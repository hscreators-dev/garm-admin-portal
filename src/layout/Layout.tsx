import { useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import Logo from '../components/Logo';
import { useToast } from '../components/Toast';
import { useRole } from '../components/RoleContext';
import { TITLES } from '../data/mockData';
import NotificationBell from './NotificationBell';

function initialsOf(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';
}

const WORKSPACE_NAV = [
  { view: 'dashboard', icon: 'grid', label: 'Dashboard' },
  { view: 'catalog', icon: 'tag', label: 'Catalog' },
  { view: 'orders', icon: 'package', label: 'Orders' },
  { view: 'manufacturers', icon: 'factory', label: 'Manufacturers' },
  { view: 'qc', icon: 'shield', label: 'Quality Control' },
  { view: 'documents', icon: 'file', label: 'Documents' },
  { view: 'payments', icon: 'card', label: 'Payments' },
  { view: 'support', icon: 'help', label: 'Support' },
];

const INSIGHTS_NAV = [
  { view: 'reports', icon: 'bar', label: 'Reports' },
  { view: 'settings', icon: 'settings', label: 'Settings' },
];

export default function Layout() {
  const { currentUser, role, allowedViews, signOut } = useRole();
  const showToast = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const currentView = location.pathname.split('/').filter(Boolean).pop() || 'dashboard';

  useEffect(() => {
    if (allowedViews.length && !allowedViews.includes(currentView)) {
      navigate(`/${allowedViews[0]}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  function handleSignOut() {
    signOut();
    showToast('Signed out.');
  }

  function renderNavItem(item: { view: string; icon: string; label: string }) {
    if (!allowedViews.includes(item.view)) return null;
    return (
      <li key={item.view} className={currentView === item.view ? 'active' : ''}>
        <NavLink to={`/${item.view}`}>
          <Icon name={item.icon} />
          <span>{item.label}</span>
        </NavLink>
      </li>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Logo size={34} /></div>
          <div>
            <div className="brand-name">Garm Admin</div>
            <div className="brand-sub">Operations Portal</div>
          </div>
        </div>

        <div className="nav-group-label">Workspace</div>
        <ul className="nav">{WORKSPACE_NAV.map(renderNavItem)}</ul>

        <div className="nav-group-label">Insights</div>
        <ul className="nav">{INSIGHTS_NAV.map(renderNavItem)}</ul>

        <div className="sidebar-footer">
          <div className="signed-in-chip">
            <div className="avatar">{initialsOf(currentUser?.name || '?')}</div>
            <div className="meta">
              <div className="name">{currentUser?.name}</div>
              <div className="role">{role}{role === 'Super Admin' ? ' · full access' : ''}</div>
            </div>
          </div>
          <button className="signout-btn" onClick={handleSignOut}><Icon name="logout" /> Sign out</button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div>
            <div className="crumb">{TITLES[currentView] || 'Dashboard'}</div>
          </div>
          <div className="topbar-search">
            <Icon name="search" />
            <input placeholder="Search orders, customers, manufacturers…" />
          </div>
          <div className="topbar-right">
            <NotificationBell />
            <button className="icon-btn" title="Refresh data" onClick={() => { showToast('Refreshing…'); setTimeout(() => window.location.reload(), 150); }}>
              <Icon name="refresh" />
            </button>
          </div>
        </header>

        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
