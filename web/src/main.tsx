import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Route, Routes } from 'react-router-dom'
import './styles.css'
import { AppLayout, SiteLayout } from './components/Layouts'
import { ToastHost } from './components/ui'
import Landing from './pages/site/Landing'
import { DownloadPage, FeesPage, GuidePage, InstallmentPage, TermsPage } from './pages/site/InfoPages'
import { ArticlePage, EventPage, MagazinePage, NoticePage, SupportPage } from './pages/site/BoardPages'
import LoginPage from './pages/app/Login'
import AppHome from './pages/app/AppHome'
import { ContractDetail, ContractNew } from './pages/app/Contracts'
import { HistoryPage, PayPage, TransferPage, TransferResult } from './pages/app/Transfers'
import { ChatPage, MileagePage, SettingsPage } from './pages/app/Account'

// GitHub Pages에서 새로고침해도 깨지지 않도록 해시 주소(#/...)를 씁니다.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route element={<SiteLayout />}>
          <Route index element={<Landing />} />
          <Route path="guide" element={<GuidePage />} />
          <Route path="fees" element={<FeesPage />} />
          <Route path="installment" element={<InstallmentPage />} />
          <Route path="download" element={<DownloadPage />} />
          <Route path="terms/:kind" element={<TermsPage />} />
          <Route path="support" element={<SupportPage />} />
          <Route path="notice/:id" element={<NoticePage />} />
          <Route path="event/:id" element={<EventPage />} />
          <Route path="magazine" element={<MagazinePage />} />
          <Route path="magazine/:id" element={<ArticlePage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="*" element={<Landing />} />
        </Route>
        <Route path="app" element={<AppLayout />}>
          <Route index element={<AppHome />} />
          <Route path="contracts/new" element={<ContractNew />} />
          <Route path="contracts/:id" element={<ContractDetail />} />
          <Route path="transfer/:contractId" element={<TransferPage />} />
          <Route path="pay" element={<PayPage />} />
          <Route path="transfers" element={<HistoryPage />} />
          <Route path="transfers/:id" element={<TransferResult />} />
          <Route path="mileage" element={<MileagePage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
      <ToastHost />
    </HashRouter>
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {}))
}
