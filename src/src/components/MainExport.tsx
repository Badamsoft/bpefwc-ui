import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Download, Save, Eye, RotateCcw } from 'lucide-react';
import { useAppState } from '@/context/AppStateContext';
import { useNotifications } from '@/hooks/useNotifications';
import { FieldSelector } from './export/FieldSelector';
import { ExportBuilder } from './export/ExportBuilder';
import { FiltersPanel } from './export/FiltersPanel';
import { PreviewModal } from './modals/PreviewModal';
import { SaveTemplateModal } from './modals/SaveTemplateModal';
import { buildFieldSections, buildSelectedFieldList } from '@/utils/field-sections';
import { saveTemplate, TEMPLATE_CREATE_ACTION, TEMPLATE_UPDATE_ACTION } from '@/api/templates';
import type { ExportFilters, ExportTemplateItem } from '@/types/app-state';
import { useHint } from '@/context/HintContext';

type TemplateRequestValue = string | number | boolean | Array<string | number>;

type PreviewPayload = Record<string, string | string[]>;

interface StatusMessage {
  type: 'success' | 'error';
  text: string;
}

const DEFAULT_FILENAME_PATTERN = 'wc-products-export-{{date}}';
const DEFAULT_FORMAT_KEY = 'csv';

const createEmptyFilters = (): ExportFilters => ({
  category: 0,
  brand: 0,
  price: {
    regular: { min: null, max: null },
    sale: { min: null, max: null },
  },
  stock: { min: null, max: null, only_in_stock: false, only_zero: false },
  date_created: { from: null, to: null },
  date_modified: { from: null, to: null },
  relative_date_created: null,
  relative_date_modified: null,
  discount_mode: '',
  image_mode: '',
  reviews_mode: '',
  description_search: '',
  exclude_categories: [],
  exclude_tags: [],
  condition_groups: { relation: 'AND', groups: [] },
  behavior: {
    requireImages: false,
    requireFields: [],
    requireActions: [],
    requireConditions: [],
    excludeMissingFields: [],
  },
});

const resolveDefaultFormat = (
  formatOptions?: Record<string, string>,
  preferredFormat?: string
): string => {
  if (formatOptions && typeof formatOptions === 'object') {
    if (preferredFormat) {
      if (preferredFormat === 'xml' && 'xml_universal' in formatOptions) {
        return 'xml_universal';
      }

      if (preferredFormat in formatOptions) {
        return preferredFormat;
      }
    }

    if ('csv' in formatOptions) {
      return 'csv';
    }

    const csvKey = Object.keys(formatOptions).find((key) => key.toLowerCase() === 'csv');
    if (csvKey) {
      return csvKey;
    }

    const [first] = Object.keys(formatOptions);
    if (first) {
      return first;
    }
  }

  return DEFAULT_FORMAT_KEY;
};

function serializeFiltersForTemplate(filters: ExportFilters): Record<string, TemplateRequestValue> {
  const payload: Record<string, TemplateRequestValue> = {};

  const addValue = (key: string, value: unknown) => {
    if (value === null || value === undefined) {
      return;
    }

    const stringValue = String(value);

    if (stringValue === '') {
      return;
    }

    payload[key] = stringValue;
  };

  const addArray = (key: string, values?: Array<number | string>) => {
    if (!Array.isArray(values) || values.length === 0) {
      return;
    }

    const normalized = values
      .map((entry) => {
        if (typeof entry === 'number' && Number.isFinite(entry)) {
          return String(entry);
        }

        if (typeof entry === 'string') {
          const trimmed = entry.trim();
          return trimmed === '' ? null : trimmed;
        }

        return null;
      })
      .filter((entry): entry is string => entry !== null);

    if (normalized.length > 0) {
      payload[key] = normalized;
    }
  };

  const addRange = (prefix: string, range?: { min: number | null; max: number | null }) => {
    if (!range) {
      return;
    }

    if (range.min !== null && range.min !== undefined) {
      addValue(`${prefix}_min`, range.min);
    }

    if (range.max !== null && range.max !== undefined) {
      addValue(`${prefix}_max`, range.max);
    }
  };

  const addDateRange = (prefix: string, range?: { from: string | null; to: string | null }) => {
    if (!range) {
      return;
    }

    if (range.from) {
      addValue(`${prefix}_from`, range.from);
    }

    if (range.to) {
      addValue(`${prefix}_to`, range.to);
    }
  };

  addValue('filter_category', filters.category);
  addValue('filter_brand', filters.brand);

  addRange('filter_regular_price', filters.price?.regular);
  addRange('filter_sale_price', filters.price?.sale);

  const stockRange = {
    min: filters.stock?.min ?? null,
    max: filters.stock?.max ?? null,
  };

  addRange('filter_stock', stockRange);

  if (filters.stock?.only_in_stock) {
    payload.filter_stock_only_in_stock = 1;
  }

  if (filters.stock?.only_zero) {
    payload.filter_stock_only_zero = 1;
  }

  addDateRange('filter_created', filters.date_created);
  addDateRange('filter_modified', filters.date_modified);

  addValue('filter_discount_mode', filters.discount_mode);
  addValue('filter_image_mode', filters.image_mode);
  addValue('filter_reviews_mode', filters.reviews_mode);

  const description = typeof filters.description_search === 'string' ? filters.description_search.trim() : '';

  if (description !== '') {
    payload.filter_description_search = description;
  }

  addArray('filter_exclude_categories', filters.exclude_categories);
  addArray('filter_exclude_tags', filters.exclude_tags);

  if (filters.condition_groups?.groups?.length) {
    try {
      payload.filter_condition_groups = JSON.stringify(filters.condition_groups);
    } catch (error) {
      // ignore serialization issues
    }
  }

  return payload;
}

