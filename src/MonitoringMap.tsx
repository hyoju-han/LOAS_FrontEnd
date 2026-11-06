import { useEffect, useRef, useState } from 'react'
import Map from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import XYZ from 'ol/source/XYZ'
import VectorSource from 'ol/source/Vector'
import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import Polygon from 'ol/geom/Polygon'
import GeoJSON from 'ol/format/GeoJSON'
import { fromLonLat } from 'ol/proj'
import { Fill, Stroke, Style, Circle as CircleStyle, Text } from 'ol/style'
import { defaults as defaultControls } from 'ol/control'
import 'ol/ol.css'
import districtData from './districts.json'

// VWorld legal-dong boundary representative points within the supplied extent.
const centers: Record<string, number[]> = Object.fromEntries(districtData.map((item) => [item.name, item.center]))
// User-provided P2 reference: Plus Code 8Q9923M3+2G4 (cell center).
const campusCenter = [127.053828125, 37.0325125]

type Props = { scenario: 'normal' | 'loading' | 'result'; minutes: number; district: string; zoom: number; onDistrict: (name: string) => void }
export default function MonitoringMap({ scenario, minutes, district, zoom, onDistrict }: Props) {
  const target = useRef<HTMLDivElement>(null)
  const mapRef = useRef<Map | null>(null)
  const sourceRef = useRef(new VectorSource())
  const boundaryRef = useRef(new VectorSource())
  const boundaryCache = useRef<Feature[]>([])
  const [boundaryError, setBoundaryError] = useState(false)
  const callback = useRef(onDistrict)
  const [failed, setFailed] = useState(false)
  const key = import.meta.env.VITE_VWORLD_API_KEY
  useEffect(() => { callback.current = onDistrict }, [onDistrict])

  useEffect(() => {
    if (!target.current || !key) return
    const tiles = new XYZ({
      url: `https://api.vworld.kr/req/wmts/1.0.0/${encodeURIComponent(key)}/Base/{z}/{y}/{x}.png`,
      attributions: '© <a href="https://www.vworld.kr/" target="_blank" rel="noopener noreferrer">VWorld</a>',
      maxZoom: 19,
    })
    tiles.on('tileloaderror', () => setFailed(true))
    const map = new Map({ target: target.current, layers: [new TileLayer({ source: tiles }), new VectorLayer({ source: boundaryRef.current, style: new Style({ stroke: new Stroke({ color: '#2678ad', width: 3 }), fill: new Fill({ color: 'rgba(38,120,173,0.08)' }) }) }), new VectorLayer({ source: sourceRef.current })], view: new View({ center: fromLonLat(campusCenter), zoom: 14, minZoom: 8, maxZoom: 19 }), controls: defaultControls({ zoom: false, rotate: false }) })
    map.on('singleclick', (event) => {
      const feature = map.forEachFeatureAtPixel(event.pixel, (item) => item)
      const name = feature?.get('district')
      if (typeof name === 'string') callback.current(name)
    })
    map.on('pointermove', (event) => { const element = map.getTargetElement(); if (element) element.style.cursor = map.hasFeatureAtPixel(event.pixel) ? 'pointer' : '' })
    mapRef.current = map
    const observer = new ResizeObserver(() => map.updateSize())
    observer.observe(target.current)
    return () => { observer.disconnect(); map.setTarget(undefined); map.dispose(); mapRef.current = null }
  }, [key])

  useEffect(() => {
    const controller = new AbortController()
    const view = mapRef.current?.getView()
    boundaryRef.current.clear()
    if (!view) return
    if (district === '전체 동') {
      view.animate({ center: fromLonLat(campusCenter), zoom: 14 + (zoom - 1) * 4, duration: 300 })
      return
    }
    async function selectBoundary() {
      try {
        if (!boundaryCache.current.length) {
          const response = await fetch(`${import.meta.env.BASE_URL}data/legal-dong.geojson`, { signal: controller.signal })
          if (!response.ok) throw new Error('Boundary load failed')
          const features = new GeoJSON().readFeatures(await response.json(), { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' })
          if (controller.signal.aborted) return
          boundaryCache.current = features
        }
        const feature = boundaryCache.current.find((item) => item.get('emd_kor_nm') === district)
        if (!feature) throw new Error('Boundary not found')
        feature.set('district', district)
        boundaryRef.current.addFeature(feature)
        setBoundaryError(false)
        const extent = feature.getGeometry()?.getExtent()
        if (extent) {
          view?.fit(extent, { padding: [105, 65, 90, 65], duration: 300, maxZoom: 15 })
          if (zoom > 1) view?.animate({ zoom: (view.getZoom() ?? 14) + (zoom - 1) * 4, duration: 300 })
        }
      } catch {
        if (!controller.signal.aborted) setBoundaryError(true)
      }
    }
    void selectBoundary()
    return () => controller.abort()
  }, [district, zoom])

  useEffect(() => {
    const source = sourceRef.current
    source.clear()
    if (scenario === 'result') {
      // Illustrative plume in projected meters, not calculated simulation output.
      const origin = fromLonLat(centers['고덕동'])
      const length = 600 + minutes * 75
      for (const [factor, color, border] of [[1, 'rgba(232,183,70,.23)', '#d2a547'], [.55, 'rgba(220,91,65,.26)', '#d2684d']] as const) {
        const ring = Array.from({ length: 65 }, (_, i) => {
          const angle = i / 64 * Math.PI * 2
          const along = length * factor * (1 + Math.cos(angle)) / 2
          const across = Math.sin(angle) * length * factor * .32
          return [origin[0] + along * .7 - across * .7, origin[1] - along * .7 - across * .7]
        })
        const plume = new Feature(new Polygon([ring]))
        plume.setStyle(new Style({ fill: new Fill({ color }), stroke: new Stroke({ color: border, width: 1.5, lineDash: [5, 5] }) }))
        source.addFeature(plume)
      }
    }
    for (const [name, coords] of Object.entries(centers)) {
      const incident = name === '고덕동' && scenario !== 'normal'
      const marker = new Feature({ geometry: new Point(fromLonLat(coords)), district: name })
      marker.setStyle(new Style({ image: new CircleStyle({ radius: incident ? 8 : 5, fill: new Fill({ color: incident ? '#d76650' : '#45866b' }), stroke: new Stroke({ color: '#ffffff', width: 2 }) }), text: new Text({ text: name, offsetY: -20, font: '600 12px sans-serif', fill: new Fill({ color: incident ? '#b44b38' : '#345441' }), stroke: new Stroke({ color: '#fff', width: 4 }) }) }))
      source.addFeature(marker)
    }
  }, [scenario, minutes])

  return <div className="real-map"><div ref={target} className="ol-target"/>{(!key || failed) && <div className="map-error" role="alert">{!key ? 'VWorld API 키가 설정되지 않았습니다.' : '배경지도를 불러오지 못했습니다. 네트워크와 VWorld 키의 허용 URL·인증 설정을 확인하세요.'}</div>}{boundaryError && <div className="map-error" role="alert">법정동 경계를 불러오지 못했습니다. 다른 동을 선택하거나 새로고침해 주세요.</div>}<div className="map-data-note">법정동 경계: VWorld · 확산: 예시 데이터</div></div>
}
