import React from 'react';
import { PackageOpen } from 'lucide-react';

export default function EmptyState({
  title = 'No records found',
  description = 'No data currently available from the database.',
  icon: Icon = PackageOpen,
  actionText,
  onAction,
}) {
  return (
    <div className="empty-state">
      <Icon className="empty-state-icon" />
      <h3 className="empty-state-title">{title}</h3>
      <p style={{ maxWidth: 400, margin: '0 auto 1.25rem', fontSize: '0.875rem' }}>{description}</p>
      {actionText && onAction && (
        <button className="btn-primary" onClick={onAction}>
          {actionText}
        </button>
      )}
    </div>
  );
}
