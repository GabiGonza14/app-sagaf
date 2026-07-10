'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { LogOut, X } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';
import { useNavigationGuard } from '@/lib/navigation-guard';
import type { Role } from '@/types';
import type { ReactNode } from 'react';

export interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  badge?: number;
  badgeTone?: 'green' | 'amber' | 'blue';
}

interface Props {
  role: Role;
  userName: string;
  navItems: NavItem[];
  note?: string;
  mobileOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ role, userName, navItems, note, mobileOpen, onClose }: Props) {
  const path = usePathname();
  const router = useRouter();
  const { hasUnsavedChanges, requestNavigate } = useNavigationGuard();
  const [showSignOut, setShowSignOut] = useState(false);
  const prefetched = useRef(false);

  useEffect(() => {
    if (prefetched.current) return;
    prefetched.current = true;
    for (const item of navItems) {
      router.prefetch(item.href);
    }
  }, [navItems, router]);
  const roleLabel: Record<Role, string> = {
    sujeto_obligado: 'Portal del Sujeto Obligado',
    analista:        'Sistema interno UAF',
    supervisor:      'Sistema interno UAF · Supervisión',
    auditor:         'Auditor Interno',
    admin:           'Administración SAGAF',
  };

  return (
    <aside className={`sidebar${mobileOpen ? ' sidebar--open' : ''}`}>
      {onClose && (
        <button
          className="sidebar-close"
          type="button"
          onClick={onClose}
          aria-label="Cerrar menú"
        >
          <X size={18} />
        </button>
      )}

      <div className="brand">
        <div className="brand-icon">SG</div>
        <div>
          <h1>SAGAF</h1>
          <span>{roleLabel[role]}</span>
        </div>
      </div>

      <div className="side-title">Navegación</div>
      <nav className="nav">
        {navItems.map((item) => {
          const active = (() => {
            if (path === item.href) return true;
            if (item.href === '/' || !path.startsWith(item.href + '/')) return false;
            // Don't mark parent active if a more-specific nav item already matches
            return !navItems.some(
              (other) =>
                other.href !== item.href &&
                other.href.startsWith(item.href) &&
                (path === other.href || path.startsWith(other.href + '/')),
            );
          })();
          return (
            <Link
              key={item.href}
              href={item.href}
              className={active ? 'active' : ''}
              onClick={(e) => {
                if (hasUnsavedChanges && path !== item.href) {
                  e.preventDefault();
                  requestNavigate(item.href);
                } else {
                  onClose?.();
                }
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', marginRight: 4 }}>{item.icon}</span>
              {item.label}
              {item.badge ? (
                <span className={`nav-badge nav-badge--${item.badgeTone ?? 'green'}`} aria-label={`${item.badge} pendiente(s)`}>{item.badge}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-spacer" />

      <div className="side-note">
        <strong style={{ color: 'white', display: 'block', marginBottom: 4 }}>{userName}</strong>
        {note ??
          'Esta sesión está protegida por autenticación de dos factores. Todas las acciones quedan registradas en auditoría.'}
      </div>

      <div className="side-title">Sesión</div>
      <div className="nav">
        <button
          type="button"
          className="signout-btn"
          onClick={() => setShowSignOut(true)}
        >
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </div>

      <ConfirmModal
        isOpen={showSignOut}
        variant="danger"
        title="¿Cerrar sesión?"
        message="Tu sesión activa se cerrará y serás redirigido a la pantalla de inicio de sesión."
        confirmLabel="Sí, cerrar sesión"
        cancelLabel="Cancelar"
        onConfirm={() => signOut({ callbackUrl: '/login' })}
        onCancel={() => setShowSignOut(false)}
      />
    </aside>
  );
}
