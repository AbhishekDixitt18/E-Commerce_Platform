import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useOutletContext } from 'react-router-dom';
import {
  Search,
  ShoppingCart,
  PlusCircle,
  Calendar,
  User,
  MapPin,
  CreditCard,
  ShieldCheck,
  Eye,
  X,
  PackageCheck,
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorAlert from '../components/ErrorAlert';
import EmptyState from '../components/EmptyState';
import { orderService } from '../services/orderService';
import { formatINR, formatIndianNumber, formatDate } from '../utils/formatters';

export default function OrdersPage() {
  const [searchParams] = useSearchParams();
  const { globalRefreshTrigger } = useOutletContext() || {};

  const [lookupId, setLookupId] = useState(searchParams.get('lookupId') || '');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState(null);
  const [lookupResult, setLookupResult] = useState(null);

  const [sessionOrders, setSessionOrders] = useState([]);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);

  useEffect(() => {
    // Load local session-tracked orders from real backend transactions
    const orders = orderService.getSessionOrders();
    setSessionOrders(orders);

    // Auto-trigger lookup if query param provided
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.85rem' }}>
          <div>
            <h2 className="content-title">Order Management & Lookup</h2>
            <p className="content-subtitle">
              Verify customer orders by UUID and monitor completed transactions recorded in PostgreSQL.
            </p>
          </div>
          <Link to="/orders/new" className="btn-primary">
            <PlusCircle size={15} /> Create Order
          </Link>
        </div>
      </div>

      {/* Direct Order Lookup Form */}
      <div className="dashboard-card">
        <div className="card-header">
          <h3 className="card-title">Order Lookup by ID</h3>
        </div>
        <div className="card-body">
          <form onSubmit={handleLookupSubmit} style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '260px', position: 'relative' }}>
              <Search size={15} className="search-icon" />
              <input
                type="text"
                className="search-input"
                placeholder="Enter Order UUID (e.g. 79a19aa6-76cf-494c-a11d-51e63081cf3f)..."
                value={lookupId}
                onChange={(e) => setLookupId(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="btn-primary"
              disabled={lookupLoading || !lookupId.trim()}
            >
              {lookupLoading ? 'Searching...' : 'Lookup Order'}
            </button>
          </form>

          {lookupError && (
            <div style={{ marginTop: '1rem' }}>
              <ErrorAlert error={lookupError} onRetry={() => performLookup()} />
            </div>
          )}

          {/* Verified Order Lookup Result Card */}
          {lookupResult && (
            <div
              style={{
                marginTop: '1.25rem',
                padding: '1.15rem',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: '1px solid #e2e8f0',
                  paddingBottom: '0.65rem',
                  marginBottom: '0.85rem',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                    Verified Database Record
                  </div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#172B4D' }}>
                    {lookupResult.order?.order_number || lookupResult.order?.orderNumber}
                  </div>
                </div>
                <StatusBadge status={lookupResult.order?.status} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem', marginBottom: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.725rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <User size={12} /> Customer Name
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                    {lookupResult.order?.customer_name || lookupResult.order?.customerName}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                    {lookupResult.order?.customer_email || lookupResult.order?.customerEmail}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.725rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <MapPin size={12} /> Shipping Address
                  </div>
                  <div style={{ fontSize: '0.825rem' }}>
                    {lookupResult.order?.shipping_address || lookupResult.order?.shippingAddress}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.725rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <CreditCard size={12} /> Total Amount (INR)
                  </div>
                  <div className="price-inr" style={{ fontSize: '1.15rem' }}>
                    {formatINR(lookupResult.order?.total_amount || lookupResult.order?.total || 0)}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.725rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Calendar size={12} /> Placed Date
                  </div>
                  <div style={{ fontSize: '0.8rem' }}>
                    {formatDate(lookupResult.order?.created_at || lookupResult.order?.createdAt)}
                  </div>
                </div>
              </div>

              {/* Items Purchased Breakdown */}
              <div style={{ marginTop: '0.85rem' }}>
                <h4 style={{ fontSize: '0.825rem', fontWeight: 600, marginBottom: '0.45rem', color: '#475569' }}>
                  Ordered Items ({lookupResult.items?.length || 0})
                </h4>
                <div className="table-responsive">
                  <table className="data-table" style={{ background: '#fff', borderRadius: '4px', overflow: 'hidden' }}>
                    <thead>
                      <tr>
                        <th>Item Description</th>
                        <th>Quantity</th>
                        <th>Unit Price (INR)</th>
                        <th>Subtotal (INR)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(lookupResult.items || []).map((item, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 500 }}>
                            {item.title || item.name || item.product_id || item.productId}
                          </td>
                          <td style={{ fontWeight: 600 }}>{item.quantity}</td>
                          <td className="price-inr">{formatINR(item.unit_price || item.unitPrice || 0)}</td>
                          <td className="price-inr">
                            {formatINR(item.subtotal || item.quantity * (item.unit_price || 0))}
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

      {/* Session Order History Table */}
      <div className="dashboard-card">
        <div className="card-header">
          <div>
            <h3 className="card-title">Completed Orders</h3>
            <p style={{ fontSize: '0.75rem', color: '#64748B' }}>
              Orders created during this session. Click "View Details" to view full items and shipping breakdown.
            </p>
          </div>
        </div>

        {sessionOrders.length === 0 ? (
          <EmptyState
            title="No orders created yet"
            description="Use the Create Order page to place transactions with automatic inventory reduction in PostgreSQL."
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
                  <th>Total Amount (INR)</th>
                  <th>Status</th>
                  <th>Replay Check</th>
                  <th>Order Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessionOrders.map((ord) => (
                  <tr key={ord.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#2563eb' }}>{ord.order_number || ord.orderNumber}</div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{ord.id}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{ord.customer_name || ord.customerName}</div>
                      <div style={{ fontSize: '0.725rem', color: '#64748B' }}>{ord.customer_email || ord.customerEmail}</div>
                    </td>
                    <td className="price-inr">
                      {formatINR(ord.total_amount || ord.total || 0)}
                    </td>
                    <td>
                      <StatusBadge status={ord.status || 'PENDING'} />
                    </td>
                    <td>
                      {ord.isIdempotentReplay ? (
                        <span className="badge badge-warning" style={{ fontSize: '0.675rem' }}>
                          Cached Replay
                        </span>
                      ) : (
                        <span className="badge badge-success" style={{ fontSize: '0.675rem' }}>
                          New Transaction
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.775rem', color: '#64748B' }}>
                      {formatDate(ord.created_at || ord.createdAt || Date.now())}
                    </td>
                    <td>
                      <button
                        className="btn-refresh"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.725rem' }}
                        onClick={() => {
                          setLookupId(ord.id);
                          performLookup(ord.id);
                          window.scrollTo({ top: 120, behavior: 'smooth' });
                        }}
                      >
                        <Eye size={12} /> View Details
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
