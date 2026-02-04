import { useState, useEffect } from 'react';
import { X, Save as SaveIcon, Plus, Trash2, Settings } from 'lucide-react';
import { createOrUpdateSchedule } from '@/api/scheduler';
import type { SchedulerTask, SchedulerConfig } from '@/types/app-state';
import type { ExportTemplateItem } from '@/types/app-state';

interface ScheduleModalProps {
  templates: ExportTemplateItem[];
  config: SchedulerConfig;
  ajaxUrl: string;
  nonce: string;
  onClose: () => void;
  onSave: () => void;
  task?: SchedulerTask | null; // If provided, we are in edit mode
  defaultTimezone?: string;
}

const toBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (['1', 'true', 'yes'].includes(normalized)) {
      return true;
    }

    if (['0', 'false', 'no', ''].includes(normalized)) {
      return false;
    }
  }

  return false;
};

interface ScheduleState {
  name: string;
  templateId: string;
  enabled: boolean;
  scheduleType: 'weekly' | 'monthly' | 'interval' | 'cron' | 'none';
  scheduleCron: string;
  scheduleInterval: number;
  scheduleTimezone: string;
  schedulePayload: Record<string, unknown>;
  incremental: boolean;
  incrementalField: string;
  actions: unknown[];
}

const TIMEZONE_OPTIONS = new Intl.DisplayNames(['en'], { type: 'region' })
  ? Intl.supportedValuesOf?.('timeZone') ?? []
  : [];
const SHARED_INPUT_STYLE = { width: '6rem' } satisfies React.CSSProperties;

const DEFAULT_STATE: ScheduleState = {
  name: '',
  templateId: '',
  enabled: true,
  scheduleType: 'weekly',
  scheduleCron: '',
  scheduleInterval: 3600,
  scheduleTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  schedulePayload: { days: [1], times: ['09:00'], mode: 'shared' },
  incremental: false,
  incrementalField: 'post_modified',
  actions: [],
};

const WEEKDAY_KEYS: Array<{ key: string; fallback: string }> = [
  { key: 'weekdayShortSun', fallback: 'Sun' },
  { key: 'weekdayShortMon', fallback: 'Mon' },
  { key: 'weekdayShortTue', fallback: 'Tue' },
  { key: 'weekdayShortWed', fallback: 'Wed' },
  { key: 'weekdayShortThu', fallback: 'Thu' },
  { key: 'weekdayShortFri', fallback: 'Fri' },
  { key: 'weekdayShortSat', fallback: 'Sat' },
];

