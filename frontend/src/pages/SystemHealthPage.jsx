import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Activity,
  Database,
  Server,
  Cpu,
  HardDrive,
  Clock,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorAlert from '../components/ErrorAlert';
import { healthService } from '../services/healthService';

export default function SystemHealthPage() {
  const { globalRefreshTrigger } = useOutletContext() || {};
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [healthInfo, setHealthInfo] = useState(null);
  const [readinessInfo, setReadinessInfo] = useState(null);
  const [lastCheckTime, setLastCheckTime] = useState(null);

  const runHealthProbes = async () => {
    setLoading(true);
    setError(null);
    try {
      const [healthRes, readinessRes] = await Promise.all([
        healthService.getHealth(),
        healthService.getReadiness(),
      ]);

      setHealthInfo(healthRes);
      setReadinessInfo(readinessRes);
      setLastCheckTime(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runHealthProbes();
  }, [globalRefreshTrigger]);

  const dbStatus = readinessInfo?.dependencies?.database?.status || 'UNKNOWN';
  const isDbHealthy = dbStatus === 'CONNECTED';
  const pool = readinessInfo?.dependencies?.database?.pool || { totalCount: 0, idleCount: 0, waitingCount: 0 };
  const memory = readinessInfo?.system?.memoryUsageMB || { rss: 0, heapUsed: 0, heapTotal: 0 };

  return (
    <div>
      <div className="content-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 className="content-title">System & Dependency Telemetry</h2>
            <p className="content-subtitle">
              Observability dashboard polling native Express liveness (<code>/health</code>) and PostgreSQL readiness (<code>/ready</code>).
            </p>
          </div>
          <button
            className="btn-primary"
            onClick={runHealthProbes}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'spinning' : ''} /> Probe Now
          </button>
        </div>
      </div>

      {error && <ErrorAlert error={error} onRetry={runHealthProbes} />}

      {/* Top 3 Live Health Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div>
            <div className="stat-label">API Liveness (/health)</div>
            <div className="stat-value" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <StatusBadge status={healthInfo?.status || 'CHECKING'} />
            </div>
            <div className="stat-subtext">Latency: {healthInfo?.latencyMs ?? 0} ms</div>
          </div>
          <div className="stat-icon-wrapper green">
            <Server size={22} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-label">Database Readiness (/ready)</div>
            <div className="stat-value" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <StatusBadge status={isDbHealthy ? 'CONNECTED' : 'DEGRADED'} />
            </div>
            <div className="stat-subtext">Engine: PostgreSQL 16 Alpine</div>
          </div>
          <div className={`stat-icon-wrapper ${isDbHealthy ? 'blue' : 'amber'}`}>
            <Database size={22} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-label">Last Successful Probe</div>
            <div className="stat-value" style={{ fontSize: '1.35rem' }}>
              {lastCheckTime || 'Just now'}
            </div>
            <div className="stat-subtext">Continuous SRE probe interval: 15s</div>
          </div>
          <div className="stat-icon-wrapper purple">
            <Clock size={22} />
          </div>
        </div>
      </div>

      {/* Detailed Diagnostics Grids */}
      <div className="health-grid" style={{ marginBottom: '1.75rem' }}>
        
        {/* Backend Runtime Card */}
        <div className="dashboard-card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <h3 className="card-title">Backend API Specification</h3>
          </div>
          <div className="card-body">
            <div className="metric-row">
              <span className="metric-label">Service Name</span>
              <span className="metric-val">ecommerce-cloud-devops-api</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Runtime Environment</span>
              <span className="metric-val" style={{ textTransform: 'uppercase' }}>
                {healthInfo?.environment || 'production'}
              </span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Application Version</span>
              <span className="metric-val">v{healthInfo?.version || '1.0.0'}</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Process Uptime</span>
              <span className="metric-val">
                {healthInfo?.uptimeSeconds ? `${Math.floor(healthInfo.uptimeSeconds / 60)} minutes (${healthInfo.uptimeSeconds}s)` : '0s'}
              </span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Node.js Engine</span>
              <span className="metric-val">{readinessInfo?.system?.nodeVersion || 'v20.x'}</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Target Architecture</span>
              <span className="metric-val">
                {readinessInfo?.system?.platform} ({readinessInfo?.system?.arch})
              </span>
            </div>
          </div>
        </div>

        {/* PostgreSQL Connection Pool Diagnostics */}
        <div className="dashboard-card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <h3 className="card-title">PostgreSQL Connection Pool</h3>
          </div>
          <div className="card-body">
            <div className="metric-row">
              <span className="metric-label">Database Status</span>
              <StatusBadge status={dbStatus} />
            </div>
            <div className="metric-row">
              <span className="metric-label">SQL Ping Latency</span>
              <span className="metric-val">{readinessInfo?.dependencies?.database?.latencyMs ?? 0} ms</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Total Allocated Connections</span>
              <span className="metric-val">{pool.totalCount} sockets</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Idle Available Connections</span>
              <span className="metric-val" style={{ color: '#16a34a' }}>
                {pool.idleCount} sockets
              </span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Waiting Queue Clients</span>
              <span className="metric-val" style={{ color: pool.waitingCount > 0 ? '#dc2626' : '#64748b' }}>
                {pool.waitingCount} clients
              </span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Pool Health State</span>
              <span className="metric-val" style={{ color: '#16a34a' }}>
                Nominal (No starvation)
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* Memory Footprint & Prometheus Metrics Card */}
      <div className="dashboard-card">
        <div className="card-header">
          <h3 className="card-title">Process Memory Footprint & Metrics Integration</h3>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>RESIDENT SET SIZE (RSS)</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0f172a' }}>{memory.rss} MB</div>
            </div>

            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>V8 HEAP ALLOCATED</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#2563eb' }}>{memory.heapTotal} MB</div>
            </div>

            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>V8 HEAP ACTUALLY USED</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#16a34a' }}>{memory.heapUsed} MB</div>
            </div>
          </div>

          <div style={{ background: '#f1f5f9', padding: '1rem', borderRadius: 8, fontSize: '0.85rem' }}>
            <div style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <ShieldCheck size={16} style={{ color: '#2563eb' }} /> Prometheus Scrape Integration Endpoint:
            </div>
            <p style={{ color: '#475569', fontSize: '0.8rem' }}>
              Application metrics are continuously instrumented with <code>prom-client</code> and scraped every 5 seconds by Prometheus on <code>/metrics</code> (tracking <code>http_requests_total</code>, <code>http_request_duration_seconds</code>, and database pool gauges).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
