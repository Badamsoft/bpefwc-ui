import { createContext, useContext, useMemo, useState } from 'react';
import type { AppState, AppStateContextValue, AppStateProviderProps } from '@/types/app-state';

const BASE_STATE: AppState = {
      initialScreen: 'export',
      isProBuild: false,
      timezone: undefined,
      capabilities: {},
      urls: { ajax: '', rest: '' },
      nonces: { templates: '', preview: '', manualExport: '' },
      export: {
        fieldDefinitions: {},
        fieldMetadata: {},
        initialFields: [],
        filters: {
          category: 0,
          brand: 0,
          price: {
            regular: { min: null, max: null },
            sale: { min: null, max: null },
          },
          stock: { min: null, max: null, only_in_stock: false, only_zero: false },
          date_created: { from: null, to: null },
          date_modified: { from: null, to: null },
          discount_mode: '',
          image_mode: '',
          reviews_mode: '',
          description_search: '',
          exclude_categories: [],
          exclude_tags: [],
          condition_groups: { relation: 'AND', groups: [] },
        },
        filterOptions: {
          categories: [],
          brands: [],
          tags: [],
          discountModes: {},
          imageModes: {},
          reviewsModes: {},
        },
        formatOptions: {},
        delimiterOptions: {},
        encodingOptions: {},
        fileSettings: {},
        conditionBuilder: { fields: {}, initial: [] },
        templates: null,
        preview: null,
        hasBrandTaxonomy: false,
      },
      scheduler: null,
      history: {
        filters: {
          status: '',
          template_id: '',
          template_name: '',
          run_type: '',
          date_from: '',
          date_to: '',
          task_name: '',
          limit: 20,
          offset: 0,
          page: 1,
          per_page: 20,
        },
        runs: [],
        pagination: { total: 0, current: 1, per_page: 20, pages: 1 },
      },
      access: {
        capabilities: {},
        matrix: {},
        roles: {},
      },
      notices: [],
      strings: {},
      media: {
        capabilities: {
          exportUi: false,
          zip: false,
          cloud: false,
          local: false,
        },
        tiles: {
          urls: true,
          zip: false,
          cloud: false,
          local: false,
        },
        imageSettings: {
          sizePreset: 'full',
          filenamePattern: '{product-name}-{sku}',
          includeGallery: true,
          replaceUrls: false,
          quality: 'original',
        },
        cloud: {
          providers: [],
          connections: {},
          attachAsZip: false,
          transferFormat: 'files',
          isConfigured: false,
        },
        local: {
          targetPath: '',
          lastExportFormat: 'files',
        },
        history: {
          entries: [],
        },
      },
      settings: {
        general: {
          defaultExportFormat: 'csv',
          productsPerBatch: 1000,
          exportDirectory: '/wp-content/uploads/exports/',
          autoCleanup: true,
        },
        multilingual: {
          exportMode: 'separate_columns',
          activeLanguages: ['en'],
        },
        database: {
          historyRetention: 'all',
          autoOptimizeWeekly: false,
        },
        notifications: {
          exportComplete: true,
          exportError: true,
          scheduledComplete: true,
          scheduledError: true,
          storageFull: true,
        },
        advanced: {
          memoryLimitMb: 256,
          executionTimeout: 300,
          queryCaching: true,
        },
      },
};

