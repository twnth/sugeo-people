'use client'

import { useEffect, useRef, useState } from 'react'
import { type Box } from '@/lib/api'

declare global {
  interface Window { kakao?: any }
}

type Point = { lat: number; lng: number }
type UserLocation = Point & { accuracy: number }
type Bounds = { swLat: number; swLng: number; neLat: number; neLng: number }
type Props = {
  boxes?: Box[]
  onBounds?: (bounds: Bounds) => void
  onUserMove?: () => void
  onBox?: (box: Box) => void
  onPoint?: (point: Point, address: string) => void
  selectedPoint?: Point | null
  moveTo?: Point | null
  searchTerm?: string
  userLocation?: UserLocation | null
}

const key = process.env.NEXT_PUBLIC_KAKAO_MAP_JAVASCRIPT_KEY
const markerSvg = (source: Box['sourceType']) => `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 52 52"><circle cx="26" cy="26" r="22" fill="${source === 'PUBLIC' ? '#20845a' : '#2878e5'}" stroke="white" stroke-width="5"/><circle cx="26" cy="26" r="3" fill="white" fill-opacity=".9"/></svg>`

export default function KakaoMap({ boxes = [], onBounds, onUserMove, onBox, onPoint, selectedPoint, moveTo, searchTerm, userLocation }: Props) {
  const element = useRef<HTMLDivElement>(null)
  const map = useRef<any>(null)
  const clusterer = useRef<any>(null)
  const selection = useRef<any>(null)
  const accuracyCircle = useRef<any>(null)
  const currentLocation = useRef<UserLocation | null>(null)
  const updateLocationPixel = useRef<(() => void) | null>(null)
  const [locationPixel, setLocationPixel] = useState<{ x: number; y: number } | null>(null)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const callbacks = useRef({ onBounds, onUserMove, onBox, onPoint, moveTo })
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    callbacks.current = { onBounds, onUserMove, onBox, onPoint, moveTo }
  }, [onBounds, onUserMove, onBox, onPoint, moveTo])

  useEffect(() => {
    if (!key) {
      setError('카카오맵 JavaScript 키를 설정해주세요. web/.env.local의 NEXT_PUBLIC_KAKAO_MAP_JAVASCRIPT_KEY를 확인하세요.')
      return
    }

    let disposed = false
    const initialize = () => {
      if (disposed || !element.current || map.current || !window.kakao?.maps) return
      window.kakao.maps.load(() => {
        if (disposed || !element.current || map.current) return
        const maps = window.kakao!.maps
        const center = callbacks.current.moveTo || { lat: 37.5665, lng: 126.9780 }
        const instance = new maps.Map(element.current, {
          center: new maps.LatLng(center.lat, center.lng), level: 5,
        })
        map.current = instance
        clusterer.current = new maps.MarkerClusterer({ map: instance, averageCenter: true, minLevel: 6 })
        const placeLocation = () => {
          if (!currentLocation.current || !element.current) {
            setLocationPixel(null)
            return
          }
          const point = instance.getProjection().containerPointFromCoords(
            new maps.LatLng(currentLocation.current.lat, currentLocation.current.lng),
          )
          setLocationPixel({ x: point.x, y: point.y })
        }
        updateLocationPixel.current = placeLocation
        maps.event.addListener(instance, 'center_changed', placeLocation)
        maps.event.addListener(instance, 'zoom_changed', placeLocation)

        const emitBounds = () => {
          if (debounce.current) clearTimeout(debounce.current)
          debounce.current = setTimeout(() => {
            const bounds = instance.getBounds()
            const sw = bounds.getSouthWest()
            const ne = bounds.getNorthEast()
            callbacks.current.onBounds?.({
              swLat: sw.getLat(), swLng: sw.getLng(), neLat: ne.getLat(), neLng: ne.getLng(),
            })
          }, 350)
        }
        maps.event.addListener(instance, 'idle', emitBounds)
        maps.event.addListener(instance, 'dragstart', () => callbacks.current.onUserMove?.())
        maps.event.addListener(instance, 'zoom_start', () => callbacks.current.onUserMove?.())
        maps.event.addListener(instance, 'click', (event: any) => {
          if (!callbacks.current.onPoint) return
          const point = { lat: event.latLng.getLat(), lng: event.latLng.getLng() }
          new maps.services.Geocoder().coord2Address(point.lng, point.lat, (results: any[], status: string) => {
            const address = status === maps.services.Status.OK
              ? results[0]?.road_address?.address_name || results[0]?.address?.address_name
              : undefined
            callbacks.current.onPoint?.(point, address || '주소를 확인할 수 없습니다')
          })
        })
        setReady(true)
        placeLocation()
        emitBounds()
      })
    }

    if (window.kakao?.maps) {
      initialize()
    } else {
      const scriptId = 'kakao-map-sdk'
      let script = document.getElementById(scriptId) as HTMLScriptElement | null
      if (!script) {
        script = document.createElement('script')
        script.id = scriptId
        script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false&libraries=services,clusterer`
        script.async = true
        document.head.appendChild(script)
      }
      script.addEventListener('load', initialize)
      script.addEventListener('error', () => setError('카카오맵을 불러오지 못했습니다. 키와 JavaScript SDK 도메인을 확인하세요.'), { once: true })
    }
    return () => {
      disposed = true
      if (debounce.current) clearTimeout(debounce.current)
      clusterer.current?.clear()
      selection.current?.setMap(null)
      accuracyCircle.current?.setMap(null)
      updateLocationPixel.current = null
      clusterer.current = null
      map.current = null
    }
  }, [])

  useEffect(() => {
    if (!ready || !clusterer.current || !window.kakao?.maps) return
    const maps = window.kakao.maps
    clusterer.current.clear()
    const imageFor = (source: Box['sourceType']) => new maps.MarkerImage(
      `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(markerSvg(source))}`,
      new maps.Size(26, 26), { offset: new maps.Point(13, 13) },
    )
    const publicImage = imageFor('PUBLIC')
    const userImage = imageFor('USER')
    const markers = boxes.map(box => {
      const marker = new maps.Marker({ position: new maps.LatLng(box.lat, box.lng), image: box.sourceType === 'PUBLIC' ? publicImage : userImage })
      maps.event.addListener(marker, 'click', () => callbacks.current.onBox?.(box))
      return marker
    })
    clusterer.current.addMarkers(markers)
  }, [boxes, ready])

  useEffect(() => {
    if (!ready || !map.current || !window.kakao?.maps) return
    selection.current?.setMap(null)
    selection.current = selectedPoint
      ? new window.kakao.maps.Marker({ map: map.current, position: new window.kakao.maps.LatLng(selectedPoint.lat, selectedPoint.lng) })
      : null
  }, [selectedPoint, ready])

  useEffect(() => {
    if (ready && map.current && moveTo && window.kakao?.maps) {
      map.current.setCenter(new window.kakao.maps.LatLng(moveTo.lat, moveTo.lng))
    }
  }, [moveTo, ready])

  useEffect(() => {
    currentLocation.current = userLocation || null
    updateLocationPixel.current?.()
    if (!ready || !map.current || !window.kakao?.maps) return
    if (!userLocation) {
      accuracyCircle.current?.setMap(null)
      accuracyCircle.current = null
      return
    }
    const maps = window.kakao.maps
    const position = new maps.LatLng(userLocation.lat, userLocation.lng)
    const radius = Math.min(Math.max(userLocation.accuracy, 10), 1000)
    if (!accuracyCircle.current) {
      accuracyCircle.current = new maps.Circle({
        map: map.current, center: position, radius,
        strokeWeight: 1, strokeColor: '#2377e8', strokeOpacity: 0.5,
        fillColor: '#4b96ff', fillOpacity: 0.12, zIndex: 1,
      })
    } else {
      accuracyCircle.current.setPosition(position)
      accuracyCircle.current.setRadius(radius)
    }
  }, [userLocation, ready])

  useEffect(() => {
    if (!ready || !searchTerm?.trim() || !map.current || !window.kakao?.maps) return
    const maps = window.kakao.maps
    const centerOn = (result: any) => map.current?.setCenter(new maps.LatLng(Number(result.y), Number(result.x)))
    new maps.services.Geocoder().addressSearch(searchTerm, (results: any[], status: string) => {
      if (status === maps.services.Status.OK && results[0]) {
        centerOn(results[0])
      } else {
        new maps.services.Places().keywordSearch(searchTerm, (places: any[], placeStatus: string) => {
          if (placeStatus === maps.services.Status.OK && places[0]) centerOn(places[0])
        })
      }
    })
  }, [searchTerm, ready])

  if (error) return <div className="flex h-full items-center justify-center p-8 text-center text-sm text-ink">{error}</div>
  return <div className="relative h-full w-full">
    <div ref={element} id="map" aria-label="의류수거함 지도" />
    {userLocation && locationPixel && <div className="live-location-marker absolute z-10" style={{ left: locationPixel.x, top: locationPixel.y }} role="img" aria-label="내 실시간 위치">
      <span className="live-location-pulse" /><span className="live-location-dot" />
    </div>}
  </div>
}
