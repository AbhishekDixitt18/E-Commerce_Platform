import React from 'react';

/**
 * Enterprise Status Badge Component
 * Clean, subtle rectangular badge with crisp typography (no pill bubble bloat)
 */
export default function StatusBadge({ status }) {
  const rawStatus = (status || '').toUpperCase();

  let badgeClass = 'badge-info';
  let displayLabel = rawStatus;

  if (['ACTIVE', 'PAID', 'UP', 'CONNECTED', 'DELIVERED', 'IN_STOCK', 'HEALTHY'].includes(rawStatus)) {
    badgeClass = 'badge-success';
    if (rawStatus === 'UP') displayLabel = 'Operational';
    if (rawStatus === 'ACTIVE') displayLabel = 'In Stock';
  } else if (['PENDING', 'PROCESSING', 'LOW_STOCK', 'DEGRADED', 'WARNING', 'CHECKING'].includes(rawStatus)) {
    badgeClass = 'badge-warning';
    if (rawStatus === 'LOW_STOCK') displayLabel = 'Low Stock';
  } else if (['INACTIVE', 'CANCELLED', 'OUT_OF_STOCK', 'DOWN', 'DISCONNECTED', 'FAILED'].includes(rawStatus)) {
    badgeClass = 'badge-danger';
    if (rawStatus === 'OUT_OF_STOCK') displayLabel = 'Out of Stock';
  }

  return (
    <span className={`badge ${badgeClass}`}>
      <span className="pulse-dot" style={{ width: 5, height: 5 }} />
      {displayLabel}
    </span>
  );
}