const mergeInitialState = (incoming: unknown): AppState => {
  if (!incoming || typeof incoming !== 'object') {
    return BASE_STATE;
  }

  const raw = incoming as Partial<AppState>;

  return {
    ...BASE_STATE,
    ...raw,
    urls: {
      ...BASE_STATE.urls,
      ...(raw.urls ?? {}),
    },
    nonces: {
      ...BASE_STATE.nonces,
      ...(raw.nonces ?? {}),
    },
    export: {
      ...BASE_STATE.export,
      ...(raw.export ?? {}),
      filters: {
        ...BASE_STATE.export.filters,
        ...(raw.export?.filters ?? {}),
        price: {
          ...BASE_STATE.export.filters.price,
          ...(raw.export?.filters?.price ?? {}),
          regular: {
            ...BASE_STATE.export.filters.price.regular,
            ...(raw.export?.filters?.price?.regular ?? {}),
          },
          sale: {
            ...BASE_STATE.export.filters.price.sale,
            ...(raw.export?.filters?.price?.sale ?? {}),
          },
        },
        stock: {
          ...BASE_STATE.export.filters.stock,
          ...(raw.export?.filters?.stock ?? {}),
        },
        date_created: {
          ...BASE_STATE.export.filters.date_created,
          ...(raw.export?.filters?.date_created ?? {}),
        },
        date_modified: {
          ...BASE_STATE.export.filters.date_modified,
          ...(raw.export?.filters?.date_modified ?? {}),
        },
        condition_groups: {
          ...BASE_STATE.export.filters.condition_groups,
          ...(raw.export?.filters?.condition_groups ?? {}),
        },
      },
      filterOptions: {
        ...BASE_STATE.export.filterOptions,
        ...(raw.export?.filterOptions ?? {}),
      },
      conditionBuilder: {
        ...BASE_STATE.export.conditionBuilder,
        ...(raw.export?.conditionBuilder ?? {}),
      },
    },
    history: {
      ...BASE_STATE.history,
      ...(raw.history ?? {}),
      filters: {
        ...BASE_STATE.history.filters,
        ...(raw.history?.filters ?? {}),
      },
      pagination: {
        ...BASE_STATE.history.pagination,
        ...(raw.history?.pagination ?? {}),
      },
    },
    access: {
      ...BASE_STATE.access,
      ...(raw.access ?? {}),
    },
    media: {
      ...BASE_STATE.media,
      ...(raw.media ?? {}),
      capabilities: {
        ...BASE_STATE.media.capabilities,
        ...(raw.media?.capabilities ?? {}),
      },
      tiles: {
        ...BASE_STATE.media.tiles,
        ...(raw.media?.tiles ?? {}),
      },
      imageSettings: {
        ...BASE_STATE.media.imageSettings,
        ...(raw.media?.imageSettings ?? {}),
      },
      cloud: {
        ...BASE_STATE.media.cloud,
        ...(raw.media?.cloud ?? {}),
        connections: {
          ...BASE_STATE.media.cloud.connections,
          ...(raw.media?.cloud?.connections ?? {}),
        },
      },
      local: {
        ...BASE_STATE.media.local,
        ...(raw.media?.local ?? {}),
      },
      history: {
        ...BASE_STATE.media.history,
        ...(raw.media?.history ?? {}),
      },
    },
    settings: {
      ...BASE_STATE.settings,
      ...(raw.settings ?? {}),
      general: {
        ...BASE_STATE.settings.general,
        ...(raw.settings?.general ?? {}),
      },
      multilingual: {
        ...BASE_STATE.settings.multilingual,
        ...(raw.settings?.multilingual ?? {}),
      },
      database: {
        ...BASE_STATE.settings.database,
        ...(raw.settings?.database ?? {}),
      },
      notifications: {
        ...BASE_STATE.settings.notifications,
        ...(raw.settings?.notifications ?? {}),
      },
      advanced: {
        ...BASE_STATE.settings.advanced,
        ...(raw.settings?.advanced ?? {}),
      },
    },
  };
};

const DEFAULT_STATE: AppState = (typeof window !== 'undefined' && window.PRODEXFO_APP_STATE)
  ? mergeInitialState(window.PRODEXFO_APP_STATE)
  : BASE_STATE;

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ initialState, children }: AppStateProviderProps) {
  const [state, setStateInternal] = useState<AppState>(initialState ?? DEFAULT_STATE);

  const value = useMemo<AppStateContextValue>(
    () => ({
      state,
      setState: (updater) => {
        setStateInternal((prev) => updater(prev));
      },
    }),
    [state]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateContextValue {
  const context = useContext(AppStateContext);

  if (!context) {
    throw new Error('useAppState must be used within AppStateProvider');
  }

  return context;
}
