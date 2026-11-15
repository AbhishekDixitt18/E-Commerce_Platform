import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  ShoppingCart,
  CheckCircle2,
  RefreshCw,
  Key,
  ShieldCheck,
  Package,
  Boxes,
  ArrowRight,
  Info,
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorAlert from '../components/ErrorAlert';
import { productService } from '../services/productService';
import { orderService } from '../services/orderService';
import { generateIdempotencyKey } from '../services/api';
import { formatINR, formatIndianNumber, formatDate } from '../utils/formatters';

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
    if (e && e.preventDefault) e.preventDefault();

    if (!selectedProductId) {
      setSubmitError('Please select a product from the catalog.');
      return;
    }

    if (quantity < 1) {
      setSubmitError('Order quantity must be at least 1 unit.');
      return;
    }

    if (quantity > availableStock) {
      setSubmitError(`Requested quantity (${quantity}) exceeds available stock (${availableStock}).`);
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
      // Backend validates inventory row locks and calculates authoritative total
      const result = await orderService.createOrder(payload, idempotencyKey);
      setCreatedOrderResult(result);

      // Refresh product stock locally to reflect database deduction
      const updatedProducts = await productService.getProducts({ limit: 50 });
      setProducts(updatedProducts.products || []);
    } catch (err) {
      // Translate technical errors into understandable plain English
      if (err.message && err.message.includes('Idempotency')) {
        setSubmitError('This order request has already been processed.');
      } else {
        setSubmitError(err);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingProducts && !products.length) {
    return <LoadingSpinner message="Loading product catalog for checkout..." />;
  }

  // Frontend estimate for display purposes (backend remains authoritative)
  const estimatedSubtotal = selectedProduct ? parseFloat(selectedProduct.price || 0) * quantity : 0;

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto' }}>
      <div className="content-header">
        <h2 className="content-title">Create Customer Order</h2>
        <p className="content-subtitle">
          Submit orders with automatic PostgreSQL inventory deduction and Idempotency key protection.
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
            gap: '0.85rem',
            padding: '1.25rem',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <CheckCircle2 size={24} style={{ color: '#15803D', flexShrink: 0 }} />
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#14532D' }}>
                {createdOrderResult.isIdempotentReplay
                  ? 'Duplicate Order Request Suppressed'
                  : 'Order Confirmed & Saved in PostgreSQL'}
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#166534', marginTop: '0.1rem' }}>
                {createdOrderResult.isIdempotentReplay
                  ? 'This order request has already been processed. Stock was not deducted twice.'
                  : 'Transaction committed atomically. Warehouse stock updated and order number generated.'}
              </p>
            </div>
          </div>

          <div
            style={{
              background: '#ffffff',
              padding: '1rem',
              borderRadius: '6px',
              border: '1px solid #bbf7d0',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: '0.85rem',
            }}
          >
            <div>
              <span className="metric-label">Order Number:</span>
              <div style={{ fontWeight: 700, color: '#2563EB', fontSize: '0.95rem' }}>
                {createdOrderResult.order?.order_number || createdOrderResult.order?.orderNumber}
              </div>
            </div>

            <div>
              <span className="metric-label">Order ID (UUID):</span>
              <code style={{ fontSize: '0.725rem', background: '#f1f5f9', padding: '0.15rem 0.35rem', borderRadius: 4 }}>
                {createdOrderResult.order?.id}
              </code>
            </div>

            <div>
              <span className="metric-label">Authoritative Total:</span>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#15803D' }}>
                {formatINR(createdOrderResult.order?.total_amount || createdOrderResult.order?.total || 0)}
              </div>
            </div>

            <div>
              <span className="metric-label">Order Status:</span>
              <div style={{ marginTop: '0.2rem' }}>
                <StatusBadge status={createdOrderResult.order?.status || 'PENDING'} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
            <button
              className="btn-primary"
              style={{ backgroundColor: '#15803D', fontSize: '0.8rem' }}
              onClick={() => handleSubmit()}
              disabled={submitting}
            >
              <RefreshCw size={13} /> Re-Submit Same Key (Test Idempotency)
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
              style={{ color: '#2563EB' }}
            >
              Inspect Order →
            </Link>
          </div>
        </div>
      )}

      {/* Main Order Form */}
      <div className="dashboard-card">
        <div className="card-header">
          <h3 className="card-title">Order Details</h3>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            {/* Product Selection */}
            <div className="form-group">
              <label className="form-label" htmlFor="product-select">
                Select Product *
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
                    {p.name || p.title} ({formatINR(p.price)}) — Available: {formatIndianNumber(p.inventory_count)} units{' '}
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
                  borderRadius: '6px',
                  padding: '0.85rem 1rem',
                  marginBottom: '1.15rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.85rem',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{selectedProduct.name || selectedProduct.title}</div>
                  <div style={{ fontSize: '0.725rem', color: '#64748B' }}>
                    SKU: <code>{selectedProduct.sku}</code> | Category: {selectedProduct.category}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.7rem', color: '#64748B' }}>Unit Price (INR)</div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: '#15803D' }}>
                      {formatINR(selectedProduct.price)}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.7rem', color: '#64748B' }}>Available Stock</div>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: '1rem',
                        color: isOutOfStock ? '#DC2626' : availableStock <= 10 ? '#D97706' : '#15803D',
                      }}
                    >
                      {formatIndianNumber(availableStock)} units
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Quantity */}
            <div className="form-group">
              <label className="form-label" htmlFor="order-quantity">
                Quantity *
              </label>
              <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
                <input
                  id="order-quantity"
                  type="number"
                  min="1"
                  max={Math.max(1, availableStock)}
                  className="form-control"
                  style={{ maxWidth: '140px' }}
                  value={quantity}
                  onChange={handleQuantityChange}
                  disabled={isOutOfStock}
                  required
                />
                <span style={{ fontSize: '0.775rem', color: '#64748B' }}>
                  Maximum available: {formatIndianNumber(availableStock)} units
                </span>
              </div>
              {quantity > availableStock && (
                <div style={{ color: '#DC2626', fontSize: '0.75rem', marginTop: '0.3rem', fontWeight: 600 }}>
                  ⚠️ Quantity exceeds warehouse inventory of {availableStock} units.
                </div>
              )}
            </div>

            {/* Estimated Order Summary Box */}
            {selectedProduct && (
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '0.85rem 1rem',
                  marginBottom: '1.15rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                  <span style={{ color: '#475569', fontWeight: 500 }}>Estimated Total ({quantity} unit(s)):</span>
                  <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#172B4D' }}>
                    {formatINR(estimatedSubtotal)}
                  </span>
                </div>
                <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: '0.2rem' }}>
                  * Authoritative total is calculated and validated on the backend.
                </div>
              </div>
            )}

            {/* Customer Details */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="cust-name">
                  Customer Name *
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
                  Customer Email *
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
                borderRadius: '6px',
                padding: '0.85rem',
                marginBottom: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <label className="form-label" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Key size={13} style={{ color: '#2563EB' }} /> Idempotency Key (Safe Retry Token)
                </label>
                <button
                  type="button"
                  className="btn-refresh"
                  style={{ fontSize: '0.725rem', padding: '0.2rem 0.45rem' }}
                  onClick={handleGenerateNewKey}
                >
                  <RefreshCw size={11} /> New Key
                </button>
              </div>
              <input
                type="text"
                className="form-control"
                style={{ fontFamily: 'monospace', fontSize: '0.775rem', background: '#fff' }}
                value={idempotencyKey}
                onChange={(e) => setIdempotencyKey(e.target.value)}
                required
              />
              <p className="form-text">
                Prevents duplicate charges and orders if a network timeout occurs during checkout.
              </p>
            </div>

            {/* Submit Action */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.85rem', alignItems: 'center' }}>
              <button
                type="submit"
                className="btn-primary"
                style={{ padding: '0.6rem 1.25rem', fontSize: '0.9rem' }}
                disabled={submitting || isOutOfStock || quantity > availableStock}
              >
                {submitting ? (
                  <>
                    <RefreshCw size={14} className="spinning" /> Processing Order...
                  </>
                ) : (
                  <>
                    <ShoppingCart size={14} /> Confirm & Place Order
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
