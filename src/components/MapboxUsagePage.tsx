import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type ServiceRow = { service: string; requests: number; successful_requests: number; error_requests: number; estimated_cost_usd: number };
type RestaurantRow = { restaurant_id: string | null; restaurant_name: string; requests: number; estimated_cost_usd: number };
type DailyRow = { usage_date: string; requests: number; estimated_cost_usd: number };

function dateRange(days: number) {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  return { start: start.toISOString(), end: end.toISOString() };
}

export default function MapboxUsagePage({ onBack }: { onBack: () => void }) {
  const [range, setRange] = useState<7 | 30>(30);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [restaurants, setRestaurants] = useState<RestaurantRow[]>([]);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadUsage = useCallback(async (initial = false) => {
    if (initial) setLoading(true); else setRefreshing(true);
    setError('');
    const { start, end } = dateRange(range);
    const [serviceResult, restaurantResult, dailyResult] = await Promise.all([
      supabase.rpc('system_admin_get_mapbox_usage', { p_start_at: start, p_end_at: end }),
      supabase.rpc('system_admin_get_mapbox_usage_by_restaurant', { p_start_at: start, p_end_at: end }),
      supabase.rpc('system_admin_get_mapbox_usage_daily', { p_start_at: start, p_end_at: end }),
    ]);
    const firstError = serviceResult.error || restaurantResult.error || dailyResult.error;
    if (firstError) {
      setError(firstError.message);
      setServices([]); setRestaurants([]); setDaily([]);
    } else {
      setServices((serviceResult.data ?? []) as ServiceRow[]);
      setRestaurants((restaurantResult.data ?? []) as RestaurantRow[]);
      setDaily((dailyResult.data ?? []) as DailyRow[]);
    }
    if (initial) setLoading(false); else setRefreshing(false);
  }, [range]);

  useEffect(() => { void loadUsage(true); }, [loadUsage]);

  const totalRequests = useMemo(() => services.reduce((sum, row) => sum + Number(row.requests || 0), 0), [services]);
  const totalErrors = useMemo(() => services.reduce((sum, row) => sum + Number(row.error_requests || 0), 0), [services]);
  const totalCost = useMemo(() => services.reduce((sum, row) => sum + Number(row.estimated_cost_usd || 0), 0), [services]);
  const maxDaily = Math.max(1, ...daily.map((row) => Number(row.requests || 0)));

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div className="brand-block">
          <img className="company-logo" src="/web2table-system-admin/web2table.png" alt="WEB2TABLE" />
          <div><div className="eyebrow">WEB2TABLE Platform</div><h1>Mapbox Usage</h1></div>
        </div>
        <div className="platform-health-header-actions">
          <button className="secondary-button" type="button" onClick={onBack}>Dashboard</button>
          <button className="secondary-button" type="button" onClick={() => void loadUsage(false)} disabled={refreshing}>{refreshing ? 'Refreshing...' : 'Refresh'}</button>
        </div>
      </header>
      <section className="dashboard-card mapbox-usage-card">
        <div className="mapbox-usage-toolbar">
          <div>
            <div className="eyebrow">Cost & Usage Control</div>
            <h2>Mapbox</h2>
            <p>Web2Table usage recorded by backend Mapbox operations. Route requests should only be recorded after a customer confirms a delivery location.</p>
          </div>
          <div className="segmented-control" aria-label="Usage period">
            <button className={range === 7 ? 'active' : ''} type="button" onClick={() => setRange(7)}>7 days</button>
            <button className={range === 30 ? 'active' : ''} type="button" onClick={() => setRange(30)}>30 days</button>
          </div>
        </div>
        {error && <div className="error-banner">{error}</div>}
        {loading ? <div className="empty-state">Loading Mapbox usage...</div> : (
          <>
            <div className="mapbox-usage-metrics">
              <article><span>Total requests</span><strong>{totalRequests.toLocaleString()}</strong><small>Recorded in selected period</small></article>
              <article><span>Estimated cost</span><strong>{'$' + totalCost.toFixed(2)}</strong><small>Based on recorded billable usage</small></article>
              <article><span>Errors / blocked</span><strong>{totalErrors.toLocaleString()}</strong><small>Requests that did not complete successfully</small></article>
              <article><span>Active services</span><strong>{services.length}</strong><small>Mapbox services recorded</small></article>
            </div>
            <div className="dashboard-section-label">Service usage</div>
            {services.length === 0 ? <div className="empty-state">No Mapbox usage has been recorded yet.</div> : (
              <div className="mapbox-usage-table-wrap"><table className="mapbox-usage-table"><thead><tr><th>Service</th><th>Requests</th><th>Successful</th><th>Errors</th><th>Estimated cost</th></tr></thead><tbody>
                {services.map((row) => <tr key={row.service}><td><strong>{row.service}</strong></td><td>{Number(row.requests).toLocaleString()}</td><td>{Number(row.successful_requests).toLocaleString()}</td><td>{Number(row.error_requests).toLocaleString()}</td><td>{'$' + Number(row.estimated_cost_usd).toFixed(2)}</td></tr>)}
              </tbody></table></div>
            )}
            <div className="dashboard-section-label">Daily requests</div>
            {daily.length === 0 ? <div className="empty-state">No daily usage recorded yet.</div> : (
              <div className="mapbox-usage-bars">
                {daily.map((row) => {
                  const requests = Number(row.requests);
                  return <div className="mapbox-usage-bar-row" key={row.usage_date}><span>{new Date(row.usage_date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span><div className="mapbox-usage-bar-track"><div className="mapbox-usage-bar" style={{ width: Math.max(2, (requests / maxDaily) * 100) + '%' }} /></div><strong>{requests.toLocaleString()}</strong></div>;
                })}
              </div>
            )}
            <div className="dashboard-section-label">Usage by restaurant</div>
            {restaurants.length === 0 ? <div className="empty-state">No restaurant-level Mapbox usage recorded yet.</div> : (
              <div className="mapbox-usage-table-wrap"><table className="mapbox-usage-table"><thead><tr><th>Restaurant</th><th>Requests</th><th>Estimated cost</th></tr></thead><tbody>
                {restaurants.map((row) => <tr key={row.restaurant_id ?? 'unassigned'}><td><strong>{row.restaurant_name}</strong></td><td>{Number(row.requests).toLocaleString()}</td><td>{'$' + Number(row.estimated_cost_usd).toFixed(2)}</td></tr>)}
              </tbody></table></div>
            )}
            <div className="mapbox-usage-note"><strong>Cost protection</strong><span>This dashboard tracks Web2Table requests. Mapbox account dashboard remains the billing source of truth. Usage quotas should still be configured in Mapbox to protect the platform from unexpected spikes.</span></div>
          </>
        )}
      </section>
    </main>
  );
}
