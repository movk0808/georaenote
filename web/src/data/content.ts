import raw from './content.json'

// FAQ·공지·이벤트·매거진·할부 정보는 안드로이드 앱의 Content.kt 에서 내보낸 같은 내용을 씁니다.
export interface Faq { category: string; question: string; answer: string }
export interface Notice { id: number; title: string; date: string; body: string }
export interface EventItem { id: number; tag: string; title: string; subtitle: string; period: string; body: string; isQuiz: boolean }
export interface Article { id: number; category: string; title: string; date: string; summary: string; body: string }
export interface InstallmentRow { card: string; free: string; partial: string }
export interface QuizItem { question: string; options: string[]; answer: number; explain: string }

export const FAQS: Faq[] = raw.faqs
export const NOTICES: Notice[] = raw.notices
export const EVENTS: EventItem[] = raw.events
export const ARTICLES: Article[] = raw.articles
export const INSTALLMENTS: InstallmentRow[] = raw.installments
export const QUIZZES: QuizItem[] = raw.quizzes
export const GUIDE_POINTS: { title: string; body: string }[] = raw.guidePoints

export const FAQ_CATEGORIES = ['전체보기', '이용안내', '이용료/수수료', '계약/서류 관련', '결제', '취소/환불']
export const INSTALLMENT_MONTH = '11월'
export const INSTALLMENT_PERIOD = '2026.11.01 ~ 2026.11.30 · 5만원 이상'

export const SITE = {
  name: '거래노트',
  csPhone: '1600-0000',
  csHours: '평일 10:00 ~ 18:00 (점심 12:30 ~ 13:30, 주말·공휴일 휴무)',
  /** 안드로이드 APK 내려받기 주소 (GitHub Releases의 최신 파일) */
  apkUrl: 'https://github.com/movk0808/georaenote/releases/latest/download/georaenote.apk',
  repoUrl: 'https://github.com/movk0808/georaenote',
}
