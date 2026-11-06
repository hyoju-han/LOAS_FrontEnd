import { useState } from 'react'
import './App.css'
import MonitoringMap from './MonitoringMap'
import districtData from './districts.json'
import { useWeather } from './useWeather'
import { useIncident, type Incident } from './useIncident'

const directions = ['북', '북북동', '북동', '동북동', '동', '동남동', '남동', '남남동', '남', '남남서', '남서', '서남서', '서', '서북서', '북서', '북북서']
function App() {
  const [district, setDistrict] = useState('전체 동')
  const [search, setSearch] = useState('')
  const [zoom, setZoom] = useState(1)
  const [failedImage, setFailedImage] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const weather = useWeather(district)
  const feed = useIncident()
  const event = feed.incident
  const scenario = !event ? 'normal' : event.imageUrl ? 'result' : 'loading'
  const current = event ? { degrees: event.windDirection, speed: event.windSpeed, temperature: event.temperature, humidity: event.humidity, observedAt: event.observedAt, location: event.location } : weather.data ? { ...weather.data, location: district === '전체 동' ? '삼성전자 평택캠퍼스 중앙' : `${district} 대표 격자` } : null
  const windName = current ? directions[Math.round(current.degrees / 22.5) % 16] : '-'
  const matches = districtData.filter((item) => item.name.includes(search.trim()))
  const observation = current ? new Date(current.observedAt.includes('T') ? current.observedAt : current.observedAt.replace(' ', 'T') + '+09:00').toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false }) : '-'
  function demo(result: boolean) {
    const data: Incident = { eventId: 'DEMO-001', windDirection: 315, windSpeed: 3, observedAt: new Date().toISOString(), temperature: 18, humidity: 60, location: '삼성전자 평택캠퍼스 중앙', gasType: '예시 가스', imageUrl: result ? new URL('demo-result.svg', window.location.href).href : null }
    feed.setDemo(data)
  }
  return <div className="app">
    <div className="demo-bar"><span><b>{feed.configured ? 'SERVER' : 'DEMO'}</b>{feed.configured ? feed.connected ? '서버 이벤트 수신 연결됨' : '서버 연결 대기' : '서버 미연결 · 데모 버튼으로 수신 흐름 확인'}</span>{!feed.configured && <div className="scenario-tabs"><button onClick={() => feed.setDemo(null)}>이벤트 없음</button><button onClick={() => demo(false)}>이미지 없이 수신</button><button onClick={() => demo(true)}>이미지 포함 수신</button></div>}</div>
    <header className="header"><div className="brand-mark">L<span>↗</span></div><div><div className="eyebrow">LOAS · PYEONGTAEK</div><h1>평택시 기상·가스 확산 모니터링</h1></div><div className="header-meta"><span className="status-dot"/>{event ? '가스 이상 이벤트' : '기상 모니터링'}</div></header>
    {feed.error && <p className="feed-error" role="alert">{feed.error}</p>}
    <main><section className="map-panel" aria-label="기상 지도 및 유동해석 결과">
      <div className="toolbar"><div className="city-label">평택시 <span>PYEONGTAEK</span></div>{scenario !== 'result' ? <><form className="search" onSubmit={(e) => { e.preventDefault(); if (matches[0]) { setDistrict(matches[0].name); setSearch('') } }}><span>⌕</span><input aria-label="동 이름 검색" placeholder="동 이름 검색" value={search} onChange={(e) => setSearch(e.target.value)}/>{search && <div className="search-results">{matches.length ? matches.map((item) => <button type="button" key={item.code} onClick={() => { setDistrict(item.name); setSearch('') }}>{item.name}</button>) : <p>검색 결과가 없습니다.</p>}</div>}</form><select aria-label="조회할 동" value={district} onChange={(e) => setDistrict(e.target.value)}><option>전체 동</option>{districtData.map((item) => <option key={item.code}>{item.name}</option>)}</select></> : <span className="result-toolbar">서버에서 전달한 유동해석 이미지 · 비인터랙션 결과</span>}</div>
      <div className="map-status"><span className="status-dot"/><b>{scenario === 'result' ? '유동해석 결과' : '일반 기상'}</b><span className="divider"/>{event ? `이벤트 ${event.eventId}` : `${district} 기상 현황`}</div>
      {scenario === 'result' && event?.imageUrl ? <div className="result-image-panel">{failedImage === event.imageUrl ? <div className="image-error" role="alert"><h3>결과 이미지를 불러오지 못했습니다.</h3><p>이미지 주소의 접근 권한·유효기간·네트워크를 확인하세요.</p><button onClick={() => { setFailedImage(null); setRetry((n) => n + 1) }}>다시 불러오기</button></div> : <img key={`${event.imageUrl}-${retry}`} src={event.imageUrl} alt="서버가 전달한 가스 유동해석 결과" onError={() => setFailedImage(event.imageUrl ?? null)}/>}</div> : <div className="map"><MonitoringMap scenario="normal" minutes={0} district={district} zoom={zoom} onDistrict={setDistrict}/><div className="map-controls"><button aria-label="지도 확대" disabled={zoom >= 1.6} onClick={() => setZoom((n) => Math.min(1.6, n + .2))}>+</button><button aria-label="지도 축소" disabled={zoom <= 1} onClick={() => setZoom((n) => Math.max(1, n - .2))}>−</button><button aria-label="지도 초기화" onClick={() => { setZoom(1); setDistrict('전체 동') }}>⌖</button></div>{scenario === 'loading' && <div className="map-waiting" role="status"><div className="spinner"/><b>유동해석 결과 대기 중</b><p>메인 서버에서 시뮬레이션을 진행하고 있습니다.<br/>이미지가 도착하면 자동으로 결과 화면으로 전환됩니다.</p></div>}</div>}
      <div className="map-footer"><span>ⓘ</span>{scenario === 'result' ? '수신한 결과 이미지를 원본 비율로 표시합니다.' : scenario === 'loading' ? '예상 소요 시간 5~10분 · 서버 응답까지 대기합니다.' : '동 선택 시 해당 법정동 경계와 대표 격자의 기상을 표시합니다.'}</div>
    </section><aside>
      <div className="aside-heading"><span className="eyebrow">MONITORING STATUS</span><span className={`state-chip ${event ? 'alert' : ''}`}>{event ? '이상 감지' : '일반 기상'}</span></div>
      {event && <section className="info-section"><h2>가스 이상 감지 현황</h2><div className="incident-card"><span className="incident-icon">!</span><div><small>이벤트 ID</small><strong>{event.eventId}</strong></div></div><dl><div><dt>가스 종류</dt><dd>{event.gasType ?? '-'}</dd></div><div><dt>처리 상태</dt><dd>{scenario === 'result' ? '결과 수신 완료' : '시뮬레이션 대기'}</dd></div></dl></section>}
      <section className="info-section weather"><div className="section-title"><h2>{event ? '해석 기준 기상' : '현재 기상 상황'}</h2><span>{event ? '메인 서버 수신값' : '기상청 초단기실황'}</span></div><p className="scope">조회 지점 <b>{current?.location ?? '-'}</b></p><div className="weather-reading"><div className="wind-dial"><span>N</span><b style={{ transform: `rotate(${(current?.degrees ?? 315) - 315}deg)` }}>{current ? '↘' : '-'}</b></div><div><h3>{windName} <span>{current ? `${current.degrees}°` : '-'}</span></h3><p>{current ? current.speed.toFixed(1) : '-'} <span>m/s</span></p></div></div><div className="observation">관측 시각 <time>{observation}{current ? ' KST' : ''}</time></div><div className="weather-extra">기온 {current ? `${current.temperature}℃` : '-'} · 습도 {current ? `${current.humidity}%` : '-'}</div>{!event && <>{weather.loading && <p className="weather-extra">기상청 관측값 조회 중…</p>}{weather.error && <p className="weather-error" role="alert">{weather.error}</p>}<button className="weather-refresh" disabled={weather.loading} onClick={weather.refresh}>↻ 기상 새로고침</button></>}</section>
      {!event ? <div className="empty-state"><div>✓</div><h3>수신한 가스 이상 이벤트가 없습니다</h3><p>새 이벤트를 기다리고 있습니다.</p></div> : scenario === 'loading' ? <div className="loading-state" role="status"><div className="spinner"/><h3>시뮬레이션 계산 중</h3><p>메인 서버의 결과를 기다립니다.<br/>예상 소요 시간 <b>5~10분</b></p></div> : <div className="empty-state"><div>✓</div><h3>유동해석 결과 수신 완료</h3><p>서버의 이미지 DB 결과를 표시합니다.</p></div>}
      <div className="aside-bottom">{event?.eventId.startsWith('DEMO-') ? '데모 이벤트' : feed.configured ? '서버 연동 모드' : '서버 미연결'}<span>LOAS v0.2</span></div>
    </aside></main><footer className="page-footer"><span>LOAS <b>Local Observation & Analysis System</b></span><span>평택시 기상·가스 확산 모니터링</span></footer>
  </div>
}
export default App
