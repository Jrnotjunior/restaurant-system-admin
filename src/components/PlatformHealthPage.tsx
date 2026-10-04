import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type ServiceStatus = 'healthy' | 'degraded' | 'critical' | 'unknown';

type HealthService = {
  key: string;
  name: string;
  status: ServiceStatus;
  latencyMs: number | null;
  message: string;
  details?: Record<string, unknown>;
};

type Incident = {
  severity: 'info' | 'warning' | 'critical';
  service: string;
  title: string;
  summary: string;
  likelyCause?: string;
  impact?: string;
  recommendation?: string;
};

type HealthReport = {
  overallStatus: ServiceStatus;
  generatedAt: string;
  services: HealthService[];
  incidents: Incident[];
  aiSummary: string;
  aiConfidence: number | null;
  configurationWarnings?: string[];
};

const statusLabel: Record<ServiceStatus, string> = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  critical: 'Critical',
  unknown: 'Unknown',
};

function StatusDot({ status }: { status: ServiceStatus }) {
  return <span className={`platform-health-dot platform-health-dot-${status}`} aria-hidden="true" />;
}

export default function PlatformHealthPage({ onBack }: { onBack: () => void }) {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const runHealthCheck = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    setError('');

    const { data, error: invokeError } = await supabase.functions.invoke('system-admin-platform-health', {
      body: {},
    });

    if (invokeError) {
      let message = invokeError.message;
      try {
        const response = (invokeError as { context?: Response }).context;
        if (response) {
          const body = await response.clone().json() as { error?: unknown };
          if (typeof body.error === 'string' && body.error.trim()) message = body.error;
        }
      } catch {
        // Keep the function error message.
      }
      setError(message);
      setReport(null);
    } else {
      setReport(data as HealthReport);
    }

    if (initial) setLoading(false);
    else setRefreshing(false);
  }, []);

  useEffect(() => {
    void runHealthCheck(true);
    const timer = window.setInterval(() => void runHealthCheck(false), 60_000);
    return () => window.clearInterval(timer);
  }, [runHealthCheck]);

  const overall = report?.overallStatus ?? 'unknown';

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div className="brand-block">
          <img className="company-logo" src="/web2table-system-admin/web2table.png" alt="WEB2TABLE" />
          <div>
            <div className="eyebrow">WEB2TABLE Platform</div>
            <h1>Platform Health</h1>
          </div>
        </div>
        <div className="platform-health-header-actions"><button className="secondary-button" type="button" onClick={onBack}>Dashboard</button><button className="secondary-button" type="button" onClick={() => void runHealthCheck(false)} disabled={refreshing}>
          {refreshing ? 'Checking...' : 'Run health check'}
        </button></div>
      </header>

      <section className="dashboard-card platform-health-card">
        <div className={`platform-health-overview platform-health-overview-${overall}`}>
          <div>
            <div className="eyebrow">Overall Platform Status</div>
            <h2><StatusDot status={overall} /> {statusLabel[overall]}</h2>
            <p>
              {report
                ? `Last checked ${new Date(report.generatedAt).toLocaleString()}`
                : 'Checking platform dependencies...'}
            </p>
          </div>
          {report?.aiConfidence != null && (
            <div className="platform-health-confidence">
              AI confidence<br /><strong>{Math.round(report.aiConfidence * 100)}%</strong>
            </div>
          )}
        </div>

        {error && <div className="error-banner">{error}</div>}

        {loading && !report ? (
          <div className="empty-state">Checking Web2Table dependencies...</div>
        ) : report ? (
          <>
            {report.configurationWarnings && report.configurationWarnings.length > 0 && (
              <div className="platform-health-warning">
                <strong>Configuration required</strong>
                {report.configurationWarnings.map((warning) => <span key={warning}>{warning}</span>)}
              </div>
            )}

            <div className="dashboard-section-label">Dependencies</div>
            <div className="platform-health-services">
              {report.services.map((service) => (
                <article className="platform-health-service" key={service.key}>
                  <div className="platform-health-service-heading">
                    <div>
                      <h3><StatusDot status={service.status} /> {service.name}</h3>
                      <p>{service.message}</p>
                    </div>
                    <span className={`status platform-health-status-${service.status}`}>
                      {statusLabel[service.status]}
                    </span>
                  </div>
                  {service.latencyMs != null && (
                    <div className="platform-health-metric">Response: <strong>{service.latencyMs} ms</strong></div>
                  )}
                </article>
              ))}
            </div>

            <div className="dashboard-section-label">AI Operations Analysis</div>
            <div className="platform-health-ai">
              <div className="eyebrow">Read-only AI diagnosis</div>
              <p>{report.aiSummary}</p>
            </div>

            <div className="dashboard-section-label">Active Incidents</div>
            {report.incidents.length === 0 ? (
              <div className="empty-state platform-health-empty">No active incidents detected.</div>
            ) : (
              <div className="platform-health-incidents">
                {report.incidents.map((incident, index) => (
                  <article className={`platform-health-incident platform-health-incident-${incident.severity}`} key={`${incident.service}-${incident.title}-${index}`}>
                    <div className="platform-health-incident-top">
                      <span className={`platform-health-severity platform-health-severity-${incident.severity}`}>{incident.severity}</span>
                      <strong>{incident.service}</strong>
                    </div>
                    <h3>{incident.title}</h3>
                    <p>{incident.summary}</p>
                    {incident.likelyCause && <div><strong>Likely cause:</strong> {incident.likelyCause}</div>}
                    {incident.impact && <div><strong>Impact:</strong> {incident.impact}</div>}
                    {incident.recommendation && <div><strong>Recommended action:</strong> {incident.recommendation}</div>}
                  </article>
                ))}
              </div>
            )}
          </>
        ) : null}
      </section>
    </main>
  );
}
