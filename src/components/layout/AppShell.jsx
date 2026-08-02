import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Brain, Focus, Calendar, Settings, Timer } from 'lucide-react';
import { useTimerStore, TIMER_STATES } from '../../store/useTimerStore';
import { useSettingsStore } from '../../store/useSettingsStore';

const NAV_ITEMS = [
  { to: '/',           icon: LayoutDashboard, label: 'داشبورد' },
  { to: '/brain-dump', icon: Brain,            label: 'تخلیه ذهن' },
  { to: '/focus',      icon: Focus,            label: 'تمرکز' },
  { to: '/calendar',   icon: Calendar,         label: 'تقویم' },
  { to: '/settings',   icon: Settings,         label: 'تنظیمات' },
];

// ── Bottom Nav (Mobile) ───────────────────────────────────────────────────
function BottomNav() {
  const { state, getDisplayTime } = useTimerStore();
  const isActive = state === TIMER_STATES.RUNNING || state === TIMER_STATES.PAUSED;

  return (
    <nav className="bottom-nav" role="navigation" aria-label="منوی اصلی">
      {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
        <NavLink key={to} to={to} end={to === '/'}
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          {to === '/focus' && isActive ? (
            <>
              <Timer size={20} style={{ color: '#34d399' }} />
              <span style={{ color: '#34d399', fontSize: '0.65rem' }}>{getDisplayTime()}</span>
            </>
          ) : (
            <>
              <Icon size={20} />
              <span>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

// ── Sidebar (Desktop ≥768px) ──────────────────────────────────────────────
function Sidebar() {
  const { state, getDisplayTime, focusTaskId } = useTimerStore();
  const { theme, toggleTheme } = useSettingsStore();
  const isTimerRunning = state === TIMER_STATES.RUNNING || state === TIMER_STATES.PAUSED;

  const isDark = theme === 'dark';

  return (
    <aside style={{
      width: 220, height: '100dvh', position: 'sticky', top: 0,
      background: isDark ? 'rgba(10,7,20,0.95)' : '#ede9fe',
      borderLeft: `1px solid ${isDark ? '#1a1130' : 'rgba(109,40,217,0.18)'}`,
      display: 'flex', flexDirection: 'column', padding: '24px 0',
      transition: 'background 250ms ease, border-color 250ms ease',
    }}>
      {/* Logo */}
      <div style={{ padding: '0 20px 24px', borderBottom: `1px solid ${isDark ? '#1a1130' : 'rgba(109,40,217,0.15)'}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #6d28d9, #0ea5e9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
            🎯
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: isDark ? '#e2e8f0' : '#1e1b4b' }}>ردیاب ADHD</div>
            <div style={{ fontSize: '0.7rem', color: isDark ? '#64748b' : '#5b4fa0' }}>Student Tracker</div>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px',
              borderRadius: 10, textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem',
              transition: 'all 150ms',
              background: isActive
                ? (isDark ? 'rgba(139,92,246,0.15)' : 'rgba(109,40,217,0.12)')
                : 'transparent',
              color: isActive
                ? (isDark ? '#a78bfa' : '#6d28d9')
                : (isDark ? '#64748b' : '#4c4469'),
              border: `1px solid ${isActive ? 'rgba(109,40,217,0.3)' : 'transparent'}`,
            })}>
            {to === '/focus' && isTimerRunning
              ? <><Timer size={18} color="#34d399" />{label}<span style={{ fontSize: '0.72rem', color: '#34d399', marginRight: 'auto' }}>{getDisplayTime()}</span></>
              : <><Icon size={18} />{label}</>
            }
          </NavLink>
        ))}
      </nav>

      {/* Bottom: theme toggle */}
      <div style={{ padding: '16px 10px', borderTop: `1px solid ${isDark ? '#1a1130' : 'rgba(109,40,217,0.15)'}` }}>
        <button onClick={toggleTheme}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: `1px solid ${isDark ? '#1a1130' : 'rgba(109,40,217,0.2)'}`, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', color: isDark ? '#64748b' : '#4c4469', fontSize: '0.85rem', fontWeight: 600, transition: 'all 150ms' }}>
          {theme === 'dark' ? '☀️ حالت روشن' : '🌙 حالت تاریک'}
        </button>
      </div>
    </aside>
  );
}

// ── App Shell ─────────────────────────────────────────────────────────────
export default function AppShell({ children }) {
  return (
    <div className="app-layout" dir="rtl">
      {/* Desktop sidebar */}
      <div style={{ display: 'none' }} className="sidebar-wrapper">
        <Sidebar />
      </div>
      <Sidebar />

      {/* Main content */}
      <main style={{ minWidth: 0, overflow: 'hidden' }}>
        {children}
      </main>

      {/* Mobile bottom nav */}
      <BottomNav />
    </div>
  );
}
