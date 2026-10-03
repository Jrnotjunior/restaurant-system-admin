import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { supabase } from './lib/supabase';

type Restaurant = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  logo_url: string | null;
  location_text: string | null;
  contact_number: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type RestaurantForm = {
  name: string;
  slug: string;
  tagline: string;
  logo_url: string;
  location_text: string;
  contact_number: string;
  email: string;
  is_active: boolean;
};

const emptyForm: RestaurantForm = {
  name: '',
  slug: '',
  tagline: '',
  logo_url: '',
  location_text: '',
  contact_number: '',
  email: '',
  is_active: true,
};

function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signedIn, setSignedIn] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [restaurantLoading, setRestaurantLoading] = useState(false);
  const [restaurantError, setRestaurantError] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingRestaurant, setEditingRestaurant] = useState<Restaurant | null>(null);
  const [form, setForm] = useState<RestaurantForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);

  async function checkAdminSession() {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;

    if (!session) {
      setSignedIn(false);
      setAuthorized(false);
      setLoading(false);
      return false;
    }

    setSignedIn(true);

    const { data: adminStatus, error } = await supabase.rpc('get_my_system_admin_status');

    if (error || adminStatus !== true) {
      await supabase.auth.signOut();
      setSignedIn(false);
      setAuthorized(false);
      setLoading(false);
      return false;
    }

    setAuthorized(true);
    setLoading(false);
    return true;
  }

  useEffect(() => {
    let active = true;

    checkAdminSession().then(() => {
      if (!active) return;
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setSignedIn(false);
        setAuthorized(false);
        setRestaurants([]);
        return;
      }

      setSignedIn(true);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signIn(event: FormEvent) {
    event.preventDefault();

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      window.alert(error.message);
      return;
    }

    const { data: adminStatus, error: adminError } = await supabase.rpc('get_my_system_admin_status');

    if (adminError) {
      await supabase.auth.signOut();
      setAuthorized(false);
      window.alert(adminError.message);
      return;
    }

    if (adminStatus !== true) {
      await supabase.auth.signOut();
      setSignedIn(false);
      setAuthorized(false);
      window.alert('This account is not authorized as a System Administrator.');
      return;
    }

    setAuthorized(true);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function loadRestaurants() {
    setRestaurantLoading(true);
    setRestaurantError('');

    const { data, error } = await supabase
      .from('restaurants')
      .select('id,slug,name,tagline,logo_url,location_text,contact_number,email,is_active,created_at,updated_at')
      .order('created_at', { ascending: false });

    if (error) {
      setRestaurantError(error.message);
      setRestaurants([]);
    } else {
      setRestaurants((data ?? []) as Restaurant[]);
    }

    setRestaurantLoading(false);
  }

  useEffect(() => {
    if (!authorized) return;

    void loadRestaurants();

    const channel = supabase
      .channel('system-admin-restaurants')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'restaurants' },
        (payload) => {
          const newRow = payload.new as Restaurant;
          const oldRow = payload.old as Restaurant;

          setRestaurants((current) => {
            if (payload.eventType === 'INSERT') {
              if (current.some((restaurant) => restaurant.id === newRow.id)) return current;
              return [newRow, ...current];
            }

            if (payload.eventType === 'UPDATE') {
              return current
                .map((restaurant) => restaurant.id === newRow.id ? newRow : restaurant)
                .sort((a, b) => b.created_at.localeCompare(a.created_at));
            }

            if (payload.eventType === 'DELETE') {
              return current.filter((restaurant) => restaurant.id !== oldRow.id);
            }

            return current;
          });

          if (payload.eventType === 'UPDATE' && selectedRestaurant?.id === newRow.id) {
            setSelectedRestaurant(newRow);
          }

          if (payload.eventType === 'DELETE' && selectedRestaurant?.id === oldRow.id) {
            setSelectedRestaurant(null);
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [authorized, selectedRestaurant?.id]);

  const filteredRestaurants = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return restaurants;

    return restaurants.filter((restaurant) =>
      [restaurant.name, restaurant.slug, restaurant.location_text ?? '', restaurant.email ?? '']
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [restaurants, search]);

  function openRestaurant(restaurant: Restaurant) {
    setSelectedRestaurant(restaurant);
    setRestaurantError('');
  }

  function closeRestaurant() {
    setSelectedRestaurant(null);
  }

  function startCreate() {
    setEditingRestaurant(null);
    setForm(emptyForm);
    setRestaurantError('');
    setShowForm(true);
  }

  function startEdit(restaurant: Restaurant) {
    setEditingRestaurant(restaurant);
    setForm({
      name: restaurant.name,
      slug: restaurant.slug,
      tagline: restaurant.tagline,
      logo_url: restaurant.logo_url ?? '',
      location_text: restaurant.location_text ?? '',
      contact_number: restaurant.contact_number ?? '',
      email: restaurant.email ?? '',
      is_active: restaurant.is_active,
    });
    setRestaurantError('');
    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;
    setShowForm(false);
    setEditingRestaurant(null);
    setForm(emptyForm);
  }

  function updateForm(field: keyof RestaurantForm, value: string | boolean) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function saveRestaurant(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setRestaurantError('');

    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim().toLowerCase(),
      tagline: form.tagline.trim(),
      logo_url: form.logo_url.trim() || null,
      location_text: form.location_text.trim() || null,
      contact_number: form.contact_number.trim() || null,
      email: form.email.trim() || null,
      is_active: form.is_active,
    };

    const result = editingRestaurant
      ? await supabase.from('restaurants').update(payload).eq('id', editingRestaurant.id)
      : await supabase.from('restaurants').insert(payload);

    if (result.error) {
      setRestaurantError(result.error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    closeForm();
    await loadRestaurants();
  }

  async function toggleRestaurant(restaurant: Restaurant) {
    const nextStatus = !restaurant.is_active;
    setRestaurantError('');

    const { error } = await supabase
      .from('restaurants')
      .update({ is_active: nextStatus })
      .eq('id', restaurant.id);

    if (error) {
      setRestaurantError(error.message);
      return;
    }

    await loadRestaurants();
  }

  if (loading) return <main className="screen-center">Loading...</main>;

  if (!signedIn) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <img className="company-logo auth-logo" src="/web2table-system-admin/web2table.png" alt="WEB2TABLE" />
          <div className="eyebrow">WEB2TABLE Platform</div>
          <h1>System Admin</h1>
          <p>Sign in to manage restaurants and platform settings.</p>
          <form onSubmit={signIn}>
            <label>
              Email
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
            </label>
            <label>
              Password
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
            </label>
            <button type="submit">Sign in</button>
          </form>
        </section>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="eyebrow">WEB2TABLE Platform</div>
          <h1>Access denied</h1>
          <p>Your account is signed in but is not authorized as a System Administrator.</p>
          <button onClick={signOut}>Sign out</button>
        </section>
      </main>
    );
  }

  if (selectedRestaurant) {
    return (
      <main className="admin-shell">
        <header className="admin-header">
          <div className="brand-block">
            <img className="company-logo" src="/web2table-system-admin/web2table.png" alt="WEB2TABLE" />
            <div>
              <div className="eyebrow">WEB2TABLE Platform</div>
              <h1>System Admin</h1>
            </div>
          </div>
          <button className="secondary-button" onClick={signOut}>Sign out</button>
        </header>

        <button className="back-button" onClick={closeRestaurant}>← Back to restaurants</button>

        <section className="dashboard-card restaurant-manage-card">
          <div className="restaurant-manage-hero">
            <div className="restaurant-hero-main">
              <div className="restaurant-hero-logo">
                {selectedRestaurant.logo_url ? (
                  <img src={selectedRestaurant.logo_url} alt="" />
                ) : (
                  <span>{selectedRestaurant.name.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div>
                <div className="eyebrow">Restaurant Management</div>
                <h2>{selectedRestaurant.name}</h2>
                <div className="restaurant-slug">/{selectedRestaurant.slug}</div>
              </div>
            </div>
            <span className={selectedRestaurant.is_active ? 'status active' : 'status inactive'}>
              {selectedRestaurant.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>

          <nav className="manage-tabs" aria-label="Restaurant management sections">
            <button className="manage-tab active" type="button">Overview</button>
            <button className="manage-tab" type="button" disabled>Owner</button>
            <button className="manage-tab" type="button" disabled>Domain</button>
            <button className="manage-tab" type="button" disabled>Settings</button>
            <button className="manage-tab" type="button" disabled>Staff</button>
          </nav>

          <div className="manage-overview">
            <div className="overview-section">
              <div className="eyebrow">Restaurant Information</div>
              <h3>Basic details</h3>
              <div className="detail-grid">
                <div className="detail-item"><span>Restaurant name</span><strong>{selectedRestaurant.name}</strong></div>
                <div className="detail-item"><span>Slug</span><strong>/{selectedRestaurant.slug}</strong></div>
                <div className="detail-item"><span>Tagline</span><strong>{selectedRestaurant.tagline || '—'}</strong></div>
                <div className="detail-item"><span>Location</span><strong>{selectedRestaurant.location_text || '—'}</strong></div>
                <div className="detail-item"><span>Contact number</span><strong>{selectedRestaurant.contact_number || '—'}</strong></div>
                <div className="detail-item"><span>Email</span><strong>{selectedRestaurant.email || '—'}</strong></div>
              </div>
            </div>

            <div className="overview-section">
              <div className="eyebrow">Platform Status</div>
              <h3>Restaurant access</h3>
              <div className="status-panel">
                <div>
                  <strong>{selectedRestaurant.is_active ? 'Restaurant is active' : 'Restaurant is inactive'}</strong>
                  <span>{selectedRestaurant.is_active ? 'Customers can access this restaurant.' : 'Customers cannot access this restaurant while inactive.'}</span>
                </div>
                <button className={selectedRestaurant.is_active ? 'danger-button' : 'secondary-button'} onClick={async () => {
                  await toggleRestaurant(selectedRestaurant);
                  const { data } = await supabase.from('restaurants').select('id,slug,name,tagline,logo_url,location_text,contact_number,email,is_active,created_at,updated_at').eq('id', selectedRestaurant.id).single();
                  if (data) setSelectedRestaurant(data as Restaurant);
                }}>
                  {selectedRestaurant.is_active ? 'Deactivate restaurant' : 'Activate restaurant'}
                </button>
              </div>
            </div>

            <div className="manage-next-card">
              <div>
                <div className="eyebrow">Coming next</div>
                <h3>Owner, domain, settings and staff</h3>
                <p>These sections will be connected to the restaurant's platform configuration from here.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div className="brand-block">
          <img className="company-logo" src="/web2table-system-admin/web2table.png" alt="WEB2TABLE" />
          <div>
            <div className="eyebrow">WEB2TABLE Platform</div>
            <h1>System Admin</h1>
          </div>
        </div>
        <button className="secondary-button" onClick={signOut}>Sign out</button>
      </header>

      <section className="dashboard-card">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Platform Management</div>
            <h2>Restaurants</h2>
            <p>Manage restaurants connected to this ordering platform.</p>
          </div>
          <button onClick={startCreate}>Add restaurant</button>
        </div>

        <div className="stats-row">
          <div className="stat-card">
            <span>Total restaurants</span>
            <strong>{restaurants.length}</strong>
          </div>
          <div className="stat-card">
            <span>Active</span>
            <strong>{restaurants.filter((restaurant) => restaurant.is_active).length}</strong>
          </div>
          <div className="stat-card">
            <span>Inactive</span>
            <strong>{restaurants.filter((restaurant) => !restaurant.is_active).length}</strong>
          </div>
        </div>

        <div className="toolbar">
          <input
            className="search-input"
            type="search"
            placeholder="Search restaurants..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <span className="live-indicator"><span className="live-dot" /> Live</span>
        </div>

        {restaurantError && <div className="error-banner">{restaurantError}</div>}

        {restaurantLoading ? (
          <div className="empty-state">Loading restaurants...</div>
        ) : filteredRestaurants.length === 0 ? (
          <div className="empty-state">
            <strong>{restaurants.length === 0 ? 'No restaurants yet' : 'No matching restaurants'}</strong>
            <span>{restaurants.length === 0 ? 'Add the first restaurant to start building the platform.' : 'Try a different search term.'}</span>
          </div>
        ) : (
          <div className="restaurant-list">
            {filteredRestaurants.map((restaurant) => (
              <article className="restaurant-row" key={restaurant.id}>
                <div className="restaurant-main">
                  <div className="restaurant-logo">
                    {restaurant.logo_url ? <img src={restaurant.logo_url} alt="" /> : <span>{restaurant.name.charAt(0).toUpperCase()}</span>}
                  </div>
                  <div>
                    <div className="restaurant-title-line">
                      <h3>{restaurant.name}</h3>
                      <span className={restaurant.is_active ? 'status active' : 'status inactive'}>
                        {restaurant.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="restaurant-slug">/{restaurant.slug}</div>
                    {restaurant.tagline && <p>{restaurant.tagline}</p>}
                    <div className="restaurant-meta">
                      {restaurant.location_text && <span>{restaurant.location_text}</span>}
                      {restaurant.email && <span>{restaurant.email}</span>}
                      {restaurant.contact_number && <span>{restaurant.contact_number}</span>}
                    </div>
                  </div>
                </div>

                <div className="row-actions">
                  <button className="secondary-button" onClick={() => openRestaurant(restaurant)}>Manage</button>
                  <button className="secondary-button" onClick={() => startEdit(restaurant)}>Edit</button>
                  <button className={restaurant.is_active ? 'danger-button' : 'secondary-button'} onClick={() => toggleRestaurant(restaurant)}>
                    {restaurant.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {showForm && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="restaurant-form-title">
            <div className="modal-heading">
              <div>
                <div className="eyebrow">{editingRestaurant ? 'Restaurant' : 'New restaurant'}</div>
                <h2 id="restaurant-form-title">{editingRestaurant ? 'Edit restaurant' : 'Add restaurant'}</h2>
              </div>
              <button className="icon-button" onClick={closeForm} disabled={saving} aria-label="Close">×</button>
            </div>

            <form className="restaurant-form" onSubmit={saveRestaurant}>
              <div className="form-grid">
                <label>
                  Restaurant name
                  <input value={form.name} onChange={(event) => updateForm('name', event.target.value)} required />
                </label>
                <label>
                  Slug
                  <input
                    value={form.slug}
                    onChange={(event) => updateForm('slug', event.target.value)}
                    placeholder="my-restaurant"
                    pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                    title="Use lowercase letters, numbers, and single hyphens."
                    required
                  />
                </label>
              </div>

              <label>
                Tagline
                <input value={form.tagline} onChange={(event) => updateForm('tagline', event.target.value)} placeholder="Fresh food, made for you." />
              </label>

              <label>
                Logo URL
                <input type="url" value={form.logo_url} onChange={(event) => updateForm('logo_url', event.target.value)} placeholder="https://..." />
              </label>

              <label>
                Location
                <input value={form.location_text} onChange={(event) => updateForm('location_text', event.target.value)} placeholder="Branch address or location" />
              </label>

              <div className="form-grid">
                <label>
                  Contact number
                  <input value={form.contact_number} onChange={(event) => updateForm('contact_number', event.target.value)} />
                </label>
                <label>
                  Email
                  <input type="email" value={form.email} onChange={(event) => updateForm('email', event.target.value)} />
                </label>
              </div>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) => updateForm('is_active', event.target.checked)}
                />
                <span>Restaurant is active</span>
              </label>

              {restaurantError && <div className="error-banner">{restaurantError}</div>}

              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={closeForm} disabled={saving}>Cancel</button>
                <button type="submit" disabled={saving}>{saving ? 'Saving...' : editingRestaurant ? 'Save changes' : 'Create restaurant'}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

export default App;
