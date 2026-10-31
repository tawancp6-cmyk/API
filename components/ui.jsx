'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import Icon from './Icons';

// ---------- Toast ----------
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [list, setList] = useState([]);
  const idRef = useRef(0);
  const push = useCallback((msg, kind = 'ok') => {
    const id = ++idRef.current;
    setList((l) => [...l.slice(-3), { id, msg, kind }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 3800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {list.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            <Icon n={t.kind === 'ok' ? 'check' : 'alert'} size={16} />
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ---------- Modal ----------
export function Modal({ open, onClose, title, children, footer, wide = false }) {
  useEffect(() => {
    if (!open) return;
    const h = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', h);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', h); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-h">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="ปิด"><Icon n="x" size={16} /></button>
        </header>
        <div className="modal-b">{children}</div>
        {footer && <footer className="modal-f">{footer}</footer>}
      </div>
    </div>
  );
}

// ---------- ตัวช่วย ----------
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch {}
    ta.remove();
    return ok;
  }
}

export function CopyBtn({ text, label = 'คัดลอก', className = '', size = 15 }) {
  const toast = useToast();
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={`btn btn-ghost btn-sm ${className}`}
      onClick={async () => {
        if (await copyText(text)) { setDone(true); toast('คัดลอกแล้ว'); setTimeout(() => setDone(false), 1500); }
        else toast('คัดลอกไม่สำเร็จ', 'err');
      }}
    >
      <Icon n={done ? 'check' : 'copy'} size={size} />{label && <span>{label}</span>}
    </button>
  );
}

export function Spinner({ size = 16 }) {
  return <span className="spin" style={{ width: size, height: size }} aria-hidden="true" />;
}

export function Switch({ checked, onChange, label }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <i aria-hidden="true" />
      {label && <span>{label}</span>}
    </label>
  );
}

export const Empty = ({ icon = 'key', title, children }) => (
  <div className="empty">
    <div className="empty-ic"><Icon n={icon} size={26} /></div>
    <b>{title}</b>
    {children && <p>{children}</p>}
  </div>
);

const STATUS = {
  active: ['ok', 'ใช้งานได้'],
  lifetime: ['ok', 'ตลอดชีพ'],
  unused: ['idle', 'ยังไม่เริ่มใช้'],
  expired: ['bad', 'หมดอายุ'],
  revoked: ['bad', 'ถูกระงับ'],
};
export function StatusBadge({ status }) {
  const [tone, text] = STATUS[status] || ['idle', status];
  return <span className={`badge badge-${tone}`}><i />{text}</span>;
}
