# 거래노트 · 사업대금 카드결제 (체험판 v0.1.0)

소상공인이 물품대금·식자재·음료·월세 같은 사업대금을 신용카드로 결제하고, 거래처에는 계좌로 입금되게 하는 서비스의 첫 버전입니다.
한 저장소에 **안드로이드 앱**, **웹사이트 + 웹앱**, **로고**가 함께 들어 있고, 셋 다 같은 색·규칙(이용료, 마일리지)을 씁니다.

- 웹사이트·웹앱: https://movk0808.github.io/georaenote/
- 안드로이드 APK: [Releases](https://github.com/movk0808/georaenote/releases/latest) (배포용 서명)
- 아이폰: Safari에서 홈 화면에 추가하는 웹앱
- 실제 카드결제·본인인증·송금은 **모의 처리**입니다. 입력한 정보는 기기(브라우저) 안에만 저장되고 외부로 전송되지 않습니다.

<p align="center">
  <img src="brand/images/app-demo.gif" width="260" alt="안드로이드 앱 사용 장면: 가입, 계약 등록, 송금, 결제, 송금 완료" />
  &nbsp;&nbsp;
  <img src="brand/3d/hero-3d.png" width="420" alt="거래노트 3D 메인 그래픽" />
</p>

## 설치 방법

설치 안내 페이지: https://movk0808.github.io/georaenote/#/install (QR 코드와 공유 버튼 포함)

**안드로이드**
1. [APK 내려받기](https://github.com/movk0808/georaenote/releases/latest/download/georaenote.apk)
2. 내려받은 `georaenote.apk`를 눌러 설치. '출처를 알 수 없는 앱' 안내가 나오면 설정에서 허용
3. Play 프로텍트 경고가 뜨면 '세부정보 더보기 → 무시하고 설치' (Play 스토어 출시 전이라 나오는 안내)

v0.1.0을 설치한 적이 있으면 서명이 달라져서 덮어쓰기가 안 돼요. 기존 앱을 지운 뒤 설치하세요.

**아이폰**: 아이폰은 APK를 설치할 수 없어서 웹앱으로 씁니다.
1. Safari로 설치 안내 페이지를 열기(카카오톡 안에서 열렸다면 'Safari로 열기')
2. 공유 버튼 → '홈 화면에 추가' → '추가'
3. 홈 화면의 거래노트 아이콘을 누르면 주소창 없이 앱처럼 실행

정식 아이폰 앱(App Store·TestFlight)은 Mac, Xcode, Apple 개발자 계정(연 $99)이 있어야 만들 수 있어요. 그때는 이 웹앱을 Capacitor로 감싸서 iOS 앱으로 빌드하면 됩니다.

## 폴더 구성

| 폴더 | 내용 |
|---|---|
| `app/` | 안드로이드 앱 (Kotlin + Jetpack Compose, minSdk 26 / targetSdk 35) |
| `web/` | 웹사이트(소개·수수료 계산기·이용방법·고객센터·매거진)와 웹앱(`#/app`). React + Vite, PWA 설치 가능 |
| `brand/` | 로고·아이콘 원본 SVG와 PNG (Play 스토어 512px 아이콘 포함) |
| `.github/workflows/pages.yml` | `web/`이 바뀌어 main에 push되면 GitHub Pages로 자동 배포 |

## 기능

| 구분 | 안드로이드 앱 | 웹 |
|---|---|---|
| 소개 | 첫 실행 안내 4장, 홈 배너·이벤트 팝업 | 랜딩(이럴 때 쓰세요, 결제 방식, 결제 가능한 대금, 수수료 계산기, 이용 순서, FAQ), 이용방법, 수수료 안내 |
| 가입 | 약관 동의 → 통신사 선택 → 본인 정보·인증번호(체험용 번호 화면 표시) | 같음 |
| 계약 등록 | 유형 8종 → 거래처·은행·계좌·예금주(+주소) → 송금자명 → 증빙 첨부 → 등록 완료(약 10초 뒤 자동 승인) | 같음 |
| 송금 | 분할결제 여부, 바로송금 4% / 예약송금 3.5%(날짜), 이용료·청구액·적립 미리보기 | 같음 |
| 결제 | 카드사·할부 선택, 카드 최대 3장 금액 배분, 모의 승인 | 같음 |
| 결과 | 바로송금은 '송금하기'를 눌러야 입금, 예약송금은 지정일 입금, 영수증, 취소 | 같음 |
| 그 밖 | 송금 내역, 마일리지, FAQ·공지·이벤트(매일 퀴즈), 매거진, 카드 할부 정보, 고객센터 채팅, 설정 | 같음 + 앱 다운로드 페이지 |

## 계산 규칙

- 이용료: 바로송금 4%, 예약송금 3.5% (원 단위 반올림). 카드 청구액 = 송금액 + 이용료
- 마일리지: 송금 완료 시 이용료의 2% (내림). 첫 송금 완료 시 3,000M 추가. 매일 퀴즈 정답 10M
- 송금 한도: 1만 원 ~ 2,000만 원

## 색과 로고

팔레트는 **네이비 + 입금 그린**입니다([ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)의 Invoice & Billing 팔레트 기반, 화면 다듬기는 unslop 원칙 참고).

| 역할 | 값 | 쓰는 곳 |
|---|---|---|
| Navy | `#1E3A5F` | 헤더 카드, 요약 띠, 로고 바탕 |
| Primary | `#2563EB` | 버튼, 선택, 핵심 금액 |
| Paid | `#059669` | 입금 완료, 승인, 마일리지 |
| Ink / Sub / Muted | `#0F172A` / `#475569` / `#64748B` | 글자 |
| Background / Line | `#F8FAFC` / `#E4E7EB` | 바탕, 테두리 |

색을 바꿀 때는 두 곳만 고치면 됩니다.
- 앱: `app/src/main/java/kr/georaenote/app/ui/theme/Theme.kt`의 `Brand`
- 웹: `web/src/styles.css`의 `:root` 변수

### 그래픽·사진·영상

| 자료 | 만든 방법 | 위치 |
|---|---|---|
| 3D 메인 그래픽(카드·입금완료 영수증·동전) | Blender 5.2 Cycles로 렌더링, 배경 투명 | `brand/3d/hero.py`(장면 스크립트), `brand/3d/hero-3d.png` |
| 매장 사진 배너, 이벤트 동전, 매거진 썸네일 6장 | Sunra(Nano Banana Pro)로 생성 | `brand/images/`, 앱 `res/drawable-nodpi/`, 웹 `web/public/img/` |
| 앱 사용 장면 | 실제 안드로이드 화면을 녹화해 GIF·MP4로 변환 | `brand/images/app-demo.gif`, `app-demo.mp4` |

3D 그래픽을 다시 만들려면 아래처럼 실행합니다(출력 경로, 가로, 세로, 샘플 수).

```bash
"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b -P brand/3d/hero.py -- hero.png 1800 1012 160
```

로고는 아래가 톱니처럼 잘린 영수증 위에 입금 완료 체크를 올린 모양입니다. 안드로이드 런처 아이콘은 적응형 아이콘과 안드로이드 13 테마 아이콘(단색)을 모두 지원합니다(`app/src/main/res/drawable/ic_launcher_*.xml`).

## 나중에 바꿀 곳

| 바꿀 것 | 위치 |
|---|---|
| FAQ·공지·이벤트·매거진·할부 정보 | `app/.../data/Content.kt` (웹은 같은 내용을 `web/src/data/content.json`으로 씀) |
| 약관 문구(현재 초안) | `app/.../ui/screens/Auth.kt`, `web/src/pages/site/InfoPages.tsx` |
| 고객센터 번호(현재 예시 1600-0000), 웹 주소 | `Content.CS_PHONE`, `Content.WEB_URL`, `web/src/data/content.ts`의 `SITE` |
| 실제 서버·PG·본인인증 연동 | 앱 `data/Repository.kt`·`AppViewModel.pay()`·`VerifyScreen`, 웹 `web/src/lib/store.ts` |

## 빌드

```bash
./gradlew.bat assembleDebug
```

```bash
cd web && npm ci && npm run dev
```

APK는 `app/build/outputs/apk/debug/app-debug.apk`에 생깁니다. Play 스토어 출시용은 서명 키를 만든 뒤 `bundleRelease`로 `.aab`를 빌드하고, `brand/icon-512.png`를 스토어 아이콘으로 씁니다.

## 출시 전 확인할 것

- PG사 계약: 소상공인의 외부 공급업체 매입대금을 카드로 결제받아 공급업체 계좌로 지급하는 구조를 취급하는지
- 본인인증 기관(PASS 등)과 계좌 실명 조회 연동
- 약관·개인정보처리방침 정식본, 사업자 정보, FAQ의 한도·처리 시간 같은 수치
- 주류 매입대금 취급 여부