export function ScheduleModal({ templates, config, ajaxUrl, nonce, onClose, onSave, task, defaultTimezone }: ScheduleModalProps) {
  const [state, setState] = useState<ScheduleState>(() => ({
    ...DEFAULT_STATE,
    scheduleTimezone: defaultTimezone || DEFAULT_STATE.scheduleTimezone,
  }));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Action editor state
  const [isEditingAction, setIsEditingAction] = useState(false);
  const [editingActionIndex, setEditingActionIndex] = useState<number | null>(null);
  const [actionDraft, setActionDraft] = useState<any>(null);

  const strings = config?.strings ?? {};
  const alerts = config?.alerts ?? {};

  const getConfigString = (key: string, fallback: string): string => {
    const raw = strings[key];
    return typeof raw === 'string' ? raw : fallback;
  };

  const getConfigAlert = (key: string, fallback: string): string => {
    const raw = alerts[key];
    return typeof raw === 'string' ? raw : fallback;
  };

  const getFrequencyLabel = (value: 'weekly' | 'monthly' | 'manual'): string => {
    switch (value) {
      case 'weekly':
        return getConfigString('frequencyWeeklyLabel', 'Weekly');
      case 'monthly':
        return getConfigString('frequencyMonthlyLabel', 'Monthly');
      case 'manual':
      default:
        return getConfigString('frequencyManualLabel', 'Manual (cron expression)');
    }
  };

  // Initialize state from task if editing
  const handleFrequencyChange = (value: ScheduleState['scheduleType']) => {
    setState((prev) => {
      const nextPayload = { ...prev.schedulePayload };

      if (value === 'weekly') {
        nextPayload.days = Array.isArray(prev.schedulePayload.days)
          ? prev.schedulePayload.days.map((day) => Number(day))
          : [1];
        nextPayload.times = Array.isArray(prev.schedulePayload.times)
          ? prev.schedulePayload.times
          : ['09:00'];
        nextPayload.mode = prev.schedulePayload.mode ?? 'shared';
      }

      if (value === 'monthly') {
        const currentDays = Array.isArray(prev.schedulePayload.days) ? prev.schedulePayload.days : [];
        nextPayload.days = currentDays.length ? currentDays.map((day) => Number(day)) : [1];
        const currentTimes = Array.isArray(prev.schedulePayload.times) ? prev.schedulePayload.times : [];
        nextPayload.times = currentTimes.length ? currentTimes : ['09:00'];
        delete nextPayload.mode;
        delete nextPayload.times_by_day;
      }

      if (value === 'none') {
        delete nextPayload.days;
        delete nextPayload.times;
        delete nextPayload.mode;
        delete nextPayload.times_by_day;
      }

      return {
        ...prev,
        scheduleType: value,
        schedulePayload: nextPayload,
      };
    });
  };

  useEffect(() => {
    if (!task) {
      setState({
        ...DEFAULT_STATE,
        scheduleTimezone: defaultTimezone || DEFAULT_STATE.scheduleTimezone,
      });

      return;
    }

    const basePayload = task.schedule_payload && typeof task.schedule_payload === 'object'
      ? task.schedule_payload
      : {};

    setState({
      name: task.name,
      templateId: task.template_id,
      enabled: toBoolean(task.enabled),
      scheduleType: (task.schedule_type as any) || 'weekly',
      scheduleCron: task.schedule_cron || '',
      scheduleInterval: typeof task.schedule_interval === 'number' ? task.schedule_interval : 0,
      scheduleTimezone: task.schedule_timezone || defaultTimezone || DEFAULT_STATE.scheduleTimezone,
      schedulePayload: {
        ...basePayload,
        days: Array.isArray(basePayload.days)
          ? basePayload.days.map((day) => Number(day))
          : (task.schedule_type === 'monthly' ? [1] : [1]),
        times: Array.isArray(basePayload.times) && basePayload.times.length
          ? basePayload.times
          : ['09:00'],
      },
      incremental: toBoolean(task.incremental) || task.incremental_mode === 'auto',
      incrementalField: task.incremental_field || 'post_modified',
      actions: Array.isArray(task.actions) ? task.actions : [],
    });
  }, [task, defaultTimezone]);

  useEffect(() => {
    if (task) {
      const basePayload = task.schedule_payload && typeof task.schedule_payload === 'object'
        ? task.schedule_payload
        : {};

      setState({
        name: task.name,
        templateId: task.template_id,
        enabled: toBoolean(task.enabled),
        scheduleType: (task.schedule_type as any) || 'weekly',
        scheduleCron: task.schedule_cron || '',
        scheduleInterval: typeof task.schedule_interval === 'number' ? task.schedule_interval : 0,
        scheduleTimezone: task.schedule_timezone || defaultTimezone || DEFAULT_STATE.scheduleTimezone,
        schedulePayload: {
          ...basePayload,
          days: Array.isArray(basePayload.days)
            ? basePayload.days.map((day) => Number(day))
            : (task.schedule_type === 'monthly' ? [1] : [1]),
          times: Array.isArray(basePayload.times) && basePayload.times.length
            ? basePayload.times
            : ['09:00'],
        },
        incremental: toBoolean(task.incremental) || task.incremental_mode === 'auto',
        incrementalField: task.incremental_field || 'post_modified',
        actions: Array.isArray(task.actions) ? task.actions : [],
      });
    }
  }, [task, defaultTimezone]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!state.name || !state.templateId) {
      setError(getConfigAlert('nameTemplateRequired', 'Name and Template are required.'));
      return;
    }

    if (state.scheduleType === 'cron' && !state.scheduleCron) {
      setError(getConfigAlert('invalidCron', 'Provide a cron expression.'));
      return;
    }

    if (state.scheduleType === 'monthly') {
      const days = Array.isArray(state.schedulePayload.days) ? state.schedulePayload.days : [];
      const times = Array.isArray(state.schedulePayload.times) ? state.schedulePayload.times : [];

      if (!days.length || !times.length) {
        setError(
          getConfigAlert(
            'monthlyDayAndTimeRequired',
            'Select at least one day and time for the monthly schedule.',
          ),
        );
        return;
      }
    }

    setIsSaving(true);

    try {
      const payload: any = {
        task_name: state.name,
        task_template: state.templateId,
        task_enabled: state.enabled ? 1 : 0,
        task_schedule_type: state.scheduleType,
        task_timezone: state.scheduleTimezone,
        task_incremental: state.incremental ? 1 : 0,
        task_incremental_field: state.incrementalField,
        task_actions_payload: JSON.stringify(state.actions),
      };

      if (task) {
        payload.task_id = task.id;
      }

      // Schedule specific payload
      if (state.scheduleType === 'cron') {
        payload.task_cron_expression = state.scheduleCron;
      } else if (state.scheduleType === 'interval') {
        // Assuming interval logic handled via payload or separate field, mapping to existing API expectation
        // The legacy code puts interval in payload sometimes or separate. Let's follow the API.
        // Looking at AdminPage.php handle_schedule_create:
        // interval comes from task_schedule_interval logic inside specific type blocks or directly.
        // We will send the payload JSON which contains details.
        payload.task_schedule_payload = JSON.stringify({
            interval_seconds: state.scheduleInterval
        });
      } else {
        // weekly, monthly
        payload.task_schedule_payload = JSON.stringify(state.schedulePayload);
      }

      const response = await createOrUpdateSchedule(ajaxUrl, nonce, payload);

      if (response.success) {
        onSave();
        onClose();
      } else {
        setError(response.message || getConfigAlert('saveFailed', 'Failed to save schedule.'));
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : getConfigAlert('genericError', 'An error occurred.'),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const toggleWeekday = (dayIndex: number) => {
    const currentDays = (state.schedulePayload.days as number[]) || [];
    const newDays = currentDays.includes(dayIndex)
      ? currentDays.filter(d => d !== dayIndex)
      : [...currentDays, dayIndex].sort();
    
    setState(prev => ({
      ...prev,
      schedulePayload: { ...prev.schedulePayload, days: newDays }
    }));
  };

  const addTime = () => {
    const currentTimes = (state.schedulePayload.times as string[]) || [];
    setState(prev => ({
      ...prev,
      schedulePayload: { ...prev.schedulePayload, times: [...currentTimes, '09:00'] }
    }));
  };

  const updateTime = (index: number, value: string) => {
    const currentTimes = [...((state.schedulePayload.times as string[]) || [])];
    currentTimes[index] = value;
    setState(prev => ({
      ...prev,
      schedulePayload: { ...prev.schedulePayload, times: currentTimes }
    }));
  };

  const removeTime = (index: number) => {
    const currentTimes = (state.schedulePayload.times as string[]) || [];
    setState(prev => ({
      ...prev,
      schedulePayload: { ...prev.schedulePayload, times: currentTimes.filter((_, i) => i !== index) }
    }));
  };

  // Action management
  const handleAddAction = () => {
    setIsEditingAction(true);
    setEditingActionIndex(null);
    setActionDraft({ type: 'email', config: {} });
  };

  const handleEditAction = (index: number) => {
    setIsEditingAction(true);
    setEditingActionIndex(index);
    setActionDraft(JSON.parse(JSON.stringify(state.actions[index])));
  };

  const handleSaveAction = () => {
    if (!actionDraft) return;
    
    const newActions = [...state.actions];
    if (editingActionIndex !== null) {
      newActions[editingActionIndex] = actionDraft;
    } else {
      newActions.push(actionDraft);
    }
    
    setState(prev => ({ ...prev, actions: newActions }));
    setIsEditingAction(false);
    setActionDraft(null);
  };

  const handleDeleteAction = (index: number) => {
    setState(prev => ({
      ...prev,
      actions: prev.actions.filter((_, i) => i !== index)
    }));
  };

  const renderActionEditor = () => {
    if (!actionDraft) return null;
    
    const def = config.actionDefinitions[actionDraft.type];
    const hasErrors = def?.fields?.some((field) => field.required && !actionDraft.config?.[field.name]);
    
    return (
      <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-[60] p-6">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[80vh] flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              {getConfigString('actionEditorTitle', 'Configure action')}
            </h3>
            <button onClick={() => setIsEditingAction(false)} className="p-2 rounded-lg hover:bg-gray-100">
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">
                  {getConfigString('actionTypeLabel', 'Action type')}
                </label>
                <select 
                  className="w-full p-2 border rounded-lg"
                  value={actionDraft.type}
                  onChange={e => setActionDraft({...actionDraft, type: e.target.value, config: {}})}
                >
                  {Object.keys(config.actionDefinitions).map(key => (
                    <option key={key} value={key}>{config.actionLabels[key] || key}</option>
                  ))}
                </select>
              </div>

              {def && def.fields.map(field => (
                <div key={field.name} className="w-full">
                  <label className="block text-sm font-medium mb-1">{field.label}</label>
                  {field.type === 'select' ? (
                    <select
                      className="w-full p-2 border rounded-lg"
                      value={actionDraft.config[field.name] || ''}
                      onChange={e => setActionDraft({
                        ...actionDraft, 
                        config: { ...actionDraft.config, [field.name]: e.target.value }
                      })}
                    >
                      {field.options?.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : field.type === 'textarea' || field.type === 'json' ? (
                    <textarea
                      className="w-full p-2 border rounded-lg"
                      rows={field.rows || 3}
                      value={actionDraft.config[field.name] || ''}
                      onChange={e => setActionDraft({
                        ...actionDraft, 
                        config: { ...actionDraft.config, [field.name]: e.target.value }
                      })}
                    />
                  ) : (
                    <input
                      type={field.type === 'number' ? 'number' : 'text'}
                      className="w-full p-2 border rounded-lg"
                      value={actionDraft.config[field.name] || ''}
                      onChange={e => setActionDraft({
                        ...actionDraft, 
                        config: { ...actionDraft.config, [field.name]: e.target.value }
                      })}
                    />
                  )}
                  {field.description && <p className="text-xs text-gray-500 mt-1">{field.description}</p>}
                  {field.required && !actionDraft.config?.[field.name] && (
                    <p className="text-xs text-red-500 mt-1">
                      {getConfigAlert('fieldRequired', 'This field is required.')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
            <button 
              type="button"
              onClick={() => setIsEditingAction(false)}
              className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg"
            >
              {getConfigString('cancelAction', 'Cancel')}
            </button>
            <button 
              type="button"
              onClick={() => {
                if (hasErrors) {
                  setError(
                    getConfigAlert(
                      'actionFieldsRequired',
                      'Please fill all required fields for the action.',
                    ),
                  );
                  return;
                }

                handleSaveAction();
                setError(null);
              }}
              className={`px-6 py-2 rounded-xl font-medium transition-colors shadow-md ${hasErrors
                ? 'bg-gray-200 text-gray-400 shadow-none cursor-not-allowed'
                : 'bg-[#FF3A2E] text-white hover:bg-red-600'}`}
              disabled={hasErrors}
            >
              {getConfigString('saveActionButtonLabel', 'Save action')}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-8">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            {task
              ? getConfigString('modalTitleEditSchedule', 'Edit Schedule')
              : getConfigString('modalTitleCreateSchedule', 'Create Schedule')}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
              {error && (
                <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200">
                  {error}
                </div>
              )}

          <form id="schedule-form" onSubmit={handleSave} className="space-y-6" noValidate>
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {getConfigString('fieldScheduleNameLabel', 'Schedule name')}
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FF3A2E] outline-none"
                  value={state.name}
                  onChange={e => setState({...state, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {getConfigString('fieldExportTemplateLabel', 'Export Template')}
                </label>
                <select
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FF3A2E] outline-none"
                  value={state.templateId}
                  onChange={e => setState({...state, templateId: e.target.value})}
                >
                  <option value="">
                    {getConfigString('fieldExportTemplatePlaceholder', 'Select a template...')}
                  </option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Schedule Type */}
            <div className="pt-6">
              <label className="block text-sm font-medium text-gray-700 mb-4">
                {getConfigString('fieldFrequencyLabel', 'Frequency')}
              </label>
              <div className="flex gap-4 mb-6">
                {['weekly', 'monthly', 'manual'].map(type => (
                  <label key={type} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="scheduleType"
                      value={type === 'manual' ? 'cron' : type}
                      checked={state.scheduleType === (type === 'manual' ? 'cron' : type)}
                      onChange={(event) => handleFrequencyChange(event.target.value as ScheduleState['scheduleType'])}
                      className="text-[#FF3A2E] focus:ring-[#FF3A2E]"
                    />
                    <span>{getFrequencyLabel(type as 'weekly' | 'monthly' | 'manual')}</span>
                  </label>
                ))}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="scheduleType"
                    value="none"
                    checked={state.scheduleType === 'none'}
                    onChange={(event) => handleFrequencyChange(event.target.value as ScheduleState['scheduleType'])}
                    className="text-[#FF3A2E] focus:ring-[#FF3A2E]"
                  />
                  <span>{getConfigString('frequencyNoneLabel', 'None (manual only)')}</span>
                </label>
              </div>

              {/* Weekly Config */}
              {state.scheduleType === 'weekly' && (
                <div className="space-y-4 bg-gray-50 p-4 rounded-xl">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">
                      {getConfigString('runOnDaysLabel', 'Run on days')}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {WEEKDAY_KEYS.map(({ key, fallback }, idx) => {
                        const label = getConfigString(key, fallback);
                        // 0=Sun in JS Date, plugin might map differently? 
                        // Looking at legacy PHP: 1=Mon...0=Sun. 
                        // Let's use standard 0-6 where 0 is Sunday.
                        const isSelected = (state.schedulePayload.days as number[])?.includes(idx);
                        return (
                          <button
                            key={label}
                            type="button"
                            onClick={() => toggleWeekday(idx)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                              isSelected 
                                ? 'bg-[#FF3A2E] text-white shadow-sm' 
                                : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">
                        {getConfigString(
                          'timeZoneLabel',
                          'Time zone (defaults to WordPress setting)',
                        )}
                      </label>
                      <select
                        value={state.scheduleTimezone}
                        onChange={(event) => setState((prev) => ({ ...prev, scheduleTimezone: event.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#FF3A2E]"
                      >
                        {TIMEZONE_OPTIONS.length === 0 && (
                          <option value={state.scheduleTimezone}>{state.scheduleTimezone}</option>
                        )}
                        {TIMEZONE_OPTIONS.length > 0 &&
                          TIMEZONE_OPTIONS.map((tz) => (
                            <option key={tz} value={tz}>
                              {tz}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">
                      {getConfigString('runAtTimesLabel', 'Run at times')}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {((state.schedulePayload.times as string[]) || []).map((time, idx) => (
                        <div key={idx} className="flex items-center bg-white border border-gray-200 rounded-lg pl-2 pr-1 py-1">
                          <input
                            type="time"
                            value={time}
                            onChange={(event) => updateTime(idx, event.target.value)}
                            className="border-none p-0 h-6 text-sm text-center focus:ring-0"
                            style={SHARED_INPUT_STYLE}
                          />
                          <button type="button" onClick={() => removeTime(idx)} className="ml-1 text-gray-400 hover:text-red-500">
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={addTime}
                        className="flex items-center gap-1 px-2.5 py-1 bg-white border border-dashed border-gray-300 text-gray-500 rounded-lg hover:border-[#FF3A2E] hover:text-[#FF3A2E] text-xs"
                      >
                        <Plus size={14} />
                        {getConfigString('addTimeButtonLabel', 'Add time')}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Monthly Config */}
              {state.scheduleType === 'monthly' && (
                <div className="space-y-4 bg-gray-50 p-4 rounded-xl">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    <div className="flex flex-col" style={SHARED_INPUT_STYLE}>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">
                        {getConfigString('dayOfMonthLabel', 'Day of month')}
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={(state.schedulePayload.days as number[])?.[0] ?? 1}
                        onChange={(event) => {
                          const raw = event.target.value.trim();
                          const dayValue = raw === '' ? 1 : Number(raw);
                          const day = Math.min(31, Math.max(1, Number.isFinite(dayValue) ? dayValue : 1));
                          setState((prev) => ({
                            ...prev,
                            schedulePayload: {
                              ...prev.schedulePayload,
                              days: [day],
                            },
                          }));
                        }}
                        className="px-2 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#FF3A2E] text-center tracking-wide"
                        style={SHARED_INPUT_STYLE}
                      />
                    </div>

                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">
                        Time zone (defaults to WordPress setting)
                      </label>
                      <select
                        value={state.scheduleTimezone}
                        onChange={(event) => setState((prev) => ({ ...prev, scheduleTimezone: event.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#FF3A2E]"
                      >
                        {TIMEZONE_OPTIONS.length === 0 && (
                          <option value={state.scheduleTimezone}>{state.scheduleTimezone}</option>
                        )}
                        {TIMEZONE_OPTIONS.length > 0 &&
                          TIMEZONE_OPTIONS.map((tz) => (
                            <option key={tz} value={tz}>
                              {tz}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">
                      Run at times
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {((state.schedulePayload.times as string[]) || []).map((time, idx) => (
                        <div key={idx} className="flex items-center bg-white border border-gray-200 rounded-lg pl-2 pr-1 py-1">
                          <input
                            type="time"
                            value={time}
                            onChange={(event) => updateTime(idx, event.target.value)}
                            className="border-none p-0 h-6 text-sm focus:ring-0"
                            style={SHARED_INPUT_STYLE}
                          />
                          <button
                            type="button"
                            onClick={() => removeTime(idx)}
                            className="ml-1 text-gray-400 hover:text-red-500"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={addTime}
                        className="flex items-center gap-1 px-3 py-1 bg-white border border-dashed border-gray-300 text-gray-500 rounded-lg hover:border-[#FF3A2E] hover:text-[#FF3A2E] text-sm"
                      >
                        <Plus size={14} /> Add time
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Cron Config */}
              {state.scheduleType === 'cron' && (
                <div className="bg-gray-50 p-4 rounded-xl">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {getConfigString('cronExpressionLabel', 'Cron expression')}
                  </label>
                  <input
                    type="text"
                    placeholder="0 0 * * *"
                    value={state.scheduleCron}
                    onChange={e => setState({...state, scheduleCron: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    {getConfigString(
                      'cronExpressionHelp',
                      'Standard cron syntax: minute hour day month weekday',
                    )}
                  </p>
                </div>
              )}
            </div>

            {/* Incremental */}
            <div className="pt-6">
              <div className="flex items-start gap-3">
                <div className="pt-1">
                  <input
                    type="checkbox"
                    id="incremental"
                    checked={state.incremental}
                    onChange={e => setState({...state, incremental: e.target.checked})}
                    className="w-4 h-4 text-[#FF3A2E] rounded border-gray-300 focus:ring-[#FF3A2E]"
                  />
                </div>
                <div>
                  <label htmlFor="incremental" className="block text-sm font-medium text-gray-900">
                    {getConfigString('incrementalLabel', 'Incremental Export')}
                  </label>
                  <p className="text-sm text-gray-500">
                    {getConfigString(
                      'incrementalDescription',
                      'Only export products modified since the last run',
                    )}
                  </p>
                  
                  {state.incremental && (
                    <div className="mt-3">
                      <select
                        value={state.incrementalField}
                        onChange={e => setState({...state, incrementalField: e.target.value})}
                        className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                      >
                        <option value="post_modified">
                          {getConfigString(
                            'incrementalOptionLastModified',
                            'Based on Last Modified Date',
                          )}
                        </option>
                        <option value="post_date">
                          {getConfigString('incrementalOptionCreated', 'Based on Creation Date')}
                        </option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                  {getConfigString('postExportActionsTitle', 'Post-Export Actions')}
                </h3>
                <button
                  type="button"
                  onClick={handleAddAction}
                  className="text-sm text-[#FF3A2E] font-medium hover:underline"
                >
                  {getConfigString('addActionButtonLabel', '+ Add Action')}
                </button>
              </div>

              {state.actions.length === 0 ? (
                <p className="text-sm text-gray-500 italic">
                  {getConfigString('noActionsConfiguredText', 'No actions configured.')}
                </p>
              ) : (
                <div className="space-y-3">
                  {state.actions.map((action: any, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center border border-gray-200 text-gray-500">
                          <Settings size={16} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{config.actionLabels[action.type] || action.type}</p>
                          <p className="text-xs text-gray-500 truncate max-w-[200px]">
                            {JSON.stringify(action.config)}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => handleEditAction(idx)} className="p-1 text-gray-400 hover:text-blue-600">
                          <Settings size={16} />
                        </button>
                        <button type="button" onClick={() => handleDeleteAction(idx)} className="p-1 text-gray-400 hover:text-red-600">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex justify-between items-center bg-gray-50 rounded-b-2xl">
          <div className="flex items-center gap-2">
             <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
               <input
                 type="checkbox"
                 checked={state.enabled}
                 onChange={e => setState({...state, enabled: e.target.checked})}
                 className="rounded text-[#FF3A2E] focus:ring-[#FF3A2E]"
               />
               {getConfigString('activeLabel', 'Active')}
             </label>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-xl font-medium transition-colors"
            >
              {getConfigString('cancelAction', 'Cancel')}
            </button>
            <button
              type="button"
              form="schedule-form"
              onClick={(event) => handleSave(event as unknown as React.FormEvent)}
              disabled={isSaving}
              className="px-6 py-2 bg-[#FF3A2E] text-white rounded-xl font-medium hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20 flex items-center gap-2"
            >
              {isSaving
                ? getConfigString('savingLabel', 'Saving...')
                : task
                  ? getConfigString('updateScheduleButton', 'Update Schedule')
                  : getConfigString('createScheduleButton', 'Create Schedule')}
            </button>
          </div>
        </div>
      </div>

      {isEditingAction && renderActionEditor()}
    </div>
  );
}
