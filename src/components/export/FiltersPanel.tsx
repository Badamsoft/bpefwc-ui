import { Fragment, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  FileText,
  Database,
  Filter,
  Lock,
  Image as ImageIcon,
  Circle,
  ChevronDown,
  Plus,
  X,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import type {
  ExportFilters,
  FilterOptions,
  RelativeDatePreset,
  ConditionGroupsPayload,
  BehavioralFilters,
} from '@/types/app-state';
import { useHint } from '@/context/HintContext';
import { useAppState } from '@/context/AppStateContext';

type ConditionOperator = 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'between' | 'contains';

interface ConditionFieldOption {
  value: string;
  label: string;
  operators: ConditionOperator[];
  valueType: 'number' | 'text';
}

interface BuilderCondition {
  field: string;
  operator: ConditionOperator;
  value: string;
  value_to?: string;
}

interface BuilderGroup {
  relation: 'AND' | 'OR';
  conditions: BuilderCondition[];
}

interface BuilderState {
  relation: 'AND' | 'OR';
  groups: BuilderGroup[];
}

const CONDITION_FIELD_OPTIONS: ConditionFieldOption[] = [
  { value: 'regular_price', label: 'Regular price', operators: ['gt', 'gte', 'lt', 'lte', 'between', 'eq'], valueType: 'number' },
  { value: 'sale_price', label: 'Sale price', operators: ['gt', 'gte', 'lt', 'lte', 'between', 'eq'], valueType: 'number' },
  { value: 'stock_quantity', label: 'Stock quantity', operators: ['gt', 'gte', 'lt', 'lte', 'between', 'eq'], valueType: 'number' },
  { value: 'total_sales', label: 'Total sales', operators: ['gt', 'gte', 'lt', 'lte', 'between', 'eq'], valueType: 'number' },
  { value: 'review_count', label: 'Review count', operators: ['gt', 'gte', 'lt', 'lte', 'between', 'eq'], valueType: 'number' },
  { value: 'title', label: 'Product title', operators: ['contains', 'eq', 'neq'], valueType: 'text' },
];

const CONDITION_OPERATOR_LABELS: Record<ConditionOperator, string> = {
  eq: 'equals',
  neq: 'not equal',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  between: 'between',
  contains: 'contains',
};

const RELATIVE_PRESET_OPTIONS = [
  { key: 'exact', label: 'Custom range', preset: null },
  { key: 'last7', label: 'Last 7 days', preset: { type: 'last', unit: 'days', value: 7 } as RelativeDatePreset },
  { key: 'last30', label: 'Last 30 days', preset: { type: 'last', unit: 'days', value: 30 } as RelativeDatePreset },
  { key: 'last90', label: 'Last 90 days', preset: { type: 'last', unit: 'days', value: 90 } as RelativeDatePreset },
  { key: 'since-export', label: 'Since last export', preset: { type: 'since' } as RelativeDatePreset },
];

const RELATIVE_PRESET_MAP = RELATIVE_PRESET_OPTIONS.reduce<Record<string, RelativeDatePreset | null>>((acc, entry) => {
  acc[entry.key] = entry.preset ?? null;
  return acc;
}, {});

const MISSING_FIELD_OPTIONS = [
  { value: 'sku', label: 'SKU' },
  { value: 'description', label: 'Description' },
  { value: 'image', label: 'Featured image' },
  { value: 'attributes', label: 'Attributes' },
];

interface FiltersPanelProps {
  filters: ExportFilters;
  onFiltersChange: (updater: ExportFilters | ((prev: ExportFilters) => ExportFilters)) => void;
  filterOptions: FilterOptions;
  formatOptions: Record<string, string>;
  delimiterOptions: Record<string, string>;
  encodingOptions: Record<string, string>;
  format: string;
  onFormatChange: (value: string) => void;
  delimiter: string;
  onDelimiterChange: (value: string) => void;
  encoding: string;
  onEncodingChange: (value: string) => void;
  attachImagesZip: boolean;
  onAttachImagesZipChange: (value: boolean) => void;
  hasAdvancedFilters: boolean;
  brandFieldHint?: string;
  showImagesZipControl?: boolean;
}

export function FiltersPanel({
  filters,
  onFiltersChange,
  filterOptions,
  formatOptions,
  delimiterOptions,
  encodingOptions,
  format,
  onFormatChange,
  delimiter,
  onDelimiterChange,
  encoding,
  onEncodingChange,
  attachImagesZip,
  onAttachImagesZipChange,
  hasAdvancedFilters,
  brandFieldHint,
  showImagesZipControl = true,
}: FiltersPanelProps) {
  const { showHint } = useHint();
  const { state } = useAppState();
  const isPro = Boolean(state.isProBuild);
  const getString = (key: string, fallback: string): string => {
    const raw = state.strings?.[key];
    return typeof raw === 'string' ? raw : fallback;
  };
  const hasShownIncrementalHintRef = useRef(false);
  const autoExpandedRef = useRef(false);
  const [expandedAdvanced, setExpandedAdvanced] = useState(false);
  const [conditionBuilderState, setConditionBuilderState] = useState<BuilderState>(
    normalizeConditionState(filters.condition_groups)
  );
  const [relativePresetCreated, setRelativePresetCreated] = useState<RelativeDatePreset | null>(
    filters.relative_date_created ?? null
  );
  const [relativePresetModified, setRelativePresetModified] = useState<RelativeDatePreset | null>(
    filters.relative_date_modified ?? null
  );
  const [activeSummaryExpanded, setActiveSummaryExpanded] = useState(() => {
    if (typeof window === 'undefined') {
      return true;
    }

    const stored = window.sessionStorage.getItem('prodexfo-active-summary-expanded');
    return stored === null ? true : stored === '1';
  });
  const behavior = useMemo(() => normalizeBehavior(filters.behavior), [filters.behavior]);
  const formatEntries = useMemo(() => Object.entries(formatOptions), [formatOptions]);
  const delimiterEntries = useMemo(() => Object.entries(delimiterOptions), [delimiterOptions]);
  const encodingEntries = useMemo(() => Object.entries(encodingOptions), [encodingOptions]);
  const discountEntries = useMemo(
    () => Object.entries(filterOptions.discountModes),
    [filterOptions.discountModes]
  );
  const imageEntries = useMemo(
    () => Object.entries(filterOptions.imageModes),
    [filterOptions.imageModes]
  );
  const reviewsEntries = useMemo(
    () => Object.entries(filterOptions.reviewsModes),
    [filterOptions.reviewsModes]
  );

  useEffect(() => {
    const hasDateFilters = Boolean(
      filters.date_created.from ||
        filters.date_created.to ||
        filters.date_modified.from ||
        filters.date_modified.to
    );

    if (hasDateFilters && !hasShownIncrementalHintRef.current) {
      showHint({
        id: 'incremental-exports-hint',
        title: 'Incremental exports',
        description: 'Configure schedules to export only new or updated products.',
        variant: 'info',
      });
      hasShownIncrementalHintRef.current = true;
    }
  }, [filters.date_created.from, filters.date_created.to, filters.date_modified.from, filters.date_modified.to, showHint]);

  useEffect(() => {
    setConditionBuilderState(normalizeConditionState(filters.condition_groups));
  }, [filters.condition_groups]);

  useEffect(() => {
    setRelativePresetCreated(filters.relative_date_created ?? null);
  }, [filters.relative_date_created]);

  useEffect(() => {
    setRelativePresetModified(filters.relative_date_modified ?? null);
  }, [filters.relative_date_modified]);

  useEffect(() => {
    if (autoExpandedRef.current) {
      return;
    }

    const hasAdvancedData =
      conditionBuilderState.groups.length > 0 ||
      Boolean(relativePresetCreated) ||
      Boolean(relativePresetModified) ||
      behavior.requireImages ||
      behavior.excludeMissingFields.length > 0;

    if (hasAdvancedData) {
      setExpandedAdvanced(true);
      autoExpandedRef.current = true;
    }
  }, [behavior.excludeMissingFields.length, behavior.requireImages, conditionBuilderState.groups.length, relativePresetCreated, relativePresetModified]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.sessionStorage.setItem('prodexfo-active-summary-expanded', activeSummaryExpanded ? '1' : '0');
  }, [activeSummaryExpanded]);

  const handleFiltersChange = (updater: ExportFilters | ((prev: ExportFilters) => ExportFilters)) => {
    onFiltersChange(updater);
  };

  const updateFilterField = <K extends keyof ExportFilters>(key: K, value: ExportFilters[K]) => {
    handleFiltersChange((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const updatePriceRange = (
    key: 'regular' | 'sale',
    field: 'min' | 'max',
    rawValue: string
  ) => {
    const value = rawValue === '' ? null : Number(rawValue);

    handleFiltersChange((prev) => ({
      ...prev,
      price: {
        ...prev.price,
        [key]: {
          ...prev.price[key],
          [field]: Number.isFinite(value as number) ? value : null,
        },
      },
    }));
  };

  const updateStockRange = (field: 'min' | 'max', rawValue: string) => {
    const value = rawValue === '' ? null : Number(rawValue);

    handleFiltersChange((prev) => ({
      ...prev,
      stock: {
        ...prev.stock,
        [field]: Number.isFinite(value as number) ? value : null,
      },
    }));
  };

  const toggleStockFlag = (field: 'only_in_stock' | 'only_zero', checked: boolean) => {
    handleFiltersChange((prev) => ({
      ...prev,
      stock: {
        ...prev.stock,
        [field]: checked,
      },
    }));
  };

  const updateDateRange = (key: 'date_created' | 'date_modified', field: 'from' | 'to', value: string) => {
    handleFiltersChange((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value || null,
      },
    }));
  };

  const updateMultiselect = (key: 'exclude_categories' | 'exclude_tags', values: number[]) => {
    updateFilterField(key, values);
  };

  const handleMultiSelectChange = (
    event: ChangeEvent<HTMLSelectElement>,
    key: 'exclude_categories' | 'exclude_tags'
  ) => {
    const selected = Array.from(event.target.selectedOptions).map((option) => Number(option.value));
    updateMultiselect(key, selected.filter((value) => Number.isFinite(value)));
  };

  const updateConditionBuilder = (nextState: BuilderState | ((prev: BuilderState) => BuilderState)) => {
    setConditionBuilderState((prev) => {
      const next = typeof nextState === 'function' ? (nextState as (prev: BuilderState) => BuilderState)(prev) : nextState;

      handleFiltersChange((prevFilters) => ({
        ...prevFilters,
        condition_groups: next,
      }));

      return next;
    });
  };

  const handleAddGroup = () => {
    updateConditionBuilder((prev) => ({
      ...prev,
      groups: [...prev.groups, createDefaultGroup()],
    }));
    setExpandedAdvanced(true);
  };

  const handleRemoveGroup = (groupIndex: number) => {
    updateConditionBuilder((prev) => ({
      ...prev,
      groups: prev.groups.filter((_, index) => index !== groupIndex),
    }));
  };

  const handleAddCondition = (groupIndex: number) => {
    updateConditionBuilder((prev) => ({
      ...prev,
      groups: prev.groups.map((group, index) =>
        index === groupIndex ? { ...group, conditions: [...group.conditions, createDefaultCondition()] } : group
      ),
    }));
  };

  const handleRemoveCondition = (groupIndex: number, conditionIndex: number) => {
    updateConditionBuilder((prev) => ({
      ...prev,
      groups: prev.groups.map((group, index) => {
        if (index !== groupIndex) {
          return group;
        }

        const updatedConditions = group.conditions.filter((_, idx) => idx !== conditionIndex);
        return { ...group, conditions: updatedConditions };
      }),
    }));
  };

  const handleConditionFieldChange = (groupIndex: number, conditionIndex: number, field: string) => {
    const fieldOption = getFieldOption(field);
    const fallbackOperator = fieldOption.operators[0] ?? 'eq';

    updateConditionBuilder((prev) => ({
      ...prev,
      groups: prev.groups.map((group, gIndex) => {
        if (gIndex !== groupIndex) {
          return group;
        }

        const conditions = group.conditions.map((condition, cIndex) =>
          cIndex === conditionIndex
            ? {
                ...condition,
                field,
                operator: fieldOption.operators.includes(condition.operator) ? condition.operator : fallbackOperator,
                value: '',
                value_to: '',
              }
            : condition
        );

        return { ...group, conditions };
      }),
    }));
  };

  const handleConditionOperatorChange = (groupIndex: number, conditionIndex: number, operator: ConditionOperator) => {
    updateConditionBuilder((prev) => ({
      ...prev,
      groups: prev.groups.map((group, gIndex) => {
        if (gIndex !== groupIndex) {
          return group;
        }

        const conditions = group.conditions.map((condition, cIndex) =>
          cIndex === conditionIndex
            ? {
                ...condition,
                operator,
                value_to: operator === 'between' ? condition.value_to : '',
              }
            : condition
        );

        return { ...group, conditions };
      }),
    }));
  };

  const handleConditionValueChange = (
    groupIndex: number,
    conditionIndex: number,
    fieldName: 'value' | 'value_to',
    value: string
  ) => {
    updateConditionBuilder((prev) => ({
      ...prev,
      groups: prev.groups.map((group, gIndex) => {
        if (gIndex !== groupIndex) {
          return group;
        }

        const conditions = group.conditions.map((condition, cIndex) =>
          cIndex === conditionIndex ? { ...condition, [fieldName]: value } : condition
        );

        return { ...group, conditions };
      }),
    }));
  };

  const handleGroupRelationChange = (groupIndex: number, relation: 'AND' | 'OR') => {
    updateConditionBuilder((prev) => ({
      ...prev,
      groups: prev.groups.map((group, index) => (index === groupIndex ? { ...group, relation } : group)),
    }));
  };

  const handleBuilderRelationChange = (relation: 'AND' | 'OR') => {
    updateConditionBuilder((prev) => ({
      ...prev,
      relation,
    }));
  };

  const handleRelativePresetChange = (target: 'created' | 'modified', presetKey: string) => {
    const preset = RELATIVE_PRESET_MAP[presetKey] ?? null;

    if (target === 'created') {
      setRelativePresetCreated(preset);
    } else {
      setRelativePresetModified(preset);
    }

    handleFiltersChange((prev) => ({
      ...prev,
      [target === 'created' ? 'relative_date_created' : 'relative_date_modified']: preset,
    }));
  };

  const getRelativePresetKey = (preset: RelativeDatePreset | null): string => {
    const match = RELATIVE_PRESET_OPTIONS.find((entry) =>
      preset && entry.preset
        ? JSON.stringify(entry.preset) === JSON.stringify(preset)
        : !preset && entry.preset === null
    );
    return match ? match.key : 'exact';
  };

  const updateBehavior = (updater: (prev: BehavioralFilters) => BehavioralFilters) => {
    handleFiltersChange((prev) => ({
      ...prev,
      behavior: updater(normalizeBehavior(prev.behavior)),
    }));
  };

  const handleBehaviorToggle = (key: keyof BehavioralFilters, checked: boolean) => {
    updateBehavior((prevBehavior) => ({
      ...prevBehavior,
      [key]: checked,
    }));
  };

  const handleBehaviorListChange = (key: keyof BehavioralFilters, values: string[]) => {
    updateBehavior((prevBehavior) => ({
      ...prevBehavior,
      [key]: values,
    }));
  };

  const renderFormatControls = () => (
    <div className="bg-white rounded-2xl p-6 border border-gray-200">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-5 h-5 text-[#FF3A2E]" />
        <h3 className="text-gray-900 block-heading">
          {getString('exportFileFormatTitle', 'File Format')}
        </h3>
      </div>

      <div className="space-y-2">
        {formatEntries.map(([value, label]) => (
          <button
            key={value}
            onClick={() => onFormatChange(value)}
            className={`w-full px-4 py-3 rounded-xl transition-all text-left text-label ${
              format === value
                ? 'bg-[#FF3A2E] text-white shadow-sm'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );

  const renderCsvControls = () => (
    <div className="bg-white rounded-2xl p-6 border border-gray-200">
      <div className="flex items-center gap-2 mb-4">
        <Database className="w-5 h-5 text-[#FF3A2E]" />
        <h3 className="text-gray-900 block-heading">
          {getString('exportCsvSettingsTitle', 'CSV Settings')}
        </h3>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-gray-700 text-label mb-2">
            {getString('exportCsvDelimiterLabel', 'Delimiter')}
          </label>
          <select
            value={delimiter}
            onChange={(e) => onDelimiterChange(e.target.value)}
            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF3A2E] focus:border-transparent"
          >
            {delimiterEntries.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-gray-700 text-label mb-2">
            {getString('exportCsvEncodingLabel', 'Encoding')}
          </label>
          <select
            value={encoding}
            onChange={(e) => onEncodingChange(e.target.value)}
            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF3A2E] focus:border-transparent"
          >
            {encodingEntries.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );

  const renderImagesZipControl = () => (
    <div className="bg-white rounded-2xl p-6 border border-gray-200">
      <div className="flex items-center gap-2 mb-3">
        <ImageIcon className="w-5 h-5 text-[#FF3A2E]" />
        <h3 className="text-gray-900 block-heading">
          {getString('exportImagesZipTitle', 'Attach product images as ZIP')}
        </h3>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        {getString('exportImagesZipDescription', 'Adds all product images to a downloadable archive alongside the export file.')}
      </p>

      <label className="inline-flex items-center gap-3 text-body">
        <input
          type="checkbox"
          id="attach_images_zip"
          checked={attachImagesZip}
          onChange={(event) => onAttachImagesZipChange(event.target.checked)}
          className="w-5 h-5 text-[#FF3A2E] border-gray-300 rounded focus:ring-[#FF3A2E]"
        />
        <span className="text-gray-800 text-body">
          {getString('exportImagesZipToggleLabel', 'Enable ZIP attachment')}
        </span>
      </label>
    </div>
  );

  const renderCategoryBrandFilters = () => (
    <div className="grid grid-cols-1 gap-4">
      <div>
        <label className="block text-gray-700 text-label mb-2">
          Category
        </label>
        <select
          value={filters.category}
          onChange={(event) => updateFilterField('category', Number(event.target.value))}
          className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF3A2E] focus:border-transparent"
        >
          <option value={0}>— All categories —</option>
          {filterOptions.categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-gray-700 text-label mb-2">
          Brand
        </label>
        <select
          value={filters.brand}
          onChange={(event) => updateFilterField('brand', Number(event.target.value))}
          className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF3A2E] focus:border-transparent"
          disabled={filterOptions.brands.length === 0}
        >
          <option value={0}>— All brands —</option>
          {filterOptions.brands.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name}
            </option>
          ))}
        </select>
        {filterOptions.brands.length === 0 && brandFieldHint && (
          <p className="text-xs text-gray-500 mt-2">{brandFieldHint}</p>
        )}
      </div>
    </div>
  );

  const renderPriceFilters = () => (
    <div className="grid grid-cols-1 gap-4">
      <div>
        <label className="block text-gray-700 text-label mb-2">
          Regular price range
        </label>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            inputMode="decimal"
            placeholder="Min"
            value={filters.price.regular.min ?? ''}
            onChange={(event) => updatePriceRange('regular', 'min', event.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF3A2E]"
          />
          <input
            type="number"
            inputMode="decimal"
            placeholder="Max"
            value={filters.price.regular.max ?? ''}
            onChange={(event) => updatePriceRange('regular', 'max', event.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF3A2E]"
          />
        </div>
      </div>

      <div>
        <label className="block text-gray-700 text-label mb-2">
          Sale price range
        </label>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            inputMode="decimal"
            placeholder="Min"
            value={filters.price.sale.min ?? ''}
            onChange={(event) => updatePriceRange('sale', 'min', event.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF3A2E]"
          />
          <input
            type="number"
            inputMode="decimal"
            placeholder="Max"
            value={filters.price.sale.max ?? ''}
            onChange={(event) => updatePriceRange('sale', 'max', event.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF3A2E]"
          />
        </div>
      </div>
    </div>
  );

  const renderStockFilters = () => (
    <div className="grid grid-cols-1 gap-4">
      <div>
        <label className="block text-gray-700 text-label mb-2">
          Stock quantity range
        </label>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            inputMode="numeric"
            placeholder="Min"
            value={filters.stock.min ?? ''}
            onChange={(event) => updateStockRange('min', event.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF3A2E]"
          />
          <input
            type="number"
            inputMode="numeric"
            placeholder="Max"
            value={filters.stock.max ?? ''}
            onChange={(event) => updateStockRange('max', event.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF3A2E]"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <label className="inline-flex items-center gap-2 text-gray-700 text-label">
          <input
            type="checkbox"
            checked={filters.stock.only_in_stock}
            onChange={(event) => toggleStockFlag('only_in_stock', event.target.checked)}
            className="w-4 h-4 text-[#FF3A2E] border-gray-300 rounded focus:ring-[#FF3A2E]"
          />
          Only products in stock
        </label>

        <label className="inline-flex items-center gap-2 text-gray-700" style={{ fontSize: '0.875rem' }}>
          <input
            type="checkbox"
            checked={filters.stock.only_zero}
            onChange={(event) => toggleStockFlag('only_zero', event.target.checked)}
            className="w-4 h-4 text-[#FF3A2E] border-gray-300 rounded focus:ring-[#FF3A2E]"
          />
          Only zero stock
        </label>
      </div>
    </div>
  );

  const renderDateFilters = () => (
    <div className="grid grid-cols-1 gap-4">
      <div>
        <label className="block text-gray-700 text-label mb-2">
          Created between
        </label>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            value={filters.date_created.from ?? ''}
            onChange={(event) => updateDateRange('date_created', 'from', event.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF3A2E]"
          />
          <input
            type="date"
            value={filters.date_created.to ?? ''}
            onChange={(event) => updateDateRange('date_created', 'to', event.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF3A2E]"
          />
        </div>
      </div>

      <div>
        <label className="block text-gray-700 text-label mb-2">
          Last modified between
        </label>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            value={filters.date_modified.from ?? ''}
            onChange={(event) => updateDateRange('date_modified', 'from', event.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF3A2E]"
          />
          <input
            type="date"
            value={filters.date_modified.to ?? ''}
            onChange={(event) => updateDateRange('date_modified', 'to', event.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF3A2E]"
          />
        </div>
      </div>
    </div>
  );

  const renderModeFilters = () => (
    <div className="grid grid-cols-1 gap-4">
      <div>
        <label className="block text-gray-700 text-label mb-2">
          Discounted products
        </label>
        <select
          value={filters.discount_mode}
          onChange={(event) => updateFilterField('discount_mode', event.target.value)}
          className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF3A2E] focus:border-transparent"
        >
          {discountEntries.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-gray-700 text-label mb-2">
          Image availability
        </label>
        <select
          value={filters.image_mode}
          onChange={(event) => updateFilterField('image_mode', event.target.value)}
          className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF3A2E] focus:border-transparent"
        >
          {imageEntries.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-gray-700 text-label mb-2">
          Reviews
        </label>
        <select
          value={filters.reviews_mode}
          onChange={(event) => updateFilterField('reviews_mode', event.target.value)}
          className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF3A2E] focus:border-transparent"
        >
          {reviewsEntries.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  const renderSearchFilters = () => (
    <div className="grid grid-cols-1 gap-4">
      <div>
        <label className="block text-gray-700 text-label mb-2">
          Description contains
        </label>
        <input
          type="text"
          value={filters.description_search}
          onChange={(event) => updateFilterField('description_search', event.target.value)}
          placeholder="Keyword or phrase"
          className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF3A2E] focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-gray-700 text-label mb-2">
          Exclude categories
        </label>
        <select
          multiple
          size={6}
          value={filters.exclude_categories.map(String)}
          onChange={(event) => handleMultiSelectChange(event, 'exclude_categories')}
          className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF3A2E] focus:border-transparent"
        >
          {filterOptions.categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-2">Hold Ctrl / Cmd to select multiple items.</p>
      </div>

      <div>
        <label className="block text-gray-700 text-label mb-2">
          Exclude tags
        </label>
        <select
          multiple
          size={6}
          value={filters.exclude_tags.map(String)}
          onChange={(event) => handleMultiSelectChange(event, 'exclude_tags')}
          className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF3A2E] focus:border-transparent"
        >
          {filterOptions.tags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  const renderSummary = () => (
    <div className="bg-white rounded-2xl border border-gray-200">
      <button
        type="button"
        className="w-full flex items-center justify-between px-6 py-4"
        onClick={() => setActiveSummaryExpanded((prev) => !prev)}
        aria-expanded={activeSummaryExpanded}
      >
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-[#FF3A2E]" />
          <h3 className="text-gray-900 block-heading">Active Filters</h3>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-500 transition-transform ${activeSummaryExpanded ? 'rotate-180' : ''}`}
        />
      </button>

      {activeSummaryExpanded && (
        <div className="px-6 pb-6 border-t border-gray-100">
          <ul className="space-y-2 pt-4">
            <SummaryItem
              label="Category"
              value={filters.category ? findName(filterOptions.categories, filters.category) : 'All categories'}
            />
            <SummaryItem
              label="Brand"
              value={filters.brand ? findName(filterOptions.brands, filters.brand) : 'All brands'}
            />
            <SummaryItem label="Regular price" value={formatRange(filters.price.regular)} />
            <SummaryItem label="Sale price" value={formatRange(filters.price.sale)} />
            <SummaryItem
              label="Stock"
              value={formatRange(filters.stock, true, filters.stock.only_in_stock, filters.stock.only_zero)}
            />
            <SummaryItem label="Created between" value={formatDateRange(filters.date_created)} />
            <SummaryItem label="Modified between" value={formatDateRange(filters.date_modified)} />
            <SummaryItem label="Discount" value={filterOptions.discountModes[filters.discount_mode] ?? 'Any'} />
            <SummaryItem label="Images" value={filterOptions.imageModes[filters.image_mode] ?? 'Any'} />
            <SummaryItem label="Reviews" value={filterOptions.reviewsModes[filters.reviews_mode] ?? 'Any'} />
            <SummaryItem label="Description search" value={filters.description_search || '—'} />
            <SummaryItem
              label="Excluded categories"
              value={formatList(filters.exclude_categories, (id) => findName(filterOptions.categories, id))}
            />
            <SummaryItem
              label="Excluded tags"
              value={formatList(filters.exclude_tags, (id) => findName(filterOptions.tags, id))}
            />
          </ul>
        </div>
      )}
    </div>
  );

  const renderConditionBuilder = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600">Combine groups using</span>
        <select
          value={conditionBuilderState.relation}
          onChange={(event) => handleBuilderRelationChange(event.target.value === 'OR' ? 'OR' : 'AND')}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
        >
          <option value="AND">AND</option>
          <option value="OR">OR</option>
        </select>
      </div>

      {conditionBuilderState.groups.length === 0 && (
        <div className="p-4 rounded-xl bg-gray-50 text-sm text-gray-600 border border-dashed border-gray-200">
          No conditions yet. Add a group to build advanced rules.
        </div>
      )}

      <div className="space-y-4">
        {conditionBuilderState.groups.map((group, groupIndex) => (
          <div key={`group-${groupIndex}`} className="border border-gray-200 rounded-2xl p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-700">
                  {groupIndex + 1}
                </span>
                <span>Group</span>
                <select
                  value={group.relation}
                  onChange={(event) => handleGroupRelationChange(groupIndex, event.target.value === 'OR' ? 'OR' : 'AND')}
                  className="px-2 py-1 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="AND">AND</option>
                  <option value="OR">OR</option>
                </select>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveGroup(groupIndex)}
                className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-600"
              >
                <X className="w-3 h-3" /> Remove group
              </button>
            </div>

            <div className="space-y-3">
              {group.conditions.map((condition, conditionIndex) => (
                <div
                  key={`group-${groupIndex}-condition-${conditionIndex}`}
                  className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end bg-gray-50 rounded-2xl p-3"
                >
                  <div className="md:col-span-2">
                    <label className="text-xs uppercase tracking-wide text-gray-500 block mb-1">Field</label>
                    <select
                      value={condition.field}
                      onChange={(event) => handleConditionFieldChange(groupIndex, conditionIndex, event.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl"
                    >
                      {CONDITION_FIELD_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs uppercase tracking-wide text-gray-500 block mb-1">Operator</label>
                    <select
                      value={condition.operator}
                      onChange={(event) =>
                        handleConditionOperatorChange(groupIndex, conditionIndex, event.target.value as ConditionOperator)
                      }
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl"
                    >
                      {getFieldOption(condition.field).operators.map((operator) => (
                        <option key={operator} value={operator}>
                          {CONDITION_OPERATOR_LABELS[operator]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs uppercase tracking-wide text-gray-500 block mb-1">Value</label>
                    <input
                      type={getFieldOption(condition.field).valueType === 'number' ? 'number' : 'text'}
                      value={condition.value}
                      onChange={(event) => handleConditionValueChange(groupIndex, conditionIndex, 'value', event.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl"
                      placeholder="Enter value"
                    />
                  </div>

                  <div className="relative">
                    {condition.operator === 'between' && (
                      <Fragment>
                        <label className="text-xs uppercase tracking-wide text-gray-500 block mb-1">To</label>
                        <input
                          type="number"
                          value={condition.value_to ?? ''}
                          onChange={(event) =>
                            handleConditionValueChange(groupIndex, conditionIndex, 'value_to', event.target.value)
                          }
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl"
                          placeholder="Max"
                        />
                      </Fragment>
                    )}
                    {condition.operator !== 'between' && (
                      <button
                        type="button"
                        onClick={() => handleRemoveCondition(groupIndex, conditionIndex)}
                        className="absolute top-0 right-0 text-xs text-gray-400 hover:text-red-600"
                        aria-label="Remove condition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {condition.operator === 'between' && (
                    <button
                      type="button"
                      onClick={() => handleRemoveCondition(groupIndex, conditionIndex)}
                      className="text-xs text-gray-400 hover:text-red-600"
                      aria-label="Remove condition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={() => handleAddCondition(groupIndex)}
                className="inline-flex items-center gap-2 text-sm text-[#FF3A2E] hover:text-[#ff5b53]"
              >
                <Plus className="w-4 h-4" />
                <span>Add condition</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={handleAddGroup}
        className="inline-flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 rounded-xl text-sm text-gray-700"
      >
        <Plus className="w-4 h-4" />
        <span>Add condition group</span>
      </button>
    </div>
  );

  const renderRelativePresets = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {[
        { label: 'Created date', value: relativePresetCreated, target: 'created' as const },
        { label: 'Modified date', value: relativePresetModified, target: 'modified' as const },
      ].map((item) => (
        <div key={item.target} className="p-4 border border-gray-200 rounded-2xl">
          <p className="text-sm font-medium text-gray-800 mb-2">{item.label}</p>
          <select
            value={getRelativePresetKey(item.value)}
            onChange={(event) => handleRelativePresetChange(item.target, event.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl"
          >
            {RELATIVE_PRESET_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-2">
            {item.value ? 'Relative preset will be applied.' : 'Manual date selection is used above.'}
          </p>
        </div>
      ))}
    </div>
  );

  const renderBehaviorSegments = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="p-4 border border-gray-200 rounded-2xl space-y-3">
        <p className="text-sm font-medium text-gray-800">Images & media</p>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={behavior.requireImages}
            onChange={(event) => handleBehaviorToggle('requireImages', event.target.checked)}
            className="w-4 h-4 text-[#FF3A2E] border-gray-300 rounded"
          />
          Only products with images
        </label>
      </div>

      <div className="p-4 border border-gray-200 rounded-2xl space-y-3">
        <p className="text-sm font-medium text-gray-800">Exclude products missing data</p>
        <select
          multiple
          value={behavior.excludeMissingFields}
          onChange={(event) => {
            const values = Array.from(event.target.selectedOptions).map((option) => option.value);
            handleBehaviorListChange('excludeMissingFields', values);
          }}
          className="w-full px-3 py-2 border border-gray-200 rounded-xl h-28"
        >
          {MISSING_FIELD_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500">Selected fields must be filled, otherwise the product is skipped.</p>
      </div>
    </div>
  );

  const renderAdvancedFilters = () => (
    <div className="bg-white rounded-2xl p-6 border border-gray-200 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#FF3A2E]" strokeWidth={2.2} />
            <h3 className="text-gray-900 block-heading">Advanced Filters</h3>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Visual condition builder, relative date windows, and behavioral segments.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 px-3 py-1 bg-[#FF6A5B] text-white rounded-full text-xs font-semibold">
          <Sparkles className="w-3 h-3" /> PRO
        </span>
      </div>

      <button
        type="button"
        onClick={() => setExpandedAdvanced((prev) => !prev)}
        className="flex items-center justify-between w-full px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-700"
      >
        <span>{expandedAdvanced ? 'Hide builder' : 'Show builder'}</span>
        <ChevronDown
          className={`w-4 h-4 transition-transform ${expandedAdvanced ? 'transform rotate-180' : ''}`}
        />
      </button>

      {expandedAdvanced && (
        <div className="space-y-6">
          {renderConditionBuilder()}
          {renderRelativePresets()}
          {renderBehaviorSegments()}
        </div>
      )}

      {!expandedAdvanced && (
        <div className="text-sm text-gray-500">
          Use AND/OR logic, relative date presets, and exclude products missing specific fields.
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {renderFormatControls()}
      {format === 'csv' && renderCsvControls()}
      {format === 'csv' && isPro && showImagesZipControl && renderImagesZipControl()}
      {format === 'csv' && isPro && !showImagesZipControl && (
        <div className="bg-white rounded-2xl p-6 border border-gray-200 text-sm text-gray-500">
          <div className="flex items-center gap-2 text-gray-700 font-medium">
            <Lock className="w-4 h-4" />
            {getString(
              'mediaZipHintTitle',
              'ZIP archive attachment is available in the Media Export module.',
            )}
          </div>
          <p className="mt-2">
            {getString(
              'mediaZipHintDescription',
              'Enable the "Create ZIP Archive" tile on the Media page to configure ZIP attachments here.',
            )}
          </p>
        </div>
      )}

      <div className="bg-white rounded-2xl p-6 border border-gray-200 space-y-6">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-[#FF3A2E]" strokeWidth={2.2} />
          <h3 className="text-gray-900 block-heading">Filters</h3>
        </div>
        {renderCategoryBrandFilters()}
        {renderPriceFilters()}
        {renderStockFilters()}
        {renderDateFilters()}
        {renderModeFilters()}
        {renderSearchFilters()}
      </div>

      {renderSummary()}
      {isPro && renderAdvancedFilters()}
    </div>
  );
}

interface SummaryItemProps {
  label: string;
  value: string;
}

function SummaryItem({ label, value }: SummaryItemProps) {
  return (
    <li className="p-3 bg-gray-50 rounded-xl text-gray-700" style={{ fontSize: '0.875rem' }}>
      <span className="font-medium text-gray-900">{label}:</span>{' '}
      <span>{value}</span>
    </li>
  );
}

function findName(options: { id: number; name: string }[], id: number): string {
  const match = options.find((option) => option.id === id);
  return match ? match.name : '—';
}

function formatRange(
  range: { min: number | null; max: number | null },
  includeFlags = false,
  onlyInStock = false,
  onlyZero = false
): string {
  const parts: string[] = [];

  if (range.min !== null || range.max !== null) {
    const min = range.min !== null ? range.min : '—';
    const max = range.max !== null ? range.max : '—';
    parts.push(`${min} → ${max}`);
  }

  if (includeFlags) {
    if (onlyInStock) {
      parts.push('only in stock');
    }

    if (onlyZero) {
      parts.push('only zero');
    }
  }

  return parts.length > 0 ? parts.join(', ') : '—';
}

function formatDateRange(range: { from: string | null; to: string | null }): string {
  if (!range.from && !range.to) {
    return '—';
  }

  const from = range.from ?? '—';
  const to = range.to ?? '—';

  return `${from} → ${to}`;
}

function formatList(ids: number[], resolver: (id: number) => string): string {
  if (ids.length === 0) {
    return '—';
  }

  return ids.map((id) => resolver(id)).join(', ');
}

function getFieldOption(field: string): ConditionFieldOption {
  return CONDITION_FIELD_OPTIONS.find((option) => option.value === field) ?? CONDITION_FIELD_OPTIONS[0];
}

function createDefaultCondition(): BuilderCondition {
  const option = CONDITION_FIELD_OPTIONS[0];
  return {
    field: option.value,
    operator: option.operators[0] ?? 'eq',
    value: '',
    value_to: '',
  };
}

function createDefaultGroup(): BuilderGroup {
  return {
    relation: 'AND',
    conditions: [createDefaultCondition()],
  };
}

function normalizeConditionState(raw?: ConditionGroupsPayload | null): BuilderState {
  const relation: 'AND' | 'OR' = raw?.relation === 'OR' ? 'OR' : 'AND';
  const groups: BuilderGroup[] = Array.isArray(raw?.groups)
    ? raw!.groups.map((group) => {
        const groupRelation: 'AND' | 'OR' = group && group.relation === 'OR' ? 'OR' : 'AND';
        const conditions: BuilderCondition[] = Array.isArray(group?.conditions)
          ? group.conditions.map((condition: BuilderCondition) => {
              const option = getFieldOption(condition?.field ?? CONDITION_FIELD_OPTIONS[0].value);
              const operator = option.operators.includes(condition?.operator ?? 'eq')
                ? (condition.operator as ConditionOperator)
                : option.operators[0];

              return {
                field: option.value,
                operator,
                value: typeof condition?.value === 'string' ? condition.value : '',
                value_to: typeof condition?.value_to === 'string' ? condition.value_to : '',
              };
            })
          : [createDefaultCondition()];

        return {
          relation: groupRelation,
          conditions,
        };
      })
    : [];

  return {
    relation,
    groups,
  };
}

function normalizeBehavior(behavior?: BehavioralFilters | null): BehavioralFilters {
  return {
    requireImages: behavior?.requireImages ?? false,
    requireFields: Array.isArray(behavior?.requireFields) ? behavior!.requireFields : [],
    requireActions: Array.isArray(behavior?.requireActions) ? behavior!.requireActions : [],
    requireConditions: Array.isArray(behavior?.requireConditions) ? behavior!.requireConditions : [],
    excludeMissingFields: Array.isArray(behavior?.excludeMissingFields) ? behavior!.excludeMissingFields : [],
  };
}
