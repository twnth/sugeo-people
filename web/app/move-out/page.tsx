'use client'

import Link from 'next/link'
import { useState } from 'react'

const districts = [
  { name: '강남구', url: 'https://clean.gangnam.go.kr/use/biwa/USEBIWA02010000.do' },
  { name: '강동구', url: 'https://biz.gangdong.go.kr/web/newportal/largeWaste/apply/step1' },
  { name: '강북구', url: 'https://www.gangbuk.go.kr/portal/lifeWaste/userWasteAplct/forInsert.do?menuNo=200292' },
  { name: '강서구', url: 'https://bbegi.com/login' },
  { name: '관악구', url: 'https://smartclean.gwanak.go.kr/online/bulky/request' },
  { name: '광진구', url: 'https://www.smartclean-gwangjin.kr/online/bulky/request' },
  { name: '구로구', url: 'https://www.guro.go.kr/www/addInfoExhaustAgree.do?key=2659' },
  { name: '금천구', url: 'https://smartclean.geumcheon.go.kr/online/bulky/request' },
  { name: '노원구', url: 'https://smartclean.nowon.kr/online/bulky/request' },
  { name: '도봉구', url: 'https://smartclean.dobong.go.kr/online/bulky/request' },
  { name: '동대문구', url: 'https://www.yeogiro24.co.kr/web/signup.html' },
  { name: '동작구', url: 'https://smartclean.dongjak.go.kr/online/bulky/request' },
  { name: '마포구', url: 'https://smartclean.mapo.go.kr/online/bulky/request' },
  { name: '서대문구', url: 'https://www.sdm.go.kr/civil/print/xpay/reg.do' },
  { name: '서초구', url: 'https://www.seocho.go.kr/site/seocho/ex/bigWaste/BigWasteUserFStart.do' },
  { name: '성동구', url: 'https://www.sd.go.kr/main/wsteExhstReqstWebForm.do?key=4180' },
  { name: '성북구', url: 'https://smartclean.sb.go.kr/online/bulky/request' },
  { name: '송파구', url: 'https://smartclean.songpa.go.kr/online/bulky/request' },
  { name: '양천구', url: 'https://smartclean.yangcheon.go.kr/online/bulky/request' },
  { name: '영등포구', url: 'https://smartclean.ydp.go.kr/online/bulky/request' },
  { name: '용산구', url: 'https://www.yongsan.go.kr/portal/lifeWaste/userWasteAplct/forInsert.do?menuNo=200674' },
  { name: '은평구', url: 'https://smartclean.ep.go.kr/online/bulky/request' },
  { name: '종로구', url: 'https://www.jongno.go.kr/waste/pc/web/order/insertAgreeForm.do' },
  { name: '중구', url: 'https://bbegi.com/login?previousUrl=orders' },
  { name: '중랑구', url: 'https://www.smartclean-jungnang.kr/online/bulky/request' },
] as const

const categories = [
  { id: 'furniture', title: '가구·생활용품', description: '장롱, 침대, 책상, 소파, 의자 등', icon: '🪑' },
  { id: 'appliance', title: '대형 폐가전', description: '냉장고, 세탁기, 에어컨, TV 등', icon: '📺' },
  { id: 'small-appliance', title: '소형 폐가전', description: '전자레인지, 청소기, 선풍기 등', icon: '🔌' },
] as const

