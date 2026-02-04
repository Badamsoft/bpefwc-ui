import { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import {
  CalendarDays,
  Plus,
  Play,
  Pause,
  Edit,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  X,
  Lock as LockIcon,
} from 'lucide-react';
import { useAppState } from '@/context/AppStateContext';
import type { SchedulerActionDefinition, SchedulerTask, SchedulerState } from '@/types/app-state';
import { restGet } from '@/api/http';
import { clearScheduleError, deleteSchedule, runScheduleNow, toggleSchedule } from '@/api/scheduler';
import { ScheduleModal } from '@/components/modals/ScheduleModal';

const DAY_LABELS: Record<number, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
};

const RELATIVE_TIME_FORMATTER = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

type SchedulerTasksApiResponse = {
  tasks: SchedulerTask[];
};

function normalizeErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'string' && error) {
    return error;
  }
  return fallback;
}

function buildTemplateNameMap(templates: Array<{ id: string; name: string }>): Map<string, string> {
  const map = new Map<string, string>();
  templates.forEach((tpl) => {
    if (tpl?.id) {
      map.set(tpl.id, tpl.name || tpl.id);
    }
  });
  return map;
}

export function Scheduler(): ReactElement {
  const { state, setState } = useAppState();
  const schedulerState = (state.scheduler ?? null) as SchedulerState | null;
  const isProInstalled = Boolean(state.isProBuild);
  const isProActive = Boolean(state.strings?.plugin?.isPro);
  const getString = (key: string, fallback: string): string => {
    const raw = state.strings?.[key];
    return typeof raw === 'string' ? raw : fallback;
  };

  const defaultTimezone = state.timezone || schedulerState?.timezone || 'UTC';

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<SchedulerTask | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused' | 'error'>('all');

  const ensureSchedulerState = (): SchedulerState => {
    if (schedulerState) {
      return schedulerState;
    }

    return {
      tasks: [],
      config: {
        strings: {},
        alerts: {},
        actionDefinitions: {},
        actionLabels: {},
      },
      timezone: defaultTimezone,
      pendingTaskId: null,
    };
  };

  const tasks = schedulerState?.tasks ?? [];
  const templateNames = useMemo(
    () => buildTemplateNameMap(state.export.templates?.items ?? []),
    [state.export.templates?.items],
  );
  const actionDefinitions: Record<string, SchedulerActionDefinition> = schedulerState?.config?.actionDefinitions ?? {};
  const actionLabels: Record<string, string> = schedulerState?.config?.actionLabels ?? {};

  const filteredTasks = useMemo(() => {
    if (statusFilter === 'all') {
      return tasks;
    }

    return tasks.filter((task) => {
      const enabled = isTaskEnabled(task);
      if (statusFilter === 'paused') {
        return !enabled;
      }
      if (statusFilter === 'active') {
        return enabled && task.status !== 'error';
      }
      if (statusFilter === 'error') {
        return task.status === 'error';
      }
      return true;
    });
  }, [tasks, statusFilter]);

  const refreshScheduler = async (): Promise<void> => {
    if (!isProInstalled) {
      return;
    }

    if (!state.urls?.rest) {
      setErrorMessage(getString('schedulerRestBaseMissing', 'REST API base URL is not configured.'));
      return;
    }

    setIsRefreshing(true);
    setErrorMessage(null);
    try {
      const response = await restGet<SchedulerTasksApiResponse>(`${state.urls.rest}scheduler/tasks`);
      const nextScheduler = ensureSchedulerState();
      setState((prev) => ({
        ...prev,
        scheduler: {
          ...nextScheduler,
          tasks: Array.isArray(response?.tasks) ? response.tasks : [],
        },
      }));
    } catch (error) {
      setErrorMessage(normalizeErrorMessage(error, getString('schedulerLoadFailed', 'Failed to load scheduler tasks.')));
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isProInstalled) {
      return;
    }

    void refreshScheduler();
  }, [isProInstalled]);

  const handleToggle = async (taskId: number): Promise<void> => {
    if (!state.urls?.ajax || !state.nonces?.schedules) {
      setErrorMessage(getString('schedulerAjaxConfigMissing', 'AJAX configuration is missing.'));
      return;
    }

    setIsRefreshing(true);
    setErrorMessage(null);
    try {
      const response = await toggleSchedule(state.urls.ajax, state.nonces.schedules, taskId);
      if (!response.success) {
        throw new Error(response.message || getString('schedulerToggleFailed', 'Failed to toggle schedule.'));
      }
      await refreshScheduler();
    } catch (error) {
      setErrorMessage(normalizeErrorMessage(error, getString('schedulerToggleFailed', 'Failed to toggle schedule.')));
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDelete = async (taskId: number): Promise<void> => {
    if (!state.urls?.ajax || !state.nonces?.schedules) {
      setErrorMessage(getString('schedulerAjaxConfigMissing', 'AJAX configuration is missing.'));
      return;
    }

    setIsRefreshing(true);
    setErrorMessage(null);
    try {
      const response = await deleteSchedule(state.urls.ajax, state.nonces.schedules, taskId);
      if (!response.success) {
        throw new Error(response.message || getString('schedulerDeleteFailed', 'Failed to delete schedule.'));
      }
      await refreshScheduler();
    } catch (error) {
      setErrorMessage(normalizeErrorMessage(error, getString('schedulerDeleteFailed', 'Failed to delete schedule.')));
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRunNow = async (taskId: number): Promise<void> => {
    if (!state.urls?.ajax || !state.nonces?.schedules) {
      setErrorMessage(getString('schedulerAjaxConfigMissing', 'AJAX configuration is missing.'));
      return;
    }

    setIsRefreshing(true);
    setErrorMessage(null);
    try {
      const response = await runScheduleNow(state.urls.ajax, state.nonces.schedules, taskId);
      if (!response.success) {
        throw new Error(response.message || getString('schedulerRunFailed', 'Failed to run schedule.'));
      }
      await refreshScheduler();
    } catch (error) {
      setErrorMessage(normalizeErrorMessage(error, getString('schedulerRunFailed', 'Failed to run schedule.')));
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleClearError = async (taskId: number): Promise<void> => {
    if (!state.urls?.ajax || !state.nonces?.schedules) {
      setErrorMessage(getString('schedulerAjaxConfigMissing', 'AJAX configuration is missing.'));
      return;
    }

    setIsRefreshing(true);
    setErrorMessage(null);
    try {
      const response = await clearScheduleError(state.urls.ajax, state.nonces.schedules, taskId);
      if (!response.success) {
        throw new Error(response.message || getString('schedulerClearErrorFailed', 'Failed to clear error.'));
      }
      await refreshScheduler();
    } catch (error) {
      setErrorMessage(normalizeErrorMessage(error, getString('schedulerClearErrorFailed', 'Failed to clear error.')));
    } finally {
      setIsRefreshing(false);
    }
  };

  const onShowPro = (): void => {
    window.open('https://badamsoft.com/plugins/badamsoft-product-export-for-woocommerce.php', '_blank', 'noopener,noreferrer');
  };

  if (!isProInstalled || !isProActive) {
    return (
      <div className="p-8">
        <LockedOverlay onShowPro={onShowPro} />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between gap-6">
        <div>
          <h1 className="text-gray-900 page-heading mb-2">
            {getString('schedulerTitle', 'Automations')}
          </h1>
          <p className="text-gray-600 page-subheading">
            {getString('schedulerSubtitle', 'Manage scheduled exports and post-export actions')}
          </p>
        </div>

        <button
          type="button"
          className="px-6 py-3 bg-[#FF3A2E] text-white rounded-xl hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20 flex items-center gap-2"
          onClick={() => {
            setEditingTask(null);
            setIsModalOpen(true);
          }}
          disabled={isRefreshing}
        >
          <Plus className="w-5 h-5" />
          {getString('schedulerCreateButton', 'Create automation')}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <FilterButton
          label={getString('schedulerFilterAll', 'All')}
          active={statusFilter === 'all'}
          onClick={() => setStatusFilter('all')}
          disabled={isRefreshing}
        />
        <FilterButton
          label={getString('schedulerFilterActive', 'Active')}
          active={statusFilter === 'active'}
          onClick={() => setStatusFilter('active')}
          disabled={isRefreshing}
        />
        <FilterButton
          label={getString('schedulerFilterPaused', 'Paused')}
          active={statusFilter === 'paused'}
          onClick={() => setStatusFilter('paused')}
          disabled={isRefreshing}
        />
        <FilterButton
          label={getString('schedulerFilterErrors', 'Errors')}
          active={statusFilter === 'error'}
          onClick={() => setStatusFilter('error')}
          disabled={isRefreshing}
        />
      </div>

      <div className="flex items-center justify-between mb-4">
        {errorMessage ? (
          <p className="text-sm text-red-600">{errorMessage}</p>
        ) : (
          <span className="text-sm text-gray-500">
            {isRefreshing
              ? getString('schedulerStatusRefreshing', 'Refreshing tasks…')
              : getString('schedulerStatusRestSync', 'Data is kept in sync via REST.')}
          </span>
        )}
        <button
          className="px-4 py-2 rounded-xl text-sm bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
          onClick={() => refreshScheduler()}
          disabled={isRefreshing}
        >
          {isRefreshing
            ? getString('schedulerButtonRefreshing', 'Refreshing…')
            : getString('schedulerButtonRefresh', 'Refresh')}
        </button>
      </div>

      <div>
        {isRefreshing ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
            <p className="text-gray-900 text-body font-medium mb-2">
              {getString('schedulerLoadingTitle', 'Refreshing scheduler tasks…')}
            </p>
            <p className="text-gray-500 text-label">
              {getString('schedulerLoadingDescription', 'Please wait while we sync data.')}
            </p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-12 text-center">
            <p className="text-gray-900 text-body font-medium mb-2">
              {tasks.length === 0
                ? getString('schedulerEmptyNoTasksTitle', 'No scheduled exports yet.')
                : getString('schedulerEmptyNoFilterTitle', 'No tasks match the selected filter.')}
            </p>
            <p className="text-gray-500 text-label">
              {getString(
                'schedulerEmptyCreateAutomationHint',
                'Use the button above to create a new automation.',
              )}
            </p>
          </div>
        ) : (
          <div className="scheduled-tiles-row">
            {filteredTasks.map((task) => {
              const enabled = isTaskEnabled(task);
              const templateName = templateNames.get(task.template_id) ?? task.template_id;
              const scheduleSummary = formatSchedule(task, defaultTimezone);
              const timezone = task.schedule_timezone || defaultTimezone;
              const nextRun = formatDateTime(task.next_run_at, timezone);
              const nextRunRelative = formatRelative(task.next_run_at, timezone);
              const lastRun = formatDateTime(task.last_run_at, timezone);
              const lastRunRelative = formatRelative(task.last_run_at, timezone);
              const badge = getStatusBadge(task.status, enabled, getString);
              const taskActions = formatTaskActions(task.actions, actionLabels);
              const actionsSummary = taskActions.length === 0
                ? getString('schedulerNoActionsConfigured', 'No actions configured')
                : taskActions.length <= 2
                  ? taskActions.join(', ')
                  : `${taskActions.slice(0, 2).join(', ')}, +${taskActions.length - 2} ${getString('schedulerActionsMoreSuffix', 'more')}`;
              const incremental = isIncrementalSchedule(task);
              const lastActionLog = task.last_action_log && typeof task.last_action_log === 'object'
                ? (task.last_action_log as Record<string, unknown>)
                : null;
              const lastActionMessage = normalizeLastActionMessage(lastActionLog);

              return (
                <div
                  key={task.id}
                  className="scheduled-tile bg-white rounded-2xl border border-gray-200 p-6 transition-all hover:border-[#FF3A2E] hover:shadow-lg flex flex-col group h-full"
                >
                  <div className="flex items-start justify-between gap-4 mb-5">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl bg-red-50 text-[#FF3A2E] flex items-center justify-center transition-colors group-hover:bg-[#FF3A2E] group-hover:text-white">
                        <CalendarDays className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-gray-900 block-heading">
                          {task.name || `Task #${task.id}`}
                        </h3>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className={`px-3 py-1 rounded-lg text-xs flex items-center gap-1 ${badge.className}`}>
                            <badge.Icon className="w-3 h-3" />
                            {badge.label}
                          </span>
                          {incremental && (
                            <span className="px-3 py-1 rounded-lg text-xs bg-blue-100 text-blue-700">
                              {getString('schedulerIncrementalBadge', 'Incremental')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 text-sm text-gray-600 flex-1">
                    <p className="text-sm text-gray-500 leading-relaxed line-clamp-2">{scheduleSummary}</p>
                    <div className="space-y-2">
                      <InfoRow
                        label={getString('schedulerInfoTemplateLabel', 'Template')}
                        value={templateName}
                      />
                      <InfoRow
                        label={getString('schedulerInfoNextRunLabel', 'Next run')}
                        value={nextRun ?? getString('schedulerInfoNextRunNotScheduled', 'Not scheduled')}
                        hint={nextRunRelative ?? '—'}
                      />
                      <InfoRow
                        label={getString('schedulerInfoLastRunLabel', 'Last run')}
                        value={lastRun ?? getString('schedulerInfoLastRunNoRunsYet', 'No runs yet')}
                        hint={lastRunRelative ?? '—'}
                      />
                      <InfoRow
                        label={getString('schedulerInfoActionsLabel', 'Actions')}
                        value={actionsSummary}
                        hint={taskActions.length > 2 ? taskActions.slice(2).join(', ') : undefined}
                      />
                    </div>

                    {lastActionMessage && (
                      <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-3 text-sm text-red-700">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <XCircle className="w-4 h-4" />
                            <span>{lastActionMessage}</span>
                          </div>
                          <button
                            type="button"
                            className="ml-2 text-red-400 hover:text-red-600 disabled:opacity-50"
                            onClick={() => handleClearError(task.id)}
                            aria-label={getString('schedulerDismissErrorAriaLabel', 'Dismiss error')}
                            disabled={isRefreshing}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-auto pt-4 flex items-center gap-2">
                    <ActionButton
                      label={getString('schedulerActionRunNow', 'Run now')}
                      icon={Play}
                      onClick={() => handleRunNow(task.id)}
                      disabled={isRefreshing}
                    />
                    <ActionButton
                      label={enabled
                        ? getString('schedulerActionPause', 'Pause')
                        : getString('schedulerActionResume', 'Resume')}
                      icon={enabled ? Pause : Play}
                      onClick={() => handleToggle(task.id)}
                      disabled={isRefreshing}
                    />
                    <ActionButton
                      label={getString('schedulerActionEdit', 'Edit')}
                      icon={Edit}
                      onClick={() => {
                        setEditingTask(task);
                        setIsModalOpen(true);
                      }}
                    />
                    <ActionButton
                      label={getString('schedulerActionDelete', 'Delete')}
                      icon={Trash2}
                      destructive
                      onClick={() => handleDelete(task.id)}
                      disabled={isRefreshing}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <section className="mt-8">
        <h2 className="text-gray-900 block-heading mb-4">
          {getString('schedulerActionsSectionTitle', 'Available Post-Export Actions')}
        </h2>

        <div className="scheduled-actions-grid">
          {Object.entries(actionDefinitions).map(([key, definition]) => (
            <div key={key} className="scheduled-action-card">
              <p className="scheduled-action-card__title">{actionLabels[key] ?? key}</p>
              <p className="scheduled-action-card__meta">
                {definition.fields.length}{' '}
                {getString('schedulerActionsSectionMetaSuffix', 'configurable fields')}
              </p>
            </div>
          ))}
        </div>
      </section>

      {isModalOpen && (
        <ScheduleModal
          templates={state.export.templates?.items ?? []}
          config={ensureSchedulerState().config}
          ajaxUrl={state.urls?.ajax ?? ''}
          nonce={state.nonces?.schedules ?? ''}
          onClose={() => setIsModalOpen(false)}
          onSave={async () => {
            await refreshScheduler();
          }}
          task={editingTask}
          defaultTimezone={defaultTimezone}
        />
      )}
    </div>
  );
}

function LockedOverlay({ onShowPro }: { onShowPro: () => void }): ReactElement {
  const { state } = useAppState();
  const getString = (key: string, fallback: string): string => {
    const raw = state.strings?.[key];
    return typeof raw === 'string' ? raw : fallback;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center shadow-sm">
      <div className="w-16 h-16 bg-[#FF3A2E] rounded-2xl flex items-center justify-center mx-auto mb-4">
        <LockIcon className="w-8 h-8 text-white" />
      </div>
      <h2 className="text-gray-900 block-heading mb-2">
        {getString('schedulerLockedTitle', 'Automation & Scheduling (PRO)')}
      </h2>
      <p className="text-gray-600 text-label mb-4">
        {getString(
          'schedulerLockedDescription',
          'Unlock automated export schedules, incremental runs, and delivery workflows.',
        )}
      </p>
      <button
        onClick={onShowPro}
        className="px-6 py-3 bg-[#FF3A2E] text-white rounded-xl hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
      >
        {getString('menuUnlockCta', 'Upgrade to PRO')}
      </button>
    </div>
  );
}

function FilterButton({ label, active, onClick, disabled }: { label: string; active: boolean; onClick: () => void; disabled?: boolean }): ReactElement {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-xl transition-colors text-sm text-label ${
        active ? 'bg-[#FF3A2E] text-white shadow-sm' : 'text-gray-700 bg-white border border-gray-200 hover:bg-gray-50'
      }`}
      disabled={disabled}
    >
      {label}
    </button>
  );
}

function ActionButton({
  label,
  icon: Icon,
  onClick,
  destructive = false,
  disabled = false,
}: {
  label: string;
  icon: typeof Play;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
}): ReactElement {
  return (
    <button
      className={`p-2 rounded-xl transition-colors border border-gray-200 hover:border-gray-300 ${
        destructive ? 'hover:bg-red-50' : 'hover:bg-gray-50'
      }`}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon className={`w-5 h-5 ${destructive ? 'text-[#FF3A2E]' : 'text-gray-600'}`} />
    </button>
  );
}

function InfoRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}): ReactElement {
  return (
    <div className="flex items-start justify-between gap-3" style={{ fontSize: '0.875rem' }}>
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 text-right leading-tight">
        {value || '—'}
        {hint && (
          <span className="block text-xs text-gray-400 mt-0.5">
            {hint}
          </span>
        )}
      </span>
    </div>
  );
}

function InfoTile({ title, value, hint }: { title: string; value: string; hint?: string }): ReactElement {
  return (
    <div>
      <p className="text-gray-500 mb-1" style={{ fontSize: '0.75rem' }}>
        {title}
      </p>
      <p className="text-gray-900" style={{ fontSize: '0.875rem' }}>
        {value || '—'}
      </p>
      {hint && (
        <p className="text-gray-400" style={{ fontSize: '0.75rem' }}>
          {hint}
        </p>
      )}
    </div>
  );
}

function isTaskEnabled(task: SchedulerTask): boolean {
  if (typeof task.enabled === 'boolean') {
    return task.enabled;
  }

  if (typeof task.enabled === 'number') {
    return task.enabled === 1;
  }

  return Boolean(task.enabled);
}

function isIncrementalSchedule(task: SchedulerTask): boolean {
  if (typeof task.incremental_mode === 'string' && task.incremental_mode !== '' && task.incremental_mode !== 'disabled') {
    return true;
  }

  const value = task.incremental;

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    if (['0', 'false', 'no', 'off', ''].includes(normalized)) {
      return false;
    }
  }

  return false;
}

function formatSchedule(task: SchedulerTask, fallbackTimezone = 'UTC'): string {
  const type = task.schedule_type ?? 'cron';
  const payload = (task.schedule_payload ?? {}) as Record<string, unknown>;
  const timezone = task.schedule_timezone || fallbackTimezone;

  switch (type) {
    case 'none':
      return 'Manual trigger';
    case 'interval': {
      const intervalLabel = resolveIntervalLabel(task, payload);
      return intervalLabel ? `${intervalLabel}` : 'Custom interval';
    }
    case 'daily': {
      const time = typeof payload.time === 'string' ? payload.time : '00:00';
      return `Daily at ${time} (${timezone})`;
    }
    case 'weekly': {
      const days = Array.isArray(payload.days)
        ? (payload.days as unknown[]).map((day) => DAY_LABELS[Number(day)] ?? '').filter(Boolean)
        : [];
      const times = extractTimes(payload);
      return `Weekly on ${days.join(', ') || '—'} at ${times || '—'} (${timezone})`;
    }
    case 'monthly': {
      const days = Array.isArray(payload.days) ? (payload.days as unknown[]).map(String).join(', ') : '—';
      const times = extractTimes(payload);
      return `Monthly on day(s) ${days} at ${times || '—'} (${timezone})`;
    }
    case 'cron':
    default:
      return task.schedule_cron ? `Cron: ${task.schedule_cron}` : 'Cron schedule';
  }
}

function resolveIntervalLabel(task: SchedulerTask, payload: Record<string, unknown>): string | null {
  if (typeof payload.value === 'number' && typeof payload.unit === 'string') {
    const value = payload.value;
    const unit = payload.unit;
    const label = value === 1 ? unit.slice(0, -1) : unit;
    return `Every ${value} ${label}`;
  }

  if (typeof payload.interval_seconds === 'number') {
    return humanizeDuration(payload.interval_seconds);
  }

  if (typeof task.schedule_interval === 'number' || typeof task.schedule_interval === 'string') {
    const seconds = typeof task.schedule_interval === 'number' ? task.schedule_interval : parseInt(task.schedule_interval, 10);
    return humanizeDuration(seconds);
  }

  return null;
}

function humanizeDuration(seconds?: number | null): string | null {
  if (!seconds || Number.isNaN(seconds) || seconds <= 0) {
    return null;
  }

  if (seconds % 86400 === 0) {
    const days = Math.round(seconds / 86400);
    return `Every ${days} day${days === 1 ? '' : 's'}`;
  }

  if (seconds % 3600 === 0) {
    const hours = Math.round(seconds / 3600);
    return `Every ${hours} hour${hours === 1 ? '' : 's'}`;
  }

  if (seconds % 60 === 0) {
    const minutes = Math.round(seconds / 60);
    return `Every ${minutes} minute${minutes === 1 ? '' : 's'}`;
  }

  return `Every ${seconds} seconds`;
}

function extractTimes(payload: Record<string, unknown>): string {
  if (Array.isArray(payload.times) && payload.times.length > 0) {
    return (payload.times as unknown[]).map(String).join(', ');
  }

  if (typeof payload.time === 'string') {
    return payload.time;
  }

  return '';
}

function formatTaskActions(actions: unknown, labels: Record<string, string>): string[] {
  if (!Array.isArray(actions)) {
    return [];
  }

  return actions
    .map((action, index) => {
      if (action && typeof action === 'object') {
        const type = (action as { type?: string }).type;

        if (type && labels[type]) {
          return labels[type];
        }

        if (type) {
          return type;
        }
      }

      if (typeof action === 'string') {
        return action;
      }

      return `Action ${index + 1}`;
    })
    .filter(Boolean);
}

function getStatusBadge(
  status: string,
  enabled: boolean,
  getString: (key: string, fallback: string) => string,
): { label: string; className: string; Icon: typeof Play } {
  switch (status) {
    case 'running':
      return {
        label: getString('schedulerStatus_running', 'Running'),
        className: 'bg-blue-100 text-blue-700',
        Icon: Play,
      };
    case 'queued':
      return {
        label: getString('schedulerStatus_queued', 'Queued'),
        className: 'bg-amber-100 text-amber-700',
        Icon: Clock,
      };
    case 'error':
      return {
        label: getString('schedulerStatus_error', 'Error'),
        className: 'bg-red-100 text-red-700',
        Icon: XCircle,
      };
    case 'idle':
      return enabled
        ? {
            label: getString('schedulerStatus_idle', 'Idle'),
            className: 'bg-green-100 text-green-700',
            Icon: CheckCircle,
          }
        : {
            label: getString('schedulerStatus_paused', 'Paused'),
            className: 'bg-gray-100 text-gray-600',
            Icon: Pause,
          };
    default:
      return enabled
        ? {
            label: status || getString('schedulerStatus_active', 'Active'),
            className: 'bg-green-100 text-green-700',
            Icon: CheckCircle,
          }
        : {
            label: getString('schedulerStatus_paused', 'Paused'),
            className: 'bg-gray-100 text-gray-600',
            Icon: Pause,
          };
  }
}

function formatDateTime(value?: string | null, timeZone?: string): string {
  const date = parseDate(value, timeZone);

  if (!date) {
    return value ?? '—';
  }

  const formatter = new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timeZone || undefined,
  });

  const formatted = formatter.format(date);

  return timeZone ? `${formatted} (${timeZone})` : formatted;
}

function formatRelative(value?: string | null, timeZone?: string): string {
  const date = parseDate(value, timeZone);

  if (!date) {
    return '';
  }

  const diffMs = date.getTime() - Date.now();
  const diffMinutes = diffMs / 60000;

  if (Math.abs(diffMinutes) < 60) {
    return RELATIVE_TIME_FORMATTER.format(Math.round(diffMinutes), 'minute');
  }

  const diffHours = diffMinutes / 60;

  if (Math.abs(diffHours) < 48) {
    return RELATIVE_TIME_FORMATTER.format(Math.round(diffHours), 'hour');
  }

  const diffDays = diffHours / 24;
  return RELATIVE_TIME_FORMATTER.format(Math.round(diffDays), 'day');
}

function normalizeLastActionMessage(log: Record<string, unknown> | null): string {
  if (!log) {
    return '';
  }

  const message = log.message ?? log.error ?? log.notice;

  if (typeof message === 'string') {
    return message;
  }

  if (Array.isArray(message)) {
    return message.map((item) => (typeof item === 'string' ? item : '')).filter(Boolean).join(' ');
  }

  if (message && typeof message === 'object') {
    return Object.values(message)
      .map((value) => (typeof value === 'string' ? value : ''))
      .filter(Boolean)
      .join(' ');
  }

  if (typeof log.status === 'string') {
    return log.status;
  }

  return '';
}

function parseDate(value?: string | null, timeZone?: string): Date | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  const hasTimezone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed);
  const normalized = trimmed.replace(' ', 'T');

  if (hasTimezone) {
    const candidate = new Date(normalized);
    return Number.isNaN(candidate.getTime()) ? null : candidate;
  }

  const isoValue = normalized.endsWith('Z') ? normalized : `${normalized}Z`;
  const candidate = new Date(isoValue);

  if (Number.isNaN(candidate.getTime())) {
    return null;
  }

  return candidate;
}

function getTimeZoneOffsetMinutes(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number
): number {
  try {
    const targetUtc = Date.UTC(year, month - 1, day, hour, minute, second);
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const parts = formatter.formatToParts(new Date(targetUtc));
    const lookUp = (type: Intl.DateTimeFormatPartTypes): string => {
      const part = parts.find((entry) => entry.type === type);
      return part ? part.value : '00';
    };

    const tzUtc = Date.UTC(
      Number(lookUp('year')),
      Number(lookUp('month')) - 1,
      Number(lookUp('day')),
      Number(lookUp('hour')),
      Number(lookUp('minute')),
      Number(lookUp('second'))
    );

    return (tzUtc - targetUtc) / 60000;
  } catch (error) {
    console.error('Failed to resolve timezone offset', { error, timeZone });
    return new Date().getTimezoneOffset() * -1;
  }
}

