import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { supabase } from './lib/supabase';

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
    type: 'revoke' | 'restore' | 'change';
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
  const [manageTab, setManageTab] = useState<'overview' | 'owner' | 'domain' | 'settings' | 'staff'>('overview');
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
  const [adminPage, setAdminPage] = useState<'restaurants' | 'audit' | 'administrators'>('restaurants');
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
  const [selectedAuditLog, setSelectedAuditLog] = useState<typeof auditLogs[number] | null>(null);

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

  function openAdministrators() {
    if (adminAccessLevel !== 'owner') return;
    setAccountMenuOpen(false);
    setAdminPage('administrators');
    setSelectedRestaurant(null);
    setInviteAdminError('');
    setInviteAdminSuccess('');
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
      setInviteAdminError(error.message);
      setInviteAdminSaving(false);
      return;
    }
    if (data?.error) {
      setInviteAdminError(String(data.error));
      setInviteAdminSaving(false);
      return;
    }

    setInviteAdminSuccess(`Invitation sent to ${inviteAdminEmail.trim()}.`);
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

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setLoading(false);
      window.alert(error.message);
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
    setLoading(false);
  }

  async function signOut() {
    setAccountMenuOpen(false);
    await recordAuthAuditEvent(
      'LOGOUT',
      'System Administrator signed out',
      { source: 'system_admin_web_app' },
    );

    await supabase.auth.signOut();
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

    const { error } = await supabase.rpc('system_admin_delete_restaurant_staff', {
      p_staff_id: staffId,
    });

    if (error) {
      setStaffActionError(error.message);
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

  async function loadAuditLogs() {
    setAuditLoading(true);
    setAuditError('');

    const { data, error } = await supabase.rpc('system_admin_get_audit_logs', {
      p_restaurant_id: null,
      p_event_type: null,
      p_limit: 500,
    });

    if (error) {
      setAuditError(error.message);
      setAuditLogs([]);
    } else {
      setAuditLogs((Array.isArray(data) ? data : []) as typeof auditLogs);
    }

    setAuditLoading(false);
  }

  function openAuditLogs() {
    setSelectedRestaurant(null);
    setAdminPage('audit');
    void loadAuditLogs();
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

    void loadAuditLogs();

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

  const filteredAuditLogs = useMemo(() => {
    const term = auditSearch.trim().toLowerCase();

    return auditLogs.filter((log) => {
      const eventMatches = auditEventFilter === 'ALL' || log.event_type === auditEventFilter;
      if (!eventMatches) return false;
      if (!term) return true;

      return [
        log.admin_email ?? '',
        log.admin_name ?? '',
        log.restaurant_name ?? '',
        log.action,
        log.event_type,
        JSON.stringify(log.details),
      ].join(' ').toLowerCase().includes(term);
    });
  }, [auditLogs, auditSearch, auditEventFilter]);

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

  if (adminPage === 'administrators') {
    return (
      <main className="admin-shell">
        <header className="admin-header">
          <div className="brand-block">
            <img className="company-logo" src="/web2table-system-admin/web2table.png" alt="WEB2TABLE" />
            <div><div className="eyebrow">Account</div><h1>System Administrators</h1></div>
          </div>
          <div className="admin-header-actions">
            <button className="admin-icon-button" onClick={() => setAdminPage('restaurants')} title="Restaurants" aria-label="Restaurants">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5"/><path d="M6.5 9.5V20h11V9.5M9.5 20v-6h5v6"/></svg>
            </button>
            <button className="admin-icon-button" onClick={() => setAccountMenuOpen((open) => !open)} title="Account" aria-label="Account">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c.8-3.3 3.2-5 6.5-5s5.7 1.7 6.5 5"/></svg>
            </button>
          </div>
        </header>
        {accountMenuOpen && (
          <div className="account-menu">
            <div className="account-menu-header"><span>System Administrator</span><strong>Owner</strong></div>
            <button className="account-menu-item" onClick={() => setAccountMenuOpen(false)}>System Administrators</button>
            <button className="account-menu-item" onClick={signOut}>Sign out</button>
          </div>
        )}
        <button className="back-button" onClick={() => setAdminPage('restaurants')}>← Back to restaurants</button>
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
                          <button className="secondary-button" onClick={() => setPendingAdminAction({ type: 'restore', admin })}>Restore</button>
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
        {pendingAdminAction && (
          <div className="modal-backdrop" role="presentation">
            <section className="modal-card administrator-action-modal" role="dialog" aria-modal="true" aria-labelledby="admin-action-title">
              <div className="modal-heading"><div><div className="eyebrow">Access Control</div><h2 id="admin-action-title">{pendingAdminAction.type === 'revoke' ? 'Revoke access?' : pendingAdminAction.type === 'restore' ? 'Restore access?' : 'Change access level?'}</h2></div><button className="icon-button" type="button" onClick={() => setPendingAdminAction(null)} disabled={adminActionSaving} aria-label="Close">×</button></div>
              <div className="administrator-action-content"><p><strong>{pendingAdminAction.admin.email || pendingAdminAction.admin.name || 'This administrator'}</strong></p><div className="administrator-action-warning"><strong>{pendingAdminAction.type === 'revoke' ? 'This administrator will no longer be able to access System Admin.' : pendingAdminAction.type === 'restore' ? 'This administrator will regain their previous access level.' : 'Access will change to ' + (pendingAdminAction.nextAccessLevel === 'administrator' ? 'Administrator — Full Access' : 'View Only') + '.'}</strong><span>The Owner account cannot be changed or revoked.</span></div>{administratorsError && <div className="error-banner">{administratorsError}</div>}</div>
              <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setPendingAdminAction(null)} disabled={adminActionSaving}>Cancel</button><button type="button" className={pendingAdminAction.type === 'revoke' ? 'danger-button' : ''} onClick={() => void confirmAdministratorAction()} disabled={adminActionSaving}>{adminActionSaving ? 'Saving...' : 'Confirm'}</button></div>
            </section>
          </div>
        )}
      </main>
    );
  }

  if (adminPage === 'audit') {
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
            <button className="admin-icon-button" onClick={() => setAccountMenuOpen((open) => !open)} title="Account" aria-label="Account"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c.8-3.3 3.2-5 6.5-5s5.7 1.7 6.5 5"/></svg></button>
          </div>
        </header>

        {accountMenuOpen && (
          <div className="account-menu">
            <div className="account-menu-header"><span>System Administrator</span><strong>{adminAccessLevel === 'owner' ? 'Owner' : adminAccessLevel === 'administrator' ? 'Administrator — Full Access' : 'View Only'}</strong></div>
            {adminAccessLevel === 'owner' && <button className="account-menu-item" onClick={openAdministrators}>System Administrators</button>}
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
                           <button className="secondary-button audit-view-button" type="button" onClick={() => setSelectedAuditLog(log)}>View</button>
                         </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    );
  }


  {selectedAuditLog && (
    <div className="modal-backdrop audit-detail-backdrop" role="presentation">
      <section className="modal-card audit-detail-modal" role="dialog" aria-modal="true" aria-labelledby="audit-detail-title">
        <div className="modal-heading">
          <div><div className="eyebrow">Audit Event</div><h2 id="audit-detail-title">Event details</h2></div>
          <button className="icon-button" type="button" onClick={() => setSelectedAuditLog(null)} aria-label="Close">×</button>
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
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setSelectedAuditLog(null)}>Close</button></div>
      </section>
    </div>
  )}

  function openRestaurant(restaurant: Restaurant) {
    setSelectedRestaurant(restaurant);
    setManageTab('overview');
    setOwnerEmail('');
    setOwnerName('');
    setOwnerUserId('');
    setOwnerError('');
    setDomain('');
    setDomainError('');
    setSettingsError('');
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
            <button className="admin-icon-button" onClick={openAuditLogs} title="Audit Logs" aria-label="Audit Logs"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5A2.5 2.5 0 0 1 7.5 2h9A2.5 2.5 0 0 1 19 4.5v15a2.5 2.5 0 0 1-2.5 2h-9A2.5 2.5 0 0 1 5 19.5v-15Z"/><path d="M8.5 7.5h7M8.5 11.5h7M8.5 15.5h4"/></svg></button>
            <button className="secondary-button" onClick={signOut}>Sign out</button>
          </div>
        </header>

        {accountMenuOpen && (
          <div className="account-menu">
            <div className="account-menu-header"><span>System Administrator</span><strong>{adminAccessLevel === 'owner' ? 'Owner' : adminAccessLevel === 'administrator' ? 'Administrator — Full Access' : 'View Only'}</strong></div>
            {adminAccessLevel === 'owner' && <button className="account-menu-item" onClick={openAdministrators}>System Administrators</button>}
            <button className="account-menu-item" onClick={signOut}>Sign out</button>
          </div>
        )}

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
                <button className={selectedRestaurant.is_active ? 'danger-button' : 'secondary-button'} onClick={() => setPendingRestaurantStatus(selectedRestaurant)}>
                  {selectedRestaurant.is_active ? 'Deactivate restaurant' : 'Activate restaurant'}
                </button>
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
                    <button className="danger-button" onClick={() => { setOwnerError(''); setPendingRemoveOwner(true); }} disabled={ownerSaving}>Remove owner</button>
                  </div>
                ) : (
                  <div className="owner-form">
                    <label>Owner account email<input type="email" value={ownerEmail} onChange={(event) => setOwnerEmail(event.target.value)} placeholder="owner@example.com" /></label>
                    <button onClick={() => { setOwnerError(''); setPendingAssignOwner(true); }} disabled={ownerSaving || !ownerEmail.trim()}>Assign owner</button>
                  </div>
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

                <div className="domain-form">
                  <label>
                    Custom domain
                    <input value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="restaurant.com" />
                  </label>
                  <button onClick={() => { setDomainError(''); setPendingSaveDomain(true); }} disabled={domainSaving || !domain.trim()}>
                    {domainSaving ? 'Saving...' : 'Save domain'}
                  </button>
                </div>
                <div className="domain-help">
                  Add a custom domain only when one is available. Enter only the hostname, for example <strong>restaurant.com</strong>. Do not include https:// or a path.
                </div>
                {domainError && <div className="error-banner">{domainError}</div>}
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
                          />
                          <span className="toggle-switch" aria-hidden="true"><span /></span>
                          <span className="toggle-label">{vatRegistered ? 'Enabled' : 'Disabled'}</span>
                        </label>
                      </div>
                      <div className="detail-item">
                        <span>VAT rate</span>
                        <label>
                          <input type="number" min="0" max="100" step="0.01" value={vatRate} onChange={(event) => setVatRate(event.target.value)} />
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
                        <span>System Administrator changes are saved through protected database functions.</span>
                      </div>
                      <button onClick={() => setPendingSaveSettings(true)} disabled={settingsSaving}>
                        {settingsSaving ? 'Saving...' : 'Save settings'}
                      </button>
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
                  <p>This will remove the staff record from this restaurant.</p>
                  <div className="staff-delete-warning">
                    <strong>This action does not delete the Supabase Auth account.</strong>
                    <span>Historical operational records are not deleted.</span>
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
          <button className="admin-icon-button" onClick={openAuditLogs} title="Audit Logs" aria-label="Audit Logs"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5A2.5 2.5 0 0 1 7.5 2h9A2.5 2.5 0 0 1 19 4.5v15a2.5 2.5 0 0 1-2.5 2h-9A2.5 2.5 0 0 1 5 19.5v-15Z"/><path d="M8.5 7.5h7M8.5 11.5h7M8.5 15.5h4"/></svg></button>
          <button className="admin-icon-button" onClick={() => setAccountMenuOpen((open) => !open)} title="Account" aria-label="Account"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c.8-3.3 3.2-5 6.5-5s5.7 1.7 6.5 5"/></svg></button>
        </div>
      </header>

        {accountMenuOpen && (
          <div className="account-menu">
            <div className="account-menu-header"><span>System Administrator</span><strong>{adminAccessLevel === 'owner' ? 'Owner' : adminAccessLevel === 'administrator' ? 'Administrator — Full Access' : 'View Only'}</strong></div>
            {adminAccessLevel === 'owner' && <button className="account-menu-item" onClick={openAdministrators}>System Administrators</button>}
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
          {canManage && <button onClick={startCreate}>Add restaurant</button>}
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
                  <button className={restaurant.is_active ? 'danger-button' : 'secondary-button'} onClick={() => setPendingRestaurantStatus(restaurant)}>
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