export default function MoveOutPage() {
  const [district, setDistrict] = useState('')
  const [category, setCategory] = useState('')
  const selectedDistrict = districts.find(item => item.name === district)
  const districtUrl = selectedDistrict?.url || ''
  const isFreePickup = category === 'appliance' || category === 'small-appliance'

  return <main className="min-h-[100dvh] bg-cream px-4 pb-10">
    <header className="mx-auto flex max-w-xl items-center gap-4 py-4"><Link href="/" aria-label="지도로 돌아가기" className="text-xl">←</Link><h1 className="font-bold">이사 정리 도우미</h1></header>
    <section className="mx-auto max-w-xl rounded-3xl bg-ink p-6 text-white shadow-lg">
      <p className="text-sm text-white/70">헌옷부터 큰 짐까지, 한 번에 정리해요</p>
      <h2 className="mt-2 text-2xl font-bold">어디로 버려야 할지<br/>막막할 때</h2>
      <p className="mt-3 text-sm leading-6 text-white/80">주소지 구청과 버릴 물건을 고르면 신청 경로와 배출 순서를 안내해요.</p>
    </section>

    <section className="mx-auto mt-5 max-w-xl rounded-3xl bg-white p-5 shadow-sm">
      <h2 className="font-bold">1. 배출할 주소의 자치구</h2>
      <p className="mt-1 text-sm text-gray-500">실제 거주지 기준으로 선택해주세요.</p>
      <select value={district} onChange={event => setDistrict(event.target.value)} className="mt-3 w-full rounded-xl border border-gray-200 bg-white p-4">
        <option value="">서울 자치구 선택</option>{districts.map(item => <option key={item.name} value={item.name}>{item.name}</option>)}
      </select>
    </section>

    <section className="mx-auto mt-4 max-w-xl rounded-3xl bg-white p-5 shadow-sm">
      <h2 className="font-bold">2. 버릴 물건 종류</h2>
      <div className="mt-3 space-y-2">{categories.map(item => <button key={item.id} onClick={() => setCategory(item.id)} aria-pressed={category === item.id} className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left ${category === item.id ? 'border-leaf bg-leaf/5 ring-1 ring-leaf' : 'border-gray-200'}`}><span className="text-2xl">{item.icon}</span><span><strong className="block text-sm">{item.title}</strong><small className="mt-1 block text-gray-500">{item.description}</small></span><span className="ml-auto text-lg">{category === item.id ? '✓' : '›'}</span></button>)}</div>
    </section>

    {category && <section className="mx-auto mt-4 max-w-xl rounded-3xl bg-white p-5 shadow-sm">
      <h2 className="font-bold">3. 이렇게 배출하면 돼요</h2>
      {category === 'furniture' ? <ol className="mt-3 space-y-3 text-sm leading-6 text-gray-700"><li className="flex gap-3"><b className="text-leaf">01</b><span>해당 자치구의 대형폐기물 신고 화면에서 품목과 크기를 선택하고 수수료를 확인해요.</span></li><li className="flex gap-3"><b className="text-leaf">02</b><span>배출 날짜와 장소를 입력하고 신청·결제를 마쳐요.</span></li><li className="flex gap-3"><b className="text-leaf">03</b><span>신고필증을 붙이거나 접수번호·품목을 적어 지정한 장소에 내놓아요.</span></li></ol> : <div className="mt-3 rounded-2xl bg-blue-50 p-4 text-sm leading-6 text-blue-950"><b>신고 전에 무상 방문수거 대상인지 확인해보세요.</b><p className="mt-1">대형 폐가전은 품목과 상태에 따라 무상 방문수거가 가능하고, 소형 폐가전은 수량 등 별도 조건이 적용될 수 있어요. 대상이 아니면 자치구 신고가 필요합니다.</p></div>}
      {district && <div className="mt-5 space-y-2">
        {category === 'furniture' && <a href={districtUrl} target="_blank" rel="noreferrer" className="block rounded-2xl bg-leaf p-4 text-center font-bold text-white">{district} 대형폐기물 배출신고 ↗</a>}
        {isFreePickup && <a href="https://15990903.or.kr/" target="_blank" rel="noreferrer" className="block rounded-2xl bg-blue-600 p-4 text-center font-bold text-white">폐가전 무상수거 대상 확인 · 신청 ↗</a>}
        {isFreePickup && <a href={districtUrl} target="_blank" rel="noreferrer" className="block rounded-2xl border border-leaf p-4 text-center font-bold text-leaf">무상수거 대상이 아니면 {district} 배출신고 ↗</a>}
        <p className="text-center text-xs leading-5 text-gray-500">품목별 수수료와 배출 방법은 해당 자치구의 안내를 확인해주세요.</p>
      </div>}
      {!district && <p className="mt-4 rounded-xl bg-cream p-3 text-sm text-gray-600">먼저 배출 주소의 자치구를 선택해주세요.</p>}
    </section>}

    <section className="mx-auto mt-4 max-w-xl rounded-3xl border border-leaf/20 bg-white p-5">
      <h2 className="font-bold">헌옷도 같이 정리하기</h2><p className="mt-2 text-sm leading-6 text-gray-600">다시 입을 수 있는 옷은 의류수거함 위치를 확인하고, 이불·가방 등은 자치구 배출 기준을 살펴보세요.</p><Link href="/" className="mt-4 block rounded-xl border border-leaf p-3 text-center font-semibold text-leaf">주변 의류수거함 찾기 ↗</Link>
    </section>
    <p className="mx-auto mt-5 max-w-xl text-xs leading-5 text-gray-500">신고·결제는 해당 자치구 또는 수거 서비스 페이지에서 진행됩니다. 서울시 안내처럼 대형폐기물 품목과 수수료, 신청 절차는 자치구마다 다를 수 있습니다.</p>
  </main>
}
