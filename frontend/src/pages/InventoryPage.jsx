import React, { useState, useEffect } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { Boxes, AlertTriangle, CheckCircle2, ShoppingCart, RefreshCw } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorAlert from '../components/ErrorAlert';
import { productService } from '../services/productService';

export default function InventoryPage() {
  const { globalRefreshTrigger } = useOutletContext() || {};
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [products, setProducts] = useState([]);

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

  return (
    <div>
      <div className="content-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 className="content-title">Warehouse Inventory Tracking</h2>
            <p className="content-subtitle">
              Monitor real-time inventory counts and warehouse asset valuation directly from PostgreSQL.
            </p>
          </div>
          <button className="btn-primary" onClick={loadInventory} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spinning' : ''} /> Refresh Stock
          </button>
        </div>
      </div>

      {error && <ErrorAlert error={error} onRetry={loadInventory} />}

      {/* Stats Summary */}
      <div className="stats-grid">
        <div className="stat-card">
          <div>
            <div className="stat-label">Total Warehouse Units</div>
            <div className="stat-value">{totalStock}</div>
            <div className="stat-subtext">Across {products.length} catalog items</div>
          </div>
          <div className="stat-icon-wrapper blue">
            <Boxes size={22} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-label">Total Stock Valuation</div>
            <div className="stat-value">${totalValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className="stat-subtext">Cumulative warehouse asset value</div>
          </div>
          <div className="stat-icon-wrapper green">
            <CheckCircle2 size={22} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-label">Items Requiring Attention</div>
            <div className="stat-value" style={{ color: lowStock.length > 0 ? '#d97706' : '#16a34a' }}>
              {lowStock.length}
            </div>
            <div className="stat-subtext">Products with ≤ 10 units remaining</div>
          </div>
          <div className="stat-icon-wrapper amber">
            <AlertTriangle size={22} />
          </div>
        </div>
      </div>

      {/* Inventory Breakdown Table */}
      <div className="dashboard-card">
        <div className="card-header">
          <h3 className="card-title">Stock Level Breakdown</h3>
        </div>
        {loading && !products.length ? (
          <LoadingSpinner message="Calculating inventory totals from PostgreSQL..." />
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product Title</th>
                  <th>SKU</th>
                  <th>Unit Price</th>
                  <th>Current Stock</th>
                  <th>Total Valuation</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const stock = parseInt(p.inventory_count, 10) || 0;
                  const itemVal = stock * parseFloat(p.price || 0);
                  const isLow = stock <= 10;
                  const isOut = stock === 0;

                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.title}</td>
                      <td>
                        <code>{p.sku}</code>
                      </td>
                      <td>${parseFloat(p.price).toFixed(2)}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span
                            style={{
                              fontWeight: 700,
                              color: isOut ? '#dc2626' : isLow ? '#d97706' : '#16a34a',
                            }}
                          >
                            {stock}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>units</span>
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>${itemVal.toFixed(2)}</td>
                      <td>
                        <StatusBadge status={isOut ? 'OUT_OF_STOCK' : isLow ? 'LOW_STOCK' : 'ACTIVE'} />
                      </td>
                      <td>
                        <Link
                          to={`/orders/new?productId=${p.id}`}
                          className="btn-refresh"
                          style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem' }}
                        >
                          <ShoppingCart size={13} /> Checkout
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
