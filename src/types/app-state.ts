import type { ReactNode } from 'react';

export type CapabilityMap = Record<string, boolean>;

export interface ExportTemplateItem {
  id: string;
  name: string;
  description?: string;
  updated_at?: string;
  fields?: string[];
  filters?: Record<string, unknown>;
  format?: string;
  settings?: Record<string, unknown>;
}

export interface NumericRange {
  min: number | null;
  max: number | null;
}

export interface DateRange {
  from: string | null;
  to: string | null;
}

export interface ConditionGroupsPayload {
  relation: 'AND' | 'OR';
  groups: unknown[];
}

export interface StockFilters extends NumericRange {
  only_in_stock: boolean;
  only_zero: boolean;
}

export interface RelativeDatePreset {
  type: 'last' | 'since';
  unit?: 'hours' | 'days' | 'weeks' | 'months';
  value?: number;
}

export interface BehavioralFilters {
  requireImages: boolean;
  requireFields: string[];
  requireActions: string[];
  requireConditions: string[];
  excludeMissingFields: string[];
}

export interface ExportFilters {
  category: number;
  brand: number;
  price: {
    regular: NumericRange;
    sale: NumericRange;
  };
  stock: StockFilters;
  date_created: DateRange;
  date_modified: DateRange;
  relative_date_created?: RelativeDatePreset | null;
  relative_date_modified?: RelativeDatePreset | null;
  discount_mode: string;
  image_mode: string;
  reviews_mode: string;
  description_search: string;
  exclude_categories: number[];
  exclude_tags: number[];
  condition_groups: ConditionGroupsPayload;
  behavior?: BehavioralFilters;
}

export interface FilterOptionItem {
  id: number;
  name: string;
}

export interface FilterOptions {
  categories: FilterOptionItem[];
  brands: FilterOptionItem[];
  tags: FilterOptionItem[];
  discountModes: Record<string, string>;
  imageModes: Record<string, string>;
  reviewsModes: Record<string, string>;
}

export interface PreviewConfig {
  limit: number;
  metaColumnMinWidth?: number;
  columnMinWidth?: number;
  action?: string;
}

export interface FieldDefinition {
  label?: string;
  group?: string;
  [key: string]: unknown;
}

export interface ExportState {
  fieldDefinitions: Record<string, FieldDefinition>;
  fieldMetadata: Record<string, unknown>;
  initialFields: string[];
  filters: ExportFilters;
  defaultFilters?: ExportFilters;
  filterOptions: FilterOptions;
  formatOptions: Record<string, string>;
  selectedFormat?: string;
  delimiterOptions: Record<string, string>;
  encodingOptions: Record<string, string>;
  fileSettings: Record<string, unknown>;
  conditionBuilder: {
    fields: Record<string, unknown>;
    initial: unknown[];
  };
  templates: ExportTemplatesState | null;
  preview: PreviewConfig | null;
  hasBrandTaxonomy: boolean;
  templateToLoad?: ExportTemplateItem | null;
  pendingReset?: boolean;
}

export interface ExportTemplatesState {
  items: ExportTemplateItem[];
  selected: string;
  strings: Record<string, string>;
  editing?: {
    templateId: string;
  } | null;
}

export interface SchedulerState {
  tasks: SchedulerTask[];
  config: SchedulerConfig;
  timezone?: string;
  pendingTaskId?: number | null;
}

export interface SchedulerTask {
  id: number;
  name: string;
  template_id: string;
  enabled: boolean | number;
  status: string;
  schedule_type: string;
  schedule_cron?: string;
  schedule_interval?: string | number | null;
  schedule_timezone?: string;
  schedule_payload?: Record<string, unknown>;
  next_run_at?: string | null;
  last_run_at?: string | null;
  last_action_log?: Record<string, unknown> | null;
  incremental?: boolean | number | string;
  incremental_mode?: string;
  incremental_field?: string;
  incremental_anchor_value?: string | null;
  actions?: unknown;
  created_at?: string;
  updated_at?: string;
}

export interface SchedulerConfig {
  strings: Record<string, string>;
  alerts: Record<string, string>;
  actionDefinitions: Record<string, SchedulerActionDefinition>;
  actionLabels: Record<string, string>;
}

export interface SchedulerActionDefinition {
  fields: SchedulerActionField[];
}

export interface SchedulerActionField {
  name: string;
  label: string;
  type: string;
  placeholder?: string;
  description?: string;
  options?: Array<{ value: string | number; label: string }>;
  rows?: number;
  defaultValue?: string | number | boolean;
  required?: boolean;
  fullWidth?: boolean;
}

export interface HistoryState {
  filters: Record<string, string | number> & {
    status?: string;
    template_id?: string;
    template_name?: string;
    run_type?: string;
    date_from?: string;
    date_to?: string;
    task_name?: string;
    limit: number;
    offset: number;
    page: number;
    per_page: number;
  };
  runs: HistoryRun[];
  pagination: {
    total: number;
    current: number;
    per_page: number;
    pages: number;
  };
}

export type HistoryRunStatus = 'success' | 'error' | 'running' | 'pending' | 'cancelled';

