// 거래노트 웹앱 서비스 워커: 한 번 열었던 화면은 인터넷이 끊겨도 다시 열 수 있게 캐시합니다.
const CACHE = 'georaenote-v1'

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest', './icon.svg'])))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return
  // 화면(HTML)은 네트워크 우선, 나머지 파일은 캐시 우선
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => {
      const copy = res.clone()
      caches.open(CACHE).then((c) => c.put(req, copy))
      return res
    }).catch(() => caches.match(req).then((r) => r || caches.match('./index.html'))))
    return
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok) {
      const copy = res.clone()
      caches.open(CACHE).then((c) => c.put(req, copy))
    }
    return res
  })))
})
