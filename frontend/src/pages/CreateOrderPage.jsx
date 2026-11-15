import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  ShoppingCart,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Key,
  ShieldCheck,
  Package,
  ArrowRight,
  Boxes,
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorAlert from '../components/ErrorAlert';
import { productService } from '../services/productService';
import { orderService } from '../services/orderService';
import { generateIdempotencyKey } from '../services/api';

export default function CreateOrderPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Form State
  const [selectedProductId, setSelectedProductId] = useState(searchParams.get('productId') || '');
  const [quantity, setQuantity] = useState(1);
  const [customerName, setCustomerName] = useState('ALGIONS DevOps Evaluator');
  const [customerEmail, setCustomerEmail] = useState('evaluator@algions.com');
  const [shippingAddress, setShippingAddress] = useState('ALGIONS AI Labs, Tech Infrastructure Campus, Floor 4');

  // Idempotency Key State
  const [idempotencyKey, setIdempotencyKey] = useState(generateIdempotencyKey());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [createdOrderResult, setCreatedOrderResult] = useState(null);

  // Load products from PostgreSQL on mount
  useEffect(() => {
    const loadProducts = async () => {
      setLoadingProducts(true);
      try {
        const res = await productService.getProducts({ limit: 50 });
        const prods = res.products || [];
        setProducts(prods);

        // Pre-select first in-stock product if none chosen in query
        if (!selectedProductId && prods.length > 0) {
          const firstInStock = prods.find((p) => p.inventory_count > 0) || prods[0];
          setSelectedProductId(firstInStock.id);
        }
      } catch (err) {
        setSubmitError(err);
      } finally {
        setLoadingProducts(false);
      }
    };
    loadProducts();
  }, []);

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const availableStock = selectedProduct ? parseInt(selectedProduct.inventory_count, 10) : 0;
  const isOutOfStock = availableStock <= 0;

  const handleQuantityChange = (e) => {
    const val = parseInt(e.target.value, 10);
    setQuantity(isNaN(val) ? 1 : val);
  };

  const handleGenerateNewKey = () => {
    setIdempotencyKey(generateIdempotencyKey());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedProductId) {
      setSubmitError('Please select a product from the catalog.');
      return;
    }

    if (quantity < 1) {
      setSubmitError('Order quantity must be at least 1.');
      return;
    }

    if (quantity > availableStock) {
      setSubmitError(`Requested quantity (${quantity}) exceeds available inventory (${availableStock}).`);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const payload = {
      customer_name: customerName.trim(),
      customer_email: customerEmail.trim(),
      shipping_address: shippingAddress.trim(),
      items: [
        {
          productId: selectedProductId,
          quantity: Number(quantity),
        },
      ],
    };

    try {
      // Backend validates inventory, applies row lock, and calculates authoritative total
      const result = await orderService.createOrder(payload, idempotencyKey);
      setCreatedOrderResult(result);

      // Refresh product stock locally to reflect database deduction
      const updatedProducts = await productService.getProducts({ limit: 50 });
      setProducts(updatedProducts.products || []);
    } catch (err) {
      // Keep same idempotencyKey so user can retry failed requests without generating duplicates!
      setSubmitError(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingProducts && !products.length) {
    return <LoadingSpinner message="Loading live product catalog for checkout..." />;
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div className="content-header">
        <h2 className="content-title">Create Customer Order</h2>
        <p className="content-subtitle">
          Submit live orders against the PostgreSQL backend with end-to-end Idempotency-Key deduplication.
        </p>
      </div>

      {submitError && (
        <ErrorAlert
          error={submitError}
          onRetry={() => {
            setSubmitError(null);
          }}
        />
      )}

      {/* Success Notification Card */}
      {createdOrderResult && (
        <div
          className="alert alert-success"
          style={{
            flexDirection: 'column',
            alignItems: 'stretch',
            gap: '1rem',
            padding: '1.5rem',
            marginBottom: '2rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <CheckCircle2 size={28} style={{ color: '#16a34a', flexShrink: 0 }} />
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#14532d' }}>
                {createdOrderResult.isIdempotentReplay
                  ? 'Idempotent Replay Verified: Duplicate Suppressed!'
                  : 'Order Placed & Committed in PostgreSQL!'}
              </h3>
              <p style={{ fontSize: '0.825rem', color: '#166534', marginTop: '0.15rem' }}>
                {createdOrderResult.isIdempotentReplay
                  ? 'The backend detected a previously processed request with this Idempotency-Key. No duplicate order was created and stock was not deducted twice.'
                  : 'Transaction committed atomically. Inventory decremented and immutable audit log created.'}
              </p>
            </div>
          </div>

          <div
            style={{
              background: '#ffffff',
              padding: '1.25rem',
              borderRadius: '8px',
              border: '1px solid #bbf7d0',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '1rem',
            }}
          >
            <div>
              <span className="metric-label">Order Number:</span>
              <div style={{ fontWeight: 700, color: '#2563eb' }}>
                {createdOrderResult.order?.order_number || createdOrderResult.order?.orderNumber}
              </div>
            </div>

            <div>
              <span className="metric-label">Order ID (UUID):</span>
              <code style={{ fontSize: '0.75rem', background: '#f1f5f9', padding: '0.2rem 0.4rem', borderRadius: 4 }}>
                {createdOrderResult.order?.id}
              </code>
            </div>

            <div>
              <span className="metric-label">Authoritative Backend Total:</span>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#16a34a' }}>
                ${parseFloat(createdOrderResult.order?.total_amount || createdOrderResult.order?.total || 0).toFixed(2)}
              </div>
            </div>

            <div>
              <span className="metric-label">Lifecycle Status:</span>
              <div style={{ marginTop: '0.25rem' }}>
                <StatusBadge status={createdOrderResult.order?.status || 'PENDING'} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              className="btn-primary"
              style={{ backgroundColor: '#15803d' }}
              onClick={() => {
                // Keep the exact same key to test duplicate prevention!
                handleSubmit({ preventDefault: () => {} });
              }}
              disabled={submitting}
            >
              <RefreshCw size={14} /> Re-Submit with Same Key (Test Idempotency)
            </button>

            <button
              className="btn-refresh"
              onClick={() => {
                setCreatedOrderResult(null);
                handleGenerateNewKey();
              }}
            >
              + Place Another Order (New Key)
            </button>

            <Link
              to={`/orders?lookupId=${createdOrderResult.order?.id}`}
              className="btn-refresh"
              style={{ color: '#2563eb' }}
            >
              Inspect Order in Orders View →
            </Link>
          </div>
        </div>
      )}

      {/* Main Order Form */}
      <div className="dashboard-card">
        <div className="card-header">
          <h3 className="card-title">Order Placement Parameters</h3>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            {/* Product Selection */}
            <div className="form-group">
              <label className="form-label" htmlFor="product-select">
                Select Product from Catalog *
              </label>
              <select
                id="product-select"
                className="form-control"
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                required
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id} disabled={p.inventory_count <= 0}>
                    {p.title} (${parseFloat(p.price).toFixed(2)}) — Stock: {p.inventory_count} units{' '}
                    {p.inventory_count <= 0 ? '(OUT OF STOCK)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Selected Product Snapshot Card */}
            {selectedProduct && (
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '1rem',
                  marginBottom: '1.25rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{selectedProduct.title}</div>
                  <div style={{ fontSize: '0.775rem', color: '#64748b' }}>
                    SKU: <code>{selectedProduct.sku}</code> | Category: {selectedProduct.category}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.725rem', color: '#64748b' }}>Unit Price</div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                      ${parseFloat(selectedProduct.price).toFixed(2)}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.725rem', color: '#64748b' }}>Available Stock</div>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: '1.1rem',
                        color: isOutOfStock ? '#dc2626' : availableStock <= 5 ? '#d97706' : '#16a34a',
                      }}
                    >
                      {availableStock} units
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Quantity */}
            <div className="form-group">
              <label className="form-label" htmlFor="order-quantity">
                Order Quantity *
              </label>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <input
                  id="order-quantity"
                  type="number"
                  min="1"
                  max={Math.max(1, availableStock)}
                  className="form-control"
                  style={{ maxWidth: '160px' }}
                  value={quantity}
                  onChange={handleQuantityChange}
                  disabled={isOutOfStock}
                  required
                />
                <span style={{ fontSize: '0.825rem', color: '#64748b' }}>
                  Max allowed: {availableStock} units
                </span>
              </div>
              {quantity > availableStock && (
                <div style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.35rem', fontWeight: 600 }}>
                  ⚠️ Quantity exceeds warehouse inventory of {availableStock} units.
                </div>
              )}
            </div>

            {/* Customer Details */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="cust-name">
                  Customer Full Name *
                </label>
                <input
                  id="cust-name"
                  type="text"
                  className="form-control"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="cust-email">
                  Customer Email Address *
                </label>
                <input
                  id="cust-email"
                  type="email"
                  className="form-control"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Shipping Address */}
            <div className="form-group">
              <label className="form-label" htmlFor="cust-address">
                Shipping Address *
              </label>
              <textarea
                id="cust-address"
                rows="2"
                className="form-control"
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                required
              />
            </div>

            {/* Idempotency Key Section */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1.5rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label className="form-label" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Key size={14} style={{ color: '#2563eb' }} /> Active Idempotency-Key
                </label>
                <button
                  type="button"
                  className="btn-refresh"
                  style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                  onClick={handleGenerateNewKey}
                >
                  <RefreshCw size={12} /> Regenerate Key
                </button>
              </div>
              <input
                type="text"
                className="form-control"
                style={{ fontFamily: 'monospace', fontSize: '0.8rem', background: '#fff' }}
                value={idempotencyKey}
                onChange={(e) => setIdempotencyKey(e.target.value)}
                required
              />
              <p className="form-text">
                Sent as <code>Idempotency-Key</code> header to backend. Guarantees safe network retries without double-charging or double-inventory deduction.
              </p>
            </div>

            {/* Submit Action */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', alignItems: 'center' }}>
              <button
                type="submit"
                className="btn-primary"
                style={{ padding: '0.65rem 1.5rem', fontSize: '0.95rem' }}
                disabled={submitting || isOutOfStock || quantity > availableStock}
              >
                {submitting ? (
                  <>
                    <RefreshCw size={16} className="spinning" /> Processing Checkout...
                  </>
                ) : (
                  <>
                    <ShoppingCart size={16} /> Submit Order to Backend
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
