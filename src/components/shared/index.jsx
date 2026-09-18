import React from 'react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { DEFAULT_CATEGORIES } from '../../lib/db';
export { CategoryManager, CategoryManagerModal } from './CategoryManager';

export const CATEGORY_LABELS = {
  assignment: 'کاری / پروژه',
  work: 'کاری / پروژه',
  project: 'کاری / پروژه',
  personal: 'شخصی',
  exam: 'مهم / ددلاین',
  deadline: 'مهم / ددلاین',
  lecture: 'جلسه / رویداد',
  meeting: 'جلسه / رویداد',
  habit: 'عادت و روتین',
};

export const CATEGORY_ICONS = {
  assignment: '💼',
  work: '💼',
  project: '💼',
  personal: '⭐',
  exam: '🎯',
  deadline: '🎯',
  lecture: '📅',
  meeting: '📅',
  habit: '🔄',
};

export const TASK_CATEGORIES = DEFAULT_CATEGORIES;

export const PRIORITY_LABELS = { high: 'بالا', medium: 'متوسط', low: 'پایین' };
export const ENERGY_LABELS   = { high: 'بالا', medium: 'متوسط', low: 'پایین' };

// ── Category Badge ─────────────────────────────────────────────────────────
export function CategoryBadge({ category, onClick, style = {} }) {
  const customCategories = useSettingsStore((s) => s.customCategories) || DEFAULT_CATEGORIES;
  const normCat = category || 'personal';
  const found = customCategories.find((c) => c.value === normCat);

  const icon = found?.icon || CATEGORY_ICONS[normCat] || '📌';
  const label = found?.label || CATEGORY_LABELS[normCat] || normCat;
  const color = found?.color;

  return (
    <span
      className={`cat-badge cat-${normCat}`}
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
        ...(color ? { '--cat-color': color } : {}),
        ...style,
      }}
    >
      {icon} {label}
    </span>
  );
}

// ── Priority Dot ───────────────────────────────────────────────────────────
export function PriorityDot({ priority }) {
  return <span className={`priority-dot priority-${priority}`} title={PRIORITY_LABELS[priority]} />;
}

// ── Energy Badge ───────────────────────────────────────────────────────────
export function EnergyBadge({ level }) {
  const icons = { high: '⚡', medium: '🔆', low: '🌙' };
  return (
    <span className={`cat-badge energy-${level}`} style={{ border: '1px solid currentColor' }}>
      {icons[level]} {ENERGY_LABELS[level]}
    </span>
  );
}

// ── Generic Button ─────────────────────────────────────────────────────────
export function Button({ variant = 'primary', size = '', className = '', children, ...props }) {
  return (
    <button className={`btn btn-${variant} ${size ? `btn-${size}` : ''} ${className}`} {...props}>
      {children}
    </button>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, maxWidth = '520px' }) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content surface-glass" style={{ maxWidth }}>
        {title && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 0' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h2>
            <button onClick={onClose} className="btn btn-ghost btn-icon btn-sm" aria-label="بستن">✕</button>
          </div>
        )}
        <div style={{ padding: '16px 20px 20px' }}>{children}</div>
      </div>
    </div>
  );
}

// ── Loading Spinner ────────────────────────────────────────────────────────
export function Spinner({ size = 24, color = 'var(--color-primary-400)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ animation: 'spin-slow 1s linear infinite' }}>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2.5" strokeOpacity="0.2" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// ── Empty State ────────────────────────────────────────────────────────────
export function EmptyState({ icon = '📋', title, subtitle, action }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px', color: '#64748b' }}>
      <div style={{ fontSize: '3rem', marginBottom: '12px' }}>{icon}</div>
      <p style={{ fontSize: '1rem', fontWeight: 600, color: '#94a3b8', margin: '0 0 6px' }}>{title}</p>
      {subtitle && <p style={{ fontSize: '0.85rem', margin: '0 0 16px' }}>{subtitle}</p>}
      {action}
    </div>
  );
}

// ── Toast ──────────────────────────────────────────────────────────────────
let toastTimeout = null;
const toastListeners = new Set();

export function toast(message, type = 'success') {
  toastListeners.forEach((fn) => fn({ message, type, id: Date.now() }));
}

export function ToastContainer() {
  const [toasts, setToasts] = React.useState([]);

  React.useEffect(() => {
    const fn = (t) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 3000);
    };
    toastListeners.add(fn);
    return () => toastListeners.delete(fn);
  }, []);

  return (
    <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 999, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 240 }}>
      {toasts.map((t) => (
        <div key={t.id} className="animate-slide-up surface-glass" style={{
          padding: '10px 18px', borderRadius: 10, fontSize: '0.9rem', fontWeight: 600,
          color: t.type === 'error' ? '#fb7185' : t.type === 'warning' ? '#fbbf24' : '#34d399',
          border: `1px solid ${t.type === 'error' ? 'rgba(251,113,133,0.3)' : t.type === 'warning' ? 'rgba(251,191,36,0.3)' : 'rgba(52,211,153,0.3)'}`,
          textAlign: 'center',
        }}>
          {t.type === 'error' ? '⚠️ ' : t.type === 'warning' ? '⚡ ' : '✅ '}{t.message}
        </div>
      ))}
    </div>
  );
}
