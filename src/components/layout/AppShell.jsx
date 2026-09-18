import React, { useState, useEffect, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Brain, Focus, Calendar, Settings, Timer, Menu, X } from 'lucide-react';
import { useTimerStore, TIMER_STATES } from '../../store/useTimerStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { hapticSelection } from '../../lib/capacitor';

const NAV_ITEMS = [
  { to: '/',           icon: LayoutDashboard, label: 'داشبورد' },
  { to: '/brain-dump', icon: Brain,            label: 'تخلیه ذهن' },
  { to: '/focus',      icon: Focus,            label: 'تمرکز' },
  { to: '/calendar',   icon: Calendar,         label: 'تقویم' },
  { to: '/settings',   icon: Settings,         label: 'تنظیمات' },
];

const PAGE_TITLES = {
  '/':           'داشبورد',
  '/brain-dump': 'تخلیه ذهن',
  '/focus':      'تمرکز',
  '/calendar':   'تقویم',
  '/settings':   'تنظیمات',
};

// ── Custom hook: detect if viewport is desktop (≥768px) ──────────────────
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 768);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isDesktop;
}

// ── Bottom Nav (Mobile) ───────────────────────────────────────────────────
function BottomNav({ onMenuOpen }) {
  const { state, getDisplayTime } = useTimerStore();
  const isActive = state === TIMER_STATES.RUNNING || state === TIMER_STATES.PAUSED;

  return (
    <nav className="bottom-nav" role="navigation" aria-label="منوی اصلی">
      {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
        <NavLink key={to} to={to} end={to === '/'}
          onClick={() => hapticSelection()}
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

// ── Mobile Header Bar ─────────────────────────────────────────────────────
function MobileHeader({ onMenuOpen, pageTitle }) {
  const { theme } = useSettingsStore();
  const isDark = theme === 'dark';
  const { state, getDisplayTime } = useTimerStore();
  const isTimerRunning = state === TIMER_STATES.RUNNING || state === TIMER_STATES.PAUSED;

  return (
    <header className="mobile-header" style={{
      background: isDark ? 'rgba(10,7,20,0.95)' : 'rgba(245,240,255,0.95)',
      borderBottom: `1px solid ${isDark ? '#1a1130' : 'rgba(var(--accent-glow-rgb),0.15)'}`,
    }}>
      <button
        onClick={onMenuOpen}
        className="hamburger-btn"
        aria-label="باز کردن منو"
        style={{ color: isDark ? '#e2e8f0' : '#1e1b4b' }}
      >
        <Menu size={22} />
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: 'linear-gradient(135deg, var(--color-primary-700), var(--color-primary-400))',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem',
        }}>🎯</div>
        <span style={{
          fontWeight: 700, fontSize: '0.95rem',
          color: isDark ? '#e2e8f0' : '#1e1b4b',
        }}>{pageTitle}</span>
      </div>

      {isTimerRunning && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          color: '#34d399', fontSize: '0.8rem', fontWeight: 700,
        }}>
          <Timer size={14} />
          <span>{getDisplayTime()}</span>
        </div>
      )}
    </header>
  );
}

