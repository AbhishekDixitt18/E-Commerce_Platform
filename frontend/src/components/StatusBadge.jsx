import React from 'react';

export default function StatusBadge({ status }) {
  const normStatus = (status || '').toUpperCase();

  let badgeClass = 'badge-info';
  if (['ACTIVE', 'PAID', 'UP', 'CONNECTED', 'DELIVERED'].includes(normStatus)) {
    badgeClass = 'badge-success';
  } else if (['PENDING', 'PROCESSING', 'LOW_STOCK', 'DEGRADED', 'WARNING'].includes(normStatus)) {
    badgeClass = 'badge-warning';
  } else if (['INACTIVE', 'CANCELLED', 'OUT_OF_STOCK', 'DOWN', 'DISCONNECTED', 'FAILED'].includes(normStatus)) {
    badgeClass = 'badge-danger';
  }

  return (
    <span className={`badge ${badgeClass}`}>
      <span className="pulse-dot" style={{ width: 6, height: 6 }} />
      {normStatus}
    </span>
  );
}
