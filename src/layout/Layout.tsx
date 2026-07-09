import { useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import { useToast } from '../components/Toast';
import { useRole } from '../components/RoleContext';
import { TITLES, type Role } from '../data/mockData';

const WORKSPACE_NAV = [
  { view: 'dashboard', icon: 'grid', label: 'Dashboard' },
  { view: 'orders', icon: 'package', label: 'Orders' },
  { view: 'manufacturers', icon: 'factory', label: 'Manufacturers' },
  { view: 'qc', icon: 'shield', label: 'Quality Control' },
  { view: 'documents', icon: 'file', label: 'Documents' },
  { view: 'payments', icon: 'card', label: 'Payments' },
];

const INSIGHTS_NAV = [
  { view: 'reports', icon: 'bar', label: 'Reports' },
  { view: 'settings', icon: 'settings', label: 'Settings' },
];

export default function Layout() {
  const { role, setRole, allowedViews } = useRole();
  const showToast = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const currentView = location.pathname.split('/').filter(Boolean).pop() || 'dashboard';

  useEffect(() => {
    if (!allowedViews.includes(currentView)) {
      navigate(`/${allowedViews[0]}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  function handleRoleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as Role;
    setRole(next);
    showToast('Now viewing the portal as ' + next);
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
          <div className="brand-mark">G</div>
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
          <div className="role-switch">
            <label>Viewing as role</label>
            <select value={role} onChange={handleRoleChange}>
              <option>Super Admin</option>
              <option>Operations Manager</option>
              <option>QC Supervisor</option>
              <option>Finance Manager</option>
              <option>Warehouse Manager</option>
              <option>View-Only</option>
            </select>
          </div>
          <div className="user-chip">
            <div className="avatar">HM</div>
            <div>
              <div className="name">Haneef M.</div>
              <div className="role">{role}</div>
            </div>
          </div>
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
            <button className="icon-btn"><span className="dot-badge"></span><Icon name="bell" /></button>
            <button className="icon-btn" onClick={() => showToast('Nothing new to sync — everything up to date.')}>
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
