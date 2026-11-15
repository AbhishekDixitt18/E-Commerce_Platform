import React from 'react';

export default function StatCard({ title, value, subtext, icon: Icon, color = 'blue' }) {
  return (
    <div className="stat-card">
      <div>
        <div className="stat-label">{title}</div>
        <div className="stat-value">{value}</div>
        {subtext && <div className="stat-subtext">{subtext}</div>}
      </div>
      {Icon && (
        <div className={`stat-icon-wrapper ${color}`}>
          <Icon size={22} />
        </div>
      )}
    </div>
  );
}
