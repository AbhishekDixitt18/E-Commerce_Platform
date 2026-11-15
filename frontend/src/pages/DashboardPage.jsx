import React, { useState, useEffect } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  Package,
  ShoppingCart,
  Boxes,
  Activity,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Server,
  Database,
} from 'lucide-react';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorAlert from '../components/ErrorAlert';
import { productService } from '../services/productService';
import { orderService } from '../services/orderService';
import { healthService } from '../services/healthService';
import { formatINR, formatIndianNumber, formatDate } from '../utils/formatters';

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
      // Parallel fetch from live PostgreSQL backend
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

      // Load session-placed orders from real backend checkouts
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
    return <LoadingSpinner message="Connecting to PostgreSQL backend & fetching live metrics..." />;
  }

  const lowStockProducts = products.filter((p) => p.inventory_count <= 10);
  const isDbConnected = readinessData?.dependencies?.database?.status === 'CONNECTED';

  // Calculate cumulative order revenue from live completed orders
  const totalOrderValue = recentOrders.reduce((sum, ord) => {
    const val = parseFloat(ord.total_amount || ord.total || 0);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  return (
    <div>
      <div className="content-header">
        <h2 className="content-title">Platform Overview</h2>
        <p className="content-subtitle">
          Real-time PostgreSQL catalog metrics, order history, and cloud infrastructure telemetry.
        </p>
      </div>

      {error && <ErrorAlert error={error} onRetry={loadDashboardData} />}

      {/* Top 4 Summary Cards */}
      <div className="stats-grid">
        <StatCard
          title="Total Products"
          value={formatIndianNumber(totalProducts)}
          subtext="Active catalog items"
          icon={Package}
          color="blue"
        />
        <StatCard
          title="Total Orders"
          value={formatIndianNumber(recentOrders.length)}
          subtext="Orders processed"
          icon={ShoppingCart}
          color="purple"
        />
        <StatCard
          title="Total Available Stock"
          value={formatIndianNumber(totalInventory)}
          subtext="Units available in warehouse"
          icon={Boxes}
          color="amber"
        />
        <StatCard
          title="Total Order Value"
          value={formatINR(totalOrderValue)}
          subtext={recentOrders.length > 0 ? `Across ${recentOrders.length} processed order(s)` : 'No orders in current session'}
          icon={TrendingUp}
          color="green"
        />
      </div>

      {/* Low Stock Warning Banner */}
      {lowStockProducts.length > 0 && (
        <div className="low-stock-box">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <AlertTriangle size={20} style={{ color: '#d97706', flexShrink: 0 }} />
            <div>
              <strong style={{ color: '#92400e', fontSize: '0.875rem' }}>Low Stock Notice: </strong>
              <span style={{ color: '#78350f', fontSize: '0.85rem' }}>
                {lowStockProducts.length} product(s) have low warehouse inventory (≤ 10 units remaining).
              </span>
            </div>
          </div>
          <Link
            to="/inventory"
            className="btn-primary"
            style={{ backgroundColor: '#d97706', fontSize: '0.75rem', padding: '0.35rem 0.7rem' }}
          >
            Review Stock <ArrowRight size={13} />
          </Link>
        </div>
      )}

      {/* 2-Column Split: Catalog Overview & System Health */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
        
        {/* Catalog Inventory Snapshot */}
        <div className="dashboard-card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <h3 className="card-title">Catalog Inventory Overview</h3>
            <Link
              to="/products"
              style={{ color: '#2563eb', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}
            >
              Full Catalog <ArrowRight size={13} />
            </Link>
          </div>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>Category</th>
                  <th>Price (INR)</th>
                  <th>Stock</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {products.slice(0, 5).map((p) => {
                  const stock = parseInt(p.inventory_count, 10) || 0;
                  const isLow = stock <= 10 && stock > 0;
                  const isOut = stock === 0;

                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{p.name || p.title}</div>
                        <div style={{ fontSize: '0.725rem', color: '#64748b' }}>{p.sku}</div>
                      </td>
                      <td>{p.category}</td>
                      <td className="price-inr">{formatINR(p.price)}</td>
                      <td>
                        <span
                          style={{
                            fontWeight: 600,
                            color: isOut ? '#dc2626' : isLow ? '#d97706' : '#15803d',
                          }}
                        >
                          {formatIndianNumber(stock)} units
                        </span>
                      </td>
                      <td>
                        <StatusBadge status={isOut ? 'OUT_OF_STOCK' : isLow ? 'LOW_STOCK' : p.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Backend & Database Telemetry Card */}
        <div className="dashboard-card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <h3 className="card-title">System Health & Telemetry</h3>
            <Link
              to="/health"
              style={{ color: '#2563eb', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}
            >
              Diagnostics <ArrowRight size={13} />
            </Link>
          </div>
          <div className="card-body">
            <div className="metric-row">
              <span className="metric-label">API Service Status</span>
              <StatusBadge status={healthData?.status === 'UP' ? 'HEALTHY' : 'CHECKING'} />
            </div>
            <div className="metric-row">
              <span className="metric-label">Database Engine</span>
              <span className="metric-val">PostgreSQL 16</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Database Connectivity</span>
              <StatusBadge status={isDbConnected ? 'CONNECTED' : 'DISCONNECTED'} />
            </div>
            <div className="metric-row">
              <span className="metric-label">Database Response Time</span>
              <span className="metric-val">{readinessData?.dependencies?.database?.latencyMs ?? 0} ms</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Application Uptime</span>
              <span className="metric-val">
                {healthData?.uptimeSeconds ? `${Math.floor(healthData.uptimeSeconds / 60)} minutes (${healthData.uptimeSeconds}s)` : '0s'}
              </span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Node.js Engine</span>
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
            <p style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Orders created during this session (synchronized with PostgreSQL).
            </p>
          </div>
          <Link to="/orders/new" className="btn-primary" style={{ fontSize: '0.8rem' }}>
            + Create Order
          </Link>
        </div>
        {recentOrders.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
            <ShoppingCart size={32} style={{ margin: '0 auto 0.5rem', color: '#94a3b8' }} />
            <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>No orders placed in this session yet.</p>
            <p style={{ fontSize: '0.775rem', marginTop: '0.2rem' }}>
              Use the "Create Order" page to submit new transactions with Idempotency protection.
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order Number</th>
                  <th>Customer Name & Email</th>
                  <th>Total Amount (INR)</th>
                  <th>Status</th>
                  <th>Order Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.slice(0, 5).map((order) => (
                  <tr key={order.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#2563eb' }}>{order.order_number || order.orderNumber}</div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{order.id}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{order.customer_name || order.customerName}</div>
                      <div style={{ fontSize: '0.725rem', color: '#64748b' }}>{order.customer_email || order.customerEmail}</div>
                    </td>
                    <td className="price-inr">
                      {formatINR(order.total_amount || order.total || 0)}
                    </td>
                    <td>
                      <StatusBadge status={order.status || 'PENDING'} />
                    </td>
                    <td style={{ fontSize: '0.775rem', color: '#64748b' }}>
                      {formatDate(order.created_at || order.createdAt || Date.now())}
                    </td>
                    <td>
                      <Link
                        to={`/orders?lookupId=${order.id}`}
                        style={{ color: '#2563eb', fontSize: '0.775rem', fontWeight: 600 }}
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
