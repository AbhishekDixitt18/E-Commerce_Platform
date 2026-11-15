import React, { useState, useEffect } from 'react';
import { Menu, RefreshCw } from 'lucide-react';
import { healthService } from '../services/healthService';

export default function Header({ pageTitle, onMenuToggle, onRefresh }) {
  const [connectionStatus, setConnectionStatus] = useState('checking'); // 'online' | 'offline' | 'checking'
  const [isRefreshing, setIsRefreshing] = useState(false);

  const checkConnection = async () => {
    try {
      const res = await healthService.getHealth();
      if (res.status === 'UP') {
        setConnectionStatus('online');
      } else {
        setConnectionStatus('checking');
      }
    } catch {
      setConnectionStatus('offline');
    }
  };

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleRefreshClick = async () => {
    setIsRefreshing(true);
    await checkConnection();
    if (onRefresh) {
      await onRefresh();
    }
    setTimeout(() => setIsRefreshing(false), 400);
  };

  return (
    <header className="header">
      <div className="header-left">
        <button
          className="menu-toggle-btn"
          onClick={onMenuToggle}
          aria-label="Toggle navigation menu"
        >
          <Menu size={20} />
        </button>
        <h1 className="page-title">{pageTitle || 'E-Commerce Cloud Platform'}</h1>
      </div>

      <div className="header-right">
        <div className={`connection-pill ${connectionStatus}`}>
          <span className="pulse-dot" />
          <span>
            {connectionStatus === 'online'
              ? 'Backend Connected'
              : connectionStatus === 'offline'
              ? 'Backend Unreachable'
              : 'Verifying Connection...'}
          </span>
        </div>

        <button
          className={`btn-refresh ${isRefreshing ? 'spinning' : ''}`}
          onClick={handleRefreshClick}
          title="Refresh Data from Backend"
        >
          <RefreshCw size={13} />
          <span>Refresh</span>
        </button>
      </div>
    </header>
  );
}
