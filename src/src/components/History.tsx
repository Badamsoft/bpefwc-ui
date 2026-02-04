import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import Papa from 'papaparse';
import { Download, Eye, Filter, Calendar as CalendarIcon, AlertTriangle, Trash2, X, RotateCw, Save, CheckSquare, Square, SquareMinus, FileText } from 'lucide-react';
import type { DateRange as DayPickerDateRange } from 'react-day-picker';
import { useAppState } from '@/context/AppStateContext';
import type { HistoryRun, HistoryRunStatus, HistoryState } from '@/types/app-state';
import { deleteHistoryRun, deleteHistoryRunsBulk, fetchHistory, retryHistoryRun } from '@/api/history';
import { SaveTemplateModal } from '@/components/modals/SaveTemplateModal';
import { saveTemplate, TEMPLATE_CREATE_ACTION, TEMPLATE_UPDATE_ACTION } from '@/api/templates';
import { buildTemplateRequestFromRun } from '@/utils/template-saving';
import { mapTemplateFromResponse, mergeTemplateItems, type TemplateRequestValue } from '@/utils/templates';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Calendar } from '@/components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type FieldDefinitionMap = Record<string, { label?: string; [key: string]: unknown }>;
type HistoryRunType = HistoryRun['run_type'];
type HistoryFilters = HistoryState['filters'];

type AdvancedFilterKey = 'template_name';

interface ActiveAdvancedFilter {
  key: AdvancedFilterKey;
  value: string;
}

const STATUS_STYLES: Record<HistoryRunStatus, { dot: string; text: string }> = {
  success: { dot: 'bg-green-500', text: 'text-green-700' },
  error: { dot: 'bg-red-500', text: 'text-red-700' },
  running: { dot: 'bg-blue-500', text: 'text-blue-700' },
  pending: { dot: 'bg-amber-500', text: 'text-amber-700' },
  cancelled: { dot: 'bg-gray-400', text: 'text-gray-500' },
};

const DATE_RANGE_LABEL_FORMATTER = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
});

function getDateFormatter(timeZone?: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timeZone || undefined,
  });
}

const HISTORY_PREVIEW_LIMIT = 100;
const HISTORY_PAGE_SIZE = 20;

function parseDateFilter(value?: string | null): Date | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed;
}

function buildRangeFromFilters(from?: string | null, to?: string | null): DayPickerDateRange | undefined {
  const parsedFrom = parseDateFilter(from);
  const parsedTo = parseDateFilter(to);

  if (!parsedFrom && !parsedTo) {
    return undefined;
  }

  return {
    from: parsedFrom,
    to: parsedTo,
  };
}

