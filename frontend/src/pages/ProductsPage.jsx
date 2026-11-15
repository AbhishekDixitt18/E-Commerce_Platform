import React, { useState, useEffect } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  Search,
  RefreshCw,
  PlusCircle,
  Eye,
  ShoppingCart,
  Boxes,
  Tag,
  Filter,
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorAlert from '../components/ErrorAlert';
import EmptyState from '../components/EmptyState';
import { productService } from '../services/productService';

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
    const matchesSearch =
      !searchQuery ||
      p.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div>
      <div className="content-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 className="content-title">Product Catalog</h2>
            <p className="content-subtitle">
              Live products fetched directly from PostgreSQL database via Express REST API.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Link to="/orders/new" className="btn-primary">
              <PlusCircle size={16} /> Place Test Order
            </Link>
          </div>
        </div>
      </div>

      {error && <ErrorAlert error={error} onRetry={fetchProducts} />}

      {/* Toolbar: Search & Category Filter */}
      <div className="toolbar">
        <form onSubmit={handleSearchSubmit} className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by title, SKU, or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#64748b', fontSize: '0.825rem' }}>
            <Filter size={14} /> Filter:
          </div>
          <select
            className="form-control"
            style={{ width: 'auto', padding: '0.45rem 0.75rem', fontSize: '0.825rem' }}
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
            <RefreshCw size={14} /> Refresh
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
                  <th>Price</th>
                  <th>Available Stock</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => {
                  const isLow = p.inventory_count <= 10;
                  const isOut = p.inventory_count === 0;

                  return (
                    <tr key={p.id}>
                      <td style={{ maxWidth: 320 }}>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{p.title}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>
                          SKU: <code>{p.sku}</code>
                        </div>
                        <div
                          style={{
                            fontSize: '0.75rem',
                            color: '#94a3b8',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: 300,
                            marginTop: '0.15rem',
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
                            padding: '0.2rem 0.5rem',
                            backgroundColor: '#f1f5f9',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            color: '#475569',
                          }}
                        >
                          <Tag size={12} /> {p.category}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                        ${parseFloat(p.price).toFixed(2)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span
                            style={{
                              fontWeight: 700,
                              color: isOut ? '#dc2626' : isLow ? '#d97706' : '#16a34a',
                            }}
                          >
                            {p.inventory_count}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>units</span>
                        </div>
                        {isLow && !isOut && (
                          <div style={{ fontSize: '0.675rem', color: '#d97706', fontWeight: 600 }}>
                            Low Stock
                          </div>
                        )}
                        {isOut && (
                          <div style={{ fontSize: '0.675rem', color: '#dc2626', fontWeight: 600 }}>
                            Out of Stock
                          </div>
                        )}
                      </td>
                      <td>
                        <StatusBadge status={isOut ? 'OUT_OF_STOCK' : p.status} />
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            className="btn-refresh"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                            onClick={() => setSelectedProduct(p)}
                            title="Inspect UUID and details"
                          >
                            <Eye size={13} /> View
                          </button>
                          <Link
                            to={`/orders/new?productId=${p.id}`}
                            className="btn-primary"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                            title="Order this product"
                          >
                            <ShoppingCart size={13} /> Order
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

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div className="sidebar-overlay" onClick={() => setSelectedProduct(null)}>
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: '#fff',
              padding: '1.75rem',
              borderRadius: '12px',
              maxWidth: '560px',
              width: '90%',
              zIndex: 60,
              boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>{selectedProduct.title}</h3>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Product Specification</span>
              </div>
              <button
                className="btn-refresh"
                style={{ padding: '0.25rem 0.5rem' }}
                onClick={() => setSelectedProduct(null)}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.875rem' }}>
              <div className="metric-row">
                <span className="metric-label">Product UUID:</span>
                <code style={{ fontSize: '0.775rem', background: '#f1f5f9', padding: '0.2rem 0.4rem', borderRadius: 4 }}>
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
                <span className="metric-val">${parseFloat(selectedProduct.price).toFixed(2)} {selectedProduct.currency}</span>
              </div>
              <div className="metric-row">
                <span className="metric-label">Warehouse Inventory:</span>
                <span className="metric-val">{selectedProduct.inventory_count} units available</span>
              </div>
              <div className="metric-row">
                <span className="metric-label">Catalog Status:</span>
                <StatusBadge status={selectedProduct.status} />
              </div>
              <div style={{ marginTop: '0.5rem' }}>
                <span className="metric-label" style={{ display: 'block', marginBottom: '0.25rem' }}>Description:</span>
                <p style={{ color: '#475569', fontSize: '0.85rem', lineHeight: 1.5, background: '#f8fafc', padding: '0.75rem', borderRadius: 6 }}>
                  {selectedProduct.description}
                </p>
              </div>
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button className="btn-refresh" onClick={() => setSelectedProduct(null)}>
                Close
              </button>
              <Link
                to={`/orders/new?productId=${selectedProduct.id}`}
                className="btn-primary"
                onClick={() => setSelectedProduct(null)}
              >
                <ShoppingCart size={15} /> Checkout with this item
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
