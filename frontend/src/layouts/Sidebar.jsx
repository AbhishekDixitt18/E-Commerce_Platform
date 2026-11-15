import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  PlusCircle,
  Boxes,
  Activity,
  Server,
  X,
} from 'lucide-react';

export default function Sidebar({ isOpen, onClose }) {
  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/products', label: 'Product Management', icon: Package },
    { to: '/orders', label: 'Order Management', icon: ShoppingCart },
    { to: '/orders/new', label: 'Create Order', icon: PlusCircle },
    { to: '/inventory', label: 'Inventory Management', icon: Boxes },
    { to: '/health', label: 'System Health', icon: Activity },
  ];

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="sidebar-logo-icon">
              <Server size={18} />
            </div>
            <div>
              <div className="sidebar-title">E-Commerce</div>
              <div className="sidebar-subtitle">Cloud Platform</div>
            </div>
          </div>
          <button
            className="menu-toggle-btn"
            style={{ color: '#fff' }}
            onClick={onClose}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                onClick={onClose}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-badge">
            <span className="pulse-dot" style={{ backgroundColor: '#10b981' }} />
            <span>AWS EC2 / Nginx Active</span>
          </div>
          <div style={{ marginTop: '0.4rem', color: '#94a3b8', fontSize: '0.7rem' }}>
            ALGIONS DevOps Platform
          </div>
        </div>
      </aside>
    </>
  );
}
