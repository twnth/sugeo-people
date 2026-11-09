export const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? ''
export type Box = { id:string; name:string; address:string|null; districtCode:string|null; lat:number; lng:number; sourceType:'PUBLIC'|'USER'; status:string; lastVerifiedAt:string|null; lastPhotoVerifiedAt?:string|null; sourceAsOf?:string|null }
export type Report = {id:string;reportType:string;boxId:string;lat:number|string;lng:number|string;address:string;description:string;status:string;createdAt:string;hasPhoto?:boolean}
export function recentlyVerified(box:Box):boolean {
  const date = box.lastPhotoVerifiedAt ? Date.parse(box.lastPhotoVerifiedAt) : NaN
  return box.status === 'ACTIVE' && Number.isFinite(date) && Date.now()-date < 90*24*60*60*1000
}
export async function request<T>(path:string, options:RequestInit={}) : Promise<T> {
  const res=await fetch(`${API}/api/v1${path}`,{...options,credentials:'include',headers:{'Content-Type':'application/json',...options.headers}})
  if(!res.ok) { let message=`요청 실패 (${res.status})`; try { const data=await res.json(); message=data.message||data.detail||message } catch {} throw new Error(message) }
  return res.json() as Promise<T>
}
export async function uploadObservation(boxId:string, form:FormData):Promise<{id:string;status:string}> {
  const res=await fetch(`${API}/api/v1/boxes/${boxId}/observations`,{method:'POST',credentials:'include',body:form})
  if(!res.ok) { let message=`요청 실패 (${res.status})`; try { const data=await res.json(); message=data.message||message } catch {} throw new Error(message) }
  return res.json()
}
export async function uploadNewReport(form:FormData):Promise<{id:string;status:string}> {
  const res=await fetch(`${API}/api/v1/reports`,{method:'POST',credentials:'include',body:form})
  if(!res.ok) { let message=`요청 실패 (${res.status})`; try { const data=await res.json(); message=data.message||message } catch {} throw new Error(message) }
  return res.json()
}