function formatDateForQuery(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function formatRangeLabel(range?: DayPickerDateRange): string | null {
  if (!range) {
    return null;
  }

  const fromLabel = range.from ? DATE_RANGE_LABEL_FORMATTER.format(range.from) : null;
  const toLabel = range.to ? DATE_RANGE_LABEL_FORMATTER.format(range.to) : null;

  if (fromLabel && toLabel) {
    return `${fromLabel} – ${toLabel}`;
  }

  if (fromLabel) {
    return `From ${fromLabel}`;
  }

  if (toLabel) {
    return `Until ${toLabel}`;
  }

  return null;
}

export function History(): ReactElement {
  const { state, setState } = useAppState();
  const getString = (key: string, fallback: string): string => {
    const raw = state.strings?.[key];
    return typeof raw === 'string' ? raw : fallback;
  };
  const getRunTypeLabel = (type: HistoryRunType | ''): string => {
    if (type === 'manual') {
      return getString('historyRunTypeManual', 'Manual');
    }
    if (type === 'scheduled') {
      return getString('historyRunTypeScheduled', 'Scheduled');
    }

    return type;
  };
  const historyState = state.history;
  const filters = historyState.filters;
  const runs = historyState.runs;
  const restBaseUrl = state.urls?.rest ?? '';
  const ajaxUrl = state.urls?.ajax ?? '';
  const canManageHistoryActions = state.capabilities['prodexfo_access_history_actions'] ?? false;
  const canManageTemplates = state.capabilities['prodexfo_access_templates'] ?? false;
  const fieldDefinitions = (state.export.fieldDefinitions as FieldDefinitionMap) ?? {};
  const templatesNonce = state.nonces?.templates ?? '';
  const templateItems = state.export.templates?.items ?? [];

  const initialTemplateName = typeof filters.template_name === 'string' ? filters.template_name : '';

  const [runTypeFilter, setRunTypeFilter] = useState<string>(filters.run_type === 'scheduled' ? '' : (filters.run_type ?? ''));
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deletingRunId, setDeletingRunId] = useState<number | null>(null);
  const [previewRun, setPreviewRun] = useState<HistoryRun | null>(null);
  const [retryingRunId, setRetryingRunId] = useState<number | null>(null);
  const [templateSourceRun, setTemplateSourceRun] = useState<HistoryRun | null>(null);
  const [logRun, setLogRun] = useState<HistoryRun | null>(null);
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DayPickerDateRange | undefined>(() =>
    buildRangeFromFilters(filters.date_from, filters.date_to)
  );
  const [draftDateRange, setDraftDateRange] = useState<DayPickerDateRange | undefined>(() =>
    buildRangeFromFilters(filters.date_from, filters.date_to)
  );
  const [selectedRunIds, setSelectedRunIds] = useState<number[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);
  const [isResettingFilters, setIsResettingFilters] = useState(false);
  const [templateNameFilter, setTemplateNameFilter] = useState<string>(initialTemplateName);
  const [draftTemplateName, setDraftTemplateName] = useState<string>(initialTemplateName);

  const templateOptions = useMemo(() => {
    const names = new Set<string>();

    (templateItems ?? []).forEach((item) => {
      if (typeof item.name === 'string') {
        const trimmed = item.name.trim();
        if (trimmed) {
          names.add(trimmed);
        }
      }
    });

    if (templateNameFilter.trim()) {
      names.add(templateNameFilter.trim());
    }

    if (draftTemplateName.trim()) {
      names.add(draftTemplateName.trim());
    }

    return Array.from(names).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [templateItems, templateNameFilter, draftTemplateName]);

  const calendarInitialMonth = useMemo(() => {
    if (draftDateRange?.from) {
      return draftDateRange.from;
    }

    if (draftDateRange?.to) {
      return draftDateRange.to;
    }

    return new Date();
  }, [draftDateRange]);

  const popoverPanelStyle = useMemo(() => ({
    width: 'min(34rem, calc(100vw - 2rem))',
  }), []);

  const normalizeRangeSelection = useCallback(
    (range: DayPickerDateRange | undefined): DayPickerDateRange | undefined => {
      if (!range) {
        return undefined;
      }

      const from = range.from ?? range.to ?? undefined;
      const to = range.to ?? undefined;

      if (!from && !to) {
        return undefined;
      }

      if (from && to && from > to) {
        return {
          from: to,
          to: from,
        };
      }

      return {
        from,
        to,
      };
    },
    []
  );

  const refreshHistory = async (overrideFilters: Partial<HistoryFilters> = {}): Promise<void> => {
    if (!restBaseUrl) {
      console.warn('REST base URL is not configured.');
      return;
    }

    const mergedFilters = {
      ...state.history.filters,
      ...overrideFilters,
    };

    const normalizedFilters = {
      ...mergedFilters,
      limit: HISTORY_PAGE_SIZE,
      per_page: HISTORY_PAGE_SIZE,
    };

    setIsRefreshing(true);
    try {
      const data = await fetchHistory(restBaseUrl, normalizedFilters);
      setState((prev) => ({
        ...prev,
        history: data,
      }));
      setRunTypeFilter(data.filters.run_type ?? '');
      setSelectedRunIds([]);
      setErrorMessage(null);
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : getString('genericError', 'An error occurred.');
      setErrorMessage(message);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRetryRun = async (runId: number) => {
    if (!restBaseUrl || !canManageHistoryActions) {
      return;
    }

    setRetryingRunId(runId);
    try {
      const updatedRun = await retryHistoryRun(restBaseUrl, runId);
      setState((prev) => ({
        ...prev,
        history: {
          ...prev.history,
          runs: prev.history.runs.map((run) => (run.id === updatedRun.id ? { ...run, ...updatedRun } : run)),
        },
      }));
      setErrorMessage(null);
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : getString('genericError', 'An error occurred.');
      setErrorMessage(message);
    } finally {
      setRetryingRunId(null);
    }
  };

  useEffect(() => {
    const nextRange = buildRangeFromFilters(filters.date_from, filters.date_to);
    setDateRange(nextRange);
    setDraftDateRange(nextRange);
  }, [filters.date_from, filters.date_to]);

  useEffect(() => {
    if (!restBaseUrl) {
      return;
    }

    refreshHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restBaseUrl]);

  useEffect(() => {
    const nextTemplateName = typeof filters.template_name === 'string' ? filters.template_name : '';

    setTemplateNameFilter(nextTemplateName);
    setDraftTemplateName(nextTemplateName);
  }, [filters.template_name]);

  const templateNameById = useMemo(() => {
    const map = new Map<string, string>();
    const templateItems = state.export.templates?.items ?? [];

    templateItems.forEach((item) => {
      map.set(item.id, item.name);
    });

    return map;
  }, [state.export.templates]);

  const dateFormatter = useMemo(
    () => getDateFormatter(Intl.DateTimeFormat().resolvedOptions().timeZone),
    []
  );

  const filteredRuns = useMemo(() => {
    if (!runTypeFilter) {
      return runs;
    }

    return runs.filter((run) => run.run_type === runTypeFilter);
  }, [runs, runTypeFilter]);

  const manualCount = useMemo(
    () => runs.filter((run) => run.run_type === 'manual').length,
    [runs]
  );

  const enableBulkActions = canManageHistoryActions;
  const currentPageRunIds = useMemo(() => filteredRuns.map((run) => run.id), [filteredRuns]);
  const selectedOnCurrent = useMemo(
    () => selectedRunIds.filter((id) => currentPageRunIds.includes(id)),
    [selectedRunIds, currentPageRunIds]
  );
  const allSelectedOnPage =
    enableBulkActions && currentPageRunIds.length > 0 && selectedOnCurrent.length === currentPageRunIds.length;
  const partiallySelectedOnPage = enableBulkActions && selectedOnCurrent.length > 0 && !allSelectedOnPage;
  const selectionDisabled = isRefreshing || isBulkDeleting;
  const tableColumnCount = enableBulkActions ? 11 : 10;
  const selectionCount = selectedOnCurrent.length;
  const selectedRunIdSet = useMemo(() => new Set(selectedOnCurrent), [selectedOnCurrent]);

  useEffect(() => {
    if (!enableBulkActions) {
      setSelectedRunIds([]);
      return;
    }

    setSelectedRunIds((prev) => {
      const filteredIds = prev.filter((id) => currentPageRunIds.includes(id));
      return filteredIds.length === prev.length ? prev : filteredIds;
    });
  }, [currentPageRunIds, enableBulkActions]);

  const toggleRunSelection = (runId: number) => {
    if (!enableBulkActions || selectionDisabled) {
      return;
    }

    if (!currentPageRunIds.includes(runId)) {
      return;
    }

    setSelectedRunIds((prev) => {
      const filteredPrev = prev.filter((id) => currentPageRunIds.includes(id));

      if (filteredPrev.includes(runId)) {
        return filteredPrev.filter((id) => id !== runId);
      }

      if (filteredPrev.length >= HISTORY_PAGE_SIZE) {
        return filteredPrev;
      }

      return [...filteredPrev, runId];
    });
  };

  const handleToggleSelectAll = () => {
    if (!enableBulkActions || selectionDisabled) {
      return;
    }

    if (allSelectedOnPage) {
      setSelectedRunIds([]);
      return;
    }

    setSelectedRunIds([...currentPageRunIds]);
  };

  const handleBulkDelete = async () => {
    if (!enableBulkActions || selectionDisabled || !selectionCount || !restBaseUrl) {
      return;
    }

    const confirmed = window.confirm(
      selectionCount === 1
        ? 'Delete the selected export record? This action cannot be undone.'
        : `Delete ${selectionCount} selected export records? This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setIsBulkDeleting(true);

    try {
      await deleteHistoryRunsBulk(restBaseUrl, selectedOnCurrent);
      await refreshHistory();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete selected export runs.';
      setErrorMessage(message);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const selectAllIcon = allSelectedOnPage ? (
    <CheckSquare className="w-4 h-4" />
  ) : partiallySelectedOnPage ? (
    <SquareMinus className="w-4 h-4" />
  ) : (
    <Square className="w-4 h-4" />
  );
  const selectAllLabel = allSelectedOnPage
    ? getString('historyBulkDeselectAllTooltip', 'Deselect all exports on this page')
    : getString('historyBulkSelectAllTooltip', 'Select all exports on this page');

  const pagination = historyState.pagination;
  const total = pagination.total;
  const start = total === 0 ? 0 : filters.offset + 1;
  const end = total === 0 ? 0 : filters.offset + filteredRuns.length;

  const dateRangeLabel = useMemo(() => formatRangeLabel(dateRange), [dateRange]);
  const activeAdvancedFilters = useMemo(() => {
    const items: ActiveAdvancedFilter[] = [];

    const normalizedTemplate = templateNameFilter.trim();

    if (normalizedTemplate) {
      items.push({ key: 'template_name', value: normalizedTemplate });
    }

    return items;
  }, [templateNameFilter]);
  const activeAdvancedFiltersCount = activeAdvancedFilters.length;
  const isAdvancedApplyDisabled = draftTemplateName.trim() === templateNameFilter.trim();

  const templateSelectValue = draftTemplateName.trim() ? draftTemplateName : '__any__';

  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        (filters.date_from ?? '') ||
          (filters.date_to ?? '') ||
          (filters.status ?? '') ||
          (filters.task_id ?? '') ||
          (filters.template_id ?? '') ||
          (filters.template_name ?? '') ||
          runTypeFilter,
      ),
    [
      filters.date_from,
      filters.date_to,
      filters.status,
      filters.task_id,
      filters.template_id,
      filters.template_name,
      runTypeFilter,
    ],
  );

  const resetButtonDisabled = isRefreshing || isResettingFilters || !hasActiveFilters;

  const handleRunTypeChange = useCallback(
    (type: 'manual' | '') => {
      setRunTypeFilter(type);
      refreshHistory({ run_type: type, page: 1, offset: 0 });
    },
    [refreshHistory]
  );

  const handleResetAllFilters = useCallback(async () => {
    if (!restBaseUrl || resetButtonDisabled) {
      return;
    }

    setIsResettingFilters(true);

    setRunTypeFilter('');
    setTemplateNameFilter('');
    setDraftTemplateName('');
    setDateRange(undefined);
    setDraftDateRange(undefined);
    setIsDatePopoverOpen(false);
    setIsAdvancedFiltersOpen(false);
    setSelectedRunIds([]);

    try {
      await refreshHistory({
        status: '',
        run_type: '',
        template_id: '',
        template_name: '',
        date_from: '',
        date_to: '',
        page: 1,
        offset: 0,
      });
    } finally {
      setIsResettingFilters(false);
    }
  }, [refreshHistory, resetButtonDisabled, restBaseUrl]);

  const handlePreviewRun = useCallback(
    (run: HistoryRun) => {
      if (!run.file_path) {
        setErrorMessage(
          getString(
            'historyPreviewFileNotAvailable',
            'Preview is unavailable because the export file has been removed.',
          ),
        );
        return;
      }

      setPreviewRun(run);
    },
    []
  );

  const handleDeleteRun = useCallback(
    async (runId: number) => {
      if (!restBaseUrl || !canManageHistoryActions) {
        return;
      }

      const confirmed = window.confirm('Delete this export record? This action cannot be undone.');

      if (!confirmed) {
        return;
      }

      setSelectedRunIds((prev) => prev.filter((id) => id !== runId));
      setDeletingRunId(runId);

      try {
        await deleteHistoryRun(restBaseUrl, runId);
        await refreshHistory();
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : getString('genericError', 'An error occurred.');
        setErrorMessage(message);
      } finally {
        setDeletingRunId(null);
      }
    },
    [canManageHistoryActions, refreshHistory, restBaseUrl]
  );

  const handleApplyDateRange = useCallback(() => {
    const normalizedRange = normalizeRangeSelection(draftDateRange);
    const appliedRange = normalizedRange
      ? {
          from: normalizedRange.from ?? undefined,
          to: (normalizedRange.to ?? normalizedRange.from) ?? undefined,
        }
      : undefined;

    setDateRange(appliedRange);
    setIsDatePopoverOpen(false);

    if (!appliedRange?.from && !appliedRange?.to) {
      refreshHistory({ date_from: '', date_to: '', page: 1, offset: 0 });
      return;
    }

    const fromDate = appliedRange.from;
    const toDate = appliedRange.to ?? appliedRange.from;

    refreshHistory({
      date_from: fromDate ? formatDateForQuery(fromDate) : '',
      date_to: toDate ? formatDateForQuery(toDate) : '',
      page: 1,
      offset: 0,
    });
  }, [draftDateRange, normalizeRangeSelection, refreshHistory]);

  const handleClearDateRange = useCallback(() => {
    setDateRange(undefined);
    setDraftDateRange(undefined);
    setIsDatePopoverOpen(false);
    refreshHistory({ date_from: '', date_to: '', page: 1, offset: 0 });
  }, [refreshHistory]);

  const handleApplyAdvancedFilters = useCallback(() => {
    const normalizedTemplate = draftTemplateName.trim();

    if (normalizedTemplate === templateNameFilter.trim()) {
      setIsAdvancedFiltersOpen(false);
      return;
    }

    setTemplateNameFilter(normalizedTemplate);
    setIsAdvancedFiltersOpen(false);
    refreshHistory({
      template_name: normalizedTemplate,
      page: 1,
      offset: 0,
    });
  }, [draftTemplateName, refreshHistory, templateNameFilter]);

  const handleResetAdvancedFilters = useCallback(() => {
    const hadFilters = Boolean(templateNameFilter.trim());

    setTemplateNameFilter('');
    setDraftTemplateName('');
    setIsAdvancedFiltersOpen(false);

    if (hadFilters) {
      refreshHistory({ template_name: '', page: 1, offset: 0 });
    }
  }, [refreshHistory, templateNameFilter]);

  const handleRemoveAdvancedFilter = useCallback(
    (key: AdvancedFilterKey) => {
      const nextTemplate = key === 'template_name' ? '' : templateNameFilter.trim();

      if (key === 'template_name') {
        setTemplateNameFilter('');
        setDraftTemplateName('');
      }

      refreshHistory({ template_name: nextTemplate, page: 1, offset: 0 });
    },
    [refreshHistory, templateNameFilter]
  );

  const renderStatus = (run: HistoryRun): ReactElement => {
    const style = STATUS_STYLES[run.status] ?? STATUS_STYLES.pending;
    const labelKey = `historyStatus_${run.status}`;
    const fallbackLabel =
      run.status === 'success'
        ? 'Success'
        : run.status === 'error'
        ? 'Error'
        : run.status === 'running'
        ? 'Running'
        : run.status === 'pending'
        ? 'Pending'
        : run.status === 'cancelled'
        ? 'Cancelled'
        : run.status;

    return (
      <div className="flex items-center justify-center gap-2">
        <div className={`w-2 h-2 rounded-full ${style.dot}`}></div>
        <span className={`text-xs ${style.text}`}>{getString(labelKey, fallbackLabel)}</span>
      </div>
    );
  };

  const templateModalGuard = useMemo(() => {
    if (!templateSourceRun) {
      return null;
    }

    if (!canManageTemplates) {
      return {
        message: 'You do not have permission to save templates.',
        type: 'error' as const,
        disableSave: true,
      };
    }

    if (!ajaxUrl || !templatesNonce) {
      return {
        message: 'Template saving endpoint is not available. Please reload the page.',
        type: 'error' as const,
        disableSave: true,
      };
    }

    if (!templateSourceRun.fields || templateSourceRun.fields.length === 0) {
      return {
        message: 'This export run did not capture the field selection required for templates.',
        type: 'info' as const,
        disableSave: true,
      };
    }

    return null;
  }, [ajaxUrl, canManageTemplates, templateSourceRun, templatesNonce]);

  const handleSaveTemplateFromHistory = async ({ name, templateId }: { name: string; templateId?: string }) => {
    if (!templateSourceRun) {
      throw new Error('No history run selected.');
    }

    if (!ajaxUrl || !templatesNonce) {
      throw new Error('Template saving endpoint is not available. Please reload the page.');
    }

    const trimmedName = name.trim();

    if (!trimmedName) {
      throw new Error('Enter a template name to continue.');
    }

    const normalizedName = trimmedName.toLowerCase();
    const itemsForLookup = templateItems ?? [];
    const exactMatch = itemsForLookup.find((item) => item.name.toLowerCase() === normalizedName);
    const mode: 'create' | 'update' = templateId ? 'update' : exactMatch ? 'update' : 'create';
    const existingTemplate = templateId
      ? itemsForLookup.find((item) => item.id === templateId)
      : exactMatch;
    const resolvedTemplateId = existingTemplate?.id ?? templateId ?? '';

    const basePayload: Record<string, TemplateRequestValue> = {
      action: mode === 'update' ? TEMPLATE_UPDATE_ACTION : TEMPLATE_CREATE_ACTION,
      nonce: templatesNonce,
      template_name: trimmedName,
      template_description: existingTemplate?.description ?? '',
    };

    if (mode === 'update' && resolvedTemplateId) {
      basePayload.template_id = resolvedTemplateId;
    }

    const requestPayload = buildTemplateRequestFromRun(templateSourceRun, basePayload);
    const response = await saveTemplate(ajaxUrl, requestPayload);

    if (!response || !response.success) {
      throw new Error('Unable to save template.');
    }

    const templatePayload = response.data?.template ?? response.data?.data ?? {};
    const fallbackId = resolvedTemplateId || (typeof templatePayload.id === 'string' ? templatePayload.id : '');
    const mappedTemplate = mapTemplateFromResponse(templatePayload, {
      id: fallbackId,
      name: trimmedName,
    });

    setState((prev) => {
      const currentTemplates = prev.export.templates ?? {
        items: [],
        selected: '',
        strings: {},
      };

      const updatedItems = mergeTemplateItems(currentTemplates.items ?? [], mappedTemplate);

      return {
        ...prev,
        export: {
          ...prev.export,
          templates: {
            ...currentTemplates,
            items: updatedItems,
            selected: mappedTemplate.id,
          },
        },
      };
    });

    setTemplateSourceRun(null);
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-gray-900 font-semibold mb-2 page-heading">
            {getString('historyTitle', 'Export History')}
          </h1>
          <p className="text-gray-600 page-subheading">
            {getString('historySubtitle', 'View and download your previous exports')}
          </p>
        </div>

        {/* Filters toolbar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleRunTypeChange('')}
              className={`px-4 py-2 rounded-xl text-sm text-label transition-colors border ${
                runTypeFilter === ''
                  ? 'bg-[#FF3A2E] text-white border-[#FF3A2E] shadow-sm'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
              disabled={isRefreshing}
            >
              {getString('historyFilterAllExports', 'All Exports')} ({runs.length})
            </button>
            <button
              type="button"
              onClick={() => handleRunTypeChange('manual')}
              className={`px-4 py-2 rounded-xl text-sm text-label transition-colors border ${
                runTypeFilter === 'manual'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
              disabled={isRefreshing}
            >
              {getString('historyFilterManual', 'Manual')} ({manualCount})
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Date range */}
            <Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  disabled={isRefreshing}
                >
                  <CalendarIcon className="w-4 h-4 text-gray-500" />
                  <span>{dateRangeLabel ?? getString('historyDateRangeLabel', 'Date range')}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent sideOffset={8} align="end" style={popoverPanelStyle} className="bg-white">
                <div className="p-3">
                  <Calendar
                    mode="range"
                    selected={draftDateRange}
                    onSelect={setDraftDateRange}
                    defaultMonth={calendarInitialMonth}
                    numberOfMonths={2}
                  />
                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-700 hover:bg-gray-50"
                      onClick={handleClearDateRange}
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-lg bg-[#FF3A2E] text-white text-xs hover:bg-red-600"
                      onClick={handleApplyDateRange}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Advanced filters */}
            <Popover open={isAdvancedFiltersOpen} onOpenChange={setIsAdvancedFiltersOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  disabled={isRefreshing}
                >
                  <Filter className="w-4 h-4 text-gray-500" />
                  <span>{getString('historyMoreFiltersButton', 'More filters')}</span>
                  {activeAdvancedFiltersCount > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center rounded-full bg-[#FF3A2E]/10 text-[#FF3A2E] text-xs px-2 py-0.5">
                      {activeAdvancedFiltersCount}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent sideOffset={8} align="end" style={popoverPanelStyle} className="bg-white">
                <div className="p-4 space-y-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">
                      {getString('historyTemplateNameLabel', 'Template name')}
                    </p>
                    <Select
                      value={templateSelectValue}
                      onValueChange={(value: string) => setDraftTemplateName(value === '__any__' ? '' : value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder={getString('historyTemplateAny', 'Any template')}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__any__">
                          {getString('historyTemplateAny', 'Any template')}
                        </SelectItem>
                        {templateOptions.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      className="text-xs text-gray-500 hover:text-gray-700"
                      onClick={handleResetAdvancedFilters}
                    >
                      {getString('historyAdvancedFiltersClear', 'Clear')}
                    </button>
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-lg bg-[#FF3A2E] text-white text-xs disabled:opacity-60"
                      onClick={handleApplyAdvancedFilters}
                      disabled={isAdvancedApplyDisabled}
                    >
                      {getString('historyAdvancedFiltersApply', 'Apply filters')}
                    </button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Reset all filters */}
            <button
              type="button"
              onClick={handleResetAllFilters}
              disabled={resetButtonDisabled}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                resetButtonDisabled
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-[#FF3A2E]/10 text-[#FF3A2E] hover:bg-[#FF3A2E]/20'
              }`}
            >
              {getString('historyResetFiltersButton', 'Reset filters')}
            </button>
          </div>
        </div>

        {activeAdvancedFilters.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            {activeAdvancedFilters.map((filterItem) => (
              <button
                key={filterItem.key}
                type="button"
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 text-xs text-gray-700 hover:bg-gray-200 transition-colors"
                onClick={() => handleRemoveAdvancedFilter(filterItem.key)}
              >
                <span className="font-semibold uppercase text-[0.65rem] text-gray-500">
                  {getString('historyTemplateNameLabel', 'Template name')}
                </span>
                <span className="text-gray-700">{filterItem.value}</span>
                <X className="w-3 h-3 text-gray-500" />
              </button>
            ))}
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm">
            {errorMessage}
          </div>
        )}
        {!errorMessage && isRefreshing && runs.length > 0 && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-gray-50 text-gray-600 text-sm">
            {getString('historyRefreshingMessage', 'Refreshing export history…')}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {enableBulkActions && (
                    <th
                      className="px-4 py-4 text-center text-gray-600 text-caption uppercase tracking-wide"
                      style={{ width: '3rem' }}
                    >
                      <button
                        type="button"
                        className={`mx-auto flex items-center justify-center w-8 h-8 rounded-lg border border-transparent transition-colors ${
                          selectionDisabled || currentPageRunIds.length === 0
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                        onClick={handleToggleSelectAll}
                        disabled={selectionDisabled || currentPageRunIds.length === 0}
                        aria-pressed={allSelectedOnPage}
                        title={selectAllLabel}
                      >
                        {selectAllIcon}
                      </button>
                    </th>
                  )}
                  <th className="px-6 py-4 text-center text-gray-600 text-caption uppercase tracking-wide">
                    {getString('historyColumnId', 'ID')}
                  </th>
                  <th className="px-6 py-4 text-center text-gray-600 text-caption uppercase tracking-wide">
                    {getString('historyColumnType', 'TYPE')}
                  </th>
                  <th className="px-6 py-4 text-center text-gray-600 text-caption uppercase tracking-wide">
                    {getString('historyColumnTemplate', 'TEMPLATE')}
                  </th>
                  <th className="px-6 py-4 text-center text-gray-600 text-caption uppercase tracking-wide">
                    {getString('historyColumnSchedule', 'SCHEDULE')}
                  </th>
                  <th className="px-6 py-4 text-center text-gray-600 text-caption uppercase tracking-wide">
                    {getString('historyColumnFormat', 'FORMAT')}
                  </th>
                  <th className="px-6 py-4 text-center text-gray-600 text-caption uppercase tracking-wide">
                    {getString('historyColumnProducts', 'PRODUCTS')}
                  </th>
                  <th className="px-6 py-4 text-center text-gray-600 text-caption uppercase tracking-wide">
                    {getString('historyColumnImagesZip', 'IMAGES ZIP')}
                  </th>
                  <th className="px-6 py-4 text-center text-gray-600 text-caption uppercase tracking-wide">
                    {getString('historyColumnStatus', 'STATUS')}
                  </th>
                  <th className="px-6 py-4 text-center text-gray-600 text-caption uppercase tracking-wide">
                    {getString('historyColumnDate', 'DATE')}
                  </th>
                  <th className="px-6 py-4 text-center text-gray-600 text-caption uppercase tracking-wide">
                    {getString('historyColumnActions', 'ACTIONS')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredRuns.length === 0 ? (
                  isRefreshing && runs.length === 0 ? (
                    <tr>
                      <td colSpan={tableColumnCount} className="px-6 py-12 text-center text-gray-500">
                        <div className="flex flex-col items-center gap-3">
                          <span className="text-sm text-label">
                            {getString('historyRefreshingMessage', 'Refreshing export history…')}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr>
                      <td colSpan={tableColumnCount} className="px-6 py-12 text-center text-gray-500">
                        <div className="flex flex-col items-center gap-3">
                          <AlertTriangle className="w-8 h-8 text-gray-300" />
                          <p className="text-label">
                            {getString(
                              'historyNoRunsMatch',
                              'No export runs match the selected filters.',
                            )}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )
                ) : (
                  filteredRuns.map((run) => (
                    <tr
                      key={run.id}
                      className={`transition-colors ${
                        selectedRunIdSet.has(run.id)
                          ? 'bg-[#FF3A2E]/5 hover:bg-[#FF3A2E]/10'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      {enableBulkActions && (
                        <td className="px-4 py-4 text-center" style={{ width: '3rem' }}>
                          <label className="inline-flex items-center justify-center mx-auto">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-gray-300 text-[#FF3A2E] focus:ring-[#FF3A2E]"
                              checked={selectedRunIdSet.has(run.id)}
                              onChange={() => toggleRunSelection(run.id)}
                              disabled={selectionDisabled}
                              aria-label={`Select export #${run.id}`}
                            />
                          </label>
                        </td>
                      )}
                      <td className="px-6 py-4 text-center">
                        <span className="text-gray-900 font-mono text-label">#{run.id}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex px-3 py-1 rounded-lg text-xs ${
                          run.run_type === 'manual'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-purple-100 text-purple-700'
                        }`}>
                          {getRunTypeLabel(run.run_type)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {run.template_id ? (
                          <span className="text-gray-900 text-label">
                            {templateNameById.get(run.template_id) ?? run.template_id}
                          </span>
                        ) : run.fields && run.fields.length ? (
                          <button
                            type="button"
                            className="px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-xl transition-colors flex items-center gap-2 mx-auto text-label"
                            onClick={() => setTemplateSourceRun(run)}
                          >
                            <Save className="w-4 h-4" />
                            {getString('modalSaveButton', 'Save as Template')}
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {run.task_name ? (
                          <span className="text-gray-900 text-label">{run.task_name}</span>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-gray-600 text-label">
                          {run.file_format?.toUpperCase() || (run.file_path ? extractFormatFromUrl(run.file_path) : '—')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-gray-900 text-label">{run.rows_exported.toLocaleString()}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {renderImagesZipLink(run, getString)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {renderStatus(run)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-gray-600" style={{ fontSize: '0.875rem' }}>
                          {formatDate(run.started_at, dateFormatter)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Preview export file */}
                          {run.file_path && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  className="p-2 rounded-xl transition-colors hover:bg-gray-50"
                                  onClick={() => handlePreviewRun(run)}
                                  type="button"
                                >
                                  <Eye className="w-4 h-4 text-gray-700" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent sideOffset={4}>
                                {getString('historyPreviewHeaderLabel', 'Preview')}
                              </TooltipContent>
                            </Tooltip>
                          )}

                          {/* Retry export */}
                          {canManageHistoryActions && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  className={`p-2 rounded-xl transition-colors hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed ${
                                    retryingRunId === run.id ? 'text-gray-400' : 'text-gray-700'
                                  }`}
                                  onClick={() => handleRetryRun(run.id)}
                                  disabled={retryingRunId === run.id}
                                  type="button"
                                >
                                  <RotateCw className={`w-4 h-4 ${retryingRunId === run.id ? 'animate-spin' : ''}`} />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent sideOffset={4}>
                                {getString('schedulerActionRunNow', 'Run now')}
                              </TooltipContent>
                            </Tooltip>
                          )}

                          {/* Download export file or show that it is unavailable */}
                          {run.file_path ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <a
                                  href={run.file_path}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-2 rounded-xl transition-colors hover:bg-gray-50 inline-flex"
                                >
                                  <Download className="w-4 h-4 text-[#FF3A2E]" />
                                </a>
                              </TooltipTrigger>
                              <TooltipContent sideOffset={4}>
                                {getString('historyPreviewDownloadButton', 'Download export file')}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="p-2 rounded-xl opacity-50 cursor-not-allowed">
                                  <Download className="w-4 h-4 text-gray-300" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent sideOffset={4}>
                                {getString(
                                  'historyPreviewFileNotAvailable',
                                  'Export file is unavailable (it may have been deleted by auto-cleanup)',
                                )}
                              </TooltipContent>
                            </Tooltip>
                          )}

                          {/* View log button before delete */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                className="p-2 rounded-xl transition-colors hover:bg-gray-50"
                                onClick={() => setLogRun(run)}
                                type="button"
                              >
                                <FileText className="w-4 h-4 text-gray-700" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent sideOffset={4}>
                              {getString('historyLogHeaderLabel', 'Log')}
                            </TooltipContent>
                          </Tooltip>

                          {/* Delete history record */}
                          {canManageHistoryActions && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  className="p-2 rounded-xl transition-colors hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                  onClick={() => handleDeleteRun(run.id)}
                                  disabled={isRefreshing || deletingRunId === run.id}
                                  type="button"
                                >
                                  <Trash2
                                    className={`w-4 h-4 ${
                                      deletingRunId === run.id
                                        ? 'text-[#FF3A2E] opacity-70 animate-pulse'
                                        : 'text-[#FF3A2E]'
                                    }`}
                                  />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent sideOffset={4}>
                                {getString('schedulerActionDelete', 'Delete')}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination & bulk actions */}
          <div className="border-t border-gray-200 px-6 py-4">
            <div className="flex flex-wrap items-center gap-4 justify-between">
              {enableBulkActions && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  {selectionCount > 0 ? (
                    <>
                      <span className="text-gray-900 font-medium">{selectionCount}</span>
                      <span>
                        {selectionCount === 1
                          ? getString('historyBulkExportSelectedSingular', 'export selected')
                          : getString('historyBulkExportSelectedPlural', 'exports selected')}
                      </span>
                    </>
                  ) : (
                    <span>
                      {getString('historyBulkSelectPrompt', 'Select exports to delete')}
                    </span>
                  )}
                  {selectionCount > 0 && (
                    <button
                      type="button"
                      onClick={handleBulkDelete}
                      disabled={selectionDisabled}
                      className={`p-2 rounded-xl transition-colors ${
                        selectionDisabled
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-[#FF3A2E]/10 text-[#FF3A2E] hover:bg-[#FF3A2E]/20'
                      }`}
                      title={
                        selectionDisabled
                          ? getString('historyBulkDeletingTitle', 'Deleting…')
                          : getString('historyBulkDeleteTooltip', 'Delete selected exports')
                      }
                    >
                      <Trash2 className={`w-4 h-4 ${selectionDisabled ? 'animate-pulse' : ''}`} />
                    </button>
                  )}
                </div>
              )}
              <p className="text-gray-600 flex-1 min-w-[12rem]" style={{ fontSize: '0.875rem' }}>
                {total === 0 ? (
                  getString('historySummaryEmpty', 'No exports recorded yet')
                ) : (
                  <>
                    {getString('historySummaryRangePrefix', 'Showing')}{' '}
                    <span className="text-gray-900">{start.toLocaleString()}</span>-
                    <span className="text-gray-900">{end.toLocaleString()}</span>{' '}
                    {getString('historySummaryRangeOf', 'of')}{' '}
                    <span className="text-gray-900">{total.toLocaleString()}</span>{' '}
                    {getString('historySummaryRangeSuffix', 'exports')}
                  </>
                )}
              </p>
              <div className="flex items-center gap-2">
                <PaginationButton
                  label={getString('historyPaginationPrevious', 'Previous')}
                  disabled={pagination.current <= 1}
                  onClick={() =>
                    refreshHistory({
                      page: Math.max(1, pagination.current - 1),
                      offset: Math.max(0, filters.offset - HISTORY_PAGE_SIZE),
                    })
                  }
                />
                <span className="px-3 py-2 bg-[#FF3A2E] text-white rounded-lg text-sm">
                  {getString('historyPaginationPageLabel', 'Page')}{' '}
                  {pagination.current} / {Math.max(pagination.pages, 1)}
                </span>
                <PaginationButton
                  label={getString('historyPaginationNext', 'Next')}
                  disabled={pagination.current >= pagination.pages}
                  onClick={() =>
                    refreshHistory({
                      page: Math.min(pagination.pages, pagination.current + 1),
                      offset: filters.offset + HISTORY_PAGE_SIZE,
                    })
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {previewRun && (
        <HistoryPreviewModal
          run={previewRun}
          fieldDefinitions={fieldDefinitions}
          onClose={() => setPreviewRun(null)}
        />
      )}
      {logRun && (
        <HistoryLogModal run={logRun} onClose={() => setLogRun(null)} />
      )}
      {templateSourceRun && (
        <SaveTemplateModal
          templates={templateItems}
          onClose={() => setTemplateSourceRun(null)}
          onSave={handleSaveTemplateFromHistory}
          guard={templateModalGuard}
        />
      )}
    </div>
  );
}

function parseRunDate(value?: string | null): Date | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  const hasTimezone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed);
  const normalized = trimmed.replace(' ', 'T');

  const isoValue = hasTimezone ? normalized : `${normalized}Z`;
  const date = new Date(isoValue);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(iso: string | undefined, formatter: Intl.DateTimeFormat, timeZone?: string): string {
  const date = parseRunDate(iso);

  if (!date) {
    return iso ?? '—';
  }

  const formatted = formatter.format(date);
  return timeZone ? `${formatted} (${timeZone})` : formatted;
}

function renderImagesZipLink(
  run: HistoryRun,
  getString: (key: string, fallback: string) => string,
): ReactElement {
  if (run.images_zip_path) {
    return (
      <a
        href={run.images_zip_path}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center justify-center gap-1 text-sm text-[#FF3A2E] hover:text-red-600"
      >
        <Download className="w-4 h-4" />
        {getString('historyImagesZipDownload', 'Download')}
      </a>
    );
  }

  return (
    <span className="text-gray-400 text-sm">
      {getString('historyImagesZipNotAvailable', 'Not available')}
    </span>
  );
}

interface PaginationButtonProps {
  label: string;
  disabled: boolean;
  onClick: () => void;
}

function PaginationButton({ label, disabled, onClick }: PaginationButtonProps): ReactElement {
  return (
    <button
      className={`px-4 py-2 text-gray-700 border border-gray-200 rounded-lg transition-colors ${
        disabled ? 'cursor-not-allowed opacity-50' : 'bg-white hover:bg-gray-50'
      }`}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

interface HistoryPreviewModalProps {
  run: HistoryRun;
  fieldDefinitions: FieldDefinitionMap;
  onClose: () => void;
}

type HistoryPreviewState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'table'; headers: string[]; rows: Record<string, unknown>[]; summary: string }
  | { status: 'text'; text: string; summary: string };

function HistoryPreviewModal({ run, fieldDefinitions, onClose }: HistoryPreviewModalProps) {
  const [state, setState] = useState<HistoryPreviewState>({ status: 'loading' });

  const { state: appState } = useAppState();
  const getString = (key: string, fallback: string): string => {
    const raw = appState.strings?.[key];
    return typeof raw === 'string' ? raw : fallback;
  };

  const noFileMessage = getString(
    'historyPreviewFileNotAvailable',
    'Export file is not available for preview.',
  );
  const loadFailedMessage = getString(
    'historyPreviewLoadFailed',
    'Unable to load export file for preview.',
  );
  const archiveUnavailableMessage = getString(
    'historyPreviewUnavailableForArchives',
    'Preview is unavailable for archive files.',
  );
  const renderFailedMessage = getString(
    'historyPreviewErrorRender',
    'Failed to render preview.',
  );
  const loadingLabel = getString('historyPreviewLoadingLabel', 'Loading preview…');
  const noColumnsLayoutLabel = getString(
    'historyPreviewNoColumnsLayout',
    'Unable to determine column layout for this export.',
  );
  const footerText = getString(
    'historyPreviewFooterText',
    'Previewing data directly from the exported file.',
  );
  const downloadFileLabel = getString('historyPreviewDownloadButton', 'Download file');
  const closeLabel = getString('historyCloseButton', 'Close');
  const closePreviewAria = getString('historyClosePreviewAria', 'Close preview');
  const previewHeaderLabel = getString('historyPreviewHeaderLabel', 'Preview');
  const runLabel = getString('historyRunLabel', 'Run');
  const productsLabel = getString('historyProductsLabel', 'products');

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      if (!run.file_path) {
        setState({ status: 'error', message: noFileMessage });
        return;
      }

      setState({ status: 'loading' });

      try {
        const previewUrl = new URL(run.file_path, window.location.origin).toString();
        const response = await fetch(previewUrl, { credentials: 'include' });

        if (!response.ok) {
          throw new Error(loadFailedMessage);
        }

        const extension = (run.file_format || extractFormatFromUrl(run.file_path)).toLowerCase();

        if (['zip', 'gz', 'tar'].includes(extension)) {
          throw new Error(archiveUnavailableMessage);
        }

        const text = await response.text();
        const parsed = parseHistoryPreview(text, extension || 'csv');

        if (!cancelled) {
          setState(parsed);
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : renderFailedMessage,
          });
        }
      }
    }

    loadPreview();

    return () => {
      cancelled = true;
    };
  }, [run]);

  const derivedColumns = useMemo(() => {
    if (state.status !== 'table') {
      return [] as { key: string; label: string; headerKey: string }[];
    }

    const headerColumns = state.headers;
    const runFields = Array.isArray(run.fields) ? run.fields : [];
    const normalize = (value: string) => value.trim().toLowerCase();
    const headerLookup = headerColumns.map((header) => ({
      header,
      normalized: normalize(header || ''),
    }));
    const usedHeaders = new Set<string>();
    const columns: { key: string; label: string; headerKey: string }[] = [];

    if (runFields.length && runFields.length === headerColumns.length) {
      runFields.forEach((fieldKey: string, index: number) => {
        const definition = fieldDefinitions[fieldKey] ?? {};
        const preferredLabel = (definition.label as string | undefined)?.trim() || headerColumns[index] || fieldKey;
        columns.push({ key: fieldKey, label: preferredLabel, headerKey: headerColumns[index] || preferredLabel });
        usedHeaders.add(headerColumns[index] || preferredLabel);
      });
      headerColumns.forEach((header) => usedHeaders.add(header));
      return columns;
    }

    runFields.forEach((fieldKey: string, index: number) => {
      const definition = fieldDefinitions[fieldKey] ?? {};
      const preferredLabel = (definition.label as string | undefined)?.trim() || fieldKey;
      const normalizedLabel = normalize(preferredLabel);
      const matchedHeader = headerLookup.find((entry) => entry.normalized === normalizedLabel && !usedHeaders.has(entry.header));
      const headerKey = matchedHeader?.header || headerColumns[index] || preferredLabel;
      columns.push({ key: fieldKey, label: preferredLabel, headerKey });
      usedHeaders.add(headerKey);
    });

    headerColumns.forEach((header, index) => {
      if (!usedHeaders.has(header)) {
        columns.push({
          key: header || `column-${index}`,
          label: header || `Column ${index + 1}`,
          headerKey: header || `column-${index}`,
        });
        usedHeaders.add(header);
      }
    });

    if (!columns.length) {
      return headerColumns.map((column, index) => ({
        key: column || `column-${index}`,
        label: column || `Column ${index + 1}`,
        headerKey: column || `column-${index}`,
      }));
    }

    return columns;
  }, [fieldDefinitions, run.fields, state]);

  const renderBody = (): ReactElement | null => {
    if (state.status === 'loading') {
      return (
        <div className="flex-1 flex items-center justify-center p-10">
          <p className="text-gray-500" style={{ fontSize: '0.875rem' }}>
            {loadingLabel}
          </p>
        </div>
      );
    }

    if (state.status === 'error') {
      return (
        <div className="flex-1 flex items-center justify-center p-10">
          <p className="text-red-600" style={{ fontSize: '0.875rem' }}>
            {state.message}
          </p>
        </div>
      );
    }

    if (state.status === 'text') {
      return (
        <div className="flex-1 overflow-auto p-6">
          <p className="text-gray-500 mb-3" style={{ fontSize: '0.85rem' }}>
            {state.summary}
          </p>
          <pre className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-800 overflow-auto">
            {state.text}
          </pre>
        </div>
      );
    }

    if (state.status === 'table') {
      if (!derivedColumns.length) {
        return (
          <div className="flex-1 flex items-center justify-center p-10">
            <p className="text-gray-500" style={{ fontSize: '0.85rem' }}>
              {noColumnsLayoutLabel}
            </p>
          </div>
        );
      }

      return (
        <div className="flex-1 overflow-auto p-6">
          <p className="text-gray-500 mb-3" style={{ fontSize: '0.85rem' }}>
            {state.summary}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {derivedColumns.map((column) => (
                    <th
                      key={column.key}
                      className="px-4 py-3 text-left text-gray-600 border-b border-gray-200 text-caption uppercase tracking-wide"
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {state.rows.map((row, rowIndex: number) => (
                  <tr key={rowIndex} className="hover:bg-gray-50">
                    {derivedColumns.map((column) => (
                      <td
                        key={`${rowIndex}-${column.key}`}
                        className="px-4 py-3 text-gray-900"
                        style={{ fontSize: '0.85rem' }}
                      >
                        {formatPreviewCell(row[column.headerKey] ?? row[column.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-gray-900 block-heading mb-1">
              {previewHeaderLabel} · {runLabel} #{run.id}
            </h2>
            <p className="text-gray-500 text-label">
              {run.template_id} · {run.rows_exported.toLocaleString()} {productsLabel} ·{' '}
              {run.file_format?.toUpperCase() || extractFormatFromUrl(run.file_path)}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
            <span className="sr-only">{closePreviewAria}</span>
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {renderBody()}

        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <p className="text-gray-500 text-label">
            {footerText}
          </p>
          <div className="flex items-center gap-3">
            <a
              href={run.file_path}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 rounded-xl text-sm border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              {downloadFileLabel}
            </a>
            <button
              onClick={onClose}
              className="px-6 py-3 bg-[#FF3A2E] text-white rounded-xl hover:bg-red-600 transition-colors"
            >
              {closeLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface HistoryLogModalProps {
  run: HistoryRun;
  onClose: () => void;
}

function normalizeRunLog(logValue: unknown, emptyMessage: string): string {
  if (logValue === null || logValue === undefined) {
    return emptyMessage;
  }

  if (typeof logValue === 'string') {
    const trimmed = logValue.trim();
    return trimmed !== '' ? trimmed : emptyMessage;
  }

  try {
    return JSON.stringify(logValue, null, 2);
  } catch {
    return String(logValue);
  }
}

function HistoryLogModal({ run, onClose }: HistoryLogModalProps): ReactElement {
  const { state: appState } = useAppState();
  const getString = (key: string, fallback: string): string => {
    const raw = appState.strings?.[key];
    return typeof raw === 'string' ? raw : fallback;
  };

  const logHeaderLabel = getString('historyLogHeaderLabel', 'Log');
  const runLabel = getString('historyRunLabel', 'Run');
  const statusLabel = getString('historyLogStatusLabel', 'Status');
  const productsLabel = getString('historyProductsLabel', 'products');
  const closeLabel = getString('historyCloseButton', 'Close');
  const closeLogAria = getString('historyCloseLogAria', 'Close log dialog');
  const emptyLogMessage = getString(
    'historyLogEmptyMessage',
    'No log entries available for this export.',
  );

  const logText = useMemo(() => normalizeRunLog(run.log, emptyLogMessage), [run.log, emptyLogMessage]);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-gray-900 block-heading mb-1">
              {logHeaderLabel} · {runLabel} #{run.id}
            </h2>
            <p className="text-gray-500 text-label">
              {statusLabel}: {getString(`historyStatus_${run.status}`, run.status)} ·{' '}
              {run.rows_exported.toLocaleString()} {productsLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100"
            aria-label={closeLogAria}
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-6">
          <pre className="text-xs text-gray-800 bg-gray-50 border border-gray-200 rounded-xl p-4 whitespace-pre-wrap break-words">
            {logText}
          </pre>
        </div>
        <div className="flex items-center justify-end p-6 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 bg-[#FF3A2E] text-white rounded-xl hover:bg-red-600 transition-colors"
          >
            {closeLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function parseHistoryPreview(text: string, extension: string): HistoryPreviewState {
  const trimmed = text.trim();

  if (!trimmed) {
    return { status: 'text', text: '(empty file)', summary: 'The export file is empty.' };
  }

  if (extension === 'json' || trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const recordRows = extractRecordArray(parsed);

      if (recordRows.length) {
        const limitedRows = recordRows.slice(0, HISTORY_PREVIEW_LIMIT);
        const columns = collectColumns(limitedRows);
        const tableRows = limitedRows.map((row) => {
          const record: Record<string, unknown> = {};
          columns.forEach((column) => {
            record[column] = row[column];
          });
          return record;
        });

        return {
          status: 'table',
          headers: columns,
          rows: tableRows,
          summary: `Showing ${tableRows.length} of ${recordRows.length.toLocaleString()} rows · ${columns.length} columns`,
        };
      }
    } catch (error) {
      // fall through to CSV parsing
    }
  }

  const csvState = parseCsvPreviewWithPapa(trimmed);
  if (csvState) {
    return csvState;
  }

  const delimiter = determineDelimiter(extension, trimmed);
  const fallbackState = parseDelimitedPreview(trimmed, delimiter);

  if (fallbackState) {
    return fallbackState;
  }

  return {
    status: 'text',
    text: trimmed.slice(0, 4000),
    summary: 'Showing first 4,000 characters of the export file.',
  };
}

function parseCsvPreviewWithPapa(text: string): HistoryPreviewState | null {
  try {
    const result = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: 'greedy',
      delimitersToGuess: [',', ';', '\t', '|'],
    });

    const headers = (result.meta.fields ?? []).filter((field): field is string => Boolean(field && field.trim()));
    const rows = result.data.filter((row) => row && Object.keys(row).length > 0).slice(0, HISTORY_PREVIEW_LIMIT);

    if (!headers.length || !rows.length) {
      return null;
    }

    const totalRows = result.data.length || rows.length;

    return {
      status: 'table',
      headers,
      rows,
      summary: `Showing ${rows.length} of ${totalRows.toLocaleString()} rows · ${headers.length} columns`,
    };
  } catch (error) {
    return null;
  }
}

function parseDelimitedPreview(text: string, delimiter: string): HistoryPreviewState | null {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (!lines.length) {
    return null;
  }

  const columns = splitDelimitedLine(lines[0], delimiter);
  const rows = lines
    .slice(1, HISTORY_PREVIEW_LIMIT + 1)
    .map((line) => splitDelimitedLine(line, delimiter));

  if (!columns.length || !rows.length) {
    return null;
  }

  const records = rows.map((row) => {
    const record: Record<string, unknown> = {};
    columns.forEach((column, index) => {
      const header = column || `column-${index}`;
      record[header] = row[index];
    });
    return record;
  });

  return {
    status: 'table',
    headers: columns,
    rows: records,
    summary: `Showing ${records.length} rows · ${columns.length} columns`,
  };
}

function splitDelimitedLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      result.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current);

  return result.map((value) => value.trim());
}

function determineDelimiter(extension: string, sample: string): string {
  const commaCount = (sample.match(/,/g) || []).length;
  const semicolonCount = (sample.match(/;/g) || []).length;
  const tabCount = (sample.match(/\t/g) || []).length;

  if (extension === 'tsv') {
    return '\t';
  }

  if (extension === 'csv') {
    if (semicolonCount > commaCount) {
      return ';';
    }
    if (tabCount > commaCount && tabCount > semicolonCount) {
      return '\t';
    }
    return ',';
  }

  if (tabCount > commaCount && tabCount > semicolonCount) {
    return '\t';
  }

  if (semicolonCount > commaCount) {
    return ';';
  }

  if (commaCount > 0) {
    return ',';
  }

  if (semicolonCount > 0) {
    return ';';
  }

  if (tabCount > 0) {
    return '\t';
  }

  return ',';
}

function formatPreviewCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (error) {
      return String(value);
    }
  }

  const text = String(value).trim();
  return text.length ? text : '—';
}

function extractFormatFromUrl(url: string | undefined): string {
  if (!url) {
    return '';
  }

  try {
    const sanitized = url.split('?')[0]?.split('#')[0] ?? url;
    const parts = sanitized.split('.');
    const ext = parts.length > 1 ? parts.pop() ?? '' : '';
    return ext.toUpperCase();
  } catch (error) {
    return '';
  }
}

function extractRecordArray(value: unknown): Record<string, unknown>[] {
  const candidates: unknown[] = [];

  if (Array.isArray(value)) {
    candidates.push(value);
  } else if (value && typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    if (Array.isArray(objectValue.data)) {
      candidates.push(objectValue.data);
    }
    if (Array.isArray(objectValue.items)) {
      candidates.push(objectValue.items);
    }
  }

  for (const candidate of candidates) {
    const normalized = normalizeRecordArray(candidate);
    if (normalized.length) {
      return normalized;
    }
  }

  return [];
}

function normalizeRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is Record<string, unknown> => {
    return Boolean(item) && typeof item === 'object' && !Array.isArray(item);
  }) as Record<string, unknown>[];
}

function collectColumns(rows: Record<string, unknown>[]): string[] {
  const columnSet = new Set<string>();

  rows.forEach((row) => {
    Object.keys(row).forEach((key) => columnSet.add(key));
  });

  return Array.from(columnSet);
}
