import { Outlet, useNavigate, useLocation, NavLink } from 'react-router-dom';
import { Menu } from 'primereact/menu';
import { Button } from 'primereact/button';
import { Avatar } from 'primereact/avatar';
import { useRef } from 'react';
import { useAuthStore } from '@/store/auth';
import { authApi } from '@/api';
import { fullName } from '@/utils/format';
import StatusBar from '@/components/StatusBar';

interface NavItem { label: string; icon: string; to: string; superOnly?: boolean; }

const NAV: NavItem[] = [
  { label: 'Dashboard',         icon: 'ph ph-house',           to: '/' },
  { label: 'Counter Sales',     icon: 'ph ph-shopping-cart',   to: '/sales' },
  { label: 'Donations',         icon: 'ph ph-fill ph-heart',   to: '/donations' },
  { label: 'Donation History',  icon: 'ph ph-list',            to: '/donations/history' },
  { label: 'Tickets',           icon: 'ph ph-ticket',          to: '/tickets' },
  { label: 'Devotees',          icon: 'ph ph-user-list',       to: '/devotees' },
  { label: 'Participation',     icon: 'ph ph-hand-heart',      to: '/participation' },
  { label: 'Events',            icon: 'ph ph-calendar',        to: '/events' },
  { label: 'Sevas',             icon: 'ph ph-gift',            to: '/sevas' },
  { label: 'Reports',           icon: 'ph ph-chart-bar',       to: '/reports' },
  { label: 'Employees',         icon: 'ph ph-users',           to: '/employees',          superOnly: true },
  { label: 'Donation Purposes', icon: 'ph ph-tag',             to: '/donation-purposes',  superOnly: true },
  { label: 'Printers',          icon: 'ph ph-printer',         to: '/printers',           superOnly: true },
  { label: 'Audit Log',         icon: 'ph ph-clock-counter-clockwise', to: '/audit',     superOnly: true },
  { label: 'Org Settings',      icon: 'ph ph-gear',            to: '/settings',           superOnly: true },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const profileMenuRef = useRef<Menu>(null);
  const { employee, refreshToken, logout } = useAuthStore();
  const isSuper = employee?.role === 'SUPER_ADMIN';

  const onLogout = async () => {
    try { if (refreshToken) await authApi.logout(refreshToken); } catch { /* ignore */ }
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex" style={{ height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={{ width: 240, background: '#fffbeb', borderRight: '1px solid #fef3c7', height: '100vh' }} className="flex flex-column">
        <div className="p-4 flex align-items-center gap-2 border-bottom-1" style={{ borderColor: '#fef3c7' }}>
          <div className="flex align-items-center justify-content-center" style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg,#b45309,#f59e0b)', color: '#fff', flex: 'none' }}>
            <i className="ph ph-flower-lotus" style={{ fontSize: 22 }} />
          </div>
          <div>
            <div className="font-bold text-lg" style={{ color: '#92400e', lineHeight: 1.1 }}>Seva ERP</div>
            <div className="text-xs" style={{ color: '#a16207' }}>Sacred Service Management</div>
          </div>
        </div>

        <nav className="flex flex-column gap-1 p-2 flex-1 overflow-auto">
          {NAV.filter((n) => !n.superOnly || isSuper).map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                `flex align-items-center gap-2 px-3 py-2 border-round no-underline transition-all transition-duration-150 ${
                  isActive ? 'bg-yellow-200 text-yellow-900 font-semibold' : 'text-700 hover:bg-yellow-100'
                }`
              }
            >
              <i className={n.icon} />
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-top-1" style={{ borderColor: '#fef3c7' }}>
          <Button
            label="Logout"
            icon="ph ph-sign-out"
            severity="secondary"
            outlined
            className="w-full"
            onClick={onLogout}
          />
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-column" style={{ background: '#fafaf9', height: '100vh', overflow: 'hidden' }}>
        {/* Top bar */}
        <header className="flex justify-content-between align-items-center px-4 py-3 bg-white border-bottom-1" style={{ borderColor: '#e5e7eb' }}>
          <div className="text-lg font-semibold text-700">
            {NAV.find((n) => n.to === location.pathname)?.label ?? 'Seva ERP'}
          </div>
          <div className="flex align-items-center gap-4">
            <StatusBar />
            <div className="flex align-items-center gap-2 cursor-pointer" onClick={(e) => profileMenuRef.current?.toggle(e)}>
              <Avatar
                label={(employee?.firstName?.[0] ?? '?').toUpperCase()}
                style={{ backgroundColor: '#fcd34d', color: '#92400e' }}
                shape="circle"
              />
              <div>
                <div className="font-semibold text-sm">{employee ? fullName(employee) : '-'}</div>
                <div className="text-xs text-500">{employee?.employeeId} · {employee?.role}</div>
              </div>
            </div>
          </div>
          <Menu
            ref={profileMenuRef}
            popup
            model={[
              { label: employee?.email ?? employee?.mobileNumber ?? '', icon: 'ph ph-user' },
              { separator: true },
              { label: 'Logout', icon: 'ph ph-sign-out', command: onLogout },
            ]}
          />
        </header>

        <div className="p-4 flex-1" style={{ overflowY: 'auto', minHeight: 0 }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