function mapTemplateFromResponse(
  data: Record<string, unknown>,
  fallback: { id: string; name: string }
): ExportTemplateItem {
  const id = typeof data.id === 'string' && data.id.length > 0 ? data.id : fallback.id;
  const name = typeof data.name === 'string' && data.name.length > 0 ? data.name : fallback.name;
  const description = typeof data.description === 'string' && data.description.length > 0 ? data.description : undefined;
  const updated_at = typeof data.updated_at === 'string' ? data.updated_at : undefined;

  const fields = Array.isArray(data.fields)
    ? (data.fields as unknown[]).map((field) => String(field))
    : [];

  const filters = (data.filters && typeof data.filters === 'object')
    ? (data.filters as Record<string, unknown>)
    : {};

  const format = typeof data.format === 'string' ? data.format : undefined;
  const settings = (data.settings && typeof data.settings === 'object')
    ? (data.settings as Record<string, unknown>)
    : {};

  return {
    id,
    name,
    description,
    updated_at,
    fields,
    filters,
    format,
    settings,
  };
}

function mergeTemplateItems(items: ExportTemplateItem[], updated: ExportTemplateItem): ExportTemplateItem[] {
  const filtered = items.filter((item) => item.id !== updated.id);
  const merged = [...filtered, updated];

  return merged.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

interface MainExportProps {
  pendingAction?: 'open-save-template' | null;
  onActionConsumed?: () => void;
}

const cloneExportFilters = (filters: ExportFilters): ExportFilters => {
  try {
    return JSON.parse(JSON.stringify(filters)) as ExportFilters;
  } catch (error) {
    return filters;
  }
};

interface InitialExportConfig {
  filters: ExportFilters;
  format: string;
  fileSettings: {
    delimiter: string;
    encoding: string;
    attach_images_zip: boolean;
    filename: string;
    [key: string]: unknown;
  };
  fields: string[];
}

export function MainExport({ pendingAction, onActionConsumed }: MainExportProps): ReactElement {
  const { state, setState } = useAppState();
  const getString = (key: string, fallback: string): string => {
    const raw = state.strings?.[key];
    return typeof raw === 'string' ? raw : fallback;
  };
  const { notify } = useNotifications();
  const exportState = state.export;
  const mediaState = state.media;
  const defaultFiltersSnapshot = useMemo(
    () => cloneExportFilters(exportState.defaultFilters ?? createEmptyFilters()),
    [exportState.defaultFilters]
  );
  const generalDefaultFormat = state.settings.general.defaultExportFormat;
  const defaultFormatKey = useMemo(
    () => resolveDefaultFormat(exportState.formatOptions, generalDefaultFormat),
    [exportState.formatOptions, generalDefaultFormat]
  );
  const fieldSections = useMemo(() => buildFieldSections(exportState), [exportState]);
  const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>(exportState.initialFields);
  const selectedFields = useMemo(
    () => buildSelectedFieldList(exportState, selectedFieldIds),
    [exportState, selectedFieldIds]
  );
  const [showPreview, setShowPreview] = useState(false);
  const [previewPayload, setPreviewPayload] = useState<PreviewPayload | null>(null);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
  const [filtersState, setFiltersState] = useState<ExportFilters>(exportState.filters);
  const previewConfig = exportState.preview;
  const previewNonce = state.nonces?.preview ?? '';
  const canPreview = Boolean(previewConfig?.action && previewNonce);
  const { showHint } = useHint();
  const templateSuggestionShownRef = useRef(false);
  const imageZipHintShownRef = useRef(false);
  const previousSelectedCountRef = useRef(selectedFields.length);

  const initialFormat = exportState.selectedFormat ?? defaultFormatKey;
  const initialFileSettings = exportState.fileSettings ?? {};
  const [format, setFormat] = useState<string>(initialFormat);
  const [delimiter, setDelimiter] = useState<string>(
    typeof initialFileSettings.delimiter === 'string' ? initialFileSettings.delimiter : ','
  );
  const [encoding, setEncoding] = useState<string>(
    typeof initialFileSettings.encoding === 'string' ? initialFileSettings.encoding : 'UTF-8'
  );
  const [attachImagesZip, setAttachImagesZip] = useState<boolean>(
    Boolean(initialFileSettings.attach_images_zip)
  );
  const mediaZipEnabled = Boolean(mediaState.tiles.zip);

  const manualExportNonce = state.nonces?.manualExport ?? '';
  const canManualExport = Boolean(state.capabilities?.prodexfo_access_manual_export);
  const templatesNonce = state.nonces?.templates ?? '';
  const ajaxUrl = state.urls?.ajax ?? '';
  const templateState = exportState.templates;
  const canManageTemplates = Boolean(state.capabilities?.prodexfo_access_templates);
  const templateItems = templateState?.items ?? [];

  const ensureBaseline = useCallback((): InitialExportConfig => {
    const config: InitialExportConfig = {
      filters: cloneExportFilters(defaultFiltersSnapshot),
      format: defaultFormatKey,
      fileSettings: {
        delimiter: ',',
        encoding: 'UTF-8',
        attach_images_zip: false,
        filename: DEFAULT_FILENAME_PATTERN,
      },
      fields: [],
    };

    return config;
  }, [defaultFiltersSnapshot, defaultFormatKey]);

  const filename =
    typeof initialFileSettings.filename === 'string'
      ? initialFileSettings.filename
      : DEFAULT_FILENAME_PATTERN;

  const resetToInitialState = useCallback((): void => {
    const baseline = ensureBaseline();

    setFiltersState(cloneExportFilters(baseline.filters));
    setSelectedFieldIds(baseline.fields);
    setFormat(baseline.format);
    setDelimiter(typeof baseline.fileSettings.delimiter === 'string' ? baseline.fileSettings.delimiter : ',');
    setEncoding(typeof baseline.fileSettings.encoding === 'string' ? baseline.fileSettings.encoding : 'UTF-8');
    setAttachImagesZip(Boolean(baseline.fileSettings.attach_images_zip));

    setState((prev) => ({
      ...prev,
      export: {
        ...prev.export,
        filters: cloneExportFilters(baseline.filters),
        selectedFormat: baseline.format,
        fileSettings: {
          ...prev.export.fileSettings,
          ...baseline.fileSettings,
        },
        initialFields: baseline.fields,
        templates: prev.export.templates
          ? { ...prev.export.templates, editing: null }
          : prev.export.templates,
        pendingReset: false,
      },
    }));

    setStatusMessage(null);
  }, [ensureBaseline, setState]);

  useEffect(() => {
    const previousCount = previousSelectedCountRef.current;
    const currentCount = selectedFields.length;

    if (currentCount >= 10 && previousCount < 10 && !templateSuggestionShownRef.current) {
      showHint({
        id: 'template-suggestion-hint',
        title: getString('exportTemplateHintTitle', 'Save a template'),
        description: getString(
          'exportTemplateHintDescription',
          'You selected many columns—save them as a template to avoid reconfiguration.'
        ),
        variant: 'info',
      });
      templateSuggestionShownRef.current = true;
    }

    previousSelectedCountRef.current = currentCount;
  }, [selectedFields.length, showHint]);

  useEffect(() => {
    if (attachImagesZip && !imageZipHintShownRef.current) {
      showHint({
        id: 'attachment-zip-hint',
        title: getString('exportImagesZipHintTitle', 'Images archive'),
        description: getString(
          'exportImagesZipHintDescription',
          'Adding an images ZIP increases export size—make sure mail/FTP can handle it.'
        ),
        variant: 'warning',
      });
      imageZipHintShownRef.current = true;
    }
  }, [attachImagesZip, showHint]);

  useEffect(() => {
    if (state.export.pendingReset) {
      resetToInitialState();
      return;
    }

    const editingTemplateId = state.export.templates?.editing?.templateId;

    if (!editingTemplateId) {
      return;
    }

    const templateItem = templateItems.find((item) => item.id === editingTemplateId);

    if (!templateItem) {
      setState((prev) => ({
        ...prev,
        export: {
          ...prev.export,
          templates: prev.export.templates
            ? { ...prev.export.templates, editing: null }
            : prev.export.templates,
        },
      }));

      setStatusMessage({
        type: 'error',
        text: getString('exportTemplateNotFound', 'Template data not found. It may have been removed.'),
      });

      return;
    }

    const nextFields = Array.isArray(templateItem.fields) && templateItem.fields.length > 0
      ? templateItem.fields
      : [];

    setSelectedFieldIds(nextFields);

    const serializedFilters = templateItem.filters;

    if (serializedFilters && typeof serializedFilters === 'object') {
      setFiltersState((prevFilters) => {
        const mergedFilters = {
          ...prevFilters,
          ...serializedFilters,
        } as ExportFilters;

        setState((prev) => ({
          ...prev,
          export: {
            ...prev.export,
            filters: mergedFilters,
          },
        }));

        return mergedFilters;
      });
    }

    if (templateItem.format && typeof templateItem.format === 'string') {
      setFormat(templateItem.format);
    }

    const templateSettings = templateItem.settings ?? {};

    if (typeof templateSettings.delimiter === 'string') {
      setDelimiter(templateSettings.delimiter);
    }

    if (typeof templateSettings.encoding === 'string') {
      setEncoding(templateSettings.encoding);
    }

    if (typeof templateSettings.filename === 'string' && templateSettings.filename.trim() !== '') {
      setState((prev) => ({
        ...prev,
        export: {
          ...prev.export,
          fileSettings: {
            ...prev.export.fileSettings,
            filename: templateSettings.filename,
          },
        },
      }));
    }

    const nextAttach = Boolean(templateSettings.attach_images_zip);
    setAttachImagesZip(nextAttach);

    const templateLoadedMessageTemplate = getString(
      'exportTemplateLoadedWithName',
      'Template "%s" loaded. Adjust settings before exporting if needed.'
    );

    setStatusMessage({
      type: 'success',
      text: templateLoadedMessageTemplate.replace('%s', templateItem.name),
    });

    setState((prev) => ({
      ...prev,
      export: {
        ...prev.export,
        templates: prev.export.templates
          ? { ...prev.export.templates, editing: null }
          : prev.export.templates,
      },
    }));
  }, [state.export.pendingReset, state.export.templates?.editing?.templateId, templateItems, resetToInitialState, setState]);

  const handleResetClick = (): void => {
    resetToInitialState();
  };

  const updateFilters = (updater: ((prev: ExportFilters) => ExportFilters) | ExportFilters): void => {
    setFiltersState((prev) => {
      const next = typeof updater === 'function' ? (updater as (filters: ExportFilters) => ExportFilters)(prev) : updater;

      setState((current) => ({
        ...current,
        export: {
          ...current.export,
          filters: next,
        },
      }));

      return next;
    });
  };

  const addField = (fieldId: string): void => {
    if (!fieldId) {
      return;
    }

    setSelectedFieldIds((prev) => (prev.includes(fieldId) ? prev.filter((id) => id !== fieldId) : [...prev, fieldId]));
  };

  const removeField = (fieldId: string): void => {
    setSelectedFieldIds((prev) => prev.filter((id) => id !== fieldId));
  };

  const reorderFields = (fromIndex: number, toIndex: number): void => {
    setSelectedFieldIds((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
  };

  const buildPreviewPayload = useCallback((): PreviewPayload | null => {
    if (!previewConfig || !previewConfig.action || !previewNonce) {
      return null;
    }

    const payload: PreviewPayload = {};

    const addValue = (name: string, value: string | number | null | undefined) => {
      if (value === null || value === undefined) {
        return;
      }

      const stringValue = String(value);

      if (stringValue === '') {
        return;
      }

      payload[name] = stringValue;
    };

    const addArray = (name: string, values: Array<string | number>) => {
      if (!values.length) {
        return;
      }

      payload[name] = values.map((entry) => String(entry));
    };

    addArray('fields[]', selectedFieldIds);
    payload['fields_order'] = JSON.stringify(selectedFieldIds);

    const { category, brand, price, stock, date_created, date_modified, discount_mode, image_mode, reviews_mode, description_search, exclude_categories, exclude_tags, condition_groups } = filtersState;

    if (category) {
      addValue('filter_category', category);
    }

    if (brand) {
      addValue('filter_brand', brand);
    }

    const addRange = (prefix: string, range?: { min: number | null; max: number | null }) => {
      if (!range) {
        return;
      }

      if (range.min !== null && range.min !== undefined) {
        addValue(`${prefix}_min`, range.min);
      }

      if (range.max !== null && range.max !== undefined) {
        addValue(`${prefix}_max`, range.max);
      }
    };

    addRange('filter_regular_price', price?.regular);
    addRange('filter_sale_price', price?.sale);

    addRange('filter_stock', stock);

    if (stock?.only_in_stock) {
      addValue('filter_stock_only_in_stock', 1);
    }

    if (stock?.only_zero) {
      addValue('filter_stock_only_zero', 1);
    }

    const addDateRange = (prefix: string, range?: { from: string | null; to: string | null }) => {
      if (!range) {
        return;
      }

      if (range.from) {
        addValue(`${prefix}_from`, range.from);
      }

      if (range.to) {
        addValue(`${prefix}_to`, range.to);
      }
    };

    addDateRange('filter_created', date_created);
    addDateRange('filter_modified', date_modified);

    if (discount_mode) {
      addValue('filter_discount_mode', discount_mode);
    }

    if (image_mode) {
      addValue('filter_image_mode', image_mode);
    }

    if (reviews_mode) {
      addValue('filter_reviews_mode', reviews_mode);
    }

    if (description_search.trim() !== '') {
      addValue('filter_description_search', description_search.trim());
    }

    addArray('filter_exclude_categories[]', exclude_categories);
    addArray('filter_exclude_tags[]', exclude_tags);

    if (condition_groups?.groups?.length) {
      try {
        payload['filter_condition_groups'] = JSON.stringify(condition_groups);
      } catch (error) {
        // ignore serialization issues
      }
    }

    const limit = previewConfig.limit ?? 20;
    addValue('limit', limit);
    addValue('action', previewConfig.action);
    addValue('nonce', previewNonce);

    return payload;
  }, [filtersState, previewConfig, previewNonce, selectedFieldIds]);

  const handleOpenPreview = (): void => {
    if (!canPreview || selectedFieldIds.length === 0) {
      return;
    }

    const payload = buildPreviewPayload();

    if (!payload) {
      return;
    }

    setPreviewPayload(payload);
    setShowPreview(true);
  };

  const handleClosePreview = (): void => {
    setShowPreview(false);
    setPreviewPayload(null);
  };

  const submitManualExportForm = (): void => {
    showHint({
      id: `manual-export-start-${Date.now()}`,
      title: getString('exportInProgressTitle', 'Export in progress'),
      description: getString(
        'exportInProgressDescription',
        'We are generating the file. Download will start automatically—please keep the tab open.'
      ),
      variant: 'success',
    });

    const form = document.createElement('form');
    form.method = 'post';
    form.action = window.location.href.split('#')[0] ?? window.location.href;
    form.style.display = 'none';

    const appendInput = (name: string, value: string | number) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = String(value);
      form.appendChild(input);
    };

    appendInput('wc_product_csv_export', 1);
    appendInput('woocommerce_product_exporter_nonce', manualExportNonce);
    appendInput('prodexfo_manual_export_nonce', manualExportNonce);

    const referer = window.location.pathname + window.location.search;
    appendInput('_wp_http_referer', referer);

    selectedFieldIds.forEach((fieldId) => appendInput('fields[]', fieldId));

    appendInput('export_format', format);
    appendInput('export_delimiter', delimiter);
    appendInput('export_encoding', encoding);
    appendInput('export_filename', filename);

    if (attachImagesZip) {
      appendInput('export_attach_images_zip', 1);
    }

    const asInt = (value: unknown): number | null => {
      if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
      }

      if (typeof value === 'string' && value !== '') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      }

      return null;
    };

    const asString = (value: unknown): string | null => {
      if (typeof value === 'string' && value !== '') {
        return value;
      }

      return null;
    };

    const addRange = (prefix: string, range: unknown) => {
      if (typeof range !== 'object' || range === null) {
        return;
      }

      const { min, max } = range as Record<string, unknown>;

      const minValue = asString(min) ?? (asInt(min) ?? null);
      const maxValue = asString(max) ?? (asInt(max) ?? null);

      if (minValue !== null) {
        appendInput(prefix + '_min', minValue);
      }

      if (maxValue !== null) {
        appendInput(prefix + '_max', maxValue);
      }
    };

    const addDateRange = (prefix: string, range: unknown) => {
      if (typeof range !== 'object' || range === null) {
        return;
      }

      const { from, to } = range as Record<string, unknown>;

      const fromValue = asString(from);
      const toValue = asString(to);

      if (fromValue) {
        appendInput(prefix + '_from', fromValue);
      }

      if (toValue) {
        appendInput(prefix + '_to', toValue);
      }
    };

    const maybeAppend = (name: string, value: unknown) => {
      const str = asString(value);

      if (str !== null) {
        appendInput(name, str);
      }
    };

    const maybeAppendInt = (name: string, value: unknown) => {
      const intValue = asInt(value);

      if (intValue !== null) {
        appendInput(name, intValue);
      }
    };

    maybeAppendInt('filter_category', filtersState.category ?? null);
    maybeAppendInt('filter_brand', filtersState.brand ?? null);

    const priceFilters = filtersState.price;
    addRange('filter_regular_price', priceFilters?.regular);
    addRange('filter_sale_price', priceFilters?.sale);

    const stockFilters = filtersState.stock;
    addRange('filter_stock', { min: stockFilters?.min ?? null, max: stockFilters?.max ?? null });
    if (stockFilters && stockFilters.only_in_stock) {
      appendInput('filter_stock_only_in_stock', 1);
    }
    if (stockFilters && stockFilters.only_zero) {
      appendInput('filter_stock_only_zero', 1);
    }

    addDateRange('filter_created', filtersState.date_created);
    addDateRange('filter_modified', filtersState.date_modified);

    maybeAppend('filter_discount_mode', filtersState.discount_mode);
    maybeAppend('filter_image_mode', filtersState.image_mode);
    maybeAppend('filter_reviews_mode', filtersState.reviews_mode);
    maybeAppend('filter_description_search', filtersState.description_search);

    filtersState.exclude_categories.forEach((category) => {
      const cleaned = asInt(category);
      if (cleaned !== null) {
        appendInput('filter_exclude_categories[]', cleaned);
      }
    });

    filtersState.exclude_tags.forEach((tag) => {
      const cleaned = asInt(tag);
      if (cleaned !== null) {
        appendInput('filter_exclude_tags[]', cleaned);
      }
    });

    if (filtersState.condition_groups !== undefined) {
      try {
        appendInput('filter_condition_groups', JSON.stringify(filtersState.condition_groups));
      } catch (error) {
        // ignore
      }
    }

    notify('exportComplete', getString('exportStartNotification', 'Manual export started. The file download will begin shortly.'), {
      severity: 'success',
      persist: false,
    });

    document.body.appendChild(form);
    form.submit();
  };

  const showExportError = (message: string): void => {
    setStatusMessage({ type: 'error', text: message });
    notify('exportError', message, { severity: 'error', persist: false });
  };

  const handleExport = (): void => {
    setStatusMessage(null);

    if (!canManualExport) {
      const message = getString('exportPermissionError', 'You do not have permission to run manual exports.');
      showExportError(message);
      return;
    }

    if (!manualExportNonce) {
      const message = getString('exportNonceMissingError', 'Export nonce is missing. Please reload the page.');
      showExportError(message);
      return;
    }

    if (selectedFieldIds.length === 0) {
      const message = getString('exportNoFieldsError', 'Select at least one field before exporting.');
      showExportError(message);
      return;
    }

    if (typeof window === 'undefined' || typeof document === 'undefined') {
      const message = getString('exportEnvironmentError', 'Manual export is not available in this environment.');
      showExportError(message);
      return;
    }

    submitManualExportForm();
  };

  const openSaveTemplateModal = (): void => {
    setStatusMessage(null);

    if (!canManageTemplates) {
      setStatusMessage({
        type: 'error',
        text: getString('templatePermissionError', 'You do not have permission to manage templates.'),
      });
      return;
    }

    if (!templatesNonce || !ajaxUrl) {
      setStatusMessage({
        type: 'error',
        text: getString('templateEndpointUnavailable', 'Template save endpoint unavailable. Please refresh the page.'),
      });
      return;
    }

    setShowSaveTemplate(true);
  };

  useEffect(() => {
    if (pendingAction === 'open-save-template') {
      openSaveTemplateModal();
      onActionConsumed?.();
    }
  }, [pendingAction, onActionConsumed]);
  const handleSaveTemplate = async ({ name, templateId }: { name: string; templateId?: string }): Promise<void> => {
    if (!templatesNonce || !ajaxUrl) {
      throw new Error(
        getString('templateAjaxUnavailable', 'Template AJAX endpoint unavailable. Please refresh the page.'),
      );
    }

    if (selectedFieldIds.length === 0) {
      throw new Error(
        getString('templateNoColumnsError', 'Select at least one column before saving a template.'),
      );
    }

    const trimmedName = name.trim();
    const normalizedName = trimmedName.toLowerCase();
    const itemsForLookup = templateState?.items ?? [];
    const exactMatch = itemsForLookup.find((item) => item.name.toLowerCase() === normalizedName);
    const mode: 'create' | 'update' = templateId ? 'update' : exactMatch ? 'update' : 'create';
    const existingTemplate = templateId ? itemsForLookup.find((item) => item.id === templateId) : exactMatch;
    const resolvedTemplateId = existingTemplate?.id ?? templateId ?? '';

    const payload: Record<string, TemplateRequestValue> = {
      action: mode === 'update' ? TEMPLATE_UPDATE_ACTION : TEMPLATE_CREATE_ACTION,
      nonce: templatesNonce,
      template_name: trimmedName,
      template_description: existingTemplate?.description ?? '',
    };

    if (mode === 'update' && resolvedTemplateId) {
      payload.template_id = resolvedTemplateId;
    }

    payload.fields = selectedFieldIds;
    payload.fields_order = JSON.stringify(selectedFieldIds);
    payload.export_format = format;
    payload.export_delimiter = delimiter;
    payload.export_encoding = encoding;
    payload.export_filename = filename;

    if (attachImagesZip) {
      payload.export_attach_images_zip = 1;
    }

    const filterPayload = serializeFiltersForTemplate(filtersState);
    Object.entries(filterPayload).forEach(([key, value]) => {
      payload[key] = value;
    });

    setStatusMessage(null);

    try {
      const response = await saveTemplate(ajaxUrl, payload);

      if (!response || !response.success) {
        throw new Error(getString('templateSaveFailed', 'Failed to save template.'));
      }

      const templatePayload = response.data?.data ?? response.data?.template ?? {};
      const mappedTemplate = mapTemplateFromResponse(templatePayload, {
        id: resolvedTemplateId || (typeof templatePayload.id === 'string' ? templatePayload.id : ''),
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

      setStatusMessage({
        type: 'success',
        text:
          mode === 'update'
            ? getString('templateUpdated', 'Template updated.')
            : getString('templateSaved', 'Template saved.'),
      });

      setShowSaveTemplate(false);

      showHint({
        id: `template-saved-${Date.now()}`,
        title: getString('templateSavedHintTitle', 'Template saved'),
        description: getString(
          'templateSavedHintDescription',
          'The template is available on the Templates tab for quick reuse.',
        ),
        variant: 'success',
      });
    } catch (error) {
      const fallbackMessage = getString('templateSaveFailed', 'Failed to save template.');
      const message = error instanceof Error && error.message ? error.message : fallbackMessage;

      setStatusMessage({ type: 'error', text: message });
      throw (error instanceof Error ? error : new Error(fallbackMessage));
    }
  };

  return (
    <div className="h-full flex flex-col p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-gray-900 font-semibold mb-2 page-heading">
            {getString('exportQuickTitle', 'Quick Export')}
          </h1>
          <p className="text-gray-600 page-subheading">
            {getString(
              'exportQuickSubtitle',
              'Select fields, configure filters, and export your products in seconds',
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={handleResetClick}
          className="px-4 py-2 text-sm font-medium bg-[#FF3A2E] text-white rounded-xl hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20 whitespace-nowrap"
          style={{ display: 'inline-flex', flexDirection: 'row', alignItems: 'center', columnGap: '0.5rem' }}
        >
          <RotateCcw className="w-4 h-4" />
          {getString('exportResetButton', 'Reset')}
        </button>
      </div>

      <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
        <div className="col-span-3 overflow-auto">
          <FieldSelector
            sections={fieldSections}
            selectedFieldIds={selectedFieldIds}
            onAddField={addField}
            mediaFieldsEnabled={mediaState.tiles.urls}
          />
        </div>

        <div className="col-span-6 overflow-auto">
          <ExportBuilder
            fields={selectedFields}
            onRemoveField={removeField}
            onReorderFields={reorderFields}
          />
        </div>

        <div className="col-span-3 overflow-auto">
          <FiltersPanel
            filters={filtersState}
            onFiltersChange={updateFilters}
            filterOptions={exportState.filterOptions}
            formatOptions={exportState.formatOptions}
            delimiterOptions={exportState.delimiterOptions}
            encodingOptions={exportState.encodingOptions}
            format={format}
            onFormatChange={setFormat}
            delimiter={delimiter}
            onDelimiterChange={setDelimiter}
            encoding={encoding}
            onEncodingChange={setEncoding}
            attachImagesZip={attachImagesZip}
            onAttachImagesZipChange={(next) => {
              setAttachImagesZip(next);
              setState((prev) => ({
                ...prev,
                export: {
                  ...prev.export,
                  fileSettings: {
                    ...prev.export.fileSettings,
                    attach_images_zip: next,
                  },
                },
              }));
            }}
            hasAdvancedFilters={
              Array.isArray((exportState.conditionBuilder.initial as unknown[] | undefined))
              && (exportState.conditionBuilder.initial as unknown[]).length > 0
            }
            brandFieldHint={state.strings?.brandFieldHint}
            showImagesZipControl={mediaZipEnabled}
          />
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between bg-white rounded-2xl p-4 border border-gray-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-gray-500 text-label">
              {getString('exportReadyLabel', 'Ready to export')}
            </p>
            <p className="text-gray-900">
              <span className="text-[#FF3A2E]">{selectedFields.length}</span>{' '}
              {getString('exportColumnsSelectedSuffix', 'columns selected')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenPreview}
            disabled={!canPreview || selectedFieldIds.length === 0}
            className={`px-4 py-2 rounded-xl transition-colors flex items-center gap-2 ${
              canPreview && selectedFieldIds.length > 0
                ? 'text-gray-700 hover:bg-gray-50'
                : 'text-gray-400 cursor-not-allowed bg-gray-100'
            }`}
          >
            <Eye className="w-4 h-4" />
            {getString('exportPreviewButton', 'Preview')}
          </button>
          <button
            className="px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-xl transition-colors flex items-center gap-2"
            onClick={openSaveTemplateModal}
            type="button"
          >
            <Save className="w-4 h-4" />
            {getString('exportSaveTemplateButton', 'Save as Template')}
          </button>
          <button
            onClick={handleExport}
            disabled={!canManualExport || !manualExportNonce}
            className="px-6 py-3 bg-[#FF3A2E] text-white rounded-xl hover:bg-red-600 transition-colors flex items-center gap-2 shadow-lg shadow-red-500/20"
            style={{ opacity: !canManualExport || !manualExportNonce ? 0.6 : 1 }}
            type="button"
          >
            <Download className="w-5 h-5" />
            {getString('exportNowButton', 'Export Now')}
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`mt-4 text-sm ${statusMessage.type === 'error' ? 'text-red-600' : 'text-green-600'}`}
          role="alert"
        >
          {statusMessage.text}
        </div>
      )}

      {showPreview && previewConfig && previewPayload && (
        <PreviewModal
          fields={selectedFields}
          payload={previewPayload}
          ajaxUrl={state.urls?.ajax ?? ''}
          config={previewConfig}
          nonce={previewNonce}
          onClose={handleClosePreview}
          onExport={handleExport}
        />
      )}

      {showSaveTemplate && (
        <SaveTemplateModal
          templates={templateItems}
          onClose={() => setShowSaveTemplate(false)}
          onSave={handleSaveTemplate}
          guard={
            selectedFieldIds.length === 0
              ? {
                  message: getString(
                    'templateGuardNoColumns',
                    'Add at least one column before saving a template.',
                  ),
                  type: 'error',
                  disableSave: true,
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

