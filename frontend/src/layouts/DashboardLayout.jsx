import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function DashboardLayout({ globalRefreshTrigger, onGlobalRefresh }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const getPageTitle = (pathname) => {
    switch (pathname) {
      case '/':
        return 'Executive Overview';
      case '/products':
        return 'Product Catalog';
      case '/orders':
        return 'Order Management';
      case '/orders/new':
        return 'Create Customer Order';
      case '/inventory':
        return 'Inventory & Stock Levels';
      case '/health':
        return 'System & Dependency Health';
      default:
        return 'E-Commerce Cloud Platform';
    }
  };

  return (
    <div className="app-container">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-wrapper">
        <Header
          pageTitle={getPageTitle(location.pathname)}
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          onRefresh={onGlobalRefresh}
        />
        <main className="page-container">
          <Outlet context={{ globalRefreshTrigger }} />
        </main>
      </div>
    </div>
  );
}
