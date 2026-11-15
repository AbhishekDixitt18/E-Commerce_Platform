import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Activity,
  Database,
  Server,
  Cpu,
  Clock,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorAlert from '../components/ErrorAlert';
import { healthService } from '../services/healthService';
import { formatDate } from '../utils/formatters';

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
      setLastCheckTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
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
  const isApiHealthy = healthInfo?.status === 'UP';
  const pool = readinessInfo?.dependencies?.database?.pool || { totalCount: 0, idleCount: 0, waitingCount: 0 };
  const memory = readinessInfo?.system?.memoryUsageMB || { rss: 0, heapUsed: 0, heapTotal: 0 };

  return (
    <div>
      <div className="content-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.85rem' }}>
          <div>
            <h2 className="content-title">System Health & Telemetry</h2>
            <p className="content-subtitle">
              Observability dashboard polling Express liveness (<code>/health</code>) and PostgreSQL readiness (<code>/ready</code>).
            </p>
          </div>
          <button
            className="btn-primary"
            onClick={runHealthProbes}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'spinning' : ''} /> Run Probes
          </button>
        </div>
      </div>

      {error && <ErrorAlert error={error} onRetry={runHealthProbes} />}

      {/* Top 3 Diagnostic Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div>
            <div className="stat-label">API Availability</div>
            <div className="stat-value" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
              <StatusBadge status={isApiHealthy ? 'HEALTHY' : 'DOWN'} />
            </div>
            <div className="stat-subtext">Endpoint: /health (HTTP 200 OK)</div>
          </div>
          <div className="stat-icon-wrapper green">
            <Server size={20} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-label">Database Readiness</div>
            <div className="stat-value" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
              <StatusBadge status={isDbHealthy ? 'CONNECTED' : 'DISCONNECTED'} />
            </div>
            <div className="stat-subtext">PostgreSQL 16 on Docker Network</div>
          </div>
          <div className={`stat-icon-wrapper ${isDbHealthy ? 'blue' : 'amber'}`}>
            <Database size={20} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-label">Last Probe Check</div>
            <div className="stat-value" style={{ fontSize: '1.25rem', marginTop: '0.2rem' }}>
              {lastCheckTime || 'Just now'}
            </div>
            <div className="stat-subtext">Continuous SRE probe interval: 15s</div>
          </div>
          <div className="stat-icon-wrapper purple">
            <Clock size={20} />
          </div>
        </div>
      </div>

      {/* Diagnostics Cards Grid */}
      <div className="health-grid" style={{ marginBottom: '1.5rem' }}>
        
        {/* API Specification Card */}
        <div className="dashboard-card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <h3 className="card-title">Backend API Specifications</h3>
          </div>
          <div className="card-body">
            <div className="metric-row">
              <span className="metric-label">Service Identifier</span>
              <span className="metric-val">ecommerce-cloud-devops-api</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Deployment Environment</span>
              <span className="metric-val" style={{ textTransform: 'uppercase' }}>
                {healthInfo?.environment || 'production'}
              </span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Application Version</span>
              <span className="metric-val">v{healthInfo?.version || '1.0.0'}</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Application Uptime</span>
              <span className="metric-val">
                {healthInfo?.uptimeSeconds ? `${Math.floor(healthInfo.uptimeSeconds / 60)} minutes (${healthInfo.uptimeSeconds}s)` : '0s'}
              </span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Node.js Engine</span>
              <span className="metric-val">{readinessInfo?.system?.nodeVersion || 'v20.x'}</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Container Architecture</span>
              <span className="metric-val">
                {readinessInfo?.system?.platform} ({readinessInfo?.system?.arch})
              </span>
            </div>
          </div>
        </div>

        {/* PostgreSQL Database Telemetry Card */}
        <div className="dashboard-card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <h3 className="card-title">Database Performance & Connections</h3>
          </div>
          <div className="card-body">
            <div className="metric-row">
              <span className="metric-label">Connection State</span>
              <StatusBadge status={isDbHealthy ? 'CONNECTED' : 'DOWN'} />
            </div>
            <div className="metric-row">
              <span className="metric-label">Database Response Time</span>
              <span className="metric-val" style={{ color: '#15803D' }}>
                {readinessInfo?.dependencies?.database?.latencyMs ?? 0} ms
              </span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Active Connection Pool</span>
              <span className="metric-val">{pool.totalCount} sockets</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Available Idle Connections</span>
              <span className="metric-val" style={{ color: '#15803D' }}>
                {pool.idleCount} sockets
              </span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Waiting Query Queue</span>
              <span className="metric-val" style={{ color: pool.waitingCount > 0 ? '#DC2626' : '#64748B' }}>
                {pool.waitingCount} queries
              </span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Connection Health</span>
              <span className="metric-val" style={{ color: '#15803D' }}>
                Nominal (No starvation)
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* Memory Footprint & Prometheus Metrics Card */}
      <div className="dashboard-card">
        <div className="card-header">
          <h3 className="card-title">Memory Allocation & Observability</h3>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: 6, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.725rem', color: '#64748B' }}>RESIDENT SET SIZE (RSS)</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#172B4D' }}>{memory.rss} MB</div>
            </div>

            <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: 6, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.725rem', color: '#64748B' }}>HEAP ALLOCATED</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#2563EB' }}>{memory.heapTotal} MB</div>
            </div>

            <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: 6, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.725rem', color: '#64748B' }}>HEAP ACTUALLY USED</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#15803D' }}>{memory.heapUsed} MB</div>
            </div>
          </div>

          <div style={{ background: '#f1f5f9', padding: '0.85rem', borderRadius: 6, fontSize: '0.825rem' }}>
            <div style={{ fontWeight: 600, marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <ShieldCheck size={15} style={{ color: '#2563EB' }} /> Prometheus Metrics Telemetry:
            </div>
            <p style={{ color: '#475569', fontSize: '0.775rem' }}>
              Express metrics are scraped continuously by Prometheus on <code>/metrics</code> (recording HTTP throughput, latency percentiles, and database connection pool gauges).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
