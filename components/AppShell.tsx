'use client';
import { useState, useEffect } from 'react';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';
import type { NavItem } from './Sidebar';
import type { Role } from '@/types';
import type { ReactNode } from 'react';

export type { NavItem };

interface Props {
  role: Role;
  userName: string;
  userInitials?: string;
  userBadge?: string;
  navItems: NavItem[];
  note?: string;
  children: ReactNode;
}

export function AppShell({ role, userName, userInitials, userBadge, navItems, note, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const onResize = () => { if (window.innerWidth > 900) setSidebarOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div className="app">
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar
        role={role}
        userName={userName}
        navItems={navItems}
        note={note}
        mobileOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="main">
        <div className="mobile-header">
          <button
            className="hamburger-btn"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menú de navegación"
            type="button"
          >
            <Menu size={20} />
          </button>
          <div
            className="brand-icon"
            style={{ width: 32, height: 32, fontSize: 13, borderRadius: 10, flexShrink: 0 }}
          >
            SG
          </div>
          <span className="mobile-header-title">SAGAF</span>
        </div>

        {children}
      </main>
    </div>
  );
}