export interface HistoryRun {
  id: number;
  task_id: number;
  template_id: string;
  task_name?: string;
  run_type: 'manual' | 'scheduled';
  started_at: string;
  finished_at?: string;
  status: HistoryRunStatus;
  rows_exported: number;
  file_path: string;
  file_format?: string;
  file_size: number;
  images_zip_path?: string;
  images_zip_size: number;
  fields?: string[];
  filters?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  actions: unknown;
  action_results: unknown;
  incremental_from?: string;
  incremental_to?: string;
  log?: unknown;
}

export interface AccessCapabilityDefinition {
  label: string;
  description: string;
}

export interface AccessState {
  capabilities: Record<string, AccessCapabilityDefinition>;
  matrix: Record<string, Record<string, boolean>>;
  roles: Record<string, string>;
}

export interface AppNotice {
  code: string;
  message: string;
  type: string;
}

export interface PluginInfoStrings {
  isPro?: boolean;
  version?: string;
  activated_on?: string;
  license?: string;
  domain?: string;
  status?: string;
  expires?: string;
  customer_email?: string;
  plan?: string;
  site_count?: number;
  license_limit?: number;
  activations_left?: number;
  last_check?: string;
  message?: string;
  manage_url?: string;
  portal_url?: string;
}

export interface AppStrings {
  brandFieldHint?: string;
  selectAll?: string;
  clearAll?: string;
  noWooCommerce?: string;
  plugin?: PluginInfoStrings;
  [key: string]: string | PluginInfoStrings | undefined;
}

export type MediaProviderFieldType = 'text' | 'password' | 'select' | 'number' | 'textarea';

export interface MediaProviderFieldOption {
  value: string;
  label: string;
}

export interface MediaProviderFieldDefinition {
  name: string;
  label: string;
  type: MediaProviderFieldType;
  required?: boolean;
  placeholder?: string;
  description?: string;
  options?: MediaProviderFieldOption[];
}

export interface MediaCloudProviderDefinition {
  id: string;
  label: string;
  description?: string;
  fields: MediaProviderFieldDefinition[];
  supportsZipToggle?: boolean;
}

export interface MediaImageSettings {
  sizePreset: 'full' | 'large' | 'medium' | 'thumbnail';
  filenamePattern: string;
  includeGallery: boolean;
  replaceUrls: boolean;
  quality: 'original' | 'high' | 'medium' | 'low';
}

export interface MediaHistoryEntry {
  id: string;
  provider: string;
  destination: 'urls' | 'zip' | 'cloud' | 'local';
  format: 'files' | 'zip';
  sizeLabel: string;
  createdAt: string;
  details?: string;
}

export interface MediaCloudState {
  providers: MediaCloudProviderDefinition[];
  selectedProvider?: string;
  connections: Record<string, Record<string, string>>;
  attachAsZip: boolean;
  transferFormat: 'files' | 'zip';
  lastConfiguredProvider?: string;
  isConfigured: boolean;
}

export interface MediaLocalState {
  targetPath: string;
  lastExportFormat: 'files' | 'zip';
}

export interface MediaState {
  capabilities: {
    exportUi: boolean;
    zip: boolean;
    cloud: boolean;
    local: boolean;
  };
  tiles: {
    urls: boolean;
    zip: boolean;
    cloud: boolean;
    local: boolean;
  };
  imageSettings: MediaImageSettings;
  cloud: MediaCloudState;
  local: MediaLocalState;
  history: {
    entries: MediaHistoryEntry[];
  };
}

export interface GeneralSettings {
  defaultExportFormat: string;
  productsPerBatch: number;
  exportDirectory: string;
  autoCleanup: boolean;
}

export type MultilingualExportMode = 'separate_columns' | 'separate_files';

export interface MultilingualSettings {
  exportMode: MultilingualExportMode;
  activeLanguages: string[]; // e.g. ['en', 'de']
}

export type HistoryRetentionOption = 'all' | '30' | '90' | '180' | '365';

export interface DatabaseSettings {
  historyRetention: HistoryRetentionOption;
  autoOptimizeWeekly: boolean;
}

export interface NotificationSettings {
  exportComplete: boolean;
  exportError: boolean;
  scheduledComplete: boolean;
  scheduledError: boolean;
  storageFull: boolean;
}

export interface AdvancedSettings {
  memoryLimitMb: number;
  executionTimeout: number;
  queryCaching: boolean;
}

export interface SettingsState {
  general: GeneralSettings;
  multilingual: MultilingualSettings;
  database: DatabaseSettings;
  notifications: NotificationSettings;
  advanced: AdvancedSettings;
}

export interface AppState {
  initialScreen: string;
  isProBuild?: boolean;
  timezone?: string;
  capabilities: CapabilityMap;
  urls: {
    ajax: string;
    rest: string;
  };
  nonces: {
    templates: string;
    preview: string;
    manualExport?: string;
  } & Record<string, string>;
  export: ExportState;
  scheduler: SchedulerState | null;
  history: HistoryState;
  access: AccessState;
  notices: AppNotice[];
  strings: AppStrings;
  media: MediaState;
  settings: SettingsState;
}

export interface AppStateContextValue {
  state: AppState;
  setState: (updater: (prev: AppState) => AppState) => void;
}

export interface AppStateProviderProps {
  initialState?: AppState;
  children: ReactNode;
}
