import { useEffect, useState } from 'react'
import districts from './districts.json'

type Weather = { direction: string; degrees: number; speed: number; temperature: number; humidity: number; observedAt: string; nx: number; ny: number }
// KMA DFS Lambert conformal conic projection, 5 km grid.
function grid(lon: number, lat: number) {
  const rad = Math.PI / 180
  const re = 6371.00877 / 5
  let sn = Math.log(Math.cos(30 * rad) / Math.cos(60 * rad)) / Math.log(Math.tan(Math.PI / 4 + 60 * rad / 2) / Math.tan(Math.PI / 4 + 30 * rad / 2))
  const sf = Math.pow(Math.tan(Math.PI / 4 + 30 * rad / 2), sn) * Math.cos(30 * rad) / sn
  const ro = re * sf / Math.pow(Math.tan(Math.PI / 4 + 38 * rad / 2), sn)
  const ra = re * sf / Math.pow(Math.tan(Math.PI / 4 + lat * rad / 2), sn)
  let theta = lon * rad - 126 * rad
  if (theta > Math.PI) theta -= 2 * Math.PI
  if (theta < -Math.PI) theta += 2 * Math.PI
  sn = theta * sn
  return { nx: Math.floor(ra * Math.sin(sn) + 43 + .5), ny: Math.floor(ro - ra * Math.cos(sn) + 136 + .5) }
}
export function useWeather(district = '전체 동') {
  const coords = districts.find((item) => item.name === district)?.center ?? [127.053828125, 37.0325125]
  const { nx, ny } = grid(coords[0], coords[1])
  const [state, setState] = useState<{ data: Weather | null; loading: boolean; error: string | null }>({ data: null, loading: true, error: null })
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    queueMicrotask(() => { if (!controller.signal.aborted) setState({ data: null, loading: true, error: null }) })
    async function load() {
      try {
        // Observations normally publish after :40. Use previous hour until :45.
        const now = Date.now()
        const kst = new Date(now + 9 * 3600000)
        const lag = kst.getUTCMinutes() < 45 ? 1 : 0
        for (let attempt = 0; attempt < 3; attempt++) {
          const date = new Date(now + 9 * 3600000 - (lag + attempt) * 3600000)
          const base_date = `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}`
          const base_time = `${String(date.getUTCHours()).padStart(2, '0')}00`
          const params = new URLSearchParams({ base_date, base_time, nx: String(nx), ny: String(ny) })
          const response = await fetch(`/api/weather?${params}`, { signal: controller.signal })
          if (!response.ok) throw new Error(`기상 조회 실패 (HTTP ${response.status})`)
          const text = await response.text()
          let json
          try { json = JSON.parse(text) } catch { throw new Error('기상청 응답을 읽을 수 없습니다. API 인증·활용 신청 상태와 개발 서버 설정을 확인하세요.') }
          const header = json.response?.header
          if (header?.resultCode === '03') continue
          if (header?.resultCode !== '00') throw new Error(`기상청 오류 ${header?.resultCode ?? ''}: ${header?.resultMsg ?? '응답 확인 필요'}`)
          const items: { category: string; obsrValue: string }[] = json.response?.body?.items?.item ?? []
          const value = (category: string) => {
            const item = items.find((entry) => entry.category === category)
            if (!item || !Number.isFinite(Number(item.obsrValue)) || Number(item.obsrValue) <= -900) throw new Error('관측값이 없거나 결측 상태입니다.')
            return Number(item.obsrValue)
          }
          const degrees = value('VEC')
          const directions = ['북', '북북동', '북동', '동북동', '동', '동남동', '남동', '남남동', '남', '남남서', '남서', '서남서', '서', '서북서', '북서', '북북서']
          const data = { direction: directions[Math.round(degrees / 22.5) % 16], degrees, speed: value('WSD'), temperature: value('T1H'), humidity: value('REH'), observedAt: `${base_date.slice(0,4)}-${base_date.slice(4,6)}-${base_date.slice(6,8)} ${base_time.slice(0,2)}:00`, nx, ny }
          if (!controller.signal.aborted) setState({ data, loading: false, error: null })
          return
        }
        throw new Error('최근 3개 관측 시각에 데이터가 없습니다. 잠시 후 다시 조회하세요.')
      } catch (error) {
        if (!controller.signal.aborted) setState({ data: null, loading: false, error: error instanceof Error ? error.message : '기상 조회 실패' })
      }
    }
    void load()
    const timer = setInterval(() => setRevision((n) => n + 1), 10 * 60 * 1000)
    return () => { controller.abort(); clearInterval(timer) }
  }, [nx, ny, revision])
  return { ...state, refresh: () => setRevision((n) => n + 1) }
}
