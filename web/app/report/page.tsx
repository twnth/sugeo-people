'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import KakaoMap from '@/components/KakaoMap'
import { request, uploadNewReport, uploadObservation, type Box } from '@/lib/api'

type ReportType = 'NEW' | 'EXISTS' | 'REMOVED' | 'LOCATION_ERROR'
type Point = { lat: number; lng: number }
const labels: Record<ReportType, string> = { NEW: '새 수거함 제보', EXISTS: '여기 있어요', REMOVED: '없어졌어요', LOCATION_ERROR: '위치가 달라요' }
const defaults: Record<ReportType, string> = { NEW: '', EXISTS: '현장에서 수거함을 확인했습니다.', REMOVED: '현장에서 수거함이 보이지 않습니다.', LOCATION_ERROR: '표시된 위치와 실제 수거함 위치가 다릅니다.' }

export default function ReportPage() {
  const [boxId, setBoxId] = useState('')
  const [type, setType] = useState<ReportType>('NEW')
  const [existing, setExisting] = useState<Box | null>(null)
  const [point, setPoint] = useState<Point | null>(null)
  const [mapCenter, setMapCenter] = useState<Point | null>(null)
  const [address, setAddress] = useState('')
  const [description, setDescription] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('boxId')) return
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(position => {
      setMapCenter({ lat: position.coords.latitude, lng: position.coords.longitude })
    }, () => {}, { enableHighAccuracy: true, maximumAge: 30_000, timeout: 10_000 })
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const id = params.get('boxId')
    if (!id) return
    const value = params.get('type')
    const next: ReportType = value === 'EXISTS' || value === 'REMOVED' || value === 'LOCATION_ERROR' ? value : 'LOCATION_ERROR'
    setBoxId(id); setType(next); setDescription(defaults[next])
    request<Box>(`/boxes/${id}`).then(box => {
      setExisting(box)
      setMapCenter({ lat: box.lat, lng: box.lng })
    }).catch(cause => setError((cause as Error).message))
  }, [])

  useEffect(() => {
    if (!photo) { setPreview(''); return }
    const url = URL.createObjectURL(photo)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  const choosePhoto = (file: File | undefined) => {
    if (!file) return
    setPhoto(null)
    if (!['image/jpeg', 'image/png'].includes(file.type)) { setError('JPG 또는 PNG 사진을 선택해주세요.'); return }
    if (file.size > 5 * 1024 * 1024) { setError('사진은 5MB 이하로 선택해주세요.'); return }
    setPhoto(file); setError('')
  }

  const submit = async () => {
    if (description.trim().length < 5) { setError('설명을 5자 이상 입력해주세요.'); return }
    if ((type === 'NEW' || type === 'LOCATION_ERROR') && !point) { setError('지도에서 위치를 선택해주세요.'); return }
    if (type !== 'NEW' && (!boxId || !existing || !photo)) { setError('수거함 정보와 사진을 확인해주세요.'); return }
    setBusy(true); setError('')
    try {
      if (type === 'NEW') {
        const form = new FormData()
        form.append('reportType', 'NEW'); form.append('lat', String(point!.lat)); form.append('lng', String(point!.lng))
        form.append('address', address); form.append('description', description.trim())
        if (photo) form.append('photo', photo)
        await uploadNewReport(form)
      } else {
        const form = new FormData()
        form.append('type', type); form.append('description', description.trim()); form.append('photo', photo!)
        if (point) { form.append('lat', String(point.lat)); form.append('lng', String(point.lng)); form.append('address', address) }
        await uploadObservation(boxId, form)
      }
      setDone(true)
    } catch (cause) { setError((cause as Error).message) } finally { setBusy(false) }
  }

  const needsPoint = type === 'NEW' || type === 'LOCATION_ERROR'
  const canSubmit = !busy && description.trim().length >= 5 && (!needsPoint || !!point) && (type === 'NEW' || !!photo && !!existing)

  if (done) return <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-cream p-6 text-center">
    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-leaf text-3xl text-white" aria-hidden="true">✓</div>
    <h1 className="mt-6 text-2xl font-bold">제보가 접수됐어요</h1>
    <p className="mt-3 text-sm leading-6 text-gray-600">관리자가 현장 정보를 확인한 뒤 지도에 반영할게요.</p>
    <Link href="/" className="mt-8 rounded-xl bg-ink px-6 py-4 font-semibold text-white">지도로 돌아가기</Link>
  </main>

  return <main className="min-h-[100dvh] bg-cream text-ink">
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:h-16 sm:px-6">
        <Link href="/" aria-label="지도로 돌아가기" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-2xl hover:bg-cream">←</Link>
        <div><p className="text-xs font-medium text-leaf">현장 정보 제보</p><h1 className="text-base font-bold sm:text-lg">{labels[type]}</h1></div>
      </div>
    </header>

    <div className="mx-auto max-w-7xl px-4 pb-28 pt-5 sm:px-6 sm:pt-7 lg:pb-8">
      <div className="mb-5 lg:mb-7">
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">수거함 정보를 알려주세요</h2>
        <p className="mt-1 text-sm text-gray-600">위치와 현장 상황을 확인하고 제보를 보내주세요.</p>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(380px,0.85fr)] lg:gap-6">
        <section aria-label="수거함 위치 지도" className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm lg:sticky lg:top-6">
          <div className="relative h-[31dvh] min-h-[240px] sm:h-[38dvh] lg:h-[min(70dvh,700px)] lg:min-h-[500px]">
            <KakaoMap boxes={existing ? [existing] : []} onPoint={needsPoint ? (selected, foundAddress) => { setPoint(selected); setAddress(foundAddress) } : undefined} selectedPoint={point} moveTo={mapCenter} />
            <div className="pointer-events-none absolute left-3 top-3 max-w-[calc(100%-1.5rem)] rounded-xl bg-white/95 px-3 py-2 text-xs font-semibold shadow sm:left-4 sm:top-4 sm:text-sm">
              {needsPoint ? point ? '위치를 바꾸려면 지도를 다시 눌러주세요' : type === 'NEW' ? '지도에서 수거함 위치를 눌러주세요' : '실제 수거함 위치를 눌러주세요' : '제보할 수거함 위치'}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6" aria-label="제보 입력">
          <div className="border-b border-gray-100 pb-5">
            <div className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-leaf text-xs font-bold text-white">1</span><h3 className="font-bold">위치 확인</h3>{needsPoint && <span className="ml-auto text-xs font-semibold text-leaf">필수</span>}</div>
            <p className="mt-3 rounded-xl bg-cream px-4 py-3 text-sm leading-6">
              {needsPoint ? point ? <><span className="block font-semibold">{address || '선택한 위치'}</span><span className="text-xs text-gray-500">{point.lat.toFixed(5)}, {point.lng.toFixed(5)}</span></> : <span className="text-gray-600">지도에서 위치를 선택해주세요.</span> : existing ? <><span className="block font-semibold">{existing.name}</span><span className="text-gray-600">{existing.address || `${existing.lat.toFixed(5)}, ${existing.lng.toFixed(5)}`}</span></> : <span className="text-gray-600">수거함 정보를 불러오는 중...</span>}
            </p>
          </div>

          <div className="border-b border-gray-100 py-5">
            <div className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-leaf text-xs font-bold text-white">2</span><h3 className="font-bold">현장 사진</h3><span className="ml-auto text-xs font-semibold text-gray-500">{type === 'NEW' ? '선택' : '필수'}</span></div>
            <p className="mt-2 text-sm leading-6 text-gray-600">수거함과 주변 길이 함께 보이게 찍어주세요. 얼굴과 차량 번호는 피해주세요.</p>
            {preview ? <div className="relative mt-4 overflow-hidden rounded-xl bg-cream"><img src={preview} alt="선택한 현장 사진 미리보기" className="max-h-60 w-full object-contain" /><button type="button" onClick={() => setPhoto(null)} className="absolute right-2 top-2 rounded-lg bg-ink/90 px-3 py-2 text-xs font-semibold text-white">사진 삭제</button></div> : null}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <label className="flex min-h-12 cursor-pointer items-center justify-center rounded-xl bg-leaf px-3 text-sm font-semibold text-white focus-within:ring-2 focus-within:ring-leaf focus-within:ring-offset-2">사진 찍기<input className="sr-only" type="file" accept="image/jpeg,image/png" capture="environment" onChange={event => choosePhoto(event.target.files?.[0])} /></label>
              <label className="flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-gray-200 px-3 text-sm font-semibold focus-within:ring-2 focus-within:ring-leaf focus-within:ring-offset-2">사진 선택<input className="sr-only" type="file" accept="image/jpeg,image/png" onChange={event => choosePhoto(event.target.files?.[0])} /></label>
            </div>
            <p className="mt-2 text-xs text-gray-500">JPG 또는 PNG · 최대 5MB</p>
          </div>

          <div className="pt-5">
            <div className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-leaf text-xs font-bold text-white">3</span><label htmlFor="report-description" className="font-bold">현장 설명</label><span className="ml-auto text-xs font-semibold text-leaf">필수</span></div>
            <p className="mt-2 text-sm text-gray-600">다른 사람이 위치를 찾는 데 도움이 될 내용을 적어주세요.</p>
            <textarea id="report-description" className="mt-3 min-h-28 w-full resize-y rounded-xl border border-gray-200 p-3 text-base outline-none focus:border-leaf focus:ring-2 focus:ring-leaf/20" placeholder="예: 편의점 옆 골목 입구에 있어요 (최소 5자)" maxLength={1000} value={description} onChange={event => setDescription(event.target.value)} />
            <p className="mt-1 text-right text-xs text-gray-500">{description.trim().length}/1000자</p>
          </div>

          {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-6px_20px_rgba(0,0,0,0.06)] backdrop-blur sm:px-6 lg:static lg:mt-5 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
            <button type="button" disabled={!canSubmit} onClick={submit} className="min-h-12 w-full rounded-xl bg-leaf px-4 font-bold text-white transition-colors hover:bg-ink disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500">{busy ? '제출 중...' : '제보 제출하기'}</button>
          </div>
        </section>
      </div>
    </div>
  </main>
}
