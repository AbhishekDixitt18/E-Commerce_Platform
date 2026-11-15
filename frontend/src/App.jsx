import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import DashboardPage from './pages/DashboardPage';
import ProductsPage from './pages/ProductsPage';
import OrdersPage from './pages/OrdersPage';
import CreateOrderPage from './pages/CreateOrderPage';
import InventoryPage from './pages/InventoryPage';
import SystemHealthPage from './pages/SystemHealthPage';

export default function App() {
  const [globalRefreshTrigger, setGlobalRefreshTrigger] = useState(0);

  const handleGlobalRefresh = () => {
    setGlobalRefreshTrigger((prev) => prev + 1);
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <DashboardLayout
              globalRefreshTrigger={globalRefreshTrigger}
              onGlobalRefresh={handleGlobalRefresh}
            />
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="orders/new" element={<CreateOrderPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="health" element={<SystemHealthPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
