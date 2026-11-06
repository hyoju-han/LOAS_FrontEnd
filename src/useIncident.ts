import { useEffect, useState } from 'react'

export type Incident = {
  eventId: string
  windDirection: number
  windSpeed: number
  observedAt: string
  temperature: number
  humidity: number
  location: string
  imageUrl?: string | null
  gasType?: string
}
export function parseIncident(value: unknown): Incident {
  if (!value || typeof value !== 'object') throw new Error('이벤트 데이터 형식이 올바르지 않습니다.')
  const data = value as Record<string, unknown>
  for (const key of ['eventId', 'observedAt', 'location']) if (typeof data[key] !== 'string' || !(data[key] as string).trim()) throw new Error(`${key} 필드가 필요합니다.`)
  for (const key of ['windDirection', 'windSpeed', 'temperature', 'humidity']) if (typeof data[key] !== 'number' || !Number.isFinite(data[key])) throw new Error(`${key}는 유효한 숫자여야 합니다.`)
  if ((data.windDirection as number) < 0 || (data.windDirection as number) > 360 || (data.windSpeed as number) < 0 || (data.humidity as number) < 0 || (data.humidity as number) > 100) throw new Error('기상 값의 범위가 올바르지 않습니다.')
  if (Number.isNaN(Date.parse(data.observedAt as string))) throw new Error('관측 시각 형식이 올바르지 않습니다.')
  if (data.imageUrl !== undefined && data.imageUrl !== null && data.imageUrl !== '') {
    if (typeof data.imageUrl !== 'string') throw new Error('이미지 주소 형식이 올바르지 않습니다.')
    const url = new URL(data.imageUrl)
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('이미지는 HTTP(S) 주소여야 합니다.')
  }
  return data as Incident
}
export function useIncident() {
  const [incident, setIncident] = useState<Incident | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const endpoint = import.meta.env.VITE_INCIDENT_SSE_URL
  useEffect(() => {
    if (!endpoint) return
    const source = new EventSource(endpoint, { withCredentials: true })
    source.onopen = () => { setConnected(true); setError(null) }
    source.onmessage = (message) => {
      try {
        const next = parseIncident(JSON.parse(message.data))
        setIncident((previous) => previous?.eventId === next.eventId && previous.imageUrl && !next.imageUrl ? previous : next)
        setError(null)
      } catch (cause) { setError(cause instanceof Error ? cause.message : '이벤트 수신 오류') }
    }
    source.onerror = () => { setConnected(false); setError('서버 연결이 끊겼습니다. 자동 재연결 중입니다. 마지막 수신 상태를 유지합니다.') }
    return () => source.close()
  }, [endpoint])
  return { incident, error, connected, configured: Boolean(endpoint), setDemo: setIncident }
}
