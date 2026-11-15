import React, { useState, useEffect } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import {
  Boxes,
  AlertTriangle,
  CheckCircle2,
  ShoppingCart,
  RefreshCw,
  Edit3,
  X,
  Lock,
  Calendar,
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorAlert from '../components/ErrorAlert';
import { productService } from '../services/productService';
import { formatINR, formatIndianNumber, formatDate } from '../utils/formatters';

export default function InventoryPage() {
  const { globalRefreshTrigger } = useOutletContext() || {};
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [products, setProducts] = useState([]);

  // Admin Stock Update Dialog State
  const [adjustingProduct, setAdjustingProduct] = useState(null);
  const [newStockCount, setNewStockCount] = useState(0);
  const [adminApiKey, setAdminApiKey] = useState('algions-devops-admin-key-2026');
  const [updatingStock, setUpdatingStock] = useState(false);
  const [updateSuccessMsg, setUpdateSuccessMsg] = useState(null);
  const [updateErrorMsg, setUpdateErrorMsg] = useState(null);

  const loadInventory = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await productService.getProducts({ limit: 100 });
      setProducts(res.products || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, [globalRefreshTrigger]);

  const totalStock = products.reduce((acc, p) => acc + (parseInt(p.inventory_count, 10) || 0), 0);
  const totalValuation = products.reduce(
    (acc, p) => acc + (parseInt(p.inventory_count, 10) || 0) * parseFloat(p.price || 0),
    0
  );
  const lowStock = products.filter((p) => p.inventory_count <= 10);

  const handleOpenAdjustModal = (product) => {
    setAdjustingProduct(product);
    setNewStockCount(parseInt(product.inventory_count, 10) || 0);
    setUpdateSuccessMsg(null);
    setUpdateErrorMsg(null);
  };

  const handleCloseAdjustModal = () => {
    setAdjustingProduct(null);
    setUpdateSuccessMsg(null);
    setUpdateErrorMsg(null);
  };

  const handleStockUpdateSubmit = async (e) => {
    e.preventDefault();
    if (!adjustingProduct) return;

    if (newStockCount < 0) {
      setUpdateErrorMsg('Stock count cannot be negative.');
      return;
    }

    setUpdatingStock(true);
    setUpdateErrorMsg(null);
    setUpdateSuccessMsg(null);

    try {
      // Call protected administrative API PATCH /api/v1/admin/products/:id/stock
      await productService.updateStock(adjustingProduct.id, newStockCount, adminApiKey);
      setUpdateSuccessMsg(`Stock for "${adjustingProduct.name || adjustingProduct.title}" updated to ${newStockCount} units.`);
      
      // Refresh inventory list
      await loadInventory();
      setTimeout(() => {
        handleCloseAdjustModal();
      }, 1200);
    } catch (err) {
      if (err.response?.status === 401) {
        setUpdateErrorMsg('Unauthorized: Invalid or missing Admin API Key.');
      } else {
        setUpdateErrorMsg(err.response?.data?.message || err.message || 'Failed to update inventory.');
      }
    } finally {
      setUpdatingStock(false);
    }
  };

  return (
    <div>
      <div className="content-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.85rem' }}>
          <div>
            <h2 className="content-title">Inventory Management</h2>
            <p className="content-subtitle">
              Monitor real-time warehouse inventory counts, valuations, and update stock via administrative APIs.
            </p>
          </div>
          <button className="btn-primary" onClick={loadInventory} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spinning' : ''} /> Refresh Stock
          </button>
        </div>
      </div>

      {error && <ErrorAlert error={error} onRetry={loadInventory} />}

      {/* Top 3 Summary Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div>
            <div className="stat-label">Total Available Stock</div>
            <div className="stat-value">{formatIndianNumber(totalStock)}</div>
            <div className="stat-subtext">Across {products.length} catalog items</div>
          </div>
          <div className="stat-icon-wrapper blue">
            <Boxes size={20} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-label">Total Stock Valuation</div>
            <div className="stat-value" style={{ color: '#15803D' }}>{formatINR(totalValuation)}</div>
            <div className="stat-subtext">Cumulative inventory asset value</div>
          </div>
          <div className="stat-icon-wrapper green">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-label">Low Stock Items</div>
            <div className="stat-value" style={{ color: lowStock.length > 0 ? '#D97706' : '#15803D' }}>
              {formatIndianNumber(lowStock.length)}
            </div>
            <div className="stat-subtext">Items with ≤ 10 units remaining</div>
          </div>
          <div className="stat-icon-wrapper amber">
            <AlertTriangle size={20} />
          </div>
        </div>
      </div>

      {/* Inventory Breakdown Table */}
      <div className="dashboard-card">
        <div className="card-header">
          <h3 className="card-title">Warehouse Stock Levels</h3>
        </div>
        {loading && !products.length ? (
          <LoadingSpinner message="Calculating inventory totals from PostgreSQL..." />
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>SKU</th>
                  <th>Unit Price (INR)</th>
                  <th>Available Stock</th>
                  <th>Stock Valuation (INR)</th>
                  <th>Stock Status</th>
                  <th>Last Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const stock = parseInt(p.inventory_count, 10) || 0;
                  const itemVal = stock * parseFloat(p.price || 0);
                  const isLow = stock <= 10 && stock > 0;
                  const isOut = stock === 0;

                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600, maxWidth: 240 }}>{p.name || p.title}</td>
                      <td>
                        <code>{p.sku}</code>
                      </td>
                      <td>{formatINR(p.price)}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span
                            style={{
                              fontWeight: 700,
                              color: isOut ? '#DC2626' : isLow ? '#D97706' : '#15803D',
                            }}
                          >
                            {formatIndianNumber(stock)}
                          </span>
                          <span style={{ fontSize: '0.725rem', color: '#64748B' }}>units</span>
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{formatINR(itemVal)}</td>
                      <td>
                        <StatusBadge status={isOut ? 'OUT_OF_STOCK' : isLow ? 'LOW_STOCK' : 'ACTIVE'} />
                      </td>
                      <td style={{ fontSize: '0.75rem', color: '#64748B' }}>
                        {formatDate(p.updated_at || p.created_at)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button
                            className="btn-refresh"
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.725rem' }}
                            onClick={() => handleOpenAdjustModal(p)}
                            title="Adjust stock with Admin API"
                          >
                            <Edit3 size={12} /> Adjust Stock
                          </button>
                          <Link
                            to={`/orders/new?productId=${p.id}`}
                            className="btn-primary"
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.725rem' }}
                            title="Order this product"
                          >
                            <ShoppingCart size={12} /> Order
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Admin Stock Adjustment Modal (Enterprise 6px-8px Radius) */}
      {adjustingProduct && (
        <div className="modal-overlay" onClick={handleCloseAdjustModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#172B4D' }}>
                  Adjust Warehouse Stock
                </h3>
                <span style={{ fontSize: '0.725rem', color: '#64748B' }}>
                  Protected Administrative Endpoint (PATCH /api/v1/admin/products/:id/stock)
                </span>
              </div>
              <button
                className="btn-refresh"
                style={{ padding: '0.2rem 0.4rem' }}
                onClick={handleCloseAdjustModal}
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleStockUpdateSubmit}>
              <div className="modal-body">
                {updateSuccessMsg && (
                  <div className="alert alert-success" style={{ marginBottom: '1rem', padding: '0.65rem' }}>
                    <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                    <span>{updateSuccessMsg}</span>
                  </div>
                )}

                {updateErrorMsg && (
                  <div className="alert alert-danger" style={{ marginBottom: '1rem', padding: '0.65rem' }}>
                    <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                    <span>{updateErrorMsg}</span>
                  </div>
                )}

                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#172B4D' }}>
                    {adjustingProduct.name || adjustingProduct.title}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                    SKU: <code>{adjustingProduct.sku}</code> | Current Stock: {adjustingProduct.inventory_count} units
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="new-stock">
                    New Stock Count (Units) *
                  </label>
                  <input
                    id="new-stock"
                    type="number"
                    min="0"
                    className="form-control"
                    value={newStockCount}
                    onChange={(e) => setNewStockCount(parseInt(e.target.value, 10) || 0)}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="admin-key" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Lock size={12} style={{ color: '#2563EB' }} /> Admin API Key *
                  </label>
                  <input
                    id="admin-key"
                    type="password"
                    className="form-control"
                    value={adminApiKey}
                    onChange={(e) => setAdminApiKey(e.target.value)}
                    required
                  />
                  <p className="form-text">
                    Required by backend authentication middleware (<code>x-admin-api-key</code>).
                  </p>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-refresh"
                  onClick={handleCloseAdjustModal}
                  disabled={updatingStock}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={updatingStock}
                >
                  {updatingStock ? (
                    <>
                      <RefreshCw size={13} className="spinning" /> Saving...
                    </>
                  ) : (
                    'Save Stock Level'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
