import { ReactNode, useEffect, useState } from 'react'
import {
  ChevronDown, CupSoda, Ellipsis, Hammer, KeyRound, Package, Receipt, Store, UtensilsCrossed, LucideIcon,
} from 'lucide-react'
import { ContractStatus, ContractType, CONTRACT_STATUS_LABEL } from '../lib/model'
import { Faq } from '../data/content'

export const TYPE_ICON: Record<ContractType, LucideIcon> = {
  GOODS: Package, FOOD: UtensilsCrossed, BEVERAGE: CupSoda, RENT: Store, DEPOSIT: KeyRound,
  INTERIOR: Hammer, MAINTENANCE: Receipt, ETC: Ellipsis,
}

export function TypeBadge({ type, size = 40 }: { type: ContractType; size?: number }) {
  const Icon = TYPE_ICON[type]
  return (
    <span className="type-badge" style={{ width: size, height: size }} aria-hidden>
      <Icon size={Math.round(size * 0.45)} strokeWidth={1.75} />
    </span>
  )
}

export function StatusPill({ status }: { status: ContractStatus }) {
  const cls = status === 'APPROVED' ? 'pill-ok' : status === 'REVIEW' ? 'pill-review' : 'pill-bad'
  return <span className={`pill ${cls}`}>{CONTRACT_STATUS_LABEL[status]}</span>
}

export function Modal({ title, onClose, children, actions }: { title: string; onClose: () => void; children: ReactNode; actions?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {children}
        {actions && <div className="actions">{actions}</div>}
      </div>
    </div>
  )
}

export function ListPicker({ title, options, onPick, onClose }: { title: string; options: string[]; onPick: (v: string) => void; onClose: () => void }) {
  return (
    <Modal title={title} onClose={onClose} actions={<button className="btn btn-ghost btn-sm" onClick={onClose}>닫기</button>}>
      {options.map((o) => (
        <button key={o} className="opt" onClick={() => onPick(o)}>{o}</button>
      ))}
    </Modal>
  )
}

export function Confirm({ title, body, confirmLabel, danger, onConfirm, onClose }: {
  title: string; body: string; confirmLabel: string; danger?: boolean; onConfirm: () => void; onClose: () => void
}) {
  return (
    <Modal title={title} onClose={onClose} actions={<>
      <button className="btn btn-secondary btn-sm" onClick={onClose}>닫기</button>
      <button className="btn btn-primary btn-sm" style={danger ? { background: 'var(--danger)' } : undefined} onClick={() => { onConfirm(); onClose() }}>{confirmLabel}</button>
    </>}>
      <p className="sub" style={{ margin: 0 }}>{body}</p>
    </Modal>
  )
}

export function Spinner({ label }: { label: string }) {
  return (
    <div className="overlay-spinner" role="status">
      <div className="box"><div className="spinner" />{label}</div>
    </div>
  )
}

let toastSetter: ((v: string | null) => void) | null = null
export function toast(msg: string) { toastSetter?.(msg) }
export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => { toastSetter = setMsg; return () => { toastSetter = null } }, [])
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 2200)
    return () => clearTimeout(t)
  }, [msg])
  return msg ? <div className="toast" role="status">{msg}</div> : null
}

export function Pager({ pages, page, onPage }: { pages: number; page: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null
  return (
    <nav className="pager" aria-label="페이지">
      {Array.from({ length: pages }, (_, i) => (
        <button key={i} aria-current={i === page ? 'page' : undefined} onClick={() => onPage(i)}>{i + 1}</button>
      ))}
    </nav>
  )
}

export function FaqList({ items }: { items: Faq[] }) {
  const [open, setOpen] = useState<string | null>(null)
  if (!items.length) return <p className="empty">검색 결과가 없어요</p>
  return (
    <div className="faq-list">
      {items.map((f) => {
        const isOpen = open === f.question
        return (
          <div key={f.question} className={`faq-item${isOpen ? ' open' : ''}`}>
            <button aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : f.question)}>
              {f.question}
              <ChevronDown size={18} strokeWidth={1.75} />
            </button>
            {isOpen && <div className="answer">{f.answer}</div>}
          </div>
        )
      })}
    </div>
  )
}

export function Kv({ k, v, total, className }: { k: string; v: ReactNode; total?: boolean; className?: string }) {
  return (
    <div className={`kv${total ? ' total' : ''}${className ? ` ${className}` : ''}`}>
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  )
}
