import type { ExportFilters, ExportTemplateItem } from '@/types/app-state';
import { TEMPLATE_CREATE_ACTION, TEMPLATE_UPDATE_ACTION } from '@/api/templates';

export type TemplateRequestValue = string | number | boolean | Array<string | number>;

export function serializeFiltersForTemplate(filters: ExportFilters): Record<string, TemplateRequestValue> {
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

export function mapTemplateFromResponse(
  data: Record<string, unknown>,
  fallback: { id: string; name: string }
): ExportTemplateItem {
  const id = (() => {
    if (typeof data.id === 'string') {
      const trimmed = data.id.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }

    if (typeof data.id === 'number' && Number.isFinite(data.id)) {
      return String(data.id);
    }

    return fallback.id;
  })();
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

export function mergeTemplateItems(items: ExportTemplateItem[], updated: ExportTemplateItem): ExportTemplateItem[] {
  const filtered = items.filter((item) => item.id !== updated.id);
  const merged = [...filtered, updated];

  return merged.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export function resolveTemplateAction(mode: 'create' | 'update'): typeof TEMPLATE_CREATE_ACTION | typeof TEMPLATE_UPDATE_ACTION {
  return mode === 'update' ? TEMPLATE_UPDATE_ACTION : TEMPLATE_CREATE_ACTION;
}
