import type { DateRange, ExportFilters, ExportTemplateItem, HistoryRun, NumericRange, StockFilters } from '@/types/app-state';
import type { TemplateRequestValue } from '@/utils/templates';

type PartialFilters = Partial<ExportFilters> & Record<string, unknown>;

function addValue(payload: Record<string, TemplateRequestValue>, key: string, value: unknown): void {
  if (value === null || value === undefined) {
    return;
  }

  const stringValue = String(value);

  if (stringValue.trim() === '') {
    return;
  }

  payload[key] = stringValue;
}

function addArray(payload: Record<string, TemplateRequestValue>, key: string, values: unknown): void {
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
}

function addRange(
  payload: Record<string, TemplateRequestValue>,
  prefix: string,
  range: Partial<NumericRange> | undefined
): void {
  if (!range) {
    return;
  }

  if (range.min !== null && range.min !== undefined) {
    addValue(payload, `${prefix}_min`, range.min);
  }

  if (range.max !== null && range.max !== undefined) {
    addValue(payload, `${prefix}_max`, range.max);
  }
}

function addDateRange(
  payload: Record<string, TemplateRequestValue>,
  prefix: string,
  range: Partial<DateRange> | undefined
): void {
  if (!range) {
    return;
  }

  if (range.from) {
    addValue(payload, `${prefix}_from`, range.from);
  }

  if (range.to) {
    addValue(payload, `${prefix}_to`, range.to);
  }
}

export function serializeFiltersForTemplate(filters?: PartialFilters): Record<string, TemplateRequestValue> {
  const payload: Record<string, TemplateRequestValue> = {};
  const data = filters ?? {};

  addValue(payload, 'filter_category', data.category);
  addValue(payload, 'filter_brand', data.brand);

  const priceFilters = (data.price ?? {}) as Partial<{ regular: NumericRange; sale: NumericRange }>;
  addRange(payload, 'filter_regular_price', priceFilters.regular);
  addRange(payload, 'filter_sale_price', priceFilters.sale);

  const stockFilters = (data.stock ?? {}) as Partial<StockFilters>;
  addRange(payload, 'filter_stock', stockFilters);

  if (stockFilters.only_in_stock) {
    payload.filter_stock_only_in_stock = 1;
  }

  if (stockFilters.only_zero) {
    payload.filter_stock_only_zero = 1;
  }

  addDateRange(payload, 'filter_created', data.date_created as Partial<DateRange> | undefined);
  addDateRange(payload, 'filter_modified', data.date_modified as Partial<DateRange> | undefined);

  addValue(payload, 'filter_discount_mode', data.discount_mode);
  addValue(payload, 'filter_image_mode', data.image_mode);
  addValue(payload, 'filter_reviews_mode', data.reviews_mode);

  if (typeof data.description_search === 'string' && data.description_search.trim() !== '') {
    addValue(payload, 'filter_description_search', data.description_search.trim());
  }

  addArray(payload, 'filter_exclude_categories', data.exclude_categories);
  addArray(payload, 'filter_exclude_tags', data.exclude_tags);

  if (data.condition_groups && typeof data.condition_groups === 'object') {
    try {
      const encoded = JSON.stringify(data.condition_groups);
      if (encoded && encoded !== '{}') {
        payload.filter_condition_groups = encoded;
      }
    } catch (error) {
      // ignore malformed structures
    }
  }

  return payload;
}

