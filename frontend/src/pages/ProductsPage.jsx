import React, { useState, useEffect } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  Search,
  RefreshCw,
  PlusCircle,
  Eye,
  ShoppingCart,
  Tag,
  Filter,
  X,
  Package,
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorAlert from '../components/ErrorAlert';
import EmptyState from '../components/EmptyState';
import { productService } from '../services/productService';
import { formatINR, formatIndianNumber, formatDate } from '../utils/formatters';

export default function ProductsPage() {
  const { globalRefreshTrigger } = useOutletContext() || {};
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [selectedProduct, setSelectedProduct] = useState(null);

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await productService.getProducts({
        limit: 100,
        search: searchQuery.trim() || undefined,
      });
      setProducts(res.products || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [globalRefreshTrigger]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchProducts();
  };

  // Extract unique categories
  const categories = ['ALL', ...new Set(products.map((p) => p.category).filter(Boolean))];

  // Client-side category filtering
  const filteredProducts = products.filter((p) => {
    const matchesCategory = categoryFilter === 'ALL' || p.category === categoryFilter;
    const title = p.name || p.title || '';
    const desc = p.description || '';
    const sku = p.sku || '';
    const q = searchQuery.toLowerCase();

    const matchesSearch =
      !searchQuery ||
      title.toLowerCase().includes(q) ||
      desc.toLowerCase().includes(q) ||
      sku.toLowerCase().includes(q);

    return matchesCategory && matchesSearch;
  });

  return (
    <div>
      <div className="content-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.85rem' }}>
          <div>
            <h2 className="content-title">Product Management</h2>
            <p className="content-subtitle">
              Live products fetched directly from PostgreSQL database via Express REST API.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.65rem' }}>
            <Link to="/orders/new" className="btn-primary">
              <PlusCircle size={15} /> Create Order
            </Link>
          </div>
        </div>
      </div>

      {error && <ErrorAlert error={error} onRetry={fetchProducts} />}

      {/* Toolbar: Search & Category Filter */}
      <div className="toolbar">
        <form onSubmit={handleSearchSubmit} className="search-input-wrapper">
          <Search size={15} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by product name, SKU, or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>

        <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#475569', fontSize: '0.8rem', fontWeight: 500 }}>
            <Filter size={13} /> Category:
          </div>
          <select
            className="form-control"
            style={{ width: 'auto', padding: '0.4rem 0.65rem', fontSize: '0.8rem' }}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === 'ALL' ? 'All Categories' : c}
              </option>
            ))}
          </select>
          <button className="btn-refresh" onClick={fetchProducts} title="Refresh catalog">
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* Products Table Card */}
      <div className="dashboard-card">
        {loading && !products.length ? (
          <LoadingSpinner message="Querying PostgreSQL product catalog..." />
        ) : filteredProducts.length === 0 ? (
          <EmptyState
            title="No products found"
            description={
              searchQuery
                ? `No products match your search query "${searchQuery}".`
                : 'The product catalog is currently empty.'
            }
            actionText={searchQuery ? 'Clear Search' : 'Refresh Catalog'}
            onAction={() => {
              setSearchQuery('');
              setCategoryFilter('ALL');
              fetchProducts();
            }}
          />
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product Details</th>
                  <th>Category</th>
                  <th>Price (INR)</th>
                  <th>Available Stock</th>
                  <th>Stock Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => {
                  const stock = parseInt(p.inventory_count, 10) || 0;
                  const isLow = stock <= 10 && stock > 0;
                  const isOut = stock === 0;

                  return (
                    <tr key={p.id}>
                      <td style={{ maxWidth: 300 }}>
                        <div style={{ fontWeight: 600, color: '#1F2937' }}>{p.name || p.title}</div>
                        <div style={{ fontSize: '0.725rem', color: '#64748B', marginTop: '0.1rem' }}>
                          SKU: <code>{p.sku}</code>
                        </div>
                        <div
                          style={{
                            fontSize: '0.725rem',
                            color: '#64748B',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: 280,
                            marginTop: '0.1rem',
                          }}
                        >
                          {p.description}
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            padding: '0.2rem 0.45rem',
                            backgroundColor: '#f1f5f9',
                            borderRadius: '4px',
                            fontSize: '0.725rem',
                            fontWeight: 500,
                            color: '#475569',
                          }}
                        >
                          <Tag size={11} /> {p.category}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                        {formatINR(p.price)}
                      </td>
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
                      <td>
                        <StatusBadge status={isOut ? 'OUT_OF_STOCK' : isLow ? 'LOW_STOCK' : p.status} />
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.45rem' }}>
                          <button
                            className="btn-refresh"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.725rem' }}
                            onClick={() => setSelectedProduct(p)}
                            title="Inspect details and UUID"
                          >
                            <Eye size={12} /> View
                          </button>
                          <Link
                            to={`/orders/new?productId=${p.id}`}
                            className="btn-primary"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.725rem' }}
                            title="Place order for this item"
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

      {/* Product Detail Modal (Enterprise 6px-8px Radius) */}
      {selectedProduct && (
        <div className="modal-overlay" onClick={() => setSelectedProduct(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#172B4D' }}>
                  {selectedProduct.name || selectedProduct.title}
                </h3>
                <span style={{ fontSize: '0.725rem', color: '#64748B' }}>Product Specifications</span>
              </div>
              <button
                className="btn-refresh"
                style={{ padding: '0.2rem 0.4rem' }}
                onClick={() => setSelectedProduct(null)}
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                <div className="metric-row">
                  <span className="metric-label">Product ID (UUID):</span>
                  <code style={{ fontSize: '0.725rem', background: '#f1f5f9', padding: '0.15rem 0.35rem', borderRadius: 4 }}>
                    {selectedProduct.id}
                  </code>
                </div>
                <div className="metric-row">
                  <span className="metric-label">SKU:</span>
                  <span className="metric-val">{selectedProduct.sku}</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">Category:</span>
                  <span className="metric-val">{selectedProduct.category}</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">Unit Price:</span>
                  <span className="metric-val" style={{ color: '#15803D', fontWeight: 700 }}>
                    {formatINR(selectedProduct.price)}
                  </span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">Available Stock:</span>
                  <span className="metric-val">
                    {formatIndianNumber(selectedProduct.inventory_count)} units available
                  </span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">Status:</span>
                  <StatusBadge
                    status={
                      parseInt(selectedProduct.inventory_count, 10) === 0
                        ? 'OUT_OF_STOCK'
                        : selectedProduct.status
                    }
                  />
                </div>
                <div style={{ marginTop: '0.5rem' }}>
                  <span className="metric-label" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>
                    Description:
                  </span>
                  <p style={{ color: '#475569', fontSize: '0.825rem', lineHeight: 1.5, background: '#f8fafc', padding: '0.65rem', borderRadius: 4, border: '1px solid #e2e8f0' }}>
                    {selectedProduct.description}
                  </p>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-refresh" onClick={() => setSelectedProduct(null)}>
                Close
              </button>
              <Link
                to={`/orders/new?productId=${selectedProduct.id}`}
                className="btn-primary"
                onClick={() => setSelectedProduct(null)}
              >
                <ShoppingCart size={14} /> Place Order with this Item
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
