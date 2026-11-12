import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Share, SquarePlus, X } from 'lucide-react'

/** 기기·브라우저 판별 */
export function device() {
  const ua = navigator.userAgent
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const android = /Android/.test(ua)
  const inApp = /KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line\//i.test(ua)
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
  return { ios, android, inApp, standalone }
}

const KEY = 'georaenote-ios-hint-closed'

/** 아이폰 Safari로 들어온 사람에게 '홈 화면에 추가' 방법을 한 번 보여주는 하단 안내 */
export default function InstallHint() {
  const d = device()
  const [closed, setClosed] = useState(() => {
    try { return localStorage.getItem(KEY) === '1' } catch { return false }
  })
  if (!d.ios || d.standalone || closed) return null
  const close = () => { setClosed(true); try { localStorage.setItem(KEY, '1') } catch { /* 저장이 막혀도 이번에는 닫힘 */ } }
  return (
    <div className="install-hint" role="dialog" aria-label="아이폰에 거래노트 설치하기">
      <img src={`${import.meta.env.BASE_URL}apple-touch-icon.png`} alt="" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong>아이폰에서 앱처럼 쓰기</strong>
        {d.inApp
          ? <p>지금 앱 안의 브라우저예요. 오른쪽 아래 메뉴에서 <b>Safari로 열기</b>를 누른 뒤 홈 화면에 추가하세요</p>
          : <p>아래 <Share size={14} className="inline-ic" /> 공유 버튼 → <SquarePlus size={14} className="inline-ic" /> <b>홈 화면에 추가</b>를 누르면 설치돼요</p>}
        <Link to="/install" onClick={close}>자세히 보기</Link>
      </div>
      <button aria-label="닫기" onClick={close}><X size={18} /></button>
    </div>
  )
}
