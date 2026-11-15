import React from 'react';

export default function LoadingSpinner({ message = 'Loading live data from PostgreSQL...' }) {
  return (
    <div className="spinner-container">
      <div className="spinner" />
      <p style={{ fontSize: '0.875rem' }}>{message}</p>
    </div>
  );
}
