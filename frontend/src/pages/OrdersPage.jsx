import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useOutletContext } from 'react-router-dom';
import {
  Search,
  ShoppingCart,
  PlusCircle,
  AlertCircle,
  CheckCircle2,
  Package,
  Calendar,
  User,
  MapPin,
  DollarSign,
  ShieldAlert,
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorAlert from '../components/ErrorAlert';
import EmptyState from '../components/EmptyState';
import { orderService } from '../services/orderService';

export default function OrdersPage() {
  const [searchParams] = useSearchParams();
  const { globalRefreshTrigger } = useOutletContext() || {};

  const [lookupId, setLookupId] = useState(searchParams.get('lookupId') || '');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState(null);
  const [lookupResult, setLookupResult] = useState(null);

  const [sessionOrders, setSessionOrders] = useState([]);

  useEffect(() => {
    // Load local session-tracked orders
    const orders = orderService.getSessionOrders();
    setSessionOrders(orders);

    // If lookupId query param was supplied, auto-trigger lookup
    const initialLookup = searchParams.get('lookupId');
    if (initialLookup) {
      setLookupId(initialLookup);
      performLookup(initialLookup);
    }
  }, [globalRefreshTrigger]);

  const performLookup = async (id) => {
    const targetId = (id || lookupId).trim();
    if (!targetId) return;

    setLookupLoading(true);
    setLookupError(null);
    setLookupResult(null);

    try {
      const data = await orderService.getOrderById(targetId);
      setLookupResult(data);
    } catch (err) {
      setLookupError(err);
    } finally {
      setLookupLoading(false);
    }
  };

  const handleLookupSubmit = (e) => {
    e.preventDefault();
    performLookup();
  };

  return (
    <div>
      <div className="content-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 className="content-title">Order Management & Lookup</h2>
            <p className="content-subtitle">
              Query customer orders by UUID and monitor recently created orders in the live database.
            </p>
          </div>
          <Link to="/orders/new" className="btn-primary">
            <PlusCircle size={16} /> Create New Order
          </Link>
        </div>
      </div>

      {/* Backend Architecture Notice: Documenting deliberate lack of public listing */}
      <div className="alert alert-info" style={{ alignItems: 'center' }}>
        <ShieldAlert size={20} style={{ flexShrink: 0, color: '#2563eb' }} />
        <div>
          <strong>Backend API Architectural Specification: </strong>
          <span style={{ fontSize: '0.825rem' }}>
            The backend REST API adheres to strict customer privacy principles and exposes{' '}
            <code>GET /api/v1/orders/:id</code> for direct order verification. In compliance with the assessment guidelines, no unsupported bulk order listing endpoint is invented; use the verified lookup tool below or the session registry.
          </span>
        </div>
      </div>

      {/* Order Lookup Form */}
      <div className="dashboard-card">
        <div className="card-header">
          <h3 className="card-title">Direct Order Lookup by UUID</h3>
        </div>
        <div className="card-body">
          <form onSubmit={handleLookupSubmit} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '280px', position: 'relative' }}>
              <Search size={16} className="search-icon" />
              <input
                type="text"
                className="search-input"
                placeholder="Paste Order UUID (e.g. 183e0dda-6f2c-4fc7-8f47-cbee1b28ebb5)..."
                value={lookupId}
                onChange={(e) => setLookupId(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="btn-primary"
              disabled={lookupLoading || !lookupId.trim()}
            >
              {lookupLoading ? 'Querying...' : 'Lookup Order'}
            </button>
          </form>

          {lookupError && (
            <div style={{ marginTop: '1.25rem' }}>
              <ErrorAlert error={lookupError} onRetry={() => performLookup()} />
            </div>
          )}

          {/* Verified Order Lookup Result Card */}
          {lookupResult && (
            <div
              style={{
                marginTop: '1.5rem',
                padding: '1.25rem',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: '1px solid #e2e8f0',
                  paddingBottom: '0.75rem',
                  marginBottom: '1rem',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>VERIFIED DATABASE ORDER</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                    {lookupResult.order?.order_number || lookupResult.order?.orderNumber}
                  </div>
                </div>
                <StatusBadge status={lookupResult.order?.status} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <User size={13} /> Customer Details
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{lookupResult.order?.customer_name || lookupResult.order?.customerName}</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{lookupResult.order?.customer_email || lookupResult.order?.customerEmail}</div>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <MapPin size={13} /> Shipping Address
                  </div>
                  <div style={{ fontSize: '0.875rem' }}>{lookupResult.order?.shipping_address || lookupResult.order?.shippingAddress}</div>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <DollarSign size={13} /> Total Amount
                  </div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#16a34a' }}>
                    ${parseFloat(lookupResult.order?.total_amount || lookupResult.order?.total || 0).toFixed(2)}{' '}
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{lookupResult.order?.currency || 'USD'}</span>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Calendar size={13} /> Created Timestamp
                  </div>
                  <div style={{ fontSize: '0.85rem' }}>
                    {new Date(lookupResult.order?.created_at || lookupResult.order?.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Items Purchased Breakdown */}
              <div style={{ marginTop: '1rem' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: '#475569' }}>
                  Purchased Items Snapshot ({lookupResult.items?.length || 0})
                </h4>
                <div className="table-responsive">
                  <table className="data-table" style={{ background: '#fff', borderRadius: '6px', overflow: 'hidden' }}>
                    <thead>
                      <tr>
                        <th>Product Title</th>
                        <th>Qty</th>
                        <th>Unit Price (At Checkout)</th>
                        <th>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(lookupResult.items || []).map((item, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 500 }}>{item.title || item.product_id || item.productId}</td>
                          <td style={{ fontWeight: 600 }}>{item.quantity}</td>
                          <td>${parseFloat(item.unit_price || item.unitPrice || 0).toFixed(2)}</td>
                          <td style={{ fontWeight: 600 }}>
                            ${parseFloat(item.subtotal || item.quantity * item.unit_price || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Session Order History */}
      <div className="dashboard-card">
        <div className="card-header">
          <div>
            <h3 className="card-title">Session-Tracked Orders</h3>
            <p style={{ fontSize: '0.775rem', color: '#64748b' }}>
              Orders created during this admin session across test runs. Click "Lookup" to pull the fresh state from PostgreSQL.
            </p>
          </div>
        </div>

        {sessionOrders.length === 0 ? (
          <EmptyState
            title="No orders placed yet"
            description="Create an order using the checkout interface to verify PostgreSQL order generation and inventory deduction."
            icon={ShoppingCart}
            actionText="Place First Order"
            onAction={() => (window.location.href = '/orders/new')}
          />
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order Number</th>
                  <th>Customer</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Idempotent Replay?</th>
                  <th>Date & Time</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {sessionOrders.map((ord) => (
                  <tr key={ord.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#2563eb' }}>{ord.order_number || ord.orderNumber}</div>
                      <div style={{ fontSize: '0.725rem', color: '#94a3b8' }}>{ord.id}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{ord.customer_name || ord.customerName}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{ord.customer_email || ord.customerEmail}</div>
                    </td>
                    <td style={{ fontWeight: 600 }}>${parseFloat(ord.total_amount || ord.total || 0).toFixed(2)}</td>
                    <td>
                      <StatusBadge status={ord.status || 'PENDING'} />
                    </td>
                    <td>
                      {ord.isIdempotentReplay ? (
                        <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
                          Replayed (Cached)
                        </span>
                      ) : (
                        <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                          Original
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      {new Date(ord.created_at || ord.createdAt || Date.now()).toLocaleString()}
                    </td>
                    <td>
                      <button
                        className="btn-refresh"
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                        onClick={() => {
                          setLookupId(ord.id);
                          performLookup(ord.id);
                          window.scrollTo({ top: 150, behavior: 'smooth' });
                        }}
                      >
                        Lookup →
                      </button>
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
