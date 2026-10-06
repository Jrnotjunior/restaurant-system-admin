import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { supabase } from './lib/supabase';
import PlatformHealthPage from './components/PlatformHealthPage';
import GoogleMapsUsagePage from './components/GoogleMapsUsagePage';

type AdminPage = 'dashboard' | 'restaurants' | 'audit' | 'administrators' | 'health' | 'maps';

function isAdminPage(current: AdminPage, target: AdminPage) {
  return current === target;
}

type Restaurant = {
  id: string;
  owner_id: string | null;
  custom_domain: string | null;
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
  const [adminAccessLevel, setAdminAccessLevel] = useState<'owner' | 'administrator' | 'view_only' | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [administratorsLoading, setAdministratorsLoading] = useState(false);
  const [administratorsError, setAdministratorsError] = useState('');
  const [administrators, setAdministrators] = useState<Array<{
    id: string; admin_user_id: string; email: string | null; name: string | null;
    access_level: 'owner' | 'administrator' | 'view_only'; is_active: boolean;
    status: 'pending' | 'active' | 'revoked'; granted_by: string | null;
    granted_by_email: string | null; created_at: string; updated_at: string;
  }>>([]);
  const [pendingAdminAction, setPendingAdminAction] = useState<{
    type: 'revoke' | 'restore' | 'change' | 'delete';
    admin: typeof administrators[number];
    nextAccessLevel?: 'administrator' | 'view_only';
  } | null>(null);
  const [adminActionSaving, setAdminActionSaving] = useState(false);
  const [showInviteAdmin, setShowInviteAdmin] = useState(false);
  const [inviteAdminEmail, setInviteAdminEmail] = useState('');
  const [inviteAdminAccessLevel, setInviteAdminAccessLevel] = useState<'administrator' | 'view_only'>('administrator');
  const [inviteAdminSaving, setInviteAdminSaving] = useState(false);
  const [inviteAdminError, setInviteAdminError] = useState('');
  const [inviteAdminSuccess, setInviteAdminSuccess] = useState('');
  const [inviteAdminConfirmationEmail, setInviteAdminConfirmationEmail] = useState('');
  const [showInviteTenant, setShowInviteTenant] = useState(false);
  const [inviteTenantEmail, setInviteTenantEmail] = useState('');
  const [inviteTenantRestaurantName, setInviteTenantRestaurantName] = useState('');
  const [inviteTenantSlug, setInviteTenantSlug] = useState('');
  const [inviteTenantPackageId, setInviteTenantPackageId] = useState('1');
  const [inviteTenantSaving, setInviteTenantSaving] = useState(false);
  const [inviteTenantError, setInviteTenantError] = useState('');
  const [inviteTenantSuccess, setInviteTenantSuccess] = useState('');
  const [inviteSetup, setInviteSetup] = useState(false);
  const [invitePassword, setInvitePassword] = useState('');
  const [invitePasswordConfirm, setInvitePasswordConfirm] = useState('');
  const [inviteSetupError, setInviteSetupError] = useState('');
  const [inviteSettingPassword, setInviteSettingPassword] = useState(false);

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [restaurantLoading, setRestaurantLoading] = useState(false);
  const [restaurantError, setRestaurantError] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingRestaurant, setEditingRestaurant] = useState<Restaurant | null>(null);
  const [form, setForm] = useState<RestaurantForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const canManage = adminAccessLevel === 'owner' || adminAccessLevel === 'administrator';
  const [manageTab, setManageTab] = useState<'overview' | 'owner' | 'domain' | 'settings' | 'staff' | 'package'>('overview');
  const [restaurantPackageId, setRestaurantPackageId] = useState<number | null>(null);
  const [restaurantPackageRows, setRestaurantPackageRows] = useState<Array<{
    package_id: number | null;
    package_key: string | null;
    package_name: string | null;
    package_description: string | null;
    subscription_status: string;
    module_key: string;
    module_name: string;
    included_by_package: boolean;
    override_enabled: boolean | null;
    effective_enabled: boolean;
  }>>([]);
  const [packageLoading, setPackageLoading] = useState(false);
  const [packageSaving, setPackageSaving] = useState(false);
  const [packageError, setPackageError] = useState('');
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState('');
  const [restaurantStaff, setRestaurantStaff] = useState<Array<{ id: string; name: string; mobile_number: string; email: string; role: string; is_active: boolean; auth_user_id: string | null }>>([]);
  const [staffActionId, setStaffActionId] = useState<string | null>(null);
  const [staffActionError, setStaffActionError] = useState('');
  const [pendingDeleteStaff, setPendingDeleteStaff] = useState<typeof restaurantStaff[number] | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [pendingSaveSettings, setPendingSaveSettings] = useState(false);
  const [cashOnDeliveryEnabled, setCashOnDeliveryEnabled] = useState(true);
  const [automaticRiderAssignmentEnabled, setAutomaticRiderAssignmentEnabled] = useState(false);
  const [vatRegistered, setVatRegistered] = useState(false);
  const [pricesVatInclusive, setPricesVatInclusive] = useState(false);
  const [vatRate, setVatRate] = useState('12');
  const [domain, setDomain] = useState('');
  const [domainLoading, setDomainLoading] = useState(false);
  const [domainSaving, setDomainSaving] = useState(false);
  const [domainError, setDomainError] = useState('');
  const [pendingSaveDomain, setPendingSaveDomain] = useState(false);
  const [ownerLoading, setOwnerLoading] = useState(false);
  const [ownerSaving, setOwnerSaving] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerUserId, setOwnerUserId] = useState('');
  const [ownerError, setOwnerError] = useState('');
  const [pendingAssignOwner, setPendingAssignOwner] = useState(false);
  const [pendingRemoveOwner, setPendingRemoveOwner] = useState(false);
  const [pendingRestaurantStatus, setPendingRestaurantStatus] = useState<Restaurant | null>(null);
  const [pendingRestaurantFormSave, setPendingRestaurantFormSave] = useState(false);
  const [adminPage, setAdminPage] = useState<AdminPage>('dashboard');
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState('');
  const [dashboardSummary, setDashboardSummary] = useState<{ total_restaurants: number; active_restaurants: number; inactive_restaurants: number; active_system_administrators: number; pending_system_administrators: number; } | null>(null);
  const [dashboardRestaurantMonitoring, setDashboardRestaurantMonitoring] = useState<Array<{
    restaurant_id: string;
    restaurant_name: string;
    is_active: boolean;
    customer_accounts: number;
    customers_ordered_today: number;
    orders_today: number;
    processing_orders: number;
    last_activity: string | null;
    logged_in_now: number | null;
  }>>([]);
  const [dashboardRecentLogs, setDashboardRecentLogs] = useState<typeof auditLogs>([]);
  const [dashboardPlatformHealth, setDashboardPlatformHealth] = useState<{
    overallStatus: 'healthy' | 'degraded' | 'critical' | 'unknown';
    generatedAt: string;
    services: Array<{ key: string; name: string; status: 'healthy' | 'degraded' | 'critical' | 'unknown'; latencyMs: number | null; message: string }>;
    incidents: Array<{ severity: 'info' | 'warning' | 'critical'; service: string; title: string; summary: string; recommendation?: string }>;
    configurationWarnings: string[];
  } | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState('');
  const [auditLogs, setAuditLogs] = useState<Array<{
    id: string;
    admin_user_id: string | null;
    admin_email: string | null;
    admin_name: string | null;
    restaurant_id: string | null;
    restaurant_name: string | null;
    event_type: string;
    action: string;
    entity_type: string | null;
    entity_id: string | null;
    details: Record<string, unknown>;
    created_at: string;
  }>>([]);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditEventFilter, setAuditEventFilter] = useState('ALL');
  const [auditDatePreset, setAuditDatePreset] = useState<'ALL' | 'TODAY' | '7_DAYS' | '30_DAYS' | 'CUSTOM'>('ALL');
  const [auditStartDate, setAuditStartDate] = useState('');
  const [auditEndDate, setAuditEndDate] = useState('');
  const [auditPageNumber, setAuditPageNumber] = useState(0);
  const [auditHasMore, setAuditHasMore] = useState(false);
  const [selectedAuditLog, setSelectedAuditLog] = useState<typeof auditLogs[number] | null>(null);
  const restaurantsRef = useRef(restaurants);
  const auditLogsRef = useRef(auditLogs);
  const adminAccessLevelRef = useRef(adminAccessLevel);
  restaurantsRef.current = restaurants;
  auditLogsRef.current = auditLogs;
  adminAccessLevelRef.current = adminAccessLevel;

  async function recordAuthAuditEvent(
    eventType: 'LOGIN_SUCCESS' | 'LOGOUT',
    action: string,
    details: Record<string, unknown> = {},
  ) {
    const { error } = await supabase.rpc('system_admin_record_auth_event', {
      p_event_type: eventType,
      p_action: action,
      p_details: details,
    });

    if (error) {
      console.error('Unable to record System Administrator audit event:', error);
    }
  }

  async function recordAdminAudit(
    action: string,
    restaurantId: string | null,
    entityType: string,
    entityId: string | null,
    details: Record<string, unknown> = {},
  ) {
    const { error } = await supabase.rpc('system_admin_write_audit_log', {
      p_event_type: 'ADMIN_ACTION',
      p_action: action,
      p_restaurant_id: restaurantId,
      p_entity_type: entityType,
      p_entity_id: entityId,
      p_details: details,
    });

    if (error) {
      console.error('Unable to record System Administrator audit event:', error);
    }
  }

  function isSystemAdminInvitation() {
    const queryParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    return queryParams.get('type') === 'invite' || hashParams.get('type') === 'invite';
  }

  async function loadMyAccessLevel() {
    const { data, error } = await supabase.rpc('system_admin_get_my_access_level');
    if (error) {
      setAdminAccessLevel(null);
      return null;
    }

    const access = Array.isArray(data) ? data[0] : data;
    const level = access?.access_level as 'owner' | 'administrator' | 'view_only' | undefined;
    const isActive = access?.is_active === true;
    const isActiveStatus = access?.status === 'active';

    if (!level || !isActive || !isActiveStatus) {
      setAdminAccessLevel(null);
      return null;
    }

    setAdminAccessLevel(level);
    return level;
  }

  async function loadAdministrators() {
    setAdministratorsLoading(true);
    setAdministratorsError('');
    const { data, error } = await supabase.rpc('system_admin_get_administrators');
    if (error) {
      setAdministratorsError(error.message);
      setAdministrators([]);
    } else {
      setAdministrators((Array.isArray(data) ? data : []) as typeof administrators);
    }
    setAdministratorsLoading(false);
  }

  function getNavigationFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const page = params.get('page');
    const restaurantId = params.get('restaurantId');
    const auditId = params.get('auditId');

    if (page === 'restaurant' && restaurantId) {
      return { page: 'restaurant' as const, restaurantId, auditId: null };
    }

    if (page === 'restaurants') return { page: 'restaurants' as const, restaurantId: null, auditId: null };
    if (page === 'audit') return { page: 'audit' as const, restaurantId: null, auditId };
    if (page === 'administrators') return { page: 'administrators' as const, restaurantId: null, auditId: null };
    if (page === 'health') return { page: 'health' as const, restaurantId: null, auditId: null };
    if (page === 'maps') return { page: 'maps' as const, restaurantId: null, auditId: null };
    return { page: 'dashboard' as const, restaurantId: null, auditId: null };
  }

  function pushNavigation(page: 'dashboard' | 'restaurants' | 'audit' | 'administrators' | 'health' | 'maps' | 'restaurant', options: { restaurantId?: string; auditId?: string } = {}) {
    const params = new URLSearchParams();
    params.set('page', page);
    if (options.restaurantId) params.set('restaurantId', options.restaurantId);
    if (options.auditId) params.set('auditId', options.auditId);
    window.history.pushState({}, '', `?${params.toString()}`);
  }

  function applyNavigationFromUrl() {
    const navigation = getNavigationFromUrl();
    setAccountMenuOpen(false);

    if (navigation.page === 'restaurant' && navigation.restaurantId) {
      const restaurant = restaurantsRef.current.find((item) => item.id === navigation.restaurantId);
      if (restaurant) {
        setAdminPage('restaurants');
        openRestaurant(restaurant, false);
        return;
      }
      setAdminPage('restaurants');
      setSelectedRestaurant(null);
      void loadRestaurants();
      return;
    }

    setSelectedRestaurant(null);
    setAdminPage(navigation.page === 'restaurant' ? 'restaurants' : navigation.page);

    if (navigation.page === 'maps') {
      setAdminPage('maps');
    } else if (navigation.page === 'dashboard') {
      void loadDashboard();
    } else if (navigation.page === 'restaurants') {
      void loadRestaurants();
    } else if (navigation.page === 'audit') {
      setAuditPageNumber(0);
      void loadAuditLogs(0);
    } else if (navigation.page === 'administrators' && adminAccessLevel === 'owner') {
      void loadAdministrators();
    }
  }

  function openPlatformHealth(pushHistory = true) {
    if (pushHistory) pushNavigation('health');
    setAccountMenuOpen(false);
    setSelectedRestaurant(null);
    setSelectedAuditLog(null);
    setAdminPage('health');
  }

  function openGoogleMapsUsage(pushHistory = true) {
    if (pushHistory) pushNavigation('maps');
    setAccountMenuOpen(false);
    setSelectedRestaurant(null);
    setSelectedAuditLog(null);
    setAdminPage('maps');
  }

  function openAdministrators(pushHistory = true) {
    if (adminAccessLevel !== 'owner') return;
    if (pushHistory) pushNavigation('administrators');
    setAccountMenuOpen(false);
    setAdminPage('administrators');
    setSelectedRestaurant(null);
    setInviteAdminError('');
    setInviteAdminSuccess('');
    setInviteAdminConfirmationEmail('');
    void loadAdministrators();
  }

  async function inviteAdministrator(event: FormEvent) {
    event.preventDefault();
    setInviteAdminSaving(true);
    setInviteAdminError('');
    setInviteAdminSuccess('');

    const { data, error } = await supabase.functions.invoke('web2table-invite-user', {
      body: {
        invitation_type: 'system_admin',
        email: inviteAdminEmail.trim(),
        access_level: inviteAdminAccessLevel,
      },
    });

    if (error) {
      let message = error.message;

      try {
        const response = (error as { context?: Response }).context;
        if (response) {
          const responseBody = await response.clone().json() as { error?: unknown };
          if (typeof responseBody.error === 'string' && responseBody.error.trim()) {
            message = responseBody.error;
          }
        }
      } catch {
        // Keep the original FunctionsHttpError message if the response body cannot be parsed.
      }

      setInviteAdminError(message);
      setInviteAdminSaving(false);
      return;
    }
    if (data?.error) {
      setInviteAdminError(String(data.error));
      setInviteAdminSaving(false);
      return;
    }

    const sentEmail = inviteAdminEmail.trim();
    setInviteAdminSuccess(`Invitation sent to ${sentEmail}.`);
    setInviteAdminConfirmationEmail(sentEmail);
    setShowInviteAdmin(false);
    setInviteAdminEmail('');
    setInviteAdminAccessLevel('administrator');
    setInviteAdminSaving(false);
    await loadAdministrators();
  }

  async function confirmAdministratorAction() {
    if (!pendingAdminAction) return;
    setAdminActionSaving(true);
    setAdministratorsError('');

    const { type, admin, nextAccessLevel } = pendingAdminAction;
    let error: { message: string } | null = null;

    if (type === 'revoke') {
      const result = await supabase.rpc('system_admin_revoke_access', { p_admin_user_id: admin.admin_user_id });
      error = result.error;
    } else if (type === 'restore') {
      const result = await supabase.rpc('system_admin_restore_access', { p_admin_user_id: admin.admin_user_id });
      error = result.error;
    } else if (type === 'delete') {
      const result = await supabase.rpc('system_admin_delete_revoked_access', { p_admin_user_id: admin.admin_user_id });
      error = result.error;
    } else if (nextAccessLevel) {
      const result = await supabase.rpc('system_admin_set_access_level', {
        p_admin_user_id: admin.admin_user_id,
        p_access_level: nextAccessLevel,
      });
      error = result.error;
    }

    if (error) {
      setAdministratorsError(error.message);
      setAdminActionSaving(false);
      return;
    }

    setPendingAdminAction(null);
    setAdminActionSaving(false);
    await loadAdministrators();
  }

  async function checkAdminSession() {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;

    if (!session) {
      setSignedIn(false);
      setAuthorized(false);
      setInviteSetup(false);
      setLoading(false);
      return false;
    }

    const { error: sessionError } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });

    if (sessionError) {
      console.error('Unable to establish System Administrator auth session:', sessionError);
      await supabase.auth.signOut();
      setSignedIn(false);
      setAuthorized(false);
      setLoading(false);
      return false;
    }

    setSignedIn(true);

    if (isSystemAdminInvitation()) {
      setInviteSetup(true);
      setInviteSetupError('');
      setLoading(false);
      return true;
    }

    const accessLevel = await loadMyAccessLevel();

    if (!accessLevel) {
      await supabase.auth.signOut();
      setSignedIn(false);
      setAuthorized(false);
      setLoading(false);
      return false;
    }

    setAuthorized(true);
    setInviteSetup(false);
    await loadDashboard(session.user.id);
    setLoading(false);
    return true;
  }

  async function completeSystemAdminInvitation(event: FormEvent) {
    event.preventDefault();
    setInviteSetupError('');

    if (invitePassword.length < 8) {
      setInviteSetupError('Your password must be at least 8 characters.');
      return;
    }

    if (invitePassword !== invitePasswordConfirm) {
      setInviteSetupError('The passwords do not match.');
      return;
    }

    setInviteSettingPassword(true);

    const { error: passwordError } = await supabase.auth.updateUser({
      password: invitePassword,
    });

    if (passwordError) {
      setInviteSetupError(passwordError.message);
      setInviteSettingPassword(false);
      return;
    }

    const { error: activationError } = await supabase.rpc(
      'system_admin_activate_my_pending_access',
    );

    if (activationError) {
      setInviteSetupError(activationError.message);
      setInviteSettingPassword(false);
      return;
    }

    window.history.replaceState(
      {},
      document.title,
      window.location.pathname,
    );

    setInvitePassword('');
    setInvitePasswordConfirm('');
    setInviteSetup(false);
    setAuthorized(true);
    setInviteSettingPassword(false);
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
        setAdminAccessLevel(null);
        setAccountMenuOpen(false);
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
    setLoading(true);

    const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setLoading(false);
      window.alert(error.message);
      return;
    }

    if (!signInData.session) {
      setLoading(false);
      window.alert('Sign in succeeded but no authenticated session was established.');
      return;
    }

    const { error: sessionError } = await supabase.auth.setSession({
      access_token: signInData.session.access_token,
      refresh_token: signInData.session.refresh_token,
    });

    if (sessionError) {
      setLoading(false);
      window.alert(sessionError.message);
      return;
    }

    const accessLevel = await loadMyAccessLevel();

    if (!accessLevel) {
      await supabase.auth.signOut();
      setSignedIn(false);
      setAuthorized(false);
      setLoading(false);
      window.alert('This account does not have active System Administrator access.');
      return;
    }

    await recordAuthAuditEvent(
      'LOGIN_SUCCESS',
      'System Administrator signed in',
      { source: 'system_admin_web_app', access_level: accessLevel },
    );

    setAuthorized(true);
    await loadDashboard(signInData.user?.id);
    setLoading(false);
  }

  async function signOut() {
    await recordAuthAuditEvent(
      'LOGOUT',
      'System Administrator signed out',
      { source: 'system_admin_web_app' },
    );

    await supabase.auth.signOut();
  }

  async function loadRestaurantPackage(restaurantId: string) {
    setPackageLoading(true);
    setPackageError('');

    const { data, error } = await supabase.rpc('system_admin_get_restaurant_package', {
      p_restaurant_id: restaurantId,
    });

    if (error) {
      setPackageError(error.message);
      setRestaurantPackageId(null);
      setRestaurantPackageRows([]);
    } else {
      const rows = (Array.isArray(data) ? data : []) as typeof restaurantPackageRows;
      setRestaurantPackageRows(rows);
      setRestaurantPackageId(rows[0]?.package_id ?? null);
    }

    setPackageLoading(false);
  }

  async function assignRestaurantPackage(packageId: number) {
    if (!selectedRestaurant) return;

    setPackageSaving(true);
    setPackageError('');

    const { error } = await supabase.rpc('system_admin_assign_restaurant_package', {
      p_restaurant_id: selectedRestaurant.id,
      p_package_id: packageId,
    });

    if (error) {
      setPackageError(error.message);
    } else {
      await loadRestaurantPackage(selectedRestaurant.id);
    }

    setPackageSaving(false);
  }

  async function setRestaurantModuleEnabled(moduleKey: string, enabled: boolean) {
    if (!selectedRestaurant) return;

    setPackageSaving(true);
    setPackageError('');

    const { error } = await supabase.rpc('system_admin_set_restaurant_module_override', {
      p_restaurant_id: selectedRestaurant.id,
      p_module_key: moduleKey,
      p_enabled: enabled,
    });

    if (error) {
      setPackageError(error.message);
    } else {
      await loadRestaurantPackage(selectedRestaurant.id);
    }

    setPackageSaving(false);
  }

  async function loadRestaurantSettings(restaurantId: string) {
    setSettingsLoading(true);
    setSettingsError('');

    const { data, error } = await supabase.rpc('system_admin_get_restaurant_settings', {
      p_restaurant_id: restaurantId,
    });

    if (error) {
      setSettingsError(error.message);
    } else {
      const settings = Array.isArray(data) ? data[0] : data;
      setCashOnDeliveryEnabled(settings?.cash_on_delivery_enabled ?? true);
      setAutomaticRiderAssignmentEnabled(settings?.automatic_rider_assignment_enabled ?? false);
      setVatRegistered(settings?.tax_vat_registered ?? false);
      setPricesVatInclusive(settings?.tax_prices_vat_inclusive ?? false);
      setVatRate(String(settings?.tax_vat_rate ?? 0));
    }

    setSettingsLoading(false);
  }

  async function saveRestaurantSettings() {
    if (!selectedRestaurant) return;

    setSettingsSaving(true);
    setSettingsError('');

    const { data, error } = await supabase.rpc('system_admin_update_restaurant_settings', {
      p_restaurant_id: selectedRestaurant.id,
      p_cash_on_delivery_enabled: cashOnDeliveryEnabled,
      p_automatic_rider_assignment_enabled: automaticRiderAssignmentEnabled,
      p_tax_vat_registered: vatRegistered,
      p_tax_prices_vat_inclusive: pricesVatInclusive,
      p_tax_vat_rate: Number(vatRate),
    });

    if (error) {
      setSettingsError(error.message);
    } else {
      const settings = Array.isArray(data) ? data[0] : data;
      setCashOnDeliveryEnabled(settings?.cash_on_delivery_enabled ?? cashOnDeliveryEnabled);
      setAutomaticRiderAssignmentEnabled(settings?.automatic_rider_assignment_enabled ?? automaticRiderAssignmentEnabled);
      setVatRegistered(settings?.tax_vat_registered ?? vatRegistered);
      setPricesVatInclusive(settings?.tax_prices_vat_inclusive ?? pricesVatInclusive);
      setVatRate(String(settings?.tax_vat_rate ?? vatRate));
    }

    setSettingsSaving(false);
    setPendingSaveSettings(false);
  }

  async function loadRestaurantStaff(restaurantId: string) {
    setStaffLoading(true);
    setStaffError('');

    const { data, error } = await supabase.rpc('system_admin_get_restaurant_staff', {
      p_restaurant_id: restaurantId,
    });

    if (error) {
      setStaffError(error.message);
      setRestaurantStaff([]);
    } else {
      setRestaurantStaff(Array.isArray(data) ? data : []);
    }

    setStaffLoading(false);
  }

  async function setRestaurantStaffActive(staffId: string, isActive: boolean) {
    setStaffActionId(staffId);
    setStaffActionError('');

    const { error } = await supabase.rpc('system_admin_set_restaurant_staff_active', {
      p_staff_id: staffId,
      p_is_active: isActive,
    });

    if (error) {
      setStaffActionError(error.message);
      setStaffActionId(null);
      return;
    }


    if (selectedRestaurant) {
      await loadRestaurantStaff(selectedRestaurant.id);
    }

    setStaffActionId(null);
  }

  function requestDeleteRestaurantStaff(staff: typeof restaurantStaff[number]) {
    setStaffActionError('');
    setPendingDeleteStaff(staff);
  }

  async function confirmDeleteRestaurantStaff() {
    if (!pendingDeleteStaff) return;

    const staffId = pendingDeleteStaff.id;
    setStaffActionId(staffId);
    setStaffActionError('');

    const { data, error } = await supabase.functions.invoke('system-admin-delete-staff', {
      body: { staffId },
    });

    if (error) {
      let message = error.message;

      try {
        const response = (error as { context?: Response }).context;
        if (response) {
          const responseBody = await response.clone().json() as { error?: unknown };
          if (typeof responseBody.error === 'string' && responseBody.error.trim()) {
            message = responseBody.error;
          }
        }
      } catch {
        // Keep the original FunctionsHttpError message if the response body cannot be parsed.
      }

      setStaffActionError(message);
      setStaffActionId(null);
      return;
    }

    if (data?.error) {
      setStaffActionError(String(data.error));
      setStaffActionId(null);
      return;
    }

    setPendingDeleteStaff(null);

    if (selectedRestaurant) {
      await loadRestaurantStaff(selectedRestaurant.id);
    }

    setStaffActionId(null);
  }

  async function saveDomain() {
    if (!selectedRestaurant) return;
    setDomainSaving(true);
    setDomainError('');
    const { data, error } = await supabase.rpc('system_admin_set_restaurant_domain', {
      p_restaurant_id: selectedRestaurant.id,
      p_custom_domain: domain.trim(),
    });
    if (error) {
      setDomainError(error.message);
    } else {
      setDomain(typeof data === 'string' ? data : domain.trim().toLowerCase());
      setPendingSaveDomain(false);
    }
    setDomainSaving(false);
  }

  async function inviteTenant(event: FormEvent) {
    event.preventDefault();
    setInviteTenantSaving(true);
    setInviteTenantError('');
    setInviteTenantSuccess('');

    const email = inviteTenantEmail.trim().toLowerCase();
    const restaurantName = inviteTenantRestaurantName.trim();
    const slug = inviteTenantSlug.trim().toLowerCase();
    const packageId = Number(inviteTenantPackageId);

    if (!email || !restaurantName || !slug || !Number.isInteger(packageId) || packageId < 1) {
      setInviteTenantError('Restaurant name, slug, package, and owner email are required.');
      setInviteTenantSaving(false);
      return;
    }

    const { data, error } = await supabase.functions.invoke('system-admin-invite-tenant', {
      body: {
        email,
        name: restaurantName,
        slug,
        package_id: packageId,
      },
    });

    if (error) {
      let message = error.message;
      try {
        const response = (error as { context?: Response }).context;
        if (response) {
          const responseBody = await response.clone().json() as { error?: unknown };
          if (typeof responseBody.error === 'string' && responseBody.error.trim()) {
            message = responseBody.error;
          }
        }
      } catch {
        // Keep the original Functions error message.
      }
      setInviteTenantError(message);
      setInviteTenantSaving(false);
      return;
    }

    if (data?.error) {
      setInviteTenantError(String(data.error));
      setInviteTenantSaving(false);
      return;
    }

    setInviteTenantSuccess(`Restaurant "${restaurantName}" was created and package ${packageId} was assigned. Invitation sent to ${email}.`);
    setInviteTenantEmail('');
    setInviteTenantRestaurantName('');
    setInviteTenantSlug('');
    setInviteTenantPackageId('1');
    setInviteTenantSaving(false);
  }

  async function loadRestaurantOwner(restaurantId: string) {
    setOwnerLoading(true);
    setOwnerError('');
    const { data, error } = await supabase.rpc('system_admin_get_restaurant_owner', { p_restaurant_id: restaurantId });
    if (error) {
      setOwnerError(error.message);
      setOwnerEmail('');
      setOwnerName('');
      setOwnerUserId('');
    } else {
      const owner = Array.isArray(data) ? data[0] : data;
      setOwnerEmail(owner?.email ?? '');
      setOwnerName(owner?.full_name ?? '');
      setOwnerUserId(owner?.user_id ?? '');
    }
    setOwnerLoading(false);
  }

  async function assignOwner() {
    if (!selectedRestaurant || !ownerEmail.trim()) return;
    setOwnerSaving(true);
    setOwnerError('');
    const { data, error } = await supabase.rpc('system_admin_assign_restaurant_owner', {
      p_restaurant_id: selectedRestaurant.id,
      p_email: ownerEmail.trim(),
    });
    if (error) {
      setOwnerError(error.message);
      setOwnerSaving(false);
      return;
    }
    const owner = Array.isArray(data) ? data[0] : data;
    setOwnerEmail(owner?.email ?? ownerEmail.trim());
    setOwnerName(owner?.full_name ?? '');
    setOwnerUserId(owner?.user_id ?? '');
    setOwnerSaving(false);
    setPendingAssignOwner(false);
  }

  async function removeOwner() {
    if (!selectedRestaurant) return;
    setOwnerSaving(true);
    setOwnerError('');
    const { error } = await supabase.rpc('system_admin_remove_restaurant_owner', { p_restaurant_id: selectedRestaurant.id });
    if (error) {
      setOwnerError(error.message);
    } else {
      setOwnerEmail('');
      setOwnerName('');
      setOwnerUserId('');
      setPendingRemoveOwner(false);
    }
    setOwnerSaving(false);
  }

  async function loadDashboard(userId?: string) {
    setDashboardLoading(true);
    setDashboardError('');

    const [summaryResult, monitoringResult, logsResult, healthResult] = await Promise.all([
      supabase.rpc('system_admin_get_dashboard_summary'),
      supabase.rpc('system_admin_get_restaurant_monitoring'),
      supabase.rpc('system_admin_get_audit_logs', {
        p_restaurant_id: null,
        p_event_type: null,
        p_limit: 6,
        p_offset: 0,
        p_search: null,
        p_start_date: null,
        p_end_date: null,
      }),
      supabase.functions.invoke('system-admin-platform-health', { body: {} }),
    ]);

    if (summaryResult.error) {
      setDashboardError(summaryResult.error.message);
      setDashboardSummary(null);
    } else {
      const summary = Array.isArray(summaryResult.data) ? summaryResult.data[0] : summaryResult.data;
      if (!summary) {
        setDashboardError('Dashboard summary returned no row.');
        setDashboardSummary(null);
      } else {
        setDashboardSummary(summary);
      }
    }

    if (monitoringResult.error) {
      setDashboardError((current) => current || monitoringResult.error.message);
      setDashboardRestaurantMonitoring([]);
    } else {
      setDashboardRestaurantMonitoring((Array.isArray(monitoringResult.data) ? monitoringResult.data : []) as typeof dashboardRestaurantMonitoring);
      if (!Array.isArray(monitoringResult.data)) {
        setDashboardError((current) => current || 'Restaurant monitoring returned an unexpected response.');
      }
    }

    if (logsResult.error) {
      setDashboardError((current) => current || logsResult.error.message);
      setDashboardRecentLogs([]);
    } else {
      setDashboardRecentLogs((Array.isArray(logsResult.data) ? logsResult.data : []) as typeof auditLogs);
    }

    if (healthResult.error || !healthResult.data || healthResult.data.error) {
      setDashboardPlatformHealth(null);
    } else {
      setDashboardPlatformHealth(healthResult.data as typeof dashboardPlatformHealth);
    }

    setDashboardLoading(false);
  }

  async function loadAuditLogs(pageNumber = auditPageNumber) {
    setAuditLoading(true);
    setAuditError('');

    const now = new Date();
    let startDate: string | null = null;
    let endDate: string | null = null;

    if (auditDatePreset === 'TODAY') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      startDate = start.toISOString();
      endDate = end.toISOString();
    } else if (auditDatePreset === '7_DAYS') {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - 6);
      const end = new Date(now);
      end.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() + 1);
      startDate = start.toISOString();
      endDate = end.toISOString();
    } else if (auditDatePreset === '30_DAYS') {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - 29);
      const end = new Date(now);
      end.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() + 1);
      startDate = start.toISOString();
      endDate = end.toISOString();
    } else if (auditDatePreset === 'CUSTOM') {
      if (auditStartDate) startDate = new Date(auditStartDate + 'T00:00:00').toISOString();
      if (auditEndDate) {
        const end = new Date(auditEndDate + 'T00:00:00');
        end.setDate(end.getDate() + 1);
        endDate = end.toISOString();
      }
    }

    const pageSize = 50;
    const { data, error } = await supabase.rpc('system_admin_get_audit_logs', {
      p_restaurant_id: null,
      p_event_type: auditEventFilter === 'ALL' ? null : auditEventFilter,
      p_limit: pageSize,
      p_offset: pageNumber * pageSize,
      p_search: auditSearch.trim() || null,
      p_start_date: startDate,
      p_end_date: endDate,
    });

    if (error) {
      setAuditError(error.message);
      setAuditLogs([]);
      setAuditHasMore(false);
    } else {
      const logs = (Array.isArray(data) ? data : []) as typeof auditLogs;
      setAuditLogs(logs);
      setAuditHasMore(logs.length === pageSize);
      setAuditPageNumber(pageNumber);

      const auditIdFromUrl = new URLSearchParams(window.location.search).get('auditId');
      if (auditIdFromUrl) {
        const matchingLog = logs.find((log) => log.id === auditIdFromUrl);
        if (matchingLog) setSelectedAuditLog(matchingLog);
      }
    }

    setAuditLoading(false);
  }

  function openDashboard(pushHistory = true) {
    if (pushHistory) pushNavigation('dashboard');
    setSelectedRestaurant(null);
    setAccountMenuOpen(false);
    setAdminPage('dashboard');
    void loadDashboard();
  }

  function openRestaurants(pushHistory = true) {
    if (pushHistory) pushNavigation('restaurants');
    setSelectedRestaurant(null);
    setAccountMenuOpen(false);
    setAdminPage('restaurants');
    void loadRestaurants();
  }

  function openAuditLogs(pushHistory = true) {
    if (pushHistory) pushNavigation('audit');
    setSelectedAuditLog(null);
    setSelectedRestaurant(null);
    setAdminPage('audit');
    setAuditPageNumber(0);
    void loadAuditLogs(0);
  }

  function openAuditLog(log: typeof auditLogs[number]) {
    pushNavigation('audit', { auditId: log.id });
    setSelectedRestaurant(null);
    setAdminPage('audit');
    setSelectedAuditLog(log);
    setAuditPageNumber(0);
  }

  async function loadRestaurants() {
    setRestaurantLoading(true);
    setRestaurantError('');

    const { data, error } = await supabase
      .from('restaurants')
      .select('id,owner_id,custom_domain,slug,name,tagline,logo_url,location_text,contact_number,email,is_active,created_at,updated_at')
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

  useEffect(() => {
    if (!authorized || adminPage !== 'audit') return;

    const channel = supabase
      .channel('system-admin-audit-logs')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'system_admin_audit_logs' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newLog = payload.new as typeof auditLogs[number];
            setAuditLogs((current) => {
              if (current.some((log) => log.id === newLog.id)) return current;
              return [newLog, ...current];
            });
          }

          if (payload.eventType === 'UPDATE') {
            const updatedLog = payload.new as typeof auditLogs[number];
            setAuditLogs((current) =>
              current
                .map((log) => log.id === updatedLog.id ? updatedLog : log)
                .sort((a, b) => b.created_at.localeCompare(a.created_at)),
            );
          }

          if (payload.eventType === 'DELETE') {
            const deletedLog = payload.old as typeof auditLogs[number];
            setAuditLogs((current) => current.filter((log) => log.id !== deletedLog.id));
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [authorized, adminPage]);

  useEffect(() => {
    if (!authorized || adminPage !== 'audit') return;
    setAuditPageNumber(0);
    void loadAuditLogs(0);
  }, [authorized, adminPage, auditSearch, auditEventFilter, auditDatePreset, auditStartDate, auditEndDate]);

  useEffect(() => {
    if (!authorized) return;

    const navigation = getNavigationFromUrl();
    const params = new URLSearchParams(window.location.search);

    if (!params.get('page')) {
      params.set('page', 'dashboard');
      window.history.replaceState({}, '', `?${params.toString()}`);
    }

    applyNavigationFromUrl();

    const handlePopState = () => {
      const current = getNavigationFromUrl();

      if (current.page === 'restaurant' && current.restaurantId) {
        const restaurant = restaurantsRef.current.find((item) => item.id === current.restaurantId);
        if (restaurant) {
          openRestaurant(restaurant, false);
          return;
        }
        void loadRestaurants();
        return;
      }

      setSelectedAuditLog(null);
      setSelectedRestaurant(null);
      setAdminPage(current.page === 'restaurant' ? 'restaurants' : current.page);

      if (current.page === 'dashboard') void loadDashboard();
      if (current.page === 'restaurants') void loadRestaurants();
      if (current.page === 'audit') {
        setAuditPageNumber(0);
        void loadAuditLogs(0);
        if (current.auditId) {
          const log = auditLogsRef.current.find((item) => item.id === current.auditId);
          if (log) setSelectedAuditLog(log);
        }
      }
      if (current.page === 'administrators' && adminAccessLevelRef.current === 'owner') void loadAdministrators();
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [authorized]);

  useEffect(() => {
    if (!authorized || adminPage !== 'dashboard') return;
    void loadDashboard();
  }, [authorized, adminPage]);

  const filteredAuditLogs = auditLogs;

  function resetAuditFiltersAndReload() {
    setAuditPageNumber(0);
    void loadAuditLogs(0);
  }

  function exportAuditLogs() {
    const headers = ['Date & Time', 'Administrator', 'Restaurant', 'Event', 'Action', 'Entity', 'Details'];
    const escapeCsv = (value: unknown) => '"' + String(value ?? '').replaceAll('"', '""') + '"';
    const rows = filteredAuditLogs.map((log) => [
      new Date(log.created_at).toLocaleString(), log.admin_name || log.admin_email || 'Unknown administrator',
      log.restaurant_name || '', log.event_type, log.action, log.entity_type || '', JSON.stringify(log.details ?? {}),
    ]);
    const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `web2table-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  }

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

  if (loading) return <main className="screen-center">Loading...</main>;

  if (inviteSetup) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <img className="company-logo auth-logo" src="/web2table-system-admin/web2table.png" alt="WEB2TABLE" />
          <div className="eyebrow">WEB2TABLE Platform</div>
          <h1>Set up your account</h1>
          <p>You have been invited as a System Administrator. Create your password to activate your account.</p>
          <form onSubmit={completeSystemAdminInvitation}>
            <label>
              Password
              <input
                type="password"
                value={invitePassword}
                onChange={(event) => setInvitePassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>
            <label>
              Confirm password
              <input
                type="password"
                value={invitePasswordConfirm}
                onChange={(event) => setInvitePasswordConfirm(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>
            {inviteSetupError && <div className="error-banner">{inviteSetupError}</div>}
            <button type="submit" disabled={inviteSettingPassword}>
              {inviteSettingPassword ? 'Activating account...' : 'Create password & continue'}
            </button>
          </form>
        </section>
      </main>
    );
  }

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

  if (isAdminPage(adminPage, 'health')) {
    return <PlatformHealthPage onBack={() => openDashboard()} />;
  }

  if (isAdminPage(adminPage, 'maps')) {
    return <GoogleMapsUsagePage onBack={() => openDashboard()} />;
  }

  if (isAdminPage(adminPage, 'dashboard')) {
    return (
      <main className="admin-shell">
        <header className="admin-header">
          <div className="brand-block">
            <img className="company-logo" src="/web2table-system-admin/web2table.png" alt="WEB2TABLE" />
            <div><div className="eyebrow">WEB2TABLE Platform</div><h1>System Admin</h1></div>
          </div>
          <div className="admin-header-actions">
            <button className={isAdminPage(adminPage, 'dashboard') ? 'admin-icon-button active' : 'admin-icon-button'} onClick={() => openDashboard()} title="Dashboard" aria-label="Dashboard">
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg>
            </button>
            <button className={isAdminPage(adminPage, 'restaurants') ? 'admin-icon-button active' : 'admin-icon-button'} onClick={() => openRestaurants()} title="Restaurants" aria-label="Restaurants">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5"/><path d="M6.5 9.5V20h11V9.5M9.5 20v-6h5v6"/></svg>
            </button>
            <button className={isAdminPage(adminPage, 'audit') ? 'admin-icon-button active' : 'admin-icon-button'} onClick={() => openAuditLogs()} title="Audit Logs" aria-label="Audit Logs">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5A2.5 2.5 0 0 1 7.5 2h9A2.5 2.5 0 0 1 19 4.5v15a2.5 2.5 0 0 1-2.5 2h-9A2.5 2.5 0 0 1 5 19.5v-15Z"/><path d="M8.5 7.5h7M8.5 11.5h7M8.5 15.5h4"/></svg>
            </button>
            <button className={isAdminPage(adminPage, 'health') ? 'admin-icon-button active' : 'admin-icon-button'} onClick={() => openPlatformHealth()} title="Platform Health" aria-label="Platform Health">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h4l2-6 4 12 2-6h4"/><path d="M4 20h16"/></svg>
            </button>
            <button className={isAdminPage(adminPage, 'maps') ? 'admin-icon-button active' : 'admin-icon-button'} onClick={() => openGoogleMapsUsage()} title="Google Maps Usage" aria-label="Google Maps Usage">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z"/><circle cx="12" cy="9" r="2.3"/></svg>
            </button>
            <button className="admin-icon-button" onClick={() => setAccountMenuOpen((open) => !open)} title="Account" aria-label="Account">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c.8-3.3 3.2-5 6.5-5s5.7 1.7 6.5 5"/></svg>
            </button>
          </div>
        </header>
        {accountMenuOpen && (
          <div className="account-menu">
            <div className="account-menu-header"><span>System Administrator</span><strong>{adminAccessLevel === 'owner' ? 'Owner' : adminAccessLevel === 'administrator' ? 'Administrator — Full Access' : 'View Only'}</strong></div>
            {adminAccessLevel === 'owner' && <button className="account-menu-item" onClick={() => openAdministrators()}>System Administrators</button>}
            <button type="button" className="account-menu-item" onClick={(event) => { event.preventDefault(); event.stopPropagation(); void signOut(); }}>Sign out</button>
          </div>
        )}
        <section className="dashboard-card system-dashboard-card">
          <div className="section-heading">
            <div><div className="eyebrow">Platform Command Center</div><h2>System Dashboard</h2><p>See platform health, operational activity, and anything that needs your attention.</p></div>
            <button className="secondary-button dashboard-health-button" type="button" onClick={() => openPlatformHealth()}>Open Platform Health</button>
          </div>
          {dashboardError && <div className="error-banner">{dashboardError}</div>}
          {dashboardLoading && !dashboardSummary ? <div className="empty-state">Loading platform command center...</div> : (
            <>
              <div className={`dashboard-platform-status dashboard-platform-status-${dashboardPlatformHealth?.overallStatus ?? 'unknown'}`}>
                <div>
                  <div className="eyebrow">Platform Status</div>
                  <div className="dashboard-platform-status-title"><span className="dashboard-status-dot" />
                    {dashboardPlatformHealth?.overallStatus === 'critical' ? 'Critical' : dashboardPlatformHealth?.overallStatus === 'degraded' ? 'Degraded' : dashboardPlatformHealth?.overallStatus === 'healthy' ? 'Operational' : 'Health data unavailable'}
                  </div>
                  <p>{dashboardPlatformHealth?.generatedAt ? `Last checked ${new Date(dashboardPlatformHealth.generatedAt).toLocaleString()}` : 'Run Platform Health to refresh dependency status.'}</p>
                </div>
                <div className="dashboard-platform-services">
                  {(dashboardPlatformHealth?.services ?? []).map((service) => <div className="dashboard-service-chip" key={service.key}><span className={`dashboard-status-dot dashboard-status-dot-${service.status}`} /><strong>{service.name.replace('Web App — ', '')}</strong><span>{service.status}</span></div>)}
                </div>
              </div>
              <div className="dashboard-section-label">Attention Required</div>
              <div className="dashboard-command-grid">
                <div className="dashboard-attention-panel">
                  {dashboardPlatformHealth?.configurationWarnings?.filter((warning) => !warning.toLowerCase().includes('openai')).length ? dashboardPlatformHealth.configurationWarnings.filter((warning) => !warning.toLowerCase().includes('openai')).slice(0, 4).map((warning) => (
                    <div className="dashboard-attention-row" key={warning}><span className="dashboard-attention-icon">!</span><div><strong>Configuration</strong><span>{warning}</span></div></div>
                  )) : dashboardPlatformHealth?.incidents?.length ? dashboardPlatformHealth.incidents.slice(0, 4).map((incident, index) => (
                    <div className="dashboard-attention-row" key={`${incident.service}-${index}`}><span className={`dashboard-attention-icon dashboard-attention-${incident.severity}`}>{incident.severity === 'critical' ? '!' : '•'}</span><div><strong>{incident.title}</strong><span>{incident.summary}</span></div></div>
                  )) : <div className="dashboard-attention-empty"><span>✓</span><div><strong>No active issues</strong><span>Monitored dependencies are operating normally.</span></div></div>}
                </div>
                <div className="dashboard-ai-panel"><div className="eyebrow">Operations Analysis</div><h3>{dashboardPlatformHealth?.overallStatus === 'critical' ? 'Immediate attention recommended' : dashboardPlatformHealth?.overallStatus === 'degraded' ? 'Platform operational with warnings' : 'Platform operating normally'}</h3><p>{dashboardPlatformHealth?.incidents?.[0]?.summary ?? 'Health monitoring will surface dependency problems and operational warnings here.'}</p><button className="secondary-button" type="button" onClick={() => openPlatformHealth()}>View diagnosis</button></div>
              </div>
              <div className="dashboard-section-label">Live Operations</div>
              <div className="system-stats-grid dashboard-kpi-grid">
                <button className="stat-card dashboard-stat-button dashboard-kpi-card" type="button" onClick={() => openRestaurants()}><span>Restaurants</span><strong>{dashboardSummary?.active_restaurants ?? 0}<small> active</small></strong><em>{dashboardSummary?.total_restaurants ?? 0} total</em></button>
                <div className="stat-card dashboard-kpi-card"><span>Orders today</span><strong>{dashboardRestaurantMonitoring.reduce((sum, item) => sum + (item.orders_today ?? 0), 0)}</strong><em>{dashboardRestaurantMonitoring.reduce((sum, item) => sum + (item.processing_orders ?? 0), 0)} processing now</em></div>
                <div className="stat-card dashboard-kpi-card"><span>Customer activity</span><strong>{dashboardRestaurantMonitoring.reduce((sum, item) => sum + (item.customers_ordered_today ?? 0), 0)}</strong><em>customers ordered today</em></div>
                <button className="stat-card dashboard-stat-button dashboard-kpi-card" type="button" onClick={() => openAdministrators()} disabled={adminAccessLevel !== 'owner'}><span>Administrators</span><strong>{dashboardSummary?.active_system_administrators ?? 0}</strong><em>{dashboardSummary?.pending_system_administrators ?? 0} pending invitation{dashboardSummary?.pending_system_administrators === 1 ? '' : 's'}</em></button>
              </div>
              <div className="dashboard-command-columns">
                <div className="dashboard-monitoring">
                  <div className="dashboard-monitoring-heading"><div><div className="eyebrow">Restaurant Operations</div><h3>Restaurant Activity</h3><p>Operational snapshot across every tenant.</p></div><button className="secondary-button" type="button" onClick={() => openRestaurants()}>Manage restaurants</button></div>
                  {dashboardRestaurantMonitoring.length === 0 ? <div className="empty-state">No restaurant monitoring data available.</div> : <div className="dashboard-monitoring-table-wrap"><table className="dashboard-monitoring-table"><thead><tr><th>Restaurant</th><th>Status</th><th>Orders</th><th>Processing</th><th>Customers</th><th>Last activity</th></tr></thead><tbody>{dashboardRestaurantMonitoring.map((monitoring) => <tr key={monitoring.restaurant_id}><td><strong>{monitoring.restaurant_name}</strong></td><td><span className={monitoring.is_active ? 'status active' : 'status inactive'}>{monitoring.is_active ? 'Active' : 'Inactive'}</span></td><td>{monitoring.orders_today}</td><td>{monitoring.processing_orders}</td><td>{monitoring.customers_ordered_today}</td><td className="dashboard-monitoring-last-activity">{monitoring.last_activity ? new Date(monitoring.last_activity).toLocaleString() : 'No activity'}</td></tr>)}</tbody></table></div>}
                </div>
                <div className="dashboard-activity"><div className="dashboard-activity-heading"><div><div className="eyebrow">Accountability</div><h3>Recent System Events</h3></div><button className="secondary-button" type="button" onClick={() => openAuditLogs()}>View logs</button></div>{dashboardRecentLogs.length === 0 ? <div className="empty-state">No recent platform activity.</div> : <div className="dashboard-activity-list">{dashboardRecentLogs.slice(0, 6).map((log) => <button className="dashboard-activity-row" type="button" key={log.id} onClick={() => openAuditLog(log)}><div><strong>{log.action}</strong><span>{log.admin_name || log.admin_email || 'Unknown administrator'}{log.restaurant_name ? ` • ${log.restaurant_name}` : ''}</span></div><time>{new Date(log.created_at).toLocaleString()}</time></button>)}</div>}</div>
              </div>
            </>
          )}
        </section>
      </main>
    );
  }

  if (isAdminPage(adminPage, 'administrators')) {
    return (
      <main className="admin-shell">
        <header className="admin-header">
          <div className="brand-block">
            <img className="company-logo" src="/web2table-system-admin/web2table.png" alt="WEB2TABLE" />
            <div><div className="eyebrow">Account</div><h1>System Administrators</h1></div>
          </div>
          <div className="admin-header-actions">
            <button className={isAdminPage(adminPage, 'dashboard') ? 'admin-icon-button active' : 'admin-icon-button'} onClick={() => openDashboard()} title="Dashboard" aria-label="Dashboard">
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg>
            </button>
            <button className={isAdminPage(adminPage, 'restaurants') ? 'admin-icon-button active' : 'admin-icon-button'} onClick={() => openRestaurants()} title="Restaurants" aria-label="Restaurants">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5"/><path d="M6.5 9.5V20h11V9.5M9.5 20v-6h5v6"/></svg>
            </button>
            <button className={isAdminPage(adminPage, 'audit') ? 'admin-icon-button active' : 'admin-icon-button'} onClick={() => openAuditLogs()} title="Audit Logs" aria-label="Audit Logs">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5A2.5 2.5 0 0 1 7.5 2h9A2.5 2.5 0 0 1 19 4.5v15a2.5 2.5 0 0 1-2.5 2h-9A2.5 2.5 0 0 1 5 19.5v-15Z"/><path d="M8.5 7.5h7M8.5 11.5h7M8.5 15.5h4"/></svg>
            </button>
            <button className={isAdminPage(adminPage, 'health') ? 'admin-icon-button active' : 'admin-icon-button'} onClick={() => openPlatformHealth()} title="Platform Health" aria-label="Platform Health">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h4l2-6 4 12 2-6h4"/><path d="M4 20h16"/></svg>
            </button>
            <button className="admin-icon-button" onClick={() => setAccountMenuOpen((open) => !open)} title="Account" aria-label="Account">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c.8-3.3 3.2-5 6.5-5s5.7 1.7 6.5 5"/></svg>
            </button>
          </div>
        </header>
        {accountMenuOpen && (
          <div className="account-menu">
            <div className="account-menu-header"><span>System Administrator</span><strong>{adminAccessLevel === 'owner' ? 'Owner' : adminAccessLevel === 'administrator' ? 'Administrator — Full Access' : 'View Only'}</strong></div>
            <button className="account-menu-item" onClick={() => setAccountMenuOpen(false)}>System Administrators</button>
            <button className="account-menu-item" onClick={signOut}>Sign out</button>
          </div>
        )}
        <section className="dashboard-card administrators-card">
          <div className="section-heading">
            <div><div className="eyebrow">Access Control</div><h2>System Administrators</h2><p>Manage who can access the WEB2TABLE System Admin platform.</p></div>
            <button onClick={() => { setInviteAdminError(''); setInviteAdminSuccess(''); setShowInviteAdmin(true); }}>+ Invite Administrator</button>
          </div>
          {administratorsError && <div className="error-banner">{administratorsError}</div>}
          {inviteAdminSuccess && <div className="success-banner">{inviteAdminSuccess}</div>}
          {administratorsLoading ? <div className="empty-state">Loading administrators...</div> : administrators.length === 0 ? (
            <div className="empty-state"><strong>No administrators found</strong><span>Invite an administrator to get started.</span></div>
          ) : (
            <div className="administrators-table-wrap">
              <table className="administrators-table">
                <thead><tr><th>Administrator</th><th>Access</th><th>Status</th><th>Granted by</th><th>Actions</th></tr></thead>
                <tbody>
                  {administrators.map((admin) => (
                    <tr key={admin.id}>
                      <td><strong>{admin.name || admin.email || 'Unnamed administrator'}</strong>{admin.name && admin.email && <span className="audit-subtext">{admin.email}</span>}</td>
                      <td><span className="access-badge">{admin.access_level === 'owner' ? 'Owner' : admin.access_level === 'administrator' ? 'Administrator — Full Access' : 'View Only'}</span></td>
                      <td><span className={admin.status === 'active' ? 'status active' : 'status inactive'}>{admin.status === 'pending' ? 'Pending invite' : admin.status === 'revoked' ? 'Revoked' : 'Active'}</span></td>
                      <td>{admin.granted_by_email || '—'}</td>
                      <td>
                        {admin.access_level === 'owner' ? <span className="audit-subtext">Owner account</span> : admin.status === 'revoked' ? (
                          <div className="staff-actions">
                            <button className="secondary-button" onClick={() => setPendingAdminAction({ type: 'restore', admin })}>Restore</button>
                            <button className="danger-button" onClick={() => setPendingAdminAction({ type: 'delete', admin })}>Delete</button>
                          </div>
                        ) : (
                          <div className="staff-actions">
                            <button className="secondary-button" onClick={() => setPendingAdminAction({ type: 'change', admin, nextAccessLevel: admin.access_level === 'administrator' ? 'view_only' : 'administrator' })}>{admin.access_level === 'administrator' ? 'Make View Only' : 'Make Full Access'}</button>
                            <button className="danger-button" onClick={() => setPendingAdminAction({ type: 'revoke', admin })}>Revoke</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        {showInviteAdmin && (
          <div className="modal-backdrop" role="presentation">
            <section className="modal-card administrator-invite-modal" role="dialog" aria-modal="true" aria-labelledby="invite-admin-title">
              <div className="modal-heading"><div><div className="eyebrow">System Administrator</div><h2 id="invite-admin-title">Invite Administrator</h2></div><button className="icon-button" type="button" onClick={() => setShowInviteAdmin(false)} disabled={inviteAdminSaving} aria-label="Close">×</button></div>
              <form className="restaurant-form" onSubmit={inviteAdministrator}>
                <label>Email address<input type="email" value={inviteAdminEmail} onChange={(event) => setInviteAdminEmail(event.target.value)}  autoComplete="email" required /></label>
                <label>Access Level<select value={inviteAdminAccessLevel} onChange={(event) => setInviteAdminAccessLevel(event.target.value as 'administrator' | 'view_only')}><option value="administrator">Administrator — Full Access</option><option value="view_only">View Only</option></select></label>
                <div className="administrator-invite-warning"><strong>The invitation will be emailed to this address.</strong><span>The account will remain pending until the invitee creates a password.</span></div>
                {inviteAdminError && <div className="error-banner">{inviteAdminError}</div>}
                <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowInviteAdmin(false)} disabled={inviteAdminSaving}>Cancel</button><button type="submit" disabled={inviteAdminSaving}>{inviteAdminSaving ? 'Sending...' : 'Send Invitation'}</button></div>
              </form>
            </section>
          </div>
        )}
        {inviteAdminConfirmationEmail && (
          <div className="modal-backdrop" role="presentation">
            <section className="modal-card administrator-invite-success-modal" role="dialog" aria-modal="true" aria-labelledby="invite-admin-success-title">
              <div className="modal-heading">
                <div>
                  <div className="eyebrow">Invitation Sent</div>
                  <h2 id="invite-admin-success-title">Invitation email sent</h2>
                </div>
                <button
                  className="icon-button"
                  type="button"
                  onClick={() => setInviteAdminConfirmationEmail('')}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <div className="administrator-action-content">
                <div className="success-banner">The invitation email has been sent successfully.</div>
                <p>The invitation was sent to <strong>{inviteAdminConfirmationEmail}</strong>.</p>
                <div className="administrator-action-warning">
                  <strong>The account is currently pending.</strong>
                  <span>The invitee must open the invitation email and create a password before the account becomes active.</span>
                </div>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setInviteAdminConfirmationEmail('')}
                >
                  Done
                </button>
              </div>
            </section>
          </div>
        )}
        {pendingAdminAction && (
          <div className="modal-backdrop" role="presentation">
            <section className="modal-card administrator-action-modal" role="dialog" aria-modal="true" aria-labelledby="admin-action-title">
              <div className="modal-heading"><div><div className="eyebrow">Access Control</div><h2 id="admin-action-title">{pendingAdminAction.type === 'revoke' ? 'Revoke access?' : pendingAdminAction.type === 'restore' ? 'Restore access?' : pendingAdminAction.type === 'delete' ? 'Delete administrator?' : 'Change access level?'}</h2></div><button className="icon-button" type="button" onClick={() => setPendingAdminAction(null)} disabled={adminActionSaving} aria-label="Close">×</button></div>
              <div className="administrator-action-content"><p><strong>{pendingAdminAction.admin.email || pendingAdminAction.admin.name || 'This administrator'}</strong></p><div className="administrator-action-warning"><strong>{pendingAdminAction.type === 'revoke' ? 'This administrator will no longer be able to access System Admin.' : pendingAdminAction.type === 'restore' ? 'This administrator will regain their previous access level.' : pendingAdminAction.type === 'delete' ? 'This permanently deletes the revoked administrator account and removes its System Admin access. This cannot be undone.' : 'Access will change to ' + (pendingAdminAction.nextAccessLevel === 'administrator' ? 'Administrator — Full Access' : 'View Only') + '.'}</strong><span>{pendingAdminAction.type === 'delete' ? 'Only a revoked account can be permanently deleted. Audit history is retained.' : 'The Owner account cannot be changed or revoked.'}</span></div>{administratorsError && <div className="error-banner">{administratorsError}</div>}</div>
              <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setPendingAdminAction(null)} disabled={adminActionSaving}>Cancel</button><button type="button" className={pendingAdminAction.type === 'revoke' || pendingAdminAction.type === 'delete' ? 'danger-button' : ''} onClick={() => void confirmAdministratorAction()} disabled={adminActionSaving}>{adminActionSaving ? 'Saving...' : pendingAdminAction.type === 'delete' ? 'Delete permanently' : 'Confirm'}</button></div>
            </section>
          </div>
        )}
      </main>
    );
  }

  if (isAdminPage(adminPage, 'audit')) {
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
          <div className="admin-header-actions">
            <button className={isAdminPage(adminPage, 'dashboard') ? 'admin-icon-button active' : 'admin-icon-button'} onClick={() => openDashboard()} title="Dashboard" aria-label="Dashboard">
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg>
            </button>
            <button className={isAdminPage(adminPage, 'restaurants') ? 'admin-icon-button active' : 'admin-icon-button'} onClick={() => openRestaurants()} title="Restaurants" aria-label="Restaurants">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5"/><path d="M6.5 9.5V20h11V9.5M9.5 20v-6h5v6"/></svg>
            </button>
            <button className={isAdminPage(adminPage, 'audit') ? 'admin-icon-button active' : 'admin-icon-button'} onClick={() => openAuditLogs()} title="Audit Logs" aria-label="Audit Logs">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5A2.5 2.5 0 0 1 7.5 2h9A2.5 2.5 0 0 1 19 4.5v15a2.5 2.5 0 0 1-2.5 2h-9A2.5 2.5 0 0 1 5 19.5v-15Z"/><path d="M8.5 7.5h7M8.5 11.5h7M8.5 15.5h4"/></svg>
            </button>
            <button className={isAdminPage(adminPage, 'health') ? 'admin-icon-button active' : 'admin-icon-button'} onClick={() => openPlatformHealth()} title="Platform Health" aria-label="Platform Health">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h4l2-6 4 12 2-6h4"/><path d="M4 20h16"/></svg>
            </button>
            <button className="admin-icon-button" onClick={() => setAccountMenuOpen((open) => !open)} title="Account" aria-label="Account">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c.8-3.3 3.2-5 6.5-5s5.7 1.7 6.5 5"/></svg>
            </button>
          </div>
        </header>

        {accountMenuOpen && (
          <div className="account-menu">
            <div className="account-menu-header"><span>System Administrator</span><strong>{adminAccessLevel === 'owner' ? 'Owner' : adminAccessLevel === 'administrator' ? 'Administrator — Full Access' : 'View Only'}</strong></div>
            {adminAccessLevel === 'owner' && <button className="account-menu-item" onClick={() => openAdministrators()}>System Administrators</button>}
            <button className="account-menu-item" onClick={signOut}>Sign out</button>
          </div>
        )}

        <section className="dashboard-card audit-page-card">
          <div className="section-heading">
            <div>
              <div className="eyebrow">Accountability</div>
              <h2>Audit Logs</h2>
              <p>Review System Administrator sign-ins and administrative changes across the platform.</p>
            </div>
          </div>

          <div className="audit-summary-row">
            <div className="stat-card"><span>Total records</span><strong>{auditLogs.length}</strong></div>
            <div className="stat-card"><span>Administrative actions</span><strong>{auditLogs.filter((log) => log.event_type === 'ADMIN_ACTION').length}</strong></div>
            <div className="stat-card"><span>Authentication events</span><strong>{auditLogs.filter((log) => log.event_type !== 'ADMIN_ACTION').length}</strong></div>
          </div>

          <div className="audit-toolbar">
            <input
              className="search-input"
              type="search"
              placeholder="Search administrator, restaurant, action..."
              value={auditSearch}
              onChange={(event) => setAuditSearch(event.target.value)}
            />
            <select value={auditEventFilter} onChange={(event) => setAuditEventFilter(event.target.value)}>
              <option value="ALL">All events</option>
              <option value="ADMIN_ACTION">Administrative actions</option>
              <option value="LOGIN_SUCCESS">Login success</option>
              <option value="LOGOUT">Logout</option>
              <option value="ACCESS_DENIED">Access denied</option>
            </select>
            <select value={auditDatePreset} onChange={(event) => setAuditDatePreset(event.target.value as typeof auditDatePreset)}>
              <option value="ALL">All dates</option>
              <option value="TODAY">Today</option>
              <option value="7_DAYS">Last 7 days</option>
              <option value="30_DAYS">Last 30 days</option>
              <option value="CUSTOM">Custom range</option>
            </select>
            {auditDatePreset === 'CUSTOM' && (
              <>
                <input type="date" value={auditStartDate} onChange={(event) => setAuditStartDate(event.target.value)} aria-label="Audit start date" />
                <input type="date" value={auditEndDate} onChange={(event) => setAuditEndDate(event.target.value)} aria-label="Audit end date" />
              </>
            )}
             <button className="secondary-button audit-export-button" type="button" onClick={exportAuditLogs} disabled={filteredAuditLogs.length === 0}>Export CSV</button>
          </div>

          {auditError && <div className="error-banner">{auditError}</div>}

          {auditLoading ? (
            <div className="empty-state">Loading audit logs...</div>
          ) : filteredAuditLogs.length === 0 ? (
            <div className="empty-state">
              <strong>No audit records found</strong>
              <span>Try a different search or filter.</span>
            </div>
          ) : (
            <div className="audit-table-wrap">
              <table className="audit-table">
                <thead>
                  <tr>
                    <th>Date &amp; Time</th>
                    <th>Administrator</th>
                    <th>Restaurant</th>
                    <th>Event</th>
                    <th>Action</th>
                    <th>Changes / Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAuditLogs.map((log) => {
                    const changes = (log.details?.changes ?? null) as Record<string, unknown> | null;
                    const createdValues = (log.details?.created_values ?? null) as Record<string, unknown> | null;

                    return (
                      <tr key={log.id}>
                        <td className="audit-date">{new Date(log.created_at).toLocaleString()}</td>
                        <td>
                          <strong>{log.admin_name || log.admin_email || 'Unknown administrator'}</strong>
                          {log.admin_name && log.admin_email && <span className="audit-subtext">{log.admin_email}</span>}
                        </td>
                        <td>{log.restaurant_name || '—'}</td>
                        <td><span className={log.event_type === 'ADMIN_ACTION' ? 'audit-event admin' : 'audit-event'}>{log.event_type}</span></td>
                        <td>{log.action}</td>
                        <td>
                          {changes && Object.keys(changes).length > 0 ? (
                            <div className="audit-change-list">
                              {Object.entries(changes).map(([field, value]) => {
                                const pair = Array.isArray(value) ? value : [];
                                return (
                                  <div className="audit-change" key={field}>
                                    <strong>{field.replaceAll('_', ' ')}</strong>
                                    <span>{String(pair[0] ?? '—')} → {String(pair[1] ?? '—')}</span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : createdValues ? (
                            <div className="audit-change-list">
                              <div className="audit-change"><strong>Created with</strong><span>{String(createdValues.name ?? 'restaurant')}</span></div>
                            </div>
                          ) : (
                            <span className="audit-subtext">{String(log.details?.source ?? '—')}</span>
                          )}
                        </td>
                         <td>
                           <button className="secondary-button audit-view-button" type="button" onClick={() => openAuditLog(log)}>View</button>
                         </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="audit-pagination">
            <button
              type="button"
              className="secondary-button"
              onClick={() => void loadAuditLogs(Math.max(0, auditPageNumber - 1))}
              disabled={auditLoading || auditPageNumber === 0}
            >
              Previous
            </button>
            <span>Page {auditPageNumber + 1}</span>
            <button
              type="button"
              className="secondary-button"
              onClick={() => void loadAuditLogs(auditPageNumber + 1)}
              disabled={auditLoading || !auditHasMore}
            >
              Next
            </button>
          </div>
        </section>
      </main>
    );
  }


  {selectedAuditLog && (
    <div className="modal-backdrop audit-detail-backdrop" role="presentation">
      <section className="modal-card audit-detail-modal" role="dialog" aria-modal="true" aria-labelledby="audit-detail-title">
        <div className="modal-heading">
          <div><div className="eyebrow">Audit Event</div><h2 id="audit-detail-title">Event details</h2></div>
          <button className="icon-button" type="button" onClick={() => { if (new URLSearchParams(window.location.search).get('auditId')) window.history.back(); else setSelectedAuditLog(null); }} aria-label="Close">×</button>
        </div>
        <div className="audit-detail-grid">
          <div><span>Date &amp; Time</span><strong>{new Date(selectedAuditLog.created_at).toLocaleString()}</strong></div>
          <div><span>Administrator</span><strong>{selectedAuditLog.admin_name || selectedAuditLog.admin_email || 'Unknown administrator'}</strong></div>
          <div><span>Restaurant</span><strong>{selectedAuditLog.restaurant_name || '—'}</strong></div>
          <div><span>Event</span><strong>{selectedAuditLog.event_type}</strong></div>
          <div><span>Action</span><strong>{selectedAuditLog.action}</strong></div>
          <div><span>Entity</span><strong>{selectedAuditLog.entity_type || '—'}</strong></div>
        </div>
        <div className="audit-json-panel"><div className="eyebrow">Recorded details</div><pre>{JSON.stringify(selectedAuditLog.details ?? {}, null, 2)}</pre></div>
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => { if (new URLSearchParams(window.location.search).get('auditId')) window.history.back(); else setSelectedAuditLog(null); }}>Close</button></div>
      </section>
    </div>
  )}

  function openRestaurant(restaurant: Restaurant, pushHistory = true) {
    if (pushHistory) pushNavigation('restaurant', { restaurantId: restaurant.id });
    setSelectedRestaurant(restaurant);
    setAdminPage('restaurants');
    setManageTab('overview');
    setRestaurantPackageId(null);
    setRestaurantPackageRows([]);
    setPackageError('');
    setOwnerEmail('');
    setOwnerName('');
    setOwnerUserId('');
    setOwnerError('');
    setDomain('');
    setDomainError('');
    setSettingsError('');
    setRestaurantError('');
  }

  function closeRestaurant(pushHistory = true) {
    if (pushHistory) pushNavigation('restaurants');
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
    setPendingRestaurantFormSave(true);
  }

  async function confirmSaveRestaurant() {
    setPendingRestaurantFormSave(false);
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
      : await supabase.from('restaurants').insert(payload).select('id').single();

    if (result.error) {
      setRestaurantError(result.error.message);
      setSaving(false);
      return;
    }

    const restaurantId = editingRestaurant?.id ?? (result.data as { id: string } | null)?.id ?? null;

    const restaurantChanges = editingRestaurant
      ? Object.fromEntries(
          Object.entries({
            name: [editingRestaurant.name, payload.name],
            slug: [editingRestaurant.slug, payload.slug],
            tagline: [editingRestaurant.tagline, payload.tagline],
            logo_url: [editingRestaurant.logo_url, payload.logo_url],
            location_text: [editingRestaurant.location_text, payload.location_text],
            contact_number: [editingRestaurant.contact_number, payload.contact_number],
            email: [editingRestaurant.email, payload.email],
            is_active: [editingRestaurant.is_active, payload.is_active],
          }).filter(([, [oldValue, newValue]]) => oldValue !== newValue),
        )
      : {};

    await recordAdminAudit(
      editingRestaurant ? 'Restaurant profile updated' : 'Restaurant created',
      restaurantId,
      'restaurant',
      restaurantId,
      editingRestaurant
        ? {
            changes: restaurantChanges,
          }
        : {
            created_values: {
              name: payload.name,
              slug: payload.slug,
              tagline: payload.tagline,
              logo_url: payload.logo_url,
              location_text: payload.location_text,
              contact_number: payload.contact_number,
              email: payload.email,
              is_active: payload.is_active,
            },
          },
    );

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

    await recordAdminAudit(
      nextStatus ? 'Restaurant activated' : 'Restaurant deactivated',
      restaurant.id,
      'restaurant',
      restaurant.id,
      {
        name: restaurant.name,
        previous_status: restaurant.is_active ? 'active' : 'inactive',
        new_status: nextStatus ? 'active' : 'inactive',
      },
    );

    await loadRestaurants();
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
          <div className="admin-header-actions">
            <button className={isAdminPage(adminPage, 'dashboard') ? 'admin-icon-button active' : 'admin-icon-button'} onClick={() => openDashboard()} title="Dashboard" aria-label="Dashboard">
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg>
            </button>
            <button className={isAdminPage(adminPage, 'restaurants') ? 'admin-icon-button active' : 'admin-icon-button'} onClick={() => openRestaurants()} title="Restaurants" aria-label="Restaurants">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5"/><path d="M6.5 9.5V20h11V9.5M9.5 20v-6h5v6"/></svg>
            </button>
            <button className={isAdminPage(adminPage, 'audit') ? 'admin-icon-button active' : 'admin-icon-button'} onClick={() => openAuditLogs()} title="Audit Logs" aria-label="Audit Logs">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5A2.5 2.5 0 0 1 7.5 2h9A2.5 2.5 0 0 1 19 4.5v15a2.5 2.5 0 0 1-2.5 2h-9A2.5 2.5 0 0 1 5 19.5v-15Z"/><path d="M8.5 7.5h7M8.5 11.5h7M8.5 15.5h4"/></svg>
            </button>
            <button className={isAdminPage(adminPage, 'health') ? 'admin-icon-button active' : 'admin-icon-button'} onClick={() => openPlatformHealth()} title="Platform Health" aria-label="Platform Health">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h4l2-6 4 12 2-6h4"/><path d="M4 20h16"/></svg>
            </button>
            <button className="admin-icon-button" onClick={() => setAccountMenuOpen((open) => !open)} title="Account" aria-label="Account">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c.8-3.3 3.2-5 6.5-5s5.7 1.7 6.5 5"/></svg>
            </button>
          </div>
        </header>

        {accountMenuOpen && (
          <div className="account-menu">
            <div className="account-menu-header"><span>System Administrator</span><strong>{adminAccessLevel === 'owner' ? 'Owner' : adminAccessLevel === 'administrator' ? 'Administrator — Full Access' : 'View Only'}</strong></div>
            {adminAccessLevel === 'owner' && <button className="account-menu-item" onClick={() => openAdministrators()}>System Administrators</button>}
            <button className="account-menu-item" onClick={signOut}>Sign out</button>
          </div>
        )}

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
            <div className="restaurant-hero-actions">
              <span className={selectedRestaurant.is_active ? 'status active' : 'status inactive'}>
                {selectedRestaurant.is_active ? 'Active' : 'Inactive'}
              </span>
              {canManage && <button className="secondary-button" type="button" onClick={() => startEdit(selectedRestaurant)}>
                Edit restaurant
              </button>}
            </div>
          </div>

          <nav className="manage-tabs" aria-label="Restaurant management sections">
            <button className={`manage-tab ${manageTab === 'overview' ? 'active' : ''}`} type="button" onClick={() => setManageTab('overview')}>Overview</button>
            <button className={`manage-tab ${manageTab === 'owner' ? 'active' : ''}`} type="button" onClick={() => { setManageTab('owner'); void loadRestaurantOwner(selectedRestaurant.id); }}>Owner</button>
            <button className={`manage-tab ${manageTab === 'domain' ? 'active' : ''}`} type="button" onClick={() => { setManageTab('domain'); setDomain(selectedRestaurant.custom_domain ?? ''); setDomainError(''); }}>Domain</button>
            <button className={`manage-tab ${manageTab === 'settings' ? 'active' : ''}`} type="button" onClick={() => { setManageTab('settings'); void loadRestaurantSettings(selectedRestaurant.id); }}>Settings</button>
            <button className={`manage-tab ${manageTab === 'staff' ? 'active' : ''}`} type="button" onClick={() => { setManageTab('staff'); void loadRestaurantStaff(selectedRestaurant.id); }}>Staff</button>
            <button className={`manage-tab ${manageTab === 'package' ? 'active' : ''}`} type="button" onClick={() => { setManageTab('package'); void loadRestaurantPackage(selectedRestaurant.id); }}>Package</button>
          </nav>

          {manageTab === 'overview' ? (
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
                <div className="detail-item"><span>Custom domain</span><strong>{selectedRestaurant.custom_domain || 'Not configured'}</strong></div>
                <div className="detail-item"><span>Created</span><strong>{new Date(selectedRestaurant.created_at).toLocaleDateString()}</strong></div>
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
                {canManage && <button className={selectedRestaurant.is_active ? 'danger-button' : 'secondary-button'} onClick={() => setPendingRestaurantStatus(selectedRestaurant)}>
                  {selectedRestaurant.is_active ? 'Deactivate restaurant' : 'Activate restaurant'}
                </button>}
              </div>
            </div>

            <div className="overview-section">
              <div className="eyebrow">Management</div>
              <h3>Platform controls</h3>
              <p>Use the tabs above to manage the restaurant owner, custom domain, operational settings, and staff accounts.</p>
            </div>
          </div>
          ) : manageTab === 'owner' ? (
            <div className="manage-overview">
              <div className="overview-section">
                <div className="eyebrow">Restaurant Owner</div>
                <h3>Owner account</h3>
                <p>Assign an existing Supabase account as the owner of this restaurant. A new account is not created here.</p>
                {ownerLoading ? <div className="empty-state owner-loading">Loading owner...</div> : ownerUserId ? (
                  <div className="owner-current">
                    <div className="owner-avatar">{(ownerName || ownerEmail).charAt(0).toUpperCase()}</div>
                    <div className="owner-current-details"><strong>{ownerName || 'Restaurant Owner'}</strong><span>{ownerEmail}</span><small>User ID: {ownerUserId}</small></div>
                    {canManage && <button className="danger-button" onClick={() => { setOwnerError(''); setPendingRemoveOwner(true); }} disabled={ownerSaving}>Remove owner</button>}
                  </div>
                ) : (
                  canManage ? (
                  <div className="owner-form">
                    <label>Owner account email<input type="email" value={ownerEmail} onChange={(event) => setOwnerEmail(event.target.value)} placeholder="owner@example.com" /></label>
                    <button onClick={() => { setOwnerError(''); setPendingAssignOwner(true); }} disabled={ownerSaving || !ownerEmail.trim()}>Assign owner</button>
                  </div>
                  ) : (
                    <div className="empty-state">No restaurant owner is assigned. View Only access cannot change ownership.</div>
                  )
                )}
                {ownerError && <div className="error-banner">{ownerError}</div>}
              </div>
            </div>
          ) : manageTab === 'domain' ? (
            <div className="manage-overview">
              <div className="overview-section">
                <div className="eyebrow">Custom Domain</div>
                <h3>Restaurant domain</h3>
                <p>Assign the public domain that will identify this restaurant on the ordering platform.</p>
                <div className="domain-status-panel">
                  <div>
                    <strong>{domain ? 'Custom domain configured' : 'No custom domain configured'}</strong>
                    <span>
                      {domain
                        ? <>This restaurant is configured to use <strong>{domain}</strong>.</>
                        : 'The restaurant is currently using its WEB2TABLE platform URL.'}
                    </span>
                  </div>
                  <span className={domain ? 'status active' : 'status inactive'}>{domain ? 'Configured' : 'Not configured'}</span>
                </div>

                {canManage && <div className="domain-form">
                  <label>
                    Custom domain
                    <input value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="restaurant.com" />
                  </label>
                  <button onClick={() => { setDomainError(''); setPendingSaveDomain(true); }} disabled={domainSaving || !domain.trim()}>
                    {domainSaving ? 'Saving...' : 'Save domain'}
                  </button>
                </div>}
                {!canManage && <div className="empty-state">View Only access can view the domain configuration but cannot change it.</div>}
                <div className="domain-help">
                  Add a custom domain only when one is available. Enter only the hostname, for example <strong>restaurant.com</strong>. Do not include https:// or a path.
                </div>
                {domainError && <div className="error-banner">{domainError}</div>}
              </div>
            </div>
          ) : manageTab === 'package' ? (
            <div className="manage-overview package-access-page">
              <div className="overview-section package-access-section">
                <div className="eyebrow">Package & Access</div>
                <h3>Restaurant package</h3>
                <p>Choose the package for this restaurant. The package automatically controls the available modules; individual included modules can be disabled when needed.</p>

                {packageLoading ? (
                  <div className="empty-state">Loading package...</div>
                ) : (
                  <>
                    {packageError && <div className="error-banner">{packageError}</div>}

                    <div className="status-panel package-current-panel">
                      <div>
                        <strong>{restaurantPackageRows[0]?.package_name || 'No package assigned'}</strong>
                        <span>{restaurantPackageRows[0]?.package_description || 'Assign a package to activate restaurant modules.'}</span>
                      </div>
                      <span className={restaurantPackageRows[0]?.subscription_status === 'active' ? 'status active' : 'status inactive'}>
                        {restaurantPackageRows[0]?.subscription_status === 'active' ? 'Active' : 'Not assigned'}
                      </span>
                    </div>

                    {canManage && (
                      <div className="domain-form package-selector">
                        <label>
                          Package
                          <select
                            value={restaurantPackageId ?? ''}
                            onChange={(event) => {
                              const nextPackageId = Number(event.target.value);
                              if (Number.isInteger(nextPackageId) && nextPackageId > 0) {
                                void assignRestaurantPackage(nextPackageId);
                              }
                            }}
                            disabled={packageSaving}
                          >
                            <option value="" disabled>Select a package</option>
                            <option value="1">1 — Full System</option>
                            <option value="2">2 — Self Ordering + POS</option>
                            <option value="3">3 — POS</option>
                            <option value="4">4 — Self Ordering + POS + Kitchen</option>
                            <option value="5">5 — Dispatch + Delivery</option>
                            <option value="6">6 — Self Ordering + Kitchen</option>
                            <option value="7">7 — POS + Delivery</option>
                          </select>
                        </label>
                      </div>
                    )}

                    <div className="overview-section package-modules-section">
                      <div className="eyebrow">Included Modules</div>
                      <h3>Module access</h3>
                      <div className="detail-grid">
                        {restaurantPackageRows.map((module) => (
                          <div className="detail-item" key={module.module_key}>
                            <span>{module.module_name}</span>
                            <label className="toggle-row">
                              <input
                                className="toggle-input"
                                type="checkbox"
                                checked={module.effective_enabled}
                                onChange={(event) => void setRestaurantModuleEnabled(module.module_key, event.target.checked)}
                                disabled={!canManage || !module.included_by_package || packageSaving}
                              />
                              <span className="toggle-switch" aria-hidden="true"><span /></span>
                              <span className="toggle-label">
                                {!module.included_by_package
                                  ? 'Not included'
                                  : module.effective_enabled
                                    ? 'Enabled'
                                    : 'Disabled'}
                              </span>
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="status-panel package-controls-panel">
                      <div>
                        <strong>Package controls</strong>
                        <span>{canManage ? 'Changing the package resets module overrides to the package defaults.' : 'View Only access can review the package but cannot change access.'}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : manageTab === 'staff' ? (
            <div className="manage-overview">
              <div className="overview-section">
                <div className="eyebrow">Staff</div>
                <h3>Restaurant staff</h3>
                <p>View the staff accounts associated with this restaurant. Staff invitations and account management remain part of the restaurant owner's workflow.</p>
                {staffLoading ? (
                  <div className="empty-state">Loading staff...</div>
                ) : staffError ? (
                  <div className="error-banner">{staffError}</div>
                ) : restaurantStaff.length === 0 ? (
                  <div className="empty-state">No staff accounts found for this restaurant.</div>
                ) : (
                  <>
                    {staffActionError && <div className="error-banner">{staffActionError}</div>}
                    <div className="staff-table-wrap">
                    <table className="staff-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Role</th>
                          <th>Email</th>
                          <th>Mobile</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {restaurantStaff.map((staff) => (
                          <tr key={staff.id}>
                            <td>{staff.name || '—'}</td>
                            <td>{staff.role.charAt(0).toUpperCase() + staff.role.slice(1)}</td>
                            <td>{staff.email || '—'}</td>
                            <td>{staff.mobile_number || '—'}</td>
                            <td><span className={staff.is_active ? 'status active' : 'status inactive'}>{staff.is_active ? 'Active' : 'Inactive'}</span></td>
                            <td>
                              <div className="staff-actions">{canManage && <><button
                                  className="secondary-button"
                                  type="button"
                                  onClick={() => void setRestaurantStaffActive(staff.id, !staff.is_active)}
                                  disabled={staffActionId !== null}
                                >
                                  {staffActionId === staff.id ? 'Saving...' : staff.is_active ? 'Deactivate' : 'Activate'}
                                </button>
                                <button
                                  className="danger-button"
                                  type="button"
                                  onClick={() => requestDeleteRestaurantStaff(staff)}
                                  disabled={staffActionId !== null}
                                >
                                  {staffActionId === staff.id ? 'Working...' : 'Delete'}
                                </button></>}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="manage-overview">
              <div className="overview-section">
                <div className="eyebrow">Restaurant Settings</div>
                <h3>Operational controls</h3>
                <p>These are platform-controlled financial and workflow settings. Restaurant owners can view their status, but only the System Administrator can change them.</p>

                {settingsLoading ? (
                  <div className="empty-state">Loading settings...</div>
                ) : (
                  <>
                    <div className="detail-grid">
                      <div className="detail-item">
                        <span>VAT registered</span>
                        <label className="toggle-row">
                          <input
                            className="toggle-input"
                            type="checkbox"
                            checked={vatRegistered}
                            onChange={(event) => setVatRegistered(event.target.checked)}
                            disabled={!canManage}
                          />
                          <span className="toggle-switch" aria-hidden="true"><span /></span>
                          <span className="toggle-label">{vatRegistered ? 'Enabled' : 'Disabled'}</span>
                        </label>
                      </div>
                      <div className="detail-item">
                        <span>VAT rate</span>
                        <label>
                          <input type="number" min="0" max="100" step="0.01" value={vatRate} onChange={(event) => setVatRate(event.target.value)} disabled={!canManage} />
                        </label>
                      </div>
                      <div className="detail-item">
                        <span>Prices are VAT-inclusive</span>
                        <label className="toggle-row">
                          <input
                            className="toggle-input"
                            type="checkbox"
                            checked={pricesVatInclusive}
                            onChange={(event) => setPricesVatInclusive(event.target.checked)}
                            disabled={!canManage}
                          />
                          <span className="toggle-switch" aria-hidden="true"><span /></span>
                          <span className="toggle-label">{pricesVatInclusive ? 'Enabled' : 'Disabled'}</span>
                        </label>
                      </div>
                      <div className="detail-item">
                        <span>Cash on Delivery</span>
                        <label className="toggle-row">
                          <input
                            className="toggle-input"
                            type="checkbox"
                            checked={cashOnDeliveryEnabled}
                            onChange={(event) => setCashOnDeliveryEnabled(event.target.checked)}
                            disabled={!canManage}
                          />
                          <span className="toggle-switch" aria-hidden="true"><span /></span>
                          <span className="toggle-label">{cashOnDeliveryEnabled ? 'Enabled' : 'Disabled'}</span>
                        </label>
                      </div>
                      <div className="detail-item">
                        <span>Automatic rider assignment</span>
                        <label className="toggle-row">
                          <input
                            className="toggle-input"
                            type="checkbox"
                            checked={automaticRiderAssignmentEnabled}
                            onChange={(event) => setAutomaticRiderAssignmentEnabled(event.target.checked)}
                            disabled={!canManage}
                          />
                          <span className="toggle-switch" aria-hidden="true"><span /></span>
                          <span className="toggle-label">{automaticRiderAssignmentEnabled ? 'Enabled' : 'Disabled'}</span>
                        </label>
                      </div>
                    </div>

                    {settingsError && <div className="error-banner">{settingsError}</div>}

                    <div className="status-panel">
                      <div>
                        <strong>Platform-level restaurant controls</strong>
                        <span>{canManage ? 'System Administrator changes are saved through protected database functions.' : 'View Only access can review these settings but cannot change them.'}</span>
                      </div>
                      {canManage && <button onClick={() => setPendingSaveSettings(true)} disabled={settingsSaving}>
                        {settingsSaving ? 'Saving...' : 'Save settings'}
                      </button>}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </section>
          {pendingRestaurantStatus && (
            <div className="modal-backdrop restaurant-status-confirm-backdrop" role="presentation">
              <section className="modal-card restaurant-status-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="restaurant-status-title">
                <div className="modal-heading">
                  <div>
                    <div className="eyebrow">{pendingRestaurantStatus.is_active ? 'Deactivate Restaurant' : 'Activate Restaurant'}</div>
                    <h2 id="restaurant-status-title">{pendingRestaurantStatus.is_active ? 'Deactivate this restaurant?' : 'Activate this restaurant?'}</h2>
                  </div>
                  <button className="icon-button" type="button" onClick={() => setPendingRestaurantStatus(null)} aria-label="Close">×</button>
                </div>
                <div className="restaurant-status-confirm-content">
                  <p>You are about to <strong>{pendingRestaurantStatus.is_active ? 'deactivate' : 'activate'}</strong> <strong>{pendingRestaurantStatus.name}</strong>.</p>
                  <div className="restaurant-status-confirm-warning">
                    <strong>{pendingRestaurantStatus.is_active ? 'Customers will no longer be able to access this restaurant.' : 'Customers will be able to access this restaurant again.'}</strong>
                    <span>This changes the restaurant's platform access status.</span>
                  </div>
                  {restaurantError && <div className="error-banner">{restaurantError}</div>}
                </div>
                <div className="modal-actions">
                  <button type="button" className="secondary-button" onClick={() => setPendingRestaurantStatus(null)}>Cancel</button>
                  <button
                    type="button"
                    className={pendingRestaurantStatus.is_active ? 'danger-button' : ''}
                    onClick={async () => {
                      const restaurant = pendingRestaurantStatus;
                      await toggleRestaurant(restaurant);
                      const { data } = await supabase.from('restaurants').select('id,owner_id,custom_domain,slug,name,tagline,logo_url,location_text,contact_number,email,is_active,created_at,updated_at').eq('id', restaurant.id).single();
                      if (data) setSelectedRestaurant(data as Restaurant);
                      setPendingRestaurantStatus(null);
                    }}
                  >
                    {pendingRestaurantStatus.is_active ? 'Confirm & Deactivate' : 'Confirm & Activate'}
                  </button>
                </div>
              </section>
            </div>
          )}

          {pendingSaveDomain && (
            <div className="modal-backdrop domain-confirm-backdrop" role="presentation">
              <section className="modal-card domain-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="save-domain-title">
                <div className="modal-heading">
                  <div>
                    <div className="eyebrow">Save Domain</div>
                    <h2 id="save-domain-title">Apply this domain?</h2>
                  </div>
                  <button className="icon-button" type="button" onClick={() => setPendingSaveDomain(false)} disabled={domainSaving} aria-label="Close">×</button>
                </div>
                <div className="domain-confirm-content">
                  <p>You are about to set the public domain for <strong>{selectedRestaurant.name}</strong> to <strong>{domain.trim().toLowerCase()}</strong>.</p>
                  <div className="domain-confirm-warning">
                    <strong>This will change the restaurant's public domain configuration.</strong>
                    <span>Use only the hostname, such as restaurant.com. Do not include https:// or a path.</span>
                  </div>
                  {domainError && <div className="error-banner">{domainError}</div>}
                </div>
                <div className="modal-actions">
                  <button type="button" className="secondary-button" onClick={() => setPendingSaveDomain(false)} disabled={domainSaving}>Cancel</button>
                  <button type="button" onClick={() => void saveDomain()} disabled={domainSaving}>{domainSaving ? 'Saving...' : 'Confirm & Save'}</button>
                </div>
              </section>
            </div>
          )}

          {pendingSaveSettings && (
            <div className="modal-backdrop settings-confirm-backdrop" role="presentation">
              <section className="modal-card settings-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="save-settings-title">
                <div className="modal-heading">
                  <div>
                    <div className="eyebrow">Save Settings</div>
                    <h2 id="save-settings-title">Apply these settings?</h2>
                  </div>
                  <button
                    className="icon-button"
                    type="button"
                    onClick={() => setPendingSaveSettings(false)}
                    disabled={settingsSaving}
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>

                <div className="settings-confirm-content">
                  <p>You are about to update the operational settings for <strong>{selectedRestaurant.name}</strong>.</p>
                  <div className="settings-confirm-warning">
                    <strong>This will immediately change how this restaurant handles these settings.</strong>
                    <span>Review the VAT, payment, and rider assignment settings before confirming.</span>
                  </div>
                  {settingsError && <div className="error-banner">{settingsError}</div>}
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setPendingSaveSettings(false)}
                    disabled={settingsSaving}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveRestaurantSettings()}
                    disabled={settingsSaving}
                  >
                    {settingsSaving ? 'Saving...' : 'Confirm & Save'}
                  </button>
                </div>
              </section>
            </div>
          )}

          {pendingAssignOwner && (
            <div className="modal-backdrop owner-confirm-backdrop" role="presentation">
              <section className="modal-card owner-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="assign-owner-title">
                <div className="modal-heading">
                  <div>
                    <div className="eyebrow">Assign Owner</div>
                    <h2 id="assign-owner-title">Assign this owner?</h2>
                  </div>
                  <button className="icon-button" type="button" onClick={() => setPendingAssignOwner(false)} disabled={ownerSaving} aria-label="Close">×</button>
                </div>
                <div className="owner-confirm-content">
                  <p>You are about to assign <strong>{ownerEmail.trim()}</strong> as the owner of <strong>{selectedRestaurant.name}</strong>.</p>
                  <div className="owner-confirm-warning">
                    <strong>This will change the restaurant's owner account.</strong>
                    <span>The existing Supabase account will be used. No new Auth account will be created.</span>
                  </div>
                  {ownerError && <div className="error-banner">{ownerError}</div>}
                </div>
                <div className="modal-actions">
                  <button type="button" className="secondary-button" onClick={() => setPendingAssignOwner(false)} disabled={ownerSaving}>Cancel</button>
                  <button type="button" onClick={() => void assignOwner()} disabled={ownerSaving}>{ownerSaving ? 'Assigning...' : 'Confirm & Assign'}</button>
                </div>
              </section>
            </div>
          )}

          {pendingRemoveOwner && (
            <div className="modal-backdrop owner-confirm-backdrop" role="presentation">
              <section className="modal-card owner-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="remove-owner-title">
                <div className="modal-heading">
                  <div>
                    <div className="eyebrow">Remove Owner</div>
                    <h2 id="remove-owner-title">Remove this owner?</h2>
                  </div>
                  <button className="icon-button" type="button" onClick={() => setPendingRemoveOwner(false)} disabled={ownerSaving} aria-label="Close">×</button>
                </div>
                <div className="owner-confirm-content">
                  <p>You are about to remove <strong>{ownerEmail || ownerName || 'the current owner'}</strong> as the owner of <strong>{selectedRestaurant.name}</strong>.</p>
                  <div className="owner-confirm-warning">
                    <strong>This only removes the restaurant owner assignment.</strong>
                    <span>The Supabase Auth account will not be deleted.</span>
                  </div>
                  {ownerError && <div className="error-banner">{ownerError}</div>}
                </div>
                <div className="modal-actions">
                  <button type="button" className="secondary-button" onClick={() => setPendingRemoveOwner(false)} disabled={ownerSaving}>Cancel</button>
                  <button type="button" className="danger-button" onClick={() => void removeOwner()} disabled={ownerSaving}>{ownerSaving ? 'Removing...' : 'Confirm & Remove'}</button>
                </div>
              </section>
            </div>
          )}

          {pendingDeleteStaff && (
            <div className="modal-backdrop staff-delete-backdrop" role="presentation">
              <section className="modal-card staff-delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-staff-title">
                <div className="modal-heading">
                  <div>
                    <div className="eyebrow">Delete Staff</div>
                    <h2 id="delete-staff-title">Delete {pendingDeleteStaff.name || 'staff member'}?</h2>
                  </div>
                  <button
                    className="icon-button"
                    type="button"
                    onClick={() => setPendingDeleteStaff(null)}
                    disabled={staffActionId !== null}
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>

                <div className="staff-delete-content">
                  <p>This permanently deletes the staff record and the associated Supabase Auth account.</p>
                  <div className="staff-delete-warning">
                    <strong>Only the System Administrator Owner can perform this action.</strong>
                    <span>Historical operational records are preserved where the database relationships allow it.</span>
                  </div>
                  {staffActionError && <div className="error-banner">{staffActionError}</div>}
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setPendingDeleteStaff(null)}
                    disabled={staffActionId !== null}
                  >
                    Close
                  </button>
                  {staffActionError && pendingDeleteStaff.role === 'rider' ? (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        const staffId = pendingDeleteStaff.id;
                        setPendingDeleteStaff(null);
                        setStaffActionError('');
                        void setRestaurantStaffActive(staffId, false);
                      }}
                      disabled={staffActionId !== null}
                    >
                      Deactivate Instead
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => void confirmDeleteRestaurantStaff()}
                      disabled={staffActionId !== null}
                    >
                      {staffActionId === pendingDeleteStaff.id ? 'Deleting...' : 'Delete Staff'}
                    </button>
                  )}
                </div>
              </section>
            </div>
          )}

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
        <div className="admin-header-actions">
            <button className={isAdminPage(adminPage, 'dashboard') ? 'admin-icon-button active' : 'admin-icon-button'} onClick={() => openDashboard()} title="Dashboard" aria-label="Dashboard">
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg>
            </button>
            <button className={isAdminPage(adminPage, 'restaurants') ? 'admin-icon-button active' : 'admin-icon-button'} onClick={() => openRestaurants()} title="Restaurants" aria-label="Restaurants">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5"/><path d="M6.5 9.5V20h11V9.5M9.5 20v-6h5v6"/></svg>
            </button>
            <button className={isAdminPage(adminPage, 'audit') ? 'admin-icon-button active' : 'admin-icon-button'} onClick={() => openAuditLogs()} title="Audit Logs" aria-label="Audit Logs">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5A2.5 2.5 0 0 1 7.5 2h9A2.5 2.5 0 0 1 19 4.5v15a2.5 2.5 0 0 1-2.5 2h-9A2.5 2.5 0 0 1 5 19.5v-15Z"/><path d="M8.5 7.5h7M8.5 11.5h7M8.5 15.5h4"/></svg>
            </button>
            <button className={isAdminPage(adminPage, 'health') ? 'admin-icon-button active' : 'admin-icon-button'} onClick={() => openPlatformHealth()} title="Platform Health" aria-label="Platform Health">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h4l2-6 4 12 2-6h4"/><path d="M4 20h16"/></svg>
            </button>
            <button className="admin-icon-button" onClick={() => setAccountMenuOpen((open) => !open)} title="Account" aria-label="Account">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c.8-3.3 3.2-5 6.5-5s5.7 1.7 6.5 5"/></svg>
            </button>
          </div>
      </header>

        {accountMenuOpen && (
          <div className="account-menu">
            <div className="account-menu-header"><span>System Administrator</span><strong>{adminAccessLevel === 'owner' ? 'Owner' : adminAccessLevel === 'administrator' ? 'Administrator — Full Access' : 'View Only'}</strong></div>
            {adminAccessLevel === 'owner' && <button className="account-menu-item" onClick={() => openAdministrators()}>System Administrators</button>}
            <button className="account-menu-item" onClick={signOut}>Sign out</button>
          </div>
        )}

      <section className="dashboard-card">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Platform Management</div>
            <h2>Restaurants</h2>
            <p>Manage restaurants connected to this ordering platform.</p>
          </div>
          {adminAccessLevel === 'owner' && (
            <button onClick={() => {
              setInviteTenantError('');
              setInviteTenantSuccess('');
              setInviteTenantEmail('');
              setShowInviteTenant(true);
            }}>
              Invite tenant
            </button>
          )}
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
                  {canManage && <button className="secondary-button" onClick={() => startEdit(restaurant)}>Edit</button>}
                  {canManage && <button className={restaurant.is_active ? 'danger-button' : 'secondary-button'} onClick={() => setPendingRestaurantStatus(restaurant)}>
                    {restaurant.is_active ? 'Deactivate' : 'Activate'}
                  </button>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {showInviteTenant && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="tenant-invite-title">
            <div className="modal-heading">
              <div>
                <div className="eyebrow">Tenant onboarding</div>
                <h2 id="tenant-invite-title">Invite a tenant</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => setShowInviteTenant(false)}
                disabled={inviteTenantSaving}
                aria-label="Close"
              >×</button>
            </div>

            <form className="restaurant-form" onSubmit={inviteTenant}>
              <p>
                Create the restaurant tenant, assign its package, and send the owner their setup invitation.
              </p>

              <div className="form-grid">
                <label>
                  Restaurant name
                  <input
                    value={inviteTenantRestaurantName}
                    onChange={(event) => setInviteTenantRestaurantName(event.target.value)}
                    placeholder="My Restaurant"
                    required
                    disabled={inviteTenantSaving}
                  />
                </label>

                <label>
                  Restaurant slug
                  <input
                    value={inviteTenantSlug}
                    onChange={(event) => setInviteTenantSlug(event.target.value.toLowerCase())}
                    placeholder="my-restaurant"
                    pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                    title="Use lowercase letters, numbers, and single hyphens."
                    required
                    disabled={inviteTenantSaving}
                  />
                </label>
              </div>

              <div className="form-grid">
                <label>
                  Package
                  <select
                    value={inviteTenantPackageId}
                    onChange={(event) => setInviteTenantPackageId(event.target.value)}
                    disabled={inviteTenantSaving}
                  >
                    <option value="1">1 — Full System</option>
                    <option value="2">2 — Self Ordering + POS</option>
                    <option value="3">3 — POS</option>
                    <option value="4">4 — Self Ordering + POS + Kitchen</option>
                    <option value="5">5 — Dispatch + Delivery</option>
                    <option value="6">6 — Self Ordering + Kitchen</option>
                    <option value="7">7 — POS + Delivery</option>
                  </select>
                </label>

                <label>
                  Owner email
                  <input
                    type="email"
                    value={inviteTenantEmail}
                    onChange={(event) => setInviteTenantEmail(event.target.value)}
                    placeholder="owner@example.com"
                    required
                    disabled={inviteTenantSaving}
                  />
                </label>
              </div>

              {inviteTenantError && <div className="error-banner">{inviteTenantError}</div>}
              {inviteTenantSuccess && <div className="success-banner">{inviteTenantSuccess}</div>}

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowInviteTenant(false)}
                  disabled={inviteTenantSaving}
                >
                  Close
                </button>
                <button type="submit" disabled={inviteTenantSaving}>
                  {inviteTenantSaving ? 'Sending invitation...' : 'Send invitation'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

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

              <label className="toggle-row">
                <input
                  className="toggle-input"
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) => updateForm('is_active', event.target.checked)}
                />
                <span className="toggle-switch" aria-hidden="true"><span /></span>
                <span className="toggle-label">{form.is_active ? 'Active' : 'Inactive'}</span>
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

      {pendingRestaurantFormSave && (
        <div className="modal-backdrop restaurant-form-confirm-backdrop" role="presentation">
          <section className="modal-card restaurant-form-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="restaurant-save-title">
            <div className="modal-heading">
              <div>
                <div className="eyebrow">{editingRestaurant ? 'Save Changes' : 'Create Restaurant'}</div>
                <h2 id="restaurant-save-title">{editingRestaurant ? 'Save these changes?' : 'Create this restaurant?'}</h2>
              </div>
              <button className="icon-button" type="button" onClick={() => setPendingRestaurantFormSave(false)} disabled={saving} aria-label="Close">×</button>
            </div>
            <div className="restaurant-form-confirm-content">
              <p>You are about to {editingRestaurant ? 'update' : 'create'} <strong>{form.name.trim() || 'this restaurant'}</strong>.</p>
              <div className="restaurant-form-confirm-warning">
                <strong>{editingRestaurant ? 'These changes will update the restaurant profile.' : 'This will create a new restaurant on the platform.'}</strong>
                <span>{form.is_active ? 'The restaurant will be active after saving.' : 'The restaurant will be created as inactive.'}</span>
              </div>
              {restaurantError && <div className="error-banner">{restaurantError}</div>}
            </div>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setPendingRestaurantFormSave(false)} disabled={saving}>Cancel</button>
              <button type="button" onClick={() => void confirmSaveRestaurant()} disabled={saving}>
                {saving ? 'Saving...' : editingRestaurant ? 'Confirm & Save' : 'Confirm & Create'}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default App;
