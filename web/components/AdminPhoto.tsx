'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { API } from '@/lib/api'

export default function AdminPhoto({ reportId, auth }: { reportId: string; auth: string }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    let objectUrl = ''
    fetch(`${API}/api/v1/admin/reports/${reportId}/photo`, { headers: { Authorization: `Basic ${auth}` } })
      .then(async response => {
        if (!response.ok) throw new Error('사진을 불러오지 못했습니다.')
        return response.blob()
      })
      .then(blob => {
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch(cause => { if (active) setError((cause as Error).message) })
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [reportId, auth])
  if (error) return <p className="mt-3 text-sm text-red-600">{error}</p>
  if (!url) return <p className="mt-3 text-sm text-gray-500">사진을 불러오는 중...</p>
  return <Image unoptimized src={url} width={600} height={400} alt="현장 제보 사진" className="mt-4 max-h-72 w-full rounded-xl object-contain" />
}
