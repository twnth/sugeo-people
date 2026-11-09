'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import KakaoMap from '@/components/KakaoMap'
import { API, recentlyVerified, request, type Box } from '@/lib/api'

type Point = { lat: number; lng: number }
type UserLocation = Point & { accuracy: number }
type Bounds = { swLat: number; swLng: number; neLat: number; neLng: number }
type SourceFilter = 'ALL' | 'USER' | 'PUBLIC'
const sourceOptions: { value: SourceFilter; label: string }[] = [
  { value: 'ALL', label: '전체' },
  { value: 'USER', label: '사용자 제보' },
  { value: 'PUBLIC', label: '공공자료' },
]

function distanceMeters(a: Point, b: Point) {
  const lat = (a.lat - b.lat) * 111_000
  const lng = (a.lng - b.lng) * 88_000
  return Math.hypot(lat, lng)
}

export default function Home() {
  const [boxes, setBoxes] = useState<Box[]>([])
  const [selected, setSelected] = useState<Box | null>(null)
  const [moveTo, setMoveTo] = useState<Point | null>(null)
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null)
  const [initialLocationResolved, setInitialLocationResolved] = useState(false)
  const [tracking, setTracking] = useState(false)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('ALL')
  const [loaded, setLoaded] = useState(false)
  const sourceFilterRef = useRef<SourceFilter>('ALL')
  const lastBounds = useRef<Bounds | null>(null)
  const sequence = useRef(0)
  const nearbyMode = useRef(false)
  const following = useRef(false)
  const watchId = useRef<number | null>(null)
  const locateRef = useRef<() => void>(() => {})
  const lastNearby = useRef<{ point: Point; at: number } | null>(null)
  const nearbyRequestInFlight = useRef(false)

  useEffect(() => () => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
    watchId.current = null
  }, [])

  const onBounds = useCallback(async (bounds: Bounds) => {
    lastBounds.current = bounds
    if (nearbyMode.current) return
    const id = ++sequence.current
    try {
      const params = new URLSearchParams(Object.entries(bounds).map(([key, value]) => [key, String(value)]))
      if (sourceFilterRef.current !== 'ALL') params.set('sourceType', sourceFilterRef.current)
      const rows = await request<Box[]>(`/boxes?${params}`)
      if (id === sequence.current && !nearbyMode.current) {
        setBoxes(rows)
        setLoaded(true)
        setError('')
      }
    } catch (cause) {
      if (id === sequence.current) setError((cause as Error).message)
    }
  }, [])

  const loadNearby = async (point: Point, force = false) => {
    if (nearbyRequestInFlight.current && !force) return
    nearbyRequestInFlight.current = true
    const id = ++sequence.current
    nearbyMode.current = true
    try {
      const params = new URLSearchParams({ lat: String(point.lat), lng: String(point.lng), radius: '1500', limit: '100' })
      if (sourceFilterRef.current !== 'ALL') params.set('sourceType', sourceFilterRef.current)
      const rows = await request<Box[]>(`/boxes/nearby?${params}`)
      if (id === sequence.current && nearbyMode.current) {
        setBoxes(rows)
        setLoaded(true)
        setError('')
        if (!lastNearby.current) setMessage(`주변 수거함 ${rows.length}개를 찾았습니다.`)
        lastNearby.current = { point, at: Date.now() }
      }
    } catch (cause) {
      if (id === sequence.current) {
        nearbyMode.current = false
        setError((cause as Error).message)
      }
    } finally {
      nearbyRequestInFlight.current = false
    }
  }

  const locate = () => {
    if (!navigator.geolocation) {
      setError('이 기기에서 위치 정보를 사용할 수 없습니다.')
      setInitialLocationResolved(true)
      return
    }
    setError('')
    following.current = true
    nearbyMode.current = true
    if (watchId.current !== null) {
      if (userLocation) {
        setMoveTo({ lat: userLocation.lat, lng: userLocation.lng })
        lastNearby.current = null
        void loadNearby(userLocation)
      }
      return
    }
    setTracking(true)
    setMessage('현재 위치를 찾는 중입니다.')
    watchId.current = navigator.geolocation.watchPosition(position => {
      const point = { lat: position.coords.latitude, lng: position.coords.longitude }
      const accuracy = Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : 1000
      setUserLocation({ ...point, accuracy })
      setInitialLocationResolved(true)
      setMessage('')
      if (following.current) {
        setMoveTo(point)
        const previous = lastNearby.current
        if (!previous || (distanceMeters(point, previous.point) >= 100 && Date.now() - previous.at >= 15_000)) {
          void loadNearby(point)
        }
      }
    }, () => {
      setTracking(false)
      setUserLocation(null)
      setInitialLocationResolved(true)
      setMessage('')
      setError('위치 권한과 기기의 위치 설정을 확인해주세요.')
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
      watchId.current = null
      following.current = false
      nearbyMode.current = false
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 })
  }

  useEffect(() => {
    locateRef.current = locate
  })

  useEffect(() => {
    locateRef.current()
  }, [])

  const searchAddress = () => {
    following.current = false
    nearbyMode.current = false
    setQuery(search)
  }

  const changeSource = (value: SourceFilter) => {
    if (value === sourceFilterRef.current) return
    sequence.current += 1
    sourceFilterRef.current = value
    setSourceFilter(value)
    setSelected(null)
    setLoaded(false)
    setBoxes([])
    lastNearby.current = null
    if (nearbyMode.current && userLocation) void loadNearby(userLocation, true)
    else if (lastBounds.current) void onBounds(lastBounds.current)
  }

  // Keep the visible result correct even while an older API process ignores sourceType.
  const visibleBoxes = sourceFilter === 'ALL'
    ? boxes
    : boxes.filter(box => box.sourceType === sourceFilter)

  return <main className="relative h-[100dvh] overflow-hidden bg-cream">
    {initialLocationResolved
      ? <KakaoMap boxes={visibleBoxes} onBounds={onBounds} onUserMove={() => { following.current = false; nearbyMode.current = false }} onBox={setSelected} moveTo={moveTo} userLocation={userLocation} searchTerm={query} />
      : <div className="flex h-full items-center justify-center text-sm text-ink">내 위치를 확인하는 중...</div>}
    <div className="absolute left-4 right-4 top-4 z-10 mx-auto max-w-xl">
      <div className="flex items-center gap-2 rounded-2xl bg-white p-2 shadow-xl">
        <div className="pl-2 text-xl">♻</div>
        <input aria-label="주소 검색" placeholder="동네나 주소 검색" className="min-w-0 flex-1 p-2 outline-none" value={search} onChange={event => setSearch(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') searchAddress() }} />
        <button onClick={searchAddress} className="rounded-xl bg-leaf px-4 py-2 font-semibold text-white">검색</button>
      </div>
      {error && <p className="mt-2 rounded-xl bg-white p-3 text-sm text-red-600 shadow">{error}</p>}
      {message && <p className="mt-2 rounded-xl bg-white p-3 text-sm shadow" onClick={() => setMessage('')}>{message}</p>}
      <div className="mt-2 flex w-fit max-w-full gap-1 rounded-2xl bg-white/95 p-1 shadow" role="group" aria-label="수거함 위치 출처 선택">
        {sourceOptions.map(option => <button key={option.value} type="button" aria-pressed={sourceFilter === option.value} onClick={() => changeSource(option.value)} className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors sm:text-sm ${sourceFilter === option.value ? 'bg-ink text-white' : 'text-ink hover:bg-cream'}`}>{option.label}</button>)}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-white/95 px-3 py-2 text-xs text-ink shadow">
        {sourceFilter !== 'USER' && <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#20845a]" />공공자료</span>}
        {sourceFilter !== 'PUBLIC' && <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#2878e5]" />사용자 제보</span>}
        {sourceFilter === 'PUBLIC' && <span>공공자료 좌표는 실제 설치 위치와 다를 수 있어요</span>}
        {sourceFilter === 'USER' && <span>관리자가 승인한 신규 위치 제보만 표시해요</span>}
        {loaded && <span className="font-semibold">{visibleBoxes.length}곳</span>}
      </div>
      <Link href="/move-out" className="mt-2 inline-flex items-center gap-2 rounded-xl bg-ink px-3 py-2 text-xs font-semibold text-white shadow">📦 이사 정리 · 대형폐기물 배출 안내</Link>
      {loaded && visibleBoxes.length === 0 && !error && <p className="mt-2 rounded-2xl bg-white/95 p-4 text-center text-sm shadow">{sourceFilter === 'USER' ? '이 주변에는 승인된 신규 위치 제보가 아직 없어요. 공공자료도 확인해보세요.' : '현재 조회 범위에 표시할 수거함이 없어요.'}</p>}
    </div>
    <div className="absolute bottom-6 left-4 right-4 z-10 mx-auto flex max-w-xl items-end justify-between">
      <button onClick={locate} className="flex items-center gap-2 rounded-full bg-white px-5 py-4 font-semibold shadow-lg">
        {tracking && userLocation && <span className="live-button-dot" aria-hidden="true" />}
        <span>{tracking ? (userLocation ? '내 위치 · 실시간' : '위치 찾는 중') : '◎ 내 위치'}</span>
      </button>
      <Link href="/report" className="rounded-full bg-ink px-6 py-4 font-semibold text-white shadow-lg">＋ 수거함 제보</Link>
    </div>
    {selected && <div className="absolute inset-0 z-20 flex items-end bg-black/20" onClick={() => setSelected(null)}>
      <section onClick={event => event.stopPropagation()} className="safe-bottom max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl">
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-gray-300" />
        <div className="mb-2 flex items-center justify-between"><h2 className="text-xl font-bold">{selected.name}</h2><button onClick={() => setSelected(null)} aria-label="닫기">✕</button></div>
        <p className="text-sm text-gray-600">{selected.address || '주소 정보 없음'}<br />{selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}</p>
        <div className="my-4 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-cream px-3 py-1">{selected.sourceType === 'PUBLIC' ? '공공자료 기반 위치' : '관리자 승인 사용자 제보 위치'}</span><span className="rounded-full bg-cream px-3 py-1">{recentlyVerified(selected) ? '최근 사진 확인됨' : selected.lastPhotoVerifiedAt ? '사진 확인 오래됨' : '사진 확인 전'}</span></div>
        {selected.sourceType === 'PUBLIC' && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">표시된 곳은 공공데이터의 좌표예요. 건물 안에 수거함이 있다는 뜻은 아니며, 실제 설치 위치는 현장에서 확인해야 해요.{selected.sourceAsOf && <span className="mt-1 block text-xs">자료 기준일: {selected.sourceAsOf}</span>}</p>}
        {selected.lastPhotoVerifiedAt && <><p className="mt-3 text-sm text-gray-600">마지막 사진 확인: {new Date(selected.lastPhotoVerifiedAt).toLocaleDateString('ko-KR')}</p><Image unoptimized width={600} height={320} className="mt-3 max-h-44 w-full rounded-xl object-cover" src={`${API}/api/v1/boxes/${selected.id}/photo`} alt="관리자가 승인한 수거함 현장 사진" /></>}
        <div className="mt-5 grid grid-cols-2 gap-2"><Link href={`/report?boxId=${selected.id}&type=EXISTS`} className="rounded-xl bg-leaf p-3 text-center font-bold text-white">여기 있어요</Link><Link href={`/report?boxId=${selected.id}&type=REMOVED`} className="rounded-xl bg-cream p-3 text-center font-bold">없어졌어요</Link></div>
        <Link href={`/report?boxId=${selected.id}&type=LOCATION_ERROR`} className="mt-3 block rounded-xl border p-3 text-center font-semibold">위치가 달라요 · 사진 제보</Link>
        <a className="mt-3 block rounded-xl border p-3 text-center font-semibold" href={`https://map.kakao.com/link/to/${encodeURIComponent(selected.name)},${selected.lat},${selected.lng}`}>카카오맵 길찾기 ↗</a>
      </section>
    </div>}
  </main>
}
