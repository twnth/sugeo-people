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
    request<Box>(`/boxes/${id}`).then(setExisting).catch(cause => setError((cause as Error).message))
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

  if (done) return <main className="flex min-h-[100dvh] flex-col items-center justify-center p-8 text-center"><div className="text-5xl">✓</div><h1 className="mt-5 text-2xl font-bold">제보가 접수됐어요</h1><p className="mt-3 text-gray-600">관리자 검토 후 지도에 반영됩니다.</p><Link href="/" className="mt-8 rounded-xl bg-leaf px-6 py-4 font-bold text-white">지도로 돌아가기</Link></main>

  const needsPoint = type === 'NEW' || type === 'LOCATION_ERROR'
  return <main className="min-h-[100dvh] bg-cream">
    <header className="flex items-center gap-4 bg-white p-4"><Link href="/" aria-label="뒤로 가기" className="text-xl">←</Link><h1 className="font-bold">{labels[type]}</h1></header>
    {needsPoint ? <div className="relative h-[42dvh] min-h-[260px]"><KakaoMap boxes={existing ? [existing] : []} onPoint={(selected, foundAddress) => { setPoint(selected); setAddress(foundAddress) }} selectedPoint={point} moveTo={mapCenter} /><div className="absolute left-4 top-4 rounded-xl bg-white p-3 text-sm shadow">{type === 'NEW' ? '지도를 눌러 수거함 위치를 선택하세요' : '실제 수거함 위치를 지도에서 눌러주세요'}</div></div> : <section className="m-4 rounded-2xl bg-white p-4 shadow"><p className="font-semibold">{existing?.name || '수거함 정보를 불러오는 중...'}</p><p className="mt-1 text-sm text-gray-600">{existing?.address}</p></section>}
    <section className="safe-bottom mx-auto max-w-xl bg-white p-5 shadow-2xl">
      {needsPoint && <><p className="text-sm font-semibold">선택한 위치</p><p className="mt-1 text-sm text-gray-600">{point ? `${address} · ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}` : '아직 선택하지 않았어요'}</p></>}
      <div className="mt-4"><p className="text-sm font-semibold">현장 사진 <span className="text-gray-500">{type === 'NEW' ? '선택' : '필수'}</span></p><p className="mt-1 text-xs text-gray-600">수거함과 주변 길이 함께 보이게 찍어주세요. 얼굴과 차량 번호는 피해주세요.</p><div className="mt-3 flex gap-2"><label className="cursor-pointer rounded-xl bg-leaf px-4 py-3 text-sm font-semibold text-white">사진 찍기<input className="sr-only" type="file" accept="image/jpeg,image/png" capture="environment" onChange={event => choosePhoto(event.target.files?.[0])} /></label><label className="cursor-pointer rounded-xl border px-4 py-3 text-sm font-semibold">사진 선택<input className="sr-only" type="file" accept="image/jpeg,image/png" onChange={event => choosePhoto(event.target.files?.[0])} /></label></div>{preview && <div className="relative mt-3"><img src={preview} alt="선택한 현장 사진 미리보기" className="max-h-48 w-full rounded-xl object-cover" /><button type="button" onClick={() => setPhoto(null)} className="absolute right-2 top-2 rounded-full bg-black/70 px-3 py-1 text-sm text-white">사진 삭제</button></div>}</div>
      <textarea className="mt-4 min-h-24 w-full rounded-xl border p-3 outline-leaf" placeholder="현장 상황을 설명해주세요 (최소 5자)" maxLength={1000} value={description} onChange={event => setDescription(event.target.value)} />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <button disabled={busy || description.trim().length < 5 || needsPoint && !point || type !== 'NEW' && !photo} onClick={submit} className="mt-4 w-full rounded-xl bg-leaf p-4 font-bold text-white disabled:opacity-40">{busy ? '제출 중...' : '제출'}</button>
    </section>
  </main>
}