export function mapTemplateFromResponse(
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

  const filters = data.filters && typeof data.filters === 'object'
    ? (data.filters as Record<string, unknown>)
    : {};

  const format = typeof data.format === 'string' ? data.format : undefined;
  const settings = data.settings && typeof data.settings === 'object'
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

export function mergeTemplateItems(items: ExportTemplateItem[], updated: ExportTemplateItem): ExportTemplateItem[] {
  const filtered = items.filter((item) => item.id !== updated.id);
  const merged = [...filtered, updated];

  return merged.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

const DEFAULT_DELIMITER = ',';
const DEFAULT_ENCODING = 'UTF-8';
const DEFAULT_FILENAME = 'wc-products-export-{{date}}';
const DEFAULT_FORMAT = 'csv';
const SUPPORTED_DELIMITERS = [DEFAULT_DELIMITER, ';', '\t', '|'];
const SUPPORTED_ENCODINGS = [DEFAULT_ENCODING, 'Windows-1251', 'ISO-8859-1'];

function sanitizeDelimiter(value: unknown): string {
  if (typeof value !== 'string') {
    return DEFAULT_DELIMITER;
  }

  return SUPPORTED_DELIMITERS.includes(value) ? value : DEFAULT_DELIMITER;
}

function sanitizeEncoding(value: unknown): string {
  if (typeof value !== 'string') {
    return DEFAULT_ENCODING;
  }

  const normalized = value.toUpperCase();

  return SUPPORTED_ENCODINGS.includes(normalized) ? normalized : DEFAULT_ENCODING;
}

function sanitizeFormat(value: unknown): string {
  if (typeof value !== 'string') {
    return DEFAULT_FORMAT;
  }

  const normalized = value.trim().toLowerCase();

  return normalized !== '' ? normalized : DEFAULT_FORMAT;
}

function buildFilename(value: unknown): string {
  if (typeof value !== 'string') {
    return DEFAULT_FILENAME;
  }

  const trimmed = value.trim();

  return trimmed !== '' ? trimmed : DEFAULT_FILENAME;
}

function normalizeAttachImagesFlag(value: unknown): 0 | 1 {
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  if (typeof value === 'number') {
    return value > 0 ? 1 : 0;
  }

  if (typeof value === 'string') {
    return value === '1' || value.toLowerCase() === 'true' ? 1 : 0;
  }

  return 0;
}

function normalizeFields(fields: unknown): string[] {
  if (!Array.isArray(fields)) {
    return [];
  }

  const clean = fields
    .map((field) => (typeof field === 'string' ? field.trim() : String(field)))
    .filter((field) => field.length > 0);

  return Array.from(new Set(clean));
}

export interface TemplateSettingsPayload {
  delimiter: string;
  encoding: string;
  filename: string;
  attach_images_zip: 0 | 1;
}

export interface ExtractedTemplateConfig {
  fields: string[];
  filters: Record<string, TemplateRequestValue>;
  format: string;
  settings: TemplateSettingsPayload;
}

export function extractTemplateDataFromRun(run: HistoryRun): ExtractedTemplateConfig {
  const fields = normalizeFields(run.fields);
  const settings = run.settings && typeof run.settings === 'object' ? run.settings : {};

  const filtersPayload = serializeFiltersForTemplate((run.filters ?? {}) as PartialFilters);

  const formatFromRun = typeof run.file_format === 'string' ? run.file_format : (settings.format as string | undefined);

  return {
    fields,
    filters: filtersPayload,
    format: sanitizeFormat(formatFromRun),
    settings: {
      delimiter: sanitizeDelimiter((settings as Record<string, unknown>).delimiter),
      encoding: sanitizeEncoding((settings as Record<string, unknown>).encoding),
      filename: buildFilename((settings as Record<string, unknown>).filename),
      attach_images_zip: normalizeAttachImagesFlag((settings as Record<string, unknown>).attach_images_zip),
    },
  };
}

export function buildTemplateRequestFromRun(
  run: HistoryRun,
  basePayload: Record<string, TemplateRequestValue>
): Record<string, TemplateRequestValue> {
  const config = extractTemplateDataFromRun(run);
  const payload: Record<string, TemplateRequestValue> = {
    ...basePayload,
  };

  payload.fields = config.fields;
  payload.fields_order = JSON.stringify(config.fields);
  payload.export_format = config.format;
  payload.export_delimiter = config.settings.delimiter;
  payload.export_encoding = config.settings.encoding;
  payload.export_filename = config.settings.filename;

  if (config.settings.attach_images_zip) {
    payload.export_attach_images_zip = 1;
  }

  Object.entries(config.filters).forEach(([key, value]) => {
    payload[key] = value;
  });

  return payload;
}
