import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import {
  Shield,
  Lock,
  Calendar,
  Check,
  CheckCircle,
  KeyRound,
  X,
  AlertCircle,
  Info,
  Settings as SettingsIcon,
  CheckSquare,
  Square,
  Globe,
  Database,
  Bell,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAppState } from '@/context/AppStateContext';
import { saveSettings } from '@/api/settings';
import { activateLicense, deactivateLicense, fetchLicenseStatus } from '@/api/license';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useNotifications } from '@/hooks/useNotifications';
import type { PluginInfoStrings } from '@/types/app-state';

interface AccessTableRole {
  key: string;
  label: string;
  editable: boolean;
}

type SettingsTabId =
  | 'general'
  | 'multilingual'
  | 'database'
  | 'notifications'
  | 'license'
  | 'advanced'
  | 'access';

export function Settings(): ReactElement {
  const { state, setState } = useAppState();
  const { access, notices, strings } = state;
  const restBaseUrl = state.urls?.rest ?? '';
  const pluginInfo = strings.plugin ?? {};
  const isProInstalled = Boolean(state.isProBuild);
  const isProActive = Boolean(pluginInfo?.isPro);
  const licenseStatus = typeof pluginInfo?.status === 'string' ? pluginInfo.status : '';
  const isLicenseActive = ['valid', 'active'].includes(licenseStatus);
  const isPro = isProInstalled || isProActive || isLicenseActive;
  const getString = (key: string, fallback: string): string => {
    const raw = (strings as Record<string, unknown> | undefined)?.[key];
    if (typeof raw === 'string' && raw.trim().length > 0) {
      return raw;
    }
    return fallback;
  };
  const formatLicenseDate = (value?: string): string => {
    if (!value) {
      return '-';
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return parsed.toLocaleDateString();
  };
  const getDaysRemainingLabel = (value?: string): string => {
    if (!value) {
      return '';
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return '';
    }

    const diffMs = parsed.getTime() - Date.now();
    const days = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    return `${days} ${getString('settingsLicenseDaysRemaining', 'days remaining')}`;
  };
  const maskLicenseKey = (value?: string): string => {
    if (!value) {
      return '-';
    }

    if (value.length <= 4) {
      return value;
    }

    return `${'*'.repeat(value.length - 4)}${value.slice(-4)}`;
  };
  const licenseKeyValue = typeof pluginInfo?.license === 'string' ? pluginInfo.license : licenseKeyDraft;
  const licenseExpiryLabel = formatLicenseDate(pluginInfo?.expires);
  const licenseDaysRemaining = getDaysRemainingLabel(pluginInfo?.expires);
  const domainsUsedLabel =
    typeof pluginInfo?.site_count === 'number' && typeof pluginInfo?.license_limit === 'number'
      ? `${pluginInfo.site_count} ${getString('settingsLicenseDomainsUsedOf', 'of')} ${pluginInfo.license_limit}`
      : '-';
  const domainsAvailableLabel =
    typeof pluginInfo?.activations_left === 'number'
      ? `${pluginInfo.activations_left} ${getString('settingsLicenseDomainsAvailableSuffix', 'domains available')}`
      : '';
  const maskedLicenseKey = maskLicenseKey(licenseKeyValue);
  const manageDomainsUrl = pluginInfo?.manage_url ?? pluginInfo?.portal_url;
  const manageSubscriptionUrl = pluginInfo?.portal_url ?? pluginInfo?.manage_url;
  const subscriptionPlanLabel =
    pluginInfo?.plan && pluginInfo.plan.trim().length > 0
      ? pluginInfo.plan
      : getString('settingsSubscriptionLicenseTypeValue', 'Pro Annual');
  const subscriptionActivationLabel = formatLicenseDate(pluginInfo?.activated_on);
  const subscriptionEmailLabel = pluginInfo?.customer_email || '-';
  const subscriptionAutoRenewalLabel = isLicenseActive
    ? getString('settingsSubscriptionAutoRenewalEnabledValue', 'Enabled')
    : '-';
  const proFeatures = useMemo(
    () => [
      {
        title: getString('settingsProFeatureMultipleFormatsTitle', 'Multiple Formats'),
        description: getString(
          'settingsProFeatureMultipleFormatsDescription',
          'Export to CSV, XML, Excel (XLSX/XLS), JSON, TSV, and custom delimiter formats.',
        ),
      },
      {
        title: getString('settingsProFeatureAllProductTypesTitle', 'All Product Types'),
        description: getString(
          'settingsProFeatureAllProductTypesDescription',
          'Simple, variable, grouped, external, digital, and downloadable products fully supported.',
        ),
      },
      {
        title: getString('settingsProFeatureCompleteDataTitle', 'Complete Data Export'),
        description: getString(
          'settingsProFeatureCompleteDataDescription',
          'Titles, descriptions, prices, SKUs, attributes, categories, tags, images, custom fields, ACF, SEO metadata.',
        ),
      },
      {
        title: getString('settingsProFeatureAdvancedFilteringTitle', 'Advanced Filtering'),
        description: getString(
          'settingsProFeatureAdvancedFilteringDescription',
          'Filter by category, tag, stock status, price range, attributes, and custom meta fields before export.',
        ),
      },
      {
        title: getString('settingsProFeatureSmartFieldMappingTitle', 'Smart Field Mapping'),
        description: getString(
          'settingsProFeatureSmartFieldMappingDescription',
          'Full control over which fields are exported and how they are structured in the output file.',
        ),
      },
      {
        title: getString('settingsProFeatureBatchProcessingTitle', 'Batch Processing'),
        description: getString(
          'settingsProFeatureBatchProcessingDescription',
          'Memory-safe processing optimized for large catalogs with 100,000+ products.',
        ),
      },
      {
        title: getString('settingsProFeatureDeltaExportTitle', 'Delta Export'),
        description: getString(
          'settingsProFeatureDeltaExportDescription',
          'Export only changed data since last export. Save time and bandwidth.',
        ),
      },
      {
        title: getString('settingsProFeatureDetailedLoggingTitle', 'Detailed Logging'),
        description: getString(
          'settingsProFeatureDetailedLoggingDescription',
          'Complete logs with exported product counts, errors, warnings, and execution time.',
        ),
      },
    ],
    [strings],
  );
  const tabs: { id: SettingsTabId; label: string; icon: LucideIcon }[] = [
    { id: 'general', label: getString('settingsTabGeneral', 'General'), icon: SettingsIcon },
    ...(isPro ? [{ id: 'multilingual' as const, label: getString('settingsTabMultilingual', 'Multilingual'), icon: Globe }] : []),
    { id: 'database', label: getString('settingsTabDatabase', 'Database'), icon: Database },
    { id: 'notifications', label: getString('settingsTabNotifications', 'Notifications'), icon: Bell },
    ...(isProInstalled
      ? [{ id: 'license' as const, label: getString('settingsTabLicense', 'License'), icon: Lock }]
      : []),
    { id: 'advanced', label: getString('settingsTabAdvanced', 'Advanced'), icon: Zap },
    ...(isPro ? [{ id: 'access' as const, label: getString('settingsTabAccess', 'Access control'), icon: Shield }] : []),
  ];

  const accessRoles = useMemo<AccessTableRole[]>(() => {
    const managedRoles = Object.entries(access.roles ?? {}).map(([key, label]) => ({
      key,
      label,
      editable: true,
    }));

    return [
      {
        key: 'administrator',
        label: getString('settingsAccessRoleAdministrator', 'Administrator'),
        editable: false,
      },
      ...managedRoles,
    ];
  }, [access.roles]);

  const capabilityEntries = useMemo(() => Object.entries(access.capabilities ?? {}), [access.capabilities]);
  const accessGridTemplate = useMemo(
    () => `1fr repeat(${Math.max(accessRoles.length, 1)}, minmax(0, 1fr))`,
    [accessRoles.length]
  );
  const totalAccessColumns = 1 + Math.max(accessRoles.length, 1);
  const statusSpanColumns = Math.max(totalAccessColumns - 1, 1);

  const [activeTab, setActiveTab] = useState<SettingsTabId>('general');

  useEffect(() => {
    if (!isPro && (activeTab === 'multilingual' || activeTab === 'access')) {
      setActiveTab('general');
    }
  }, [activeTab, isPro]);

  const [licenseKeyDraft, setLicenseKeyDraft] = useState<string>(
    typeof pluginInfo?.license === 'string' ? pluginInfo.license : '',
  );
  const [licenseKeyVisible, setLicenseKeyVisible] = useState(false);
  const [isActivatingLicense, setIsActivatingLicense] = useState(false);
  const [isDeactivatingLicense, setIsDeactivatingLicense] = useState(false);
  const [isRefreshingLicense, setIsRefreshingLicense] = useState(false);
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false);
  const hasAutoOpenedLicenseModalRef = useRef(false);

  const buildAccessDraft = (): Record<string, Record<string, boolean>> => {
    const draft: Record<string, Record<string, boolean>> = {};

    accessRoles.forEach((role) => {
      const currentRoleMatrix = access.matrix?.[role.key] ?? {};
      draft[role.key] = {};

      capabilityEntries.forEach(([capKey]) => {
        draft[role.key][capKey] = Boolean(currentRoleMatrix[capKey]);
      });
    });

    return draft;
  };

  const handleSaveAdvanced = async (): Promise<void> => {
    if (!restBaseUrl) {
      setAdvancedMessage(
        getString('settingsRestBaseUrlMissing', 'REST API base URL is not configured.'),
      );
      return;
    }

    setIsSavingAdvanced(true);
    setAdvancedMessage(null);

    try {
      const normalizedDraft = {
        ...advancedDraft,
        memoryLimitMb: Math.min(Math.max(advancedDraft.memoryLimitMb || 0, 64), 4096),
        executionTimeout: Math.min(Math.max(advancedDraft.executionTimeout || 0, 60), 7200),
      };

      const nextSettings = {
        ...state.settings,
        advanced: normalizedDraft,
      };

      const saved = await saveSettings(restBaseUrl, nextSettings);

      setState((prev) => ({
        ...prev,
        settings: saved,
      }));

      setAdvancedMessage(getString('settingsAdvancedSaved', 'Advanced settings saved.'));
    } catch (error) {
      const fallback = getString(
        'settingsAdvancedSaveFailed',
        'Failed to save advanced settings.',
      );
      const message = error instanceof Error ? error.message : fallback;
      setAdvancedMessage(message);
    } finally {
      setIsSavingAdvanced(false);
    }
  };

  const handleResetAdvanced = (): void => {
    setAdvancedDraft({
      memoryLimitMb: 256,
      executionTimeout: 300,
      queryCaching: true,
    });
    setAdvancedMessage(
      getString('settingsAdvancedReset', 'Advanced settings reset. Save to apply.'),
    );
  };

  const handleSaveNotifications = async (): Promise<void> => {
    if (!restBaseUrl) {
      console.warn('REST base URL is not configured.');
      setNotificationsMessage(
        getString('settingsRestBaseUrlMissing', 'REST API base URL is not configured.'),
      );
      return;
    }

    setIsSavingNotifications(true);
    setNotificationsMessage(null);

    try {
      const nextSettings = {
        ...state.settings,
        notifications: notificationsDraft,
      };

      const saved = await saveSettings(restBaseUrl, nextSettings);

      setState((prev) => ({
        ...prev,
        settings: saved,
      }));

      const savedLabel = getString('settingsSaved', 'Settings saved.');
      const prefsLabel = getString(
        'settingsNotificationsSaved',
        'Notification preferences saved.',
      );
      setNotificationsMessage(savedLabel);
      notify('exportComplete', prefsLabel, { severity: 'success', persist: false });
    } catch (error) {
      const fallback = getString('settingsSaveFailed', 'Failed to save settings.');
      const message = error instanceof Error ? error.message : fallback;
      setNotificationsMessage(message);
      notify('exportError', message, { severity: 'error', persist: false });
    } finally {
      setIsSavingNotifications(false);
    }
  };


  const handleSaveDatabase = async (): Promise<void> => {
    if (!restBaseUrl) {
      console.warn('REST base URL is not configured.');
      setDatabaseMessage(
        getString('settingsRestBaseUrlMissing', 'REST API base URL is not configured.'),
      );
      return;
    }

    setIsSavingDatabase(true);
    setDatabaseMessage(null);

    try {
      const nextSettings = {
        ...state.settings,
        database: databaseDraft,
      };

      const saved = await saveSettings(restBaseUrl, nextSettings);

      setState((prev) => ({
        ...prev,
        settings: saved,
      }));

      setDatabaseMessage(getString('settingsSaved', 'Settings saved.'));
    } catch (error) {
      const fallback = getString('settingsSaveFailed', 'Failed to save settings.');
      const message = error instanceof Error ? error.message : fallback;
      setDatabaseMessage(message);
    } finally {
      setIsSavingDatabase(false);
    }
  };

  const [accessDraft, setAccessDraft] = useState<Record<string, Record<string, boolean>>>(() => buildAccessDraft());
  const [isApplyingAccess, setIsApplyingAccess] = useState(false);
  const [accessMessage, setAccessMessage] = useState<string | null>(null);
  const [generalDraft, setGeneralDraft] = useState(() => state.settings.general);
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);
  const [generalMessage, setGeneralMessage] = useState<string | null>(null);
  const [multilingualDraft, setMultilingualDraft] = useState(() => state.settings.multilingual);
  const [databaseDraft, setDatabaseDraft] = useState(() => state.settings.database);
  const [advancedDraft, setAdvancedDraft] = useState(() => state.settings.advanced);
  const [isSavingMultilingual, setIsSavingMultilingual] = useState(false);
  const [multilingualMessage, setMultilingualMessage] = useState<string | null>(null);
  const [isSavingDatabase, setIsSavingDatabase] = useState(false);
  const [databaseMessage, setDatabaseMessage] = useState<string | null>(null);
  const [isSavingAdvanced, setIsSavingAdvanced] = useState(false);
  const [advancedMessage, setAdvancedMessage] = useState<string | null>(null);
  const [notificationsDraft, setNotificationsDraft] = useState(() => state.settings.notifications);
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);
  const [notificationsMessage, setNotificationsMessage] = useState<string | null>(null);
  const displayedNoticeKeysRef = useRef<Set<string>>(new Set());
  const { notify, clearNotices } = useNotifications();

  useEffect(() => {
    setAccessDraft(buildAccessDraft());
  }, [access.matrix, accessRoles, capabilityEntries]);

  useEffect(() => {
    setGeneralDraft(state.settings.general);
  }, [state.settings.general]);

  useEffect(() => {
    setLicenseKeyDraft(typeof pluginInfo?.license === 'string' ? pluginInfo.license : '');
  }, [pluginInfo?.license]);

  useEffect(() => {
    if (!isProInstalled) {
      return;
    }

    if (isLicenseActive) {
      return;
    }

    if (hasAutoOpenedLicenseModalRef.current) {
      return;
    }

    hasAutoOpenedLicenseModalRef.current = true;
    setActiveTab('license');
    setIsLicenseModalOpen(true);
  }, [isLicenseActive, isProInstalled]);

  useEffect(() => {
    if (isPro) {
      return;
    }

    if (generalDraft.defaultExportFormat !== 'csv') {
      setGeneralDraft((prev) => ({
        ...prev,
        defaultExportFormat: 'csv',
      }));
    }
  }, [generalDraft.defaultExportFormat, isPro]);

  useEffect(() => {
    setMultilingualDraft(state.settings.multilingual);
  }, [state.settings.multilingual]);

  useEffect(() => {
    setDatabaseDraft(state.settings.database);
  }, [state.settings.database]);

  useEffect(() => {
    setAdvancedDraft(state.settings.advanced);
  }, [state.settings.advanced]);

  useEffect(() => {
    setNotificationsDraft(state.settings.notifications);
  }, [state.settings.notifications]);


  useEffect(() => {
    if (!Array.isArray(notices) || notices.length === 0) {
      return;
    }

    const sanitize = (value: string): string =>
      value.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

    notices.forEach((notice) => {
      const code = typeof notice.code === 'string' && notice.code ? notice.code : 'notice';
      const type = typeof notice.type === 'string' ? notice.type : 'info';
      const message = typeof notice.message === 'string' ? sanitize(notice.message) : '';

      if (!message) {
        return;
      }

      const cacheKey = `${code}:${type}:${message}`;

      if (displayedNoticeKeysRef.current.has(cacheKey)) {
        return;
      }

      displayedNoticeKeysRef.current.add(cacheKey);

      const preferenceKey =
        code.startsWith('prodexfo_schedule') || code.startsWith('prodexfo_history')
          ? (type === 'error' ? 'scheduledError' : 'scheduledComplete')
          : code.includes('storage')
            ? 'storageFull'
            : type === 'error'
              ? 'exportError'
              : 'exportComplete';

      if (!state.settings.notifications[preferenceKey as keyof typeof state.settings.notifications]) {
        return;
      }

      if (type === 'error') {
        toast.error(message);
      } else {
        toast.success(message);
      }
    });
  }, [notices, state.settings.notifications]);

  const handleClearNotices = (): void => {
    displayedNoticeKeysRef.current.clear();
    clearNotices();
  };

  const updatePluginInfo = (next: PluginInfoStrings | undefined): void => {
    setState((prev) => ({
      ...prev,
      strings: {
        ...prev.strings,
        plugin: {
          ...(prev.strings?.plugin ?? {}),
          ...(next ?? {}),
        },
      },
    }));
  };

  const applyLicensePayload = (payload: {
    license?: PluginInfoStrings;
    capabilities?: Record<string, boolean>;
    media?: typeof state.media;
  }): void => {
    if (!payload) {
      return;
    }

    setState((prev) => ({
      ...prev,
      capabilities: payload.capabilities ?? prev.capabilities,
      media: payload.media ?? prev.media,
      strings: {
        ...prev.strings,
        plugin: {
          ...(prev.strings?.plugin ?? {}),
          ...(payload.license ?? {}),
        },
      },
    }));
  };

  const handleRefreshLicenseStatus = async (): Promise<void> => {
    if (!restBaseUrl) {
      toast.error(getString('settingsRestBaseUrlMissing', 'REST API base URL is not configured.'));
      return;
    }

    setIsRefreshingLicense(true);

    try {
      const response = await fetchLicenseStatus(restBaseUrl, true);
      applyLicensePayload(response);
      toast.success(getString('settingsLicenseStatusRefreshed', 'License status refreshed.'));
    } catch (error) {
      const fallback = getString('settingsLicenseStatusRefreshFailed', 'Failed to refresh license status.');
      const message = error instanceof Error ? error.message : fallback;
      toast.error(message);
    } finally {
      setIsRefreshingLicense(false);
    }
  };

  const handleActivateLicense = async (): Promise<void> => {
    if (!restBaseUrl) {
      toast.error(getString('settingsRestBaseUrlMissing', 'REST API base URL is not configured.'));
      return;
    }

    const trimmed = licenseKeyDraft.trim();
    if (!trimmed) {
      toast.error(getString('settingsLicenseEnterKey', 'Enter a license key.'));
      return;
    }

    setIsActivatingLicense(true);

    try {
      const response = await activateLicense(restBaseUrl, trimmed);
      applyLicensePayload(response);
      toast.success(getString('settingsLicenseActivated', 'License activated.'));
      setIsLicenseModalOpen(false);
    } catch (error) {
      const fallback = getString('settingsLicenseActivationFailed', 'Failed to activate license.');
      const message = error instanceof Error ? error.message : fallback;
      toast.error(message);
    } finally {
      setIsActivatingLicense(false);
    }
  };

  const handleDeactivateLicense = async (): Promise<void> => {
    if (!restBaseUrl) {
      toast.error(getString('settingsRestBaseUrlMissing', 'REST API base URL is not configured.'));
      return;
    }

    setIsDeactivatingLicense(true);

    try {
      const response = await deactivateLicense(restBaseUrl);
      applyLicensePayload(response);
      toast.success(getString('settingsLicenseDeactivated', 'License deactivated.'));
    } catch (error) {
      const fallback = getString('settingsLicenseDeactivationFailed', 'Failed to deactivate license.');
      const message = error instanceof Error ? error.message : fallback;
      toast.error(message);
    } finally {
      setIsDeactivatingLicense(false);
    }
  };

  const hasAccessChanges = useMemo(() => {
    return accessRoles.some((role) => {
      const roleMatrix = access.matrix?.[role.key] ?? {};
      const draftRole = accessDraft[role.key] ?? {};

      return capabilityEntries.some(([capKey]) => Boolean(roleMatrix[capKey]) !== Boolean(draftRole[capKey]));
    });
  }, [accessDraft, access.matrix, accessRoles, capabilityEntries]);

  const handleSaveMultilingual = async (): Promise<void> => {
    if (!restBaseUrl) {
      console.warn('REST base URL is not configured.');
      setMultilingualMessage(
        getString('settingsRestBaseUrlMissing', 'REST API base URL is not configured.'),
      );
      return;
    }

    setIsSavingMultilingual(true);
    setMultilingualMessage(null);

    try {
      const nextSettings = {
        ...state.settings,
        multilingual: multilingualDraft,
      };

      const saved = await saveSettings(restBaseUrl, nextSettings);

      setState((prev) => ({
        ...prev,
        settings: saved,
      }));

      setMultilingualMessage(getString('settingsSaved', 'Settings saved.'));
    } catch (error) {
      const fallback = getString('settingsSaveFailed', 'Failed to save settings.');
      const message = error instanceof Error ? error.message : fallback;
      setMultilingualMessage(message);
    } finally {
      setIsSavingMultilingual(false);
    }
  };

  const handleSaveGeneral = async (): Promise<void> => {
    if (!restBaseUrl) {
      console.warn('REST base URL is not configured.');
      setGeneralMessage(
        getString('settingsRestBaseUrlMissing', 'REST API base URL is not configured.'),
      );
      return;
    }

    setIsSavingGeneral(true);
    setGeneralMessage(null);

    try {
      const nextSettings = {
        ...state.settings,
        general: generalDraft,
      };

      const saved = await saveSettings(restBaseUrl, nextSettings);

      setState((prev) => ({
        ...prev,
        settings: saved,
      }));

      setGeneralMessage(getString('settingsSaved', 'Settings saved.'));
    } catch (error) {
      const fallback = getString('settingsSaveFailed', 'Failed to save settings.');
      const message = error instanceof Error ? error.message : fallback;
      setGeneralMessage(message);
    } finally {
      setIsSavingGeneral(false);
    }
  };

  const handleToggleCapability = (roleKey: string, capabilityKey: string): void => {
    setAccessDraft((prev) => {
      const next = { ...prev };
      const roleMatrix = { ...(next[roleKey] ?? {}) };
      roleMatrix[capabilityKey] = !roleMatrix[capabilityKey];
      next[roleKey] = roleMatrix;
      return next;
    });
    setAccessMessage(null);
  };

  const handleApplyAccessChanges = (): void => {
    if (!hasAccessChanges || isApplyingAccess) {
      return;
    }

    setIsApplyingAccess(true);

    try {
      setState((prev) => ({
        ...prev,
        access: {
          ...prev.access,
          matrix: {
            ...(prev.access?.matrix ?? {}),
            ...accessDraft,
          },
        },
      }));

      setAccessMessage(
        getString('settingsAccessUpdated', 'Access permissions updated.'),
      );
    } finally {
      setIsApplyingAccess(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-gray-900 page-heading mb-2">
          {getString('settingsTitle', 'Plugin Settings')}
        </h1>
        <p className="text-gray-600 page-subheading">
          {getString('settingsSubtitle', 'Configure global settings and preferences')}
        </p>
      </div>

      {isProInstalled && isLicenseModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-8"
          onClick={() => setIsLicenseModalOpen(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-gray-900 block-heading mb-1">
                  {getString('settingsLicenseKeyTitle', 'License Key')}
                </h2>
                <p className="text-sm text-gray-600">
                  {getString('settingsLicenseKeyLabel', 'Enter your license key to unlock Pro features')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsLicenseModalOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <input
                type={licenseKeyVisible ? 'text' : 'password'}
                value={licenseKeyDraft}
                onChange={(event) => setLicenseKeyDraft(event.target.value)}
                placeholder={getString('settingsLicenseKeyPlaceholder', 'XXXX-XXXX-XXXX-XXXX')}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF3A2E]"
              />

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setLicenseKeyVisible((prev) => !prev)}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  {licenseKeyVisible
                    ? getString('settingsLicenseHide', 'Hide')
                    : getString('settingsLicenseShow', 'Show')}
                </button>

                <button
                  type="button"
                  onClick={handleRefreshLicenseStatus}
                  disabled={isRefreshingLicense}
                  className="text-sm text-gray-600 hover:text-gray-900 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isRefreshingLicense
                    ? getString('settingsLicenseRefreshingLabel', 'Refreshing…')
                    : getString('settingsLicenseRefreshStatusButton', 'Refresh Status')}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setIsLicenseModalOpen(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
              >
                {getString('settingsCancelButton', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={handleActivateLicense}
                disabled={isActivatingLicense}
                className="px-6 py-3 bg-[#FF3A2E] text-white rounded-xl hover:bg-red-600 transition-colors disabled:opacity-70 disabled:cursor-not-allowed font-medium"
              >
                {isActivatingLicense
                  ? getString('settingsLicenseActivatingLabel', 'Activating…')
                  : getString('settingsLicenseActivateButton', 'Activate License')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-6">
        {/* Sidebar Tabs */}
        <div className="w-64 bg-white rounded-2xl border border-gray-200 p-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl mb-2 transition-all menu-item-text ${
                  activeTab === tab.id ? 'bg-[#FF3A2E] text-white' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-5 h-5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="flex-1 space-y-6">
          {activeTab === 'general' && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="text-gray-900 block-heading mb-6">
                {getString('settingsGeneralTitle', 'General Settings')}
              </h2>

              <div className="space-y-6">
                <div>
                  <label className="block text-gray-700 mb-2">
                    {getString('settingsGeneralDefaultFormatLabel', 'Default Export Format')}
                  </label>
                  <select
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF3A2E]"
                    value={isPro ? generalDraft.defaultExportFormat : 'csv'}
                    disabled={!isPro}
                    onChange={(event) =>
                      setGeneralDraft((prev) => ({
                        ...prev,
                        defaultExportFormat: event.target.value,
                      }))
                    }
                  >
                    <option value="csv">CSV</option>
                    {isPro && (
                      <>
                        <option value="xlsx">XLSX</option>
                        <option value="xml">XML</option>
                        <option value="json">JSON</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-gray-700 mb-2">
                    {getString('settingsGeneralProductsPerBatchLabel', 'Products Per Batch')}
                  </label>
                  <input
                    type="number"
                    value={generalDraft.productsPerBatch}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setGeneralDraft((prev) => ({
                        ...prev,
                        productsPerBatch: Number.isNaN(value) ? 0 : value,
                      }));
                    }}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF3A2E]"
                  />
                  <p className="text-gray-500 text-caption mt-2">
                    {getString(
                      'settingsGeneralProductsPerBatchHelp',
                      'Lower values reduce memory usage but may increase export time',
                    )}
                  </p>
                </div>

                <div>
                  <label className="block text-gray-700 mb-2">
                    {getString('settingsGeneralExportDirectoryLabel', 'Export Directory')}
                  </label>
                  <input
                    type="text"
                    value={generalDraft.exportDirectory}
                    onChange={(event) =>
                      setGeneralDraft((prev) => ({
                        ...prev,
                        exportDirectory: event.target.value,
                      }))
                    }
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF3A2E]"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="cleanup"
                    checked={generalDraft.autoCleanup}
                    onChange={(event) =>
                      setGeneralDraft((prev) => ({
                        ...prev,
                        autoCleanup: event.target.checked,
                      }))
                    }
                    className="w-4 h-4 text-[#FF3A2E] border-gray-300 rounded focus:ring-[#FF3A2E]"
                  />
                  <div className="flex flex-col">
                    <label htmlFor="cleanup" className="text-gray-700">
                      {getString(
                        'settingsGeneralAutoCleanupLabel',
                        'Auto-delete exports older than 7 days',
                      )}
                    </label>
                    <span className="text-gray-500 text-xs mt-0.5">
                      {getString(
                        'settingsGeneralAutoCleanupHelp',
                        'Only export files and image ZIP archives are deleted. Export history records remain available in the Export History table.',
                      )}
                    </span>
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    type="button"
                    onClick={handleSaveGeneral}
                    disabled={isSavingGeneral}
                    className="px-6 py-3 bg-[#FF3A2E] text-white rounded-xl hover:bg-red-600 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isSavingGeneral
                      ? getString('settingsSavingLabel', 'Saving…')
                      : getString('settingsSaveButtonLabel', 'Save Changes')}
                  </button>
                  {generalMessage && (
                    <p className="text-sm text-gray-600 mt-2">{generalMessage}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'multilingual' && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="text-gray-900 block-heading mb-6">
                {getString('settingsMultilingualTitle', 'Multilingual Settings (WPML / Polylang)')}
              </h2>
              <p className="text-gray-500 text-body mb-6">
                {getString(
                  'settingsMultilingualWpmlNote',
                  'Install and configure WPML or Polylang to include translated product content. Without a multilingual plugin, only column headers will be localized.',
                )}
              </p>

              <div className="space-y-6">
                <div>
                  <label className="block text-gray-700 mb-4">
                    {getString('settingsMultilingualExportMethodLabel', 'Export Method')}
                  </label>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100">
                      <input
                        type="radio"
                        name="multilingual-mode"
                        className="w-4 h-4 text-[#FF3A2E] border-gray-300 focus:ring-[#FF3A2E]"
                        checked={multilingualDraft.exportMode === 'separate_columns'}
                        onChange={() =>
                          setMultilingualDraft((prev) => ({
                            ...prev,
                            exportMode: 'separate_columns',
                          }))
                        }
                      />
                      <div>
                        <p className="text-gray-900 text-body">
                          {getString('settingsMultilingualSeparateColumnsTitle', 'Separate Columns')}
                        </p>
                        <p className="text-gray-500 text-caption">
                          {getString(
                            'settingsMultilingualSeparateColumnsCaption',
                            'name_en, name_de, name_fr...',
                          )}
                        </p>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100">
                      <input
                        type="radio"
                        name="multilingual-mode"
                        className="w-4 h-4 text-[#FF3A2E] border-gray-300 focus:ring-[#FF3A2E]"
                        checked={multilingualDraft.exportMode === 'separate_files'}
                        onChange={() =>
                          setMultilingualDraft((prev) => ({
                            ...prev,
                            exportMode: 'separate_files',
                          }))
                        }
                      />
                      <div>
                        <p className="text-gray-900 text-body">
                          {getString('settingsMultilingualSeparateFilesTitle', 'Separate Files')}
                        </p>
                        <p className="text-gray-500 text-caption">
                          {getString(
                            'settingsMultilingualSeparateFilesCaption',
                            'products-en.csv, products-de.csv...',
                          )}
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-gray-700 mb-3">
                    {getString('settingsMultilingualActiveLanguagesLabel', 'Active Languages')}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { code: 'ar', name: 'Arabic', flag: '🇦🇪' },
                      { code: 'de', name: 'German', flag: '🇩🇪' },
                      { code: 'en', name: 'English', flag: '🇺🇸' },
                      { code: 'es', name: 'Spanish', flag: '🇪🇸' },
                      { code: 'fr', name: 'French', flag: '🇫🇷' },
                      { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
                      { code: 'id', name: 'Indonesian', flag: '🇮🇩' },
                      { code: 'it', name: 'Italian', flag: '🇮🇹' },
                      { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
                      { code: 'pt', name: 'Portuguese (BR)', flag: '🇧🇷' },
                      { code: 'ru', name: 'Russian', flag: '🇷🇺' },
                      { code: 'th', name: 'Thai', flag: '🇹🇭' },
                      { code: 'tr', name: 'Turkish', flag: '🇹🇷' },
                    ].map((lang) => (
                      <label
                        key={lang.code}
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100"
                      >
                        <input
                          type="checkbox"
                          checked={multilingualDraft.activeLanguages.includes(lang.code)}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setMultilingualDraft((prev) => ({
                              ...prev,
                              activeLanguages: checked
                                ? [...prev.activeLanguages.filter((code) => code !== lang.code), lang.code]
                                : prev.activeLanguages.filter((code) => code !== lang.code),
                            }));
                          }}
                          className="w-4 h-4 text-[#FF3A2E] border-gray-300 rounded focus:ring-[#FF3A2E]"
                        />
                        <span className="text-2xl">{lang.flag}</span>
                        <span className="text-gray-900">
                          {getString(
                            `settingsMultilingualLanguageName_${lang.code}`,
                            lang.name,
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    type="button"
                    onClick={handleSaveMultilingual}
                    disabled={isSavingMultilingual}
                    className="px-6 py-3 bg-[#FF3A2E] text-white rounded-xl hover:bg-red-600 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isSavingMultilingual
                      ? getString('settingsSavingLabel', 'Saving…')
                      : getString('settingsSaveButtonLabel', 'Save Changes')}
                  </button>
                  {multilingualMessage && (
                    <p className="text-sm text-gray-600 mt-2">{multilingualMessage}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'database' && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="text-gray-900 block-heading mb-6">
                {getString('settingsDatabaseTitle', 'Database Settings')}
              </h2>

              <div className="space-y-6">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-blue-900 text-body font-semibold mb-1">
                        {getString('settingsDatabaseOptimizationTitle', 'Database Optimization')}
                      </p>
                      <p className="text-blue-700 text-label">
                        {getString(
                          'settingsDatabaseOptimizationDescription',
                          'Keep your export history clean and your database optimized',
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-gray-700 mb-2">
                    {getString('settingsDatabaseHistoryRetentionLabel', 'History Retention')}
                  </label>
                  <select
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF3A2E]"
                    value={databaseDraft.historyRetention}
                    onChange={(event) =>
                      setDatabaseDraft((prev) => ({
                        ...prev,
                        historyRetention: event.target.value as typeof prev.historyRetention,
                      }))
                    }
                  >
                    <option value="all">
                      {getString('settingsDatabaseHistoryOption_all', 'Keep all history')}
                    </option>
                    <option value="30">
                      {getString('settingsDatabaseHistoryOption_30', 'Last 30 days')}
                    </option>
                    <option value="90">
                      {getString('settingsDatabaseHistoryOption_90', 'Last 90 days')}
                    </option>
                    <option value="180">
                      {getString('settingsDatabaseHistoryOption_180', 'Last 180 days')}
                    </option>
                    <option value="365">
                      {getString('settingsDatabaseHistoryOption_365', 'Last 365 days')}
                    </option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="optimize"
                    checked={databaseDraft.autoOptimizeWeekly}
                    onChange={(event) =>
                      setDatabaseDraft((prev) => ({
                        ...prev,
                        autoOptimizeWeekly: event.target.checked,
                      }))
                    }
                    className="w-4 h-4 text-[#FF3A2E] border-gray-300 rounded focus:ring-[#FF3A2E]"
                  />
                  <label htmlFor="optimize" className="text-gray-700">
                    {getString(
                      'settingsDatabaseAutoOptimizeLabel',
                      'Auto-optimize database tables weekly',
                    )}
                  </label>
                </div>

                <div className="pt-4">
                  <button
                    type="button"
                    onClick={handleSaveDatabase}
                    disabled={isSavingDatabase}
                    className="px-6 py-3 bg-[#FF3A2E] text-white rounded-xl hover:bg-red-600 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {getString('settingsSaveButtonLabel', 'Save Changes')}
                  </button>
                  {databaseMessage && <p className="text-sm text-gray-600 mt-2">{databaseMessage}</p>}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h2 className="text-gray-900 block-heading mb-6">
                  {getString('settingsNotificationsTitle', 'Notification Settings')}
                </h2>

                <div className="space-y-4">
                  {[
                    {
                      id: 'export-complete',
                      labelKey: 'settingsNotificationsExportCompleteLabel',
                      fallback: 'Export completed successfully',
                      key: 'exportComplete',
                    },
                    {
                      id: 'export-error',
                      labelKey: 'settingsNotificationsExportErrorLabel',
                      fallback: 'Export failed or encountered errors',
                      key: 'exportError',
                    },
                    {
                      id: 'scheduled-complete',
                      labelKey: 'settingsNotificationsScheduledCompleteLabel',
                      fallback: 'Scheduled export completed',
                      key: 'scheduledComplete',
                    },
                    {
                      id: 'scheduled-error',
                      labelKey: 'settingsNotificationsScheduledErrorLabel',
                      fallback: 'Scheduled export failed',
                      key: 'scheduledError',
                    },
                    {
                      id: 'storage-full',
                      labelKey: 'settingsNotificationsStorageFullLabel',
                      fallback: 'Storage space running low',
                      key: 'storageFull',
                    },
                  ].map((notification) => (
                    <div
                      key={notification.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                    >
                      <label htmlFor={notification.id} className="text-gray-900">
                        {getString(notification.labelKey, notification.fallback)}
                      </label>
                      <input
                        type="checkbox"
                        id={notification.id}
                        checked={Boolean(notificationsDraft[notification.key as keyof typeof notificationsDraft])}
                        onChange={(event) =>
                          setNotificationsDraft((prev) => ({
                            ...prev,
                            [notification.key]: event.target.checked,
                          }))
                        }
                        className="w-4 h-4 text-[#FF3A2E] border-gray-300 rounded focus:ring-[#FF3A2E]"
                      />
                    </div>
                  ))}

                  <div className="pt-4">
                    <button
                      type="button"
                      onClick={handleSaveNotifications}
                      disabled={isSavingNotifications}
                      className="px-6 py-3 bg-[#FF3A2E] text-white rounded-xl hover:bg-red-600 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {getString('settingsSaveButtonLabel', 'Save Changes')}
                    </button>
                    {notificationsMessage && (
                      <p className="text-sm text-gray-600 mt-2">{notificationsMessage}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl p-6">
                <div className="flex items-center justify-between gap-3 mb-6">
                  <div className="flex items-center gap-3">
                    <Info className="w-5 h-5 text-[#FF3A2E]" />
                    <h2 className="text-gray-900 block-heading">
                      {getString('settingsNotificationsAdminNoticesTitle', 'Admin notices')}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearNotices}
                    disabled={notices.length === 0}
                    className={`px-4 py-2 text-sm rounded-xl border transition-colors ${
                      notices.length === 0
                        ? 'border-gray-100 text-gray-300 cursor-not-allowed bg-gray-50'
                        : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {getString('settingsNotificationsClearNoticesButton', 'Clear notices')}
                  </button>
                </div>

                {notices.length === 0 ? (
                  <p className="text-gray-600 text-sm">
                    {getString(
                      'settingsNotificationsNoNoticesText',
                      'No notices registered for this screen.',
                    )}
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {notices.map((notice) => (
                      <li
                        key={`${notice.code}-${notice.type}`}
                        className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${mapNoticeStyle(notice.type)}`}
                      >
                        <AlertCircle className="w-4 h-4 mt-0.5" />
                        <div>
                          <p className="font-medium text-gray-900">
                            {notice.code || getString('settingsNotificationsNoticeFallback', 'Notice')}
                          </p>
                          <div className="text-gray-700" dangerouslySetInnerHTML={{ __html: notice.message }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {activeTab === 'license' && isProInstalled && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Lock className="w-5 h-5 text-[#FF3A2E]" />
                  <h2 className="text-gray-900 block-heading">
                    {getString('settingsLicenseKeyTitle', 'License Key')}
                  </h2>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  {getString('settingsLicenseKeyLabel', 'Enter your license key to unlock Pro features')}
                </p>

                <div className="space-y-4">
                  <div>
                    <input
                      type={licenseKeyVisible ? 'text' : 'password'}
                      value={licenseKeyDraft}
                      onChange={(event) => setLicenseKeyDraft(event.target.value)}
                      placeholder={getString('settingsLicenseKeyPlaceholder', 'XXXX-XXXX-XXXX-XXXX')}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF3A2E]"
                    />
                    <div className="flex items-center justify-between mt-2">
                      <button
                        type="button"
                        onClick={() => setLicenseKeyVisible((prev) => !prev)}
                        className="text-sm text-gray-600 hover:text-gray-900"
                      >
                        {licenseKeyVisible
                          ? getString('settingsLicenseHide', 'Hide')
                          : getString('settingsLicenseShow', 'Show')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsLicenseModalOpen(true)}
                        className="text-sm text-gray-600 hover:text-gray-900"
                      >
                        {getString('settingsLicenseKeyLabel', 'Enter your license key to unlock Pro features')}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 pt-2">
                    {!isLicenseActive && (
                      <button
                        type="button"
                        onClick={handleActivateLicense}
                        disabled={isActivatingLicense}
                        className="px-6 py-3 bg-[#FF3A2E] text-white rounded-xl hover:bg-red-600 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                        {isActivatingLicense
                          ? getString('settingsLicenseActivatingLabel', 'Activating…')
                          : getString('settingsLicenseActivateButton', 'Activate License')}
                      </button>
                    )}

                    {isLicenseActive && (
                      <button
                        type="button"
                        onClick={handleDeactivateLicense}
                        disabled={isDeactivatingLicense}
                        className="px-6 py-3 bg-gray-200 text-gray-900 rounded-xl hover:bg-gray-300 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                        {isDeactivatingLicense
                          ? getString('settingsLicenseDeactivatingLabel', 'Deactivating…')
                          : getString('settingsLicenseDeactivateButton', 'Deactivate License')}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleRefreshLicenseStatus}
                      disabled={isRefreshingLicense}
                      className="px-6 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {isRefreshingLicense
                        ? getString('settingsLicenseRefreshingLabel', 'Refreshing…')
                        : getString('settingsLicenseRefreshStatusButton', 'Refresh Status')}
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <div className="flex items-center justify-between gap-4 mb-6">
                  <div className="flex items-center gap-3">
                    {isLicenseActive ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-amber-600" />
                    )}
                    <h2 className="text-gray-900 block-heading">
                      {getString('settingsLicenseStatusTitle', 'License Status')}
                    </h2>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      isLicenseActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {isLicenseActive
                      ? getString('settingsLicenseProBadge', 'PRO')
                      : getString('settingsLicenseFreeBadge', 'FREE')}
                  </span>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl mb-6">
                  <p className="text-gray-900 text-body font-semibold mb-1">
                    {isLicenseActive
                      ? getString('settingsLicenseProActiveLabel', 'Pro license active')
                      : getString('settingsLicenseFreeActiveLabel', 'Free version active')}
                  </p>
                  <p className="text-gray-600 text-sm">
                    {typeof pluginInfo?.message === 'string' && pluginInfo.message
                      ? pluginInfo.message
                      : (typeof pluginInfo?.status === 'string' ? pluginInfo.status : '')}
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      {getString('settingsLicenseExpirationDateLabel', 'Expiration Date')}
                    </div>
                    <div className="text-gray-900 text-lg font-semibold">{licenseExpiryLabel}</div>
                    {licenseDaysRemaining && (
                      <div className="text-xs text-gray-500 mt-1">{licenseDaysRemaining}</div>
                    )}
                  </div>

                  <div className="border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                      <Globe className="w-4 h-4 text-gray-400" />
                      {getString('settingsLicenseDomainsUsedLabel', 'Domains Used')}
                    </div>
                    <div className="text-gray-900 text-lg font-semibold">{domainsUsedLabel}</div>
                    {domainsAvailableLabel && (
                      <div className="text-xs text-gray-500 mt-1">{domainsAvailableLabel}</div>
                    )}
                  </div>

                  <div className="border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                      <KeyRound className="w-4 h-4 text-gray-400" />
                      {getString('settingsLicenseKeyColumnLabel', 'License Key')}
                    </div>
                    <div className="text-gray-900 text-lg font-semibold break-all">{maskedLicenseKey}</div>
                  </div>
                </div>

                {manageDomainsUrl && (
                  <div className="pt-4">
                    <a
                      href={manageDomainsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center px-4 py-2 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      {getString('settingsLicenseManageDomainsButton', 'Manage Domains')}
                    </a>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <CheckSquare className="w-5 h-5 text-[#FF3A2E]" />
                  <h2 className="text-gray-900 block-heading">
                    {getString('settingsLicenseProFeaturesTitle', 'Pro Features')}
                  </h2>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {proFeatures.map((feature) => (
                    <div key={feature.title} className="flex gap-3 p-4 bg-gray-50 rounded-xl">
                      <Check className="w-4 h-4 text-green-600 mt-1" />
                      <div>
                        <p className="text-gray-900 font-semibold">{feature.title}</p>
                        <p className="text-sm text-gray-600">{feature.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <Info className="w-5 h-5 text-[#FF3A2E]" />
                  <h2 className="text-gray-900 block-heading">
                    {getString('settingsSubscriptionInfoTitle', 'Subscription Information')}
                  </h2>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">
                      {getString('settingsSubscriptionLicenseTypeLabel', 'License Type:')}
                    </span>
                    <span className="text-gray-900 font-medium">{subscriptionPlanLabel}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">
                      {getString('settingsSubscriptionActivationDateLabel', 'Activation Date:')}
                    </span>
                    <span className="text-gray-900 font-medium">{subscriptionActivationLabel}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">
                      {getString('settingsSubscriptionEmailLabel', 'Email:')}
                    </span>
                    <span className="text-gray-900 font-medium">{subscriptionEmailLabel}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">
                      {getString('settingsSubscriptionAutoRenewalLabel', 'Auto-renewal:')}
                    </span>
                    <span className="text-gray-900 font-medium">{subscriptionAutoRenewalLabel}</span>
                  </div>
                </div>

                {manageSubscriptionUrl && (
                  <div className="pt-4">
                    <a
                      href={manageSubscriptionUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center px-4 py-2 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      {getString('settingsSubscriptionManageButtonLabel', 'Manage Subscription →')}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'advanced' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h2 className="text-gray-900 block-heading mb-6">
                  {getString('settingsAdvancedTitle', 'Advanced Settings')}
                </h2>

                <div className="space-y-6">
                  <div>
                    <label className="block text-gray-700 mb-2">
                      {getString('settingsAdvancedMemoryLimitLabel', 'Memory Limit (MB)')}
                    </label>
                    <input
                      type="number"
                      value={advancedDraft.memoryLimitMb}
                      onChange={(event) =>
                        setAdvancedDraft((prev) => ({
                          ...prev,
                          memoryLimitMb: Number(event.target.value),
                        }))
                      }
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF3A2E]"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {getString(
                        'settingsAdvancedMemoryLimitHelp',
                        'Used as a soft limit during export batching (64–4096).',
                      )}
                    </p>
                  </div>

                  <div>
                    <label className="block text-gray-700 mb-2">
                      {getString(
                        'settingsAdvancedExecutionTimeoutLabel',
                        'Execution Timeout (seconds)',
                      )}
                    </label>
                    <input
                      type="number"
                      value={advancedDraft.executionTimeout}
                      onChange={(event) =>
                        setAdvancedDraft((prev) => ({
                          ...prev,
                          executionTimeout: Number(event.target.value),
                        }))
                      }
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF3A2E]"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {getString(
                        'settingsAdvancedExecutionTimeoutHelp',
                        'Exporter pauses once this soft limit is reached (60–7200).',
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="cache"
                      checked={advancedDraft.queryCaching}
                      onChange={(event) =>
                        setAdvancedDraft((prev) => ({
                          ...prev,
                          queryCaching: event.target.checked,
                        }))
                      }
                      className="w-4 h-4 text-[#FF3A2E] border-gray-300 rounded focus:ring-[#FF3A2E]"
                    />
                    <label htmlFor="cache" className="text-gray-700">
                      {getString('settingsAdvancedEnableQueryCachingLabel', 'Enable query caching')}
                    </label>
                  </div>

                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-red-900 mb-2">
                      {getString('settingsAdvancedDangerZoneTitle', 'Danger Zone')}
                    </p>
                    <button
                      type="button"
                      onClick={handleResetAdvanced}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      {getString('settingsAdvancedResetAllButton', 'Reset All Settings')}
                    </button>
                  </div>

                  <div className="pt-4">
                    <button
                      type="button"
                      onClick={handleSaveAdvanced}
                      disabled={isSavingAdvanced}
                      className="px-6 py-3 bg-[#FF3A2E] text-white rounded-xl hover:bg-red-600 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {isSavingAdvanced
                        ? getString('settingsSavingLabel', 'Saving…')
                        : getString('settingsSaveButtonLabel', 'Save Changes')}
                    </button>
                    {advancedMessage && <p className="text-sm text-gray-600 mt-2">{advancedMessage}</p>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'access' && (
            <div className="space-y-6">
              <div className="bg-white border border-gray-200 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <Shield className="w-5 h-5 text-[#FF3A2E]" />
                  <h2 className="text-gray-900 block-heading">
                    {getString('settingsAccessTitle', 'Access control')}
                  </h2>
                </div>

                <p className="text-sm text-gray-600 mb-4">
                  {getString(
                    'settingsAccessDescription',
                    'Administrators always retain full access. Use the grid below to grant or revoke access for other roles.',
                  )}
                </p>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          {getString('settingsAccessCapabilityHeader', 'Capability')}
                        </th>
                        {accessRoles.map((role) => (
                          <th
                            key={role.key}
                            className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide"
                          >
                            {role.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {capabilityEntries.map(([capKey, definition]) => (
                        <tr key={capKey} className="hover:bg-gray-50">
                          <td className="px-4 py-4 align-top">
                            <div className="text-sm text-gray-900 font-medium">{definition.label}</div>
                            {definition.description && (
                              <p className="text-xs text-gray-500 mt-1">{definition.description}</p>
                            )}
                          </td>
                          {accessRoles.map((role) => {
                            if (!role.editable) {
                              return (
                                <td key={`${capKey}-${role.key}`} className="px-4 py-4 text-center align-middle">
                                  <Lock className="w-4 h-4 text-gray-400 inline" aria-hidden />
                                </td>
                              );
                            }

                            const isEnabled = Boolean(accessDraft[role.key]?.[capKey]);

                            return (
                              <td key={`${capKey}-${role.key}`} className="px-4 py-4 text-center align-middle">
                                <button
                                  type="button"
                                  className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border transition-colors ${
                                    isEnabled
                                      ? 'border-green-200 bg-green-50 text-green-600 hover:border-green-300'
                                      : 'border-gray-200 bg-gray-50 text-gray-400 hover:border-gray-300'
                                  }`}
                                  onClick={() => handleToggleCapability(role.key, capKey)}
                                  aria-pressed={isEnabled}
                                  aria-label={`${
                                    isEnabled
                                      ? getString('settingsAccessDisablePrefix', 'Disable')
                                      : getString('settingsAccessEnablePrefix', 'Enable')
                                  } ${role.label} for ${definition.label}`}
                                >
                                  {isEnabled ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div
                  className="mt-4 access-actions-grid"
                  style={{ gridTemplateColumns: accessGridTemplate }}
                >
                  <div className="flex justify-start">
                    <button
                      type="button"
                      className="access-apply-button"
                      onClick={handleApplyAccessChanges}
                      disabled={!hasAccessChanges || isApplyingAccess}
                    >
                      {isApplyingAccess
                        ? getString('settingsAccessApplyingLabel', 'Applying…')
                        : getString('settingsAccessApplyButtonLabel', 'Apply')}
                    </button>
                  </div>
                  <div
                    className="text-sm text-gray-500 min-h-[1.25rem]"
                    style={{ gridColumn: `span ${statusSpanColumns}` }}
                  >
                    {accessMessage}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingSummary({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="settings-default-card">
      <p className="settings-default-card__label">{label}</p>
      <p className="settings-default-card__value">
        {value}
      </p>
    </div>
  );
}

function mapNoticeStyle(type: string): string {
  switch (type) {
    case 'error':
      return 'border-red-200 bg-red-50 text-red-800';
    case 'warning':
      return 'border-amber-200 bg-amber-50 text-amber-800';
    case 'success':
    case 'updated':
      return 'border-green-200 bg-green-50 text-green-800';
    default:
      return 'border-gray-200 bg-gray-50 text-gray-800';
  }
}
