import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function ErrorAlert({ error, onRetry }) {
  const errorMessage = typeof error === 'string' ? error : error?.message || 'Failed to communicate with backend service';

  return (
    <div className="alert alert-danger" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        <AlertCircle size={20} style={{ flexShrink: 0 }} />
        <div>
          <strong>Error: </strong>
          <span>{errorMessage}</span>
          {error?.details && error.details.length > 0 && (
            <ul style={{ marginTop: '0.25rem', paddingLeft: '1.25rem', fontSize: '0.8rem' }}>
              {error.details.map((d, i) => (
                <li key={i}>{d.message || d.detail || JSON.stringify(d)}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="btn-refresh"
          style={{ borderColor: '#fca5a5', color: '#991b1b', background: '#fff' }}
        >
          <RefreshCw size={14} /> Retry
        </button>
      )}
    </div>
  );
}
