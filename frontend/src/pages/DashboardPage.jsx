import React, { useState, useEffect } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  Package,
  ShoppingCart,
  Boxes,
  Activity,
  AlertTriangle,
  ArrowRight,
  Database,
  CheckCircle2,
} from 'lucide-react';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorAlert from '../components/ErrorAlert';
import { productService } from '../services/productService';
import { orderService } from '../services/orderService';
import { healthService } from '../services/healthService';

export default function DashboardPage() {
  const { globalRefreshTrigger } = useOutletContext() || {};
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [products, setProducts] = useState([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalInventory, setTotalInventory] = useState(0);
  const [recentOrders, setRecentOrders] = useState([]);
  const [healthData, setHealthData] = useState(null);
  const [readinessData, setReadinessData] = useState(null);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Parallel fetch from actual PostgreSQL backend
      const [productsRes, healthRes, readinessRes] = await Promise.allSettled([
        productService.getProducts({ limit: 50 }),
        healthService.getHealth(),
        healthService.getReadiness(),
      ]);

      if (productsRes.status === 'fulfilled') {
        const prods = productsRes.value.products || [];
        setProducts(prods);
        setTotalProducts(productsRes.value.meta?.total || prods.length);

        const sumStock = prods.reduce((acc, p) => acc + (parseInt(p.inventory_count, 10) || 0), 0);
        setTotalInventory(sumStock);
      } else {
        throw productsRes.reason;
      }

      if (healthRes.status === 'fulfilled') {
        setHealthData(healthRes.value);
      }

      if (readinessRes.status === 'fulfilled') {
        setReadinessData(readinessRes.value);
      }

      // Load session-tracked orders
      const orders = orderService.getSessionOrders();
      setRecentOrders(orders);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [globalRefreshTrigger]);

  if (loading && !products.length) {
    return <LoadingSpinner message="Connecting to PostgreSQL backend & fetching metrics..." />;
  }

  const lowStockProducts = products.filter((p) => p.inventory_count <= 10);
  const isDbConnected = readinessData?.dependencies?.database?.status === 'CONNECTED';

  return (
    <div>
      <div className="content-header">
        <h2 className="content-title">Executive Dashboard</h2>
        <p className="content-subtitle">
          Real-time PostgreSQL-backed catalog, order lifecycle, and cloud infrastructure telemetry.
        </p>
      </div>

      {error && <ErrorAlert error={error} onRetry={loadDashboardData} />}

      {/* 4 Metric Statistic Cards */}
      <div className="stats-grid">
        <StatCard
          title="Total Products"
          value={totalProducts}
          subtext="Active catalog items"
          icon={Package}
          color="blue"
        />
        <StatCard
          title="Total Orders"
          value={recentOrders.length}
          subtext="Session orders placed"
          icon={ShoppingCart}
          color="purple"
        />
        <StatCard
          title="Total Inventory"
          value={totalInventory}
          subtext="Available units in warehouse"
          icon={Boxes}
          color="amber"
        />
        <StatCard
          title="System Status"
          value={healthData?.status === 'UP' ? 'HEALTHY' : 'CHECKING'}
          subtext={`Uptime: ${healthData?.uptimeSeconds ? `${Math.floor(healthData.uptimeSeconds / 60)}m` : '0m'}`}
          icon={Activity}
          color={healthData?.status === 'UP' ? 'green' : 'amber'}
        />
      </div>

      {/* Low Stock Alert Section */}
      {lowStockProducts.length > 0 && (
        <div className="low-stock-box">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertTriangle className="text-warning" size={24} style={{ color: '#d97706' }} />
            <div>
              <strong style={{ color: '#92400e' }}>Inventory Warning: </strong>
              <span style={{ color: '#78350f', fontSize: '0.875rem' }}>
                {lowStockProducts.length} product(s) have critical stock levels (≤ 10 units).
              </span>
            </div>
          </div>
          <Link to="/inventory" className="btn-primary" style={{ backgroundColor: '#d97706', fontSize: '0.775rem', padding: '0.35rem 0.75rem' }}>
            Inspect Inventory <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* Main 2-Column Split: Product Summary & System Health */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.5rem', marginBottom: '1.75rem' }}>
        
        {/* Product Inventory Summary */}
        <div className="dashboard-card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <h3 className="card-title">Catalog Inventory Snapshot</h3>
            <Link to="/products" style={{ color: '#2563eb', fontSize: '0.825rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              View Catalog <ArrowRight size={14} />
            </Link>
          </div>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {products.slice(0, 5).map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{p.title}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{p.sku}</div>
                    </td>
                    <td>{p.category}</td>
                    <td style={{ fontWeight: 600 }}>${parseFloat(p.price).toFixed(2)}</td>
                    <td>
                      <span style={{ fontWeight: 600, color: p.inventory_count <= 5 ? '#dc2626' : p.inventory_count <= 10 ? '#d97706' : '#16a34a' }}>
                        {p.inventory_count} units
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={p.inventory_count === 0 ? 'OUT_OF_STOCK' : p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Backend & Database Telemetry Card */}
        <div className="dashboard-card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <h3 className="card-title">Backend & Database Telemetry</h3>
            <Link to="/health" style={{ color: '#2563eb', fontSize: '0.825rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              Full Telemetry <ArrowRight size={14} />
            </Link>
          </div>
          <div className="card-body">
            <div className="metric-row">
              <span className="metric-label">API Service Status</span>
              <StatusBadge status={healthData?.status || 'UNKNOWN'} />
            </div>
            <div className="metric-row">
              <span className="metric-label">Database Engine</span>
              <span className="metric-val">PostgreSQL 16 (Alpine)</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">PostgreSQL Connectivity</span>
              <StatusBadge status={isDbConnected ? 'CONNECTED' : 'DISCONNECTED'} />
            </div>
            <div className="metric-row">
              <span className="metric-label">Database Round-trip Latency</span>
              <span className="metric-val">{readinessData?.dependencies?.database?.latencyMs ?? 0} ms</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Active Connection Pool</span>
              <span className="metric-val">
                {readinessData?.dependencies?.database?.pool?.totalCount ?? 0} total (
                {readinessData?.dependencies?.database?.pool?.idleCount ?? 0} idle,{' '}
                {readinessData?.dependencies?.database?.pool?.waitingCount ?? 0} waiting)
              </span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Node.js Version</span>
              <span className="metric-val">{readinessData?.system?.nodeVersion || 'v20.x'}</span>
            </div>
          </div>
        </div>

      </div>

      {/* Recent Orders Table */}
      <div className="dashboard-card">
        <div className="card-header">
          <div>
            <h3 className="card-title">Recent Customer Orders</h3>
            <p style={{ fontSize: '0.775rem', color: '#64748b' }}>
              Orders created during this session (synchronized with PostgreSQL).
            </p>
          </div>
          <Link to="/orders/new" className="btn-primary" style={{ fontSize: '0.825rem' }}>
            + Place New Order
          </Link>
        </div>
        {recentOrders.length === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>
            <ShoppingCart size={36} style={{ margin: '0 auto 0.75rem', color: '#94a3b8' }} />
            <p style={{ fontWeight: 600 }}>No orders placed in this session yet.</p>
            <p style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
              Use the "Create Order" page to test idempotent checkouts against the live backend.
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order Number</th>
                  <th>Customer</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Date & Time</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.slice(0, 5).map((order) => (
                  <tr key={order.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#2563eb' }}>{order.order_number || order.orderNumber}</div>
                      <div style={{ fontSize: '0.725rem', color: '#94a3b8' }}>{order.id}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{order.customer_name || order.customerName}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{order.customer_email || order.customerEmail}</div>
                    </td>
                    <td style={{ fontWeight: 600 }}>${parseFloat(order.total_amount || order.total || 0).toFixed(2)}</td>
                    <td>
                      <StatusBadge status={order.status || 'PENDING'} />
                    </td>
                    <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      {new Date(order.created_at || order.createdAt || Date.now()).toLocaleString()}
                    </td>
                    <td>
                      <Link
                        to={`/orders?lookupId=${order.id}`}
                        style={{ color: '#2563eb', fontSize: '0.8rem', fontWeight: 600 }}
                      >
                        Inspect →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