// ── Sidebar Content ───────────────────────────────────────────────────────
function SidebarContent({ onClose, isDesktop }) {
  const { state, getDisplayTime } = useTimerStore();
  const { theme, toggleTheme } = useSettingsStore();
  const isTimerRunning = state === TIMER_STATES.RUNNING || state === TIMER_STATES.PAUSED;
  const isDark = theme === 'dark';

  return (
    <>
      {/* Logo + Close button */}
      <div style={{
        padding: '0 16px 20px',
        borderBottom: `1px solid ${isDark ? '#1a1130' : 'rgba(var(--accent-glow-rgb),0.15)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, var(--color-primary-700), var(--color-primary-400))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem',
          }}>🎯</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: isDark ? '#e2e8f0' : '#1e1b4b' }}>ردیاب ADHD</div>
            <div style={{ fontSize: '0.7rem', color: isDark ? 'var(--color-primary-300)' : 'var(--color-primary-700)' }}>Student Tracker</div>
          </div>
        </div>

        {/* Close button — only shown on mobile */}
        {!isDesktop && (
          <button
            onClick={onClose}
            aria-label="بستن منو"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: isDark ? '#94a3b8' : '#4c4469',
              padding: 6, borderRadius: 8, display: 'flex', alignItems: 'center',
              transition: 'background 150ms',
            }}
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Nav links */}
      <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'}
            onClick={!isDesktop ? onClose : undefined}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
              borderRadius: 10, textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem',
              transition: 'all 150ms',
              background: isActive
                ? (isDark ? 'rgba(var(--accent-glow-rgb),0.15)' : 'rgba(var(--accent-glow-rgb),0.12)')
                : 'transparent',
              color: isActive
                ? (isDark ? 'var(--color-primary-400)' : 'var(--color-primary-700)')
                : (isDark ? 'var(--text-secondary)' : 'var(--text-secondary)'),
              border: `1px solid ${isActive ? 'rgba(var(--accent-glow-rgb),0.3)' : 'transparent'}`,
            })}>
            {to === '/focus' && isTimerRunning
              ? <><Timer size={18} color="var(--color-primary-500)" />{label}<span style={{ fontSize: '0.72rem', color: 'var(--color-primary-500)', marginRight: 'auto' }}>{getDisplayTime()}</span></>
              : <><Icon size={18} />{label}</>
            }
          </NavLink>
        ))}
      </nav>

      {/* Theme toggle */}
      <div style={{
        padding: '16px 10px',
        borderTop: `1px solid ${isDark ? '#1a1130' : 'rgba(var(--accent-glow-rgb),0.15)'}`,
      }}>
        <button onClick={toggleTheme}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderRadius: 10,
            border: `1px solid ${isDark ? '#1a1130' : 'rgba(var(--accent-glow-rgb),0.2)'}`,
            background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
            color: isDark ? '#64748b' : '#4c4469',
            fontSize: '0.85rem', fontWeight: 600, transition: 'all 150ms',
          }}>
          {theme === 'dark' ? '☀️ حالت روشن' : '🌙 حالت تاریک'}
        </button>
      </div>
    </>
  );
}

// ── Sidebar (Desktop) ─────────────────────────────────────────────────────
function DesktopSidebar() {
  const { theme } = useSettingsStore();
  const isDark = theme === 'dark';

  return (
    <aside style={{
      width: 220, height: '100dvh', position: 'sticky', top: 0,
      background: isDark ? 'var(--bg-sidebar-dark, rgba(10,7,20,0.95))' : 'var(--bg-sidebar-light, #ede9fe)',
      borderLeft: `1px solid ${isDark ? '#1a1130' : 'rgba(var(--accent-glow-rgb),0.18)'}`,
      display: 'flex', flexDirection: 'column', padding: '24px 0',
      transition: 'background 250ms ease, border-color 250ms ease',
    }}>
      <SidebarContent isDesktop={true} onClose={() => {}} />
    </aside>
  );
}

// ── Sidebar Drawer (Mobile) ───────────────────────────────────────────────
function MobileDrawer({ isOpen, onClose }) {
  const { theme } = useSettingsStore();
  const isDark = theme === 'dark';

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Overlay */}
      <div
        className={`sidebar-overlay${isOpen ? ' visible' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <aside
        className={`sidebar-drawer${isOpen ? ' open' : ''}`}
        style={{
          background: isDark ? 'var(--bg-sidebar-dark, rgba(10,7,20,0.98))' : 'var(--bg-sidebar-light, #ede9fe)',
          borderLeft: `1px solid ${isDark ? '#1a1130' : 'rgba(var(--accent-glow-rgb),0.18)'}`,
        }}
        aria-hidden={!isOpen}
        role="dialog"
        aria-label="منوی اصلی"
      >
        <SidebarContent isDesktop={false} onClose={onClose} />
      </aside>
    </>
  );
}

// ── App Shell ─────────────────────────────────────────────────────────────
export default function AppShell({ children }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isDesktop = useIsDesktop();
  const location = useLocation();

  const pageTitle = PAGE_TITLES[location.pathname] || 'ردیاب ADHD';

  // Close drawer on route change (mobile nav item click)
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Close drawer when switching to desktop
  useEffect(() => {
    if (isDesktop) setDrawerOpen(false);
  }, [isDesktop]);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  return (
    <div className="app-layout" dir="rtl">
      {/* Desktop: sticky sidebar */}
      {isDesktop && <DesktopSidebar />}

      {/* Mobile: header bar + drawer */}
      {!isDesktop && (
        <>
          <MobileHeader onMenuOpen={openDrawer} pageTitle={pageTitle} />
          <MobileDrawer isOpen={drawerOpen} onClose={closeDrawer} />
        </>
      )}

      {/* Main content */}
      <main className="app-main">
        {children}
      </main>

      {/* Mobile bottom nav */}
      {!isDesktop && <BottomNav />}
    </div>
  );
}
