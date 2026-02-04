import React, { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import {
  Image,
  Archive,
  Cloud,
  FolderOpen,
  Settings,
  X,
  Upload,
  Trash2,
  Check,
  Lock as LockIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAppState } from '@/context/AppStateContext';
import type { MediaCloudProviderDefinition, MediaHistoryEntry } from '@/types/app-state';
import {
  deleteMediaHistoryEntry,
  exportMediaLocal,
  exportMediaZip,
  exportMediaCloud,
  fetchMediaHistory,
  saveMediaCloudConfig,
  saveMediaLocalPreferences,
  saveMediaImageSettings,
} from '@/api/media';

interface MediaExportProps {
  onShowPro: () => void;
}

type TileId = 'urls' | 'zip' | 'cloud' | 'local';

const detectDevEnvironment = (): boolean => {
  try {
    const meta = import.meta as unknown as { env?: { DEV?: boolean } };
    if (meta?.env?.DEV !== undefined) {
      return Boolean(meta.env.DEV);
    }
  } catch (error) {
    // noop - fallback below
  }

  if (typeof process !== 'undefined' && (process as unknown as { env?: { NODE_ENV?: string } })?.env?.NODE_ENV) {
    return (process as unknown as { env?: { NODE_ENV?: string } }).env?.NODE_ENV !== 'production';
  }

  return false;
};

const SIZE_OPTION_KEYS = ['full', 'large', 'medium', 'thumbnail'] as const;
type SizeOptionKey = (typeof SIZE_OPTION_KEYS)[number];

const QUALITY_OPTION_KEYS = ['original', 'high', 'medium', 'low'] as const;
type QualityOptionKey = (typeof QUALITY_OPTION_KEYS)[number];

const formatHistoryDate = (value: string): string => {
  try {
    return new Date(value).toLocaleString();
  } catch (error) {
    return value;
  }
};

export function MediaExport({ onShowPro }: MediaExportProps): ReactElement {
  const { state, setState } = useAppState();
  const mediaState = state.media;
  const restBaseUrl = state.urls?.rest ?? '';
  const getString = (key: string, fallback: string): string => {
    const raw = state.strings?.[key];
    return typeof raw === 'string' ? raw : fallback;
  };
  const isDev = detectDevEnvironment();
  const providerLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    mediaState.cloud.providers.forEach((provider) => {
      map[provider.id] = provider.label;
    });
    return map;
  }, [mediaState.cloud.providers]);

  const [isCloudModalOpen, setCloudModalOpen] = useState(false);
  const [cloudModalProviderId, setCloudModalProviderId] = useState<string>(
    mediaState.cloud.selectedProvider ?? mediaState.cloud.providers[0]?.id ?? ''
  );
  const [cloudModalFields, setCloudModalFields] = useState<Record<string, string>>(() => {
    const providerId = mediaState.cloud.selectedProvider ?? mediaState.cloud.providers[0]?.id ?? '';
    return { ...(mediaState.cloud.connections[providerId] ?? {}) };
  });
  const [cloudModalAttachZip, setCloudModalAttachZip] = useState<boolean>(mediaState.cloud.attachAsZip);
  const [cloudModalFormat, setCloudModalFormat] = useState<'files' | 'zip'>(mediaState.cloud.transferFormat);
  const [isBusy, setIsBusy] = useState(false);

  const normalizeError = (error: unknown, fallback: string): string => {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    if (typeof error === 'string' && error) {
      return error;
    }
    return fallback;
  };

  const hasCapability = (flag: boolean): boolean => (isDev ? true : flag);

  const handleTileToggle = (tile: TileId, next: boolean): void => {
    setState((prev) => ({
      ...prev,
      media: {
        ...prev.media,
        tiles: {
          ...prev.media.tiles,
          [tile]: next,
        },
      },
    }));
  };

  const handleImageSettingChange = <K extends keyof typeof mediaState.imageSettings>(
    key: K,
    value: (typeof mediaState.imageSettings)[K],
  ): void => {
    setState((prev) => ({
      ...prev,
      media: {
        ...prev.media,
        imageSettings: {
          ...prev.media.imageSettings,
          [key]: value,
        },
      },
    }));
  };

  const handleLocalPathChange = (value: string): void => {
    setState((prev) => ({
      ...prev,
      media: {
        ...prev.media,
        local: {
          ...prev.media.local,
          targetPath: value,
        },
      },
    }));
  };

  const refreshHistory = async (): Promise<void> => {
    if (!restBaseUrl) {
      return;
    }

    setIsBusy(true);
    try {
      const response = await fetchMediaHistory(restBaseUrl);
      setState((prev) => ({
        ...prev,
        media: {
          ...prev.media,
          history: {
            ...prev.media.history,
            entries: response.entries,
          },
        },
      }));
    } catch (error) {
      console.warn('Failed to refresh media history', error);
    } finally {
      setIsBusy(false);
    }
  };

  const removeHistoryEntry = async (id: string): Promise<void> => {
    if (!restBaseUrl) {
      return;
    }

    setIsBusy(true);
    try {
      await deleteMediaHistoryEntry(restBaseUrl, id);
      setState((prev) => ({
        ...prev,
        media: {
          ...prev.media,
          history: {
            ...prev.media.history,
            entries: prev.media.history.entries.filter((entry) => entry.id !== id),
          },
        },
      }));
    } catch (error) {
      window.alert(normalizeError(error, getString('mediaHistoryDeleteFailed', 'Failed to delete history entry.')));
    } finally {
      setIsBusy(false);
    }
  };

  useEffect(() => {
    void refreshHistory();
  }, [restBaseUrl]);

  const handleLocalExport = async (): Promise<void> => {
    if (!mediaState.local.targetPath) {
      window.alert(
        getString(
          'mediaLocalExportMissingPath',
          'Specify a destination folder before starting local export.',
        ),
      );
      return;
    }

    if (!restBaseUrl) {
      window.alert(getString('mediaRestBaseUrlMissing', 'REST API base URL is not configured.'));
      return;
    }

    setIsBusy(true);
    try {
      await saveMediaLocalPreferences(restBaseUrl, {
        targetPath: mediaState.local.targetPath,
        format: mediaState.local.lastExportFormat,
      });

      const response = await exportMediaLocal(restBaseUrl, {
        targetPath: mediaState.local.targetPath,
        format: mediaState.local.lastExportFormat,
      });

      setState((prev) => ({
        ...prev,
        media: {
          ...prev.media,
          history: {
            ...prev.media.history,
            entries: [response.historyEntry, ...prev.media.history.entries].slice(0, 20),
          },
        },
      }));
    } catch (error) {
      window.alert(normalizeError(error, getString('mediaLocalExportFailed', 'Local export failed.')));
    } finally {
      setIsBusy(false);
    }
  };

  const handleZipExport = async (): Promise<void> => {
    if (!restBaseUrl) {
      window.alert(getString('mediaRestBaseUrlMissing', 'REST API base URL is not configured.'));
      return;
    }

    setIsBusy(true);
    try {
      const response = await exportMediaZip(restBaseUrl);

      setState((prev) => ({
        ...prev,
        media: {
          ...prev.media,
          history: {
            ...prev.media.history,
            entries: [response.historyEntry, ...prev.media.history.entries].slice(0, 20),
          },
        },
      }));
    } catch (error) {
      window.alert(normalizeError(error, getString('mediaZipExportFailed', 'ZIP export failed.')));
    } finally {
      setIsBusy(false);
    }
  };

  const handleCloudExport = async (): Promise<void> => {
    if (!mediaState.cloud.isConfigured || !mediaState.cloud.selectedProvider) {
      window.alert(
        getString('mediaCloudExportNotConfigured', 'Configure a cloud provider first.'),
      );
      return;
    }

    if (!restBaseUrl) {
      window.alert(getString('mediaRestBaseUrlMissing', 'REST API base URL is not configured.'));
      return;
    }

    setIsBusy(true);
    try {
      const response = await exportMediaCloud(restBaseUrl, {
        provider: mediaState.cloud.selectedProvider ?? undefined,
        transferFormat: mediaState.cloud.transferFormat,
      });

      setState((prev) => ({
        ...prev,
        media: {
          ...prev.media,
          history: {
            ...prev.media.history,
            entries: [response.historyEntry, ...prev.media.history.entries].slice(0, 20),
          },
        },
      }));
    } catch (error) {
      window.alert(normalizeError(error, getString('mediaCloudExportFailed', 'Cloud export failed.')));
    } finally {
      setIsBusy(false);
    }
  };

  const openCloudModal = (): void => {
    const providerId = mediaState.cloud.selectedProvider ?? mediaState.cloud.providers[0]?.id ?? '';
    setCloudModalProviderId(providerId);
    setCloudModalFields({ ...(mediaState.cloud.connections[providerId] ?? {}) });
    setCloudModalAttachZip(mediaState.cloud.attachAsZip);
    setCloudModalFormat(mediaState.cloud.transferFormat);
    setCloudModalOpen(true);
  };

  const handleApplyCloudModal = async (): Promise<void> => {
    if (!cloudModalProviderId) {
      window.alert('Select a provider to continue.');
      return;
    }

    if (!restBaseUrl) {
      window.alert(getString('mediaRestBaseUrlMissing', 'REST API base URL is not configured.'));
      return;
    }

    setIsBusy(true);
    try {
      const response = await saveMediaCloudConfig(restBaseUrl, {
        provider: cloudModalProviderId,
        fields: cloudModalFields,
        attachAsZip: cloudModalAttachZip,
        transferFormat: cloudModalFormat,
      });

      setState((prev) => ({
        ...prev,
        media: {
          ...prev.media,
          cloud: {
            ...prev.media.cloud,
            ...response.cloud,
            providers: prev.media.cloud.providers,
          },
        },
      }));

      setCloudModalOpen(false);
    } catch (error) {
      window.alert(normalizeError(error, getString('mediaCloudConfigSaveFailed', 'Failed to save cloud settings.')));
    } finally {
      setIsBusy(false);
    }
  };

  const handleTileGuard = (condition: boolean): boolean => {
    if (!condition) {
      onShowPro();
    }
    return condition;
  };

  const cloudProviderFields = (providerId: string): MediaCloudProviderDefinition | undefined =>
    mediaState.cloud.providers.find((provider) => provider.id === providerId);

  type CapabilityKey = keyof typeof mediaState.capabilities;

  type TileDefinition = {
    id: TileId;
    title: string;
    description: string;
    icon: LucideIcon;
    capability?: CapabilityKey;
  };

  const tileDefinitions: TileDefinition[] = [
    {
      id: 'urls',
      title: getString('mediaTileUrlsTitle', 'Export Image URLs'),
      description: getString('mediaTileUrlsDescription', 'Include image URLs in separate columns'),
      icon: Image,
    },
    {
      id: 'zip',
      title: getString('mediaTileZipTitle', 'Create ZIP Archive'),
      description: getString('mediaTileZipDescription', 'Download all product images as a ZIP file'),
      icon: Archive,
      capability: 'zip',
    },
    {
      id: 'cloud',
      title: getString('mediaTileCloudTitle', 'Upload to Cloud Storage'),
      description: getString(
        'mediaTileCloudDescription',
        'Automatically upload images to Google Drive, Dropbox or S3',
      ),
      icon: Cloud,
      capability: 'cloud',
    },
    {
      id: 'local',
      title: getString('mediaTileLocalTitle', 'Export to Local Folder'),
      description: getString(
        'mediaTileLocalDescription',
        'Copy all images to a specified directory on your server',
      ),
      icon: FolderOpen,
      capability: 'local',
    },
  ];

  const renderMediaTile = (tile: TileDefinition): ReactElement => {
    const isActive = Boolean(mediaState.tiles[tile.id]);
    const capabilityFlag = tile.capability ? mediaState.capabilities[tile.capability] : true;
    const isUnlocked = hasCapability(capabilityFlag);
    const isLocked = tile.capability ? !isUnlocked : false;
    const Icon = tile.icon;

    const handleToggle = () => {
      if (isLocked && !isDev) {
        onShowPro();
        return;
      }

      handleTileToggle(tile.id, !isActive);
    };
    const cardClasses = `relative bg-white rounded-2xl border-2 p-4 transition-all ${
      isActive && !isLocked ? 'border-[#FF3A2E] shadow-lg' : 'border-gray-200 hover:border-gray-300'
    } ${isLocked ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}`;

    return (
      <div
        key={tile.id}
        role="button"
        tabIndex={isLocked ? -1 : 0}
        onClick={handleToggle}
        onKeyDown={(event) => {
          if ((event.key === 'Enter' || event.key === ' ') && !isLocked) {
            event.preventDefault();
            handleToggle();
          }
        }}
        className={cardClasses}
      >
        {isLocked && (
          <div className="absolute top-4 right-4">
            <span className="px-3 py-1 bg-[#FF3A2E] text-white rounded-lg text-xs flex items-center gap-1">
              <LockIcon className="w-3 h-3" /> PRO
            </span>
          </div>
        )}

        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${
            isActive && !isLocked ? 'bg-[#FF3A2E]' : 'bg-gray-100'
          }`}
        >
          <Icon className={`w-6 h-6 ${isActive && !isLocked ? 'text-white' : 'text-gray-600'}`} />
        </div>

        <h3 className="text-gray-900 mb-2 text-base font-semibold">
          {tile.title}
        </h3>
        <p className="text-gray-600 text-sm mb-3">
          {tile.description}
        </p>
        {tile.id === 'zip' && (
          <div className="mt-3">
            <button
              type="button"
              className="flex items-center gap-2 rounded-xl bg-[#FF3A2E] px-4 py-2 text-sm text-white transition-colors hover:bg-red-600"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (handleTileGuard(hasCapability(mediaState.capabilities.zip))) {
                  void handleZipExport();
                }
              }}
              disabled={isBusy}
            >
              <Upload className="w-4 h-4" />
              {getString('mediaZipExportButton', 'Export ZIP')}
            </button>
          </div>
        )}

        {tile.id === 'local' && (
          <div>
            <p className="text-gray-900 font-semibold text-sm mb-1">
              {getString('mediaLocalPathLabel', 'Local export path')}
            </p>
            <p className="text-sm text-gray-500 leading-snug mb-2">
              {getString('mediaLocalPathDescription', 'Define a destination folder for copied images.')}
            </p>
            <p className="text-gray-900 font-semibold text-sm mb-1">
              {getString('mediaLocalServerPathLabel', 'Server path')}
            </p>
            <div className="flex items-end gap-3 mt-2">
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={mediaState.local.targetPath}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onChange={(event) => handleLocalPathChange(event.target.value)}
                  placeholder={getString('mediaLocalPathPlaceholder', '/path/to/folder')}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF3A2E] focus:border-[#FF3A2E]"
                />
              </div>

              <button
                type="button"
                className="shrink-0 flex items-center gap-2 rounded-xl bg-[#FF3A2E] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (handleTileGuard(hasCapability(mediaState.capabilities.local))) {
                    void handleLocalExport();
                  }
                }}
                disabled={isBusy}
              >
                <Upload className="w-4 h-4" />
                {getString('mediaLocalExportButton', 'Export now')}
              </button>
            </div>
          </div>
        )}

        {tile.id === 'cloud' && (
          <div className="mt-2">
            <p className="text-gray-900 font-semibold text-sm mb-1">
              {getString('mediaCloudControlsTitle', 'Cloud upload controls')}
            </p>
            <p className="text-sm text-gray-500 mb-2">
              {getString(
                'mediaCloudControlsDescription',
                'Configure a provider and trigger media upload jobs.',
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 transition-colors hover:border-[#FF3A2E] hover:text-[#FF3A2E]"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (handleTileGuard(hasCapability(mediaState.capabilities.cloud))) {
                    openCloudModal();
                  }
                }}
                disabled={isBusy}
              >
                <Settings className="w-4 h-4" />
                {getString('mediaCloudConfigureButton', 'Configure')}
              </button>

              <button
                type="button"
                className="flex items-center gap-2 rounded-xl bg-[#FF3A2E] px-3 py-2 text-sm text-white transition-colors hover:bg-red-600"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (handleTileGuard(hasCapability(mediaState.capabilities.cloud))) {
                    void handleCloudExport();
                  }
                }}
                disabled={isBusy}
              >
                <Upload className="w-4 h-4" />
                {getString('mediaCloudExportButton', 'Export')}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-gray-900 page-heading mb-2">
          {getString('mediaTitle', 'Media Export')}
        </h1>
        <p className="text-gray-600 page-subheading">
          {getString('mediaSubtitle', 'Configure and export product media')}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {tileDefinitions.map((tile) => renderMediaTile(tile))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 mt-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-gray-900 block-heading">
            {getString('mediaImageSettingsTitle', 'Image export settings')}
          </h3>
          <span className="text-xs text-gray-500">
            {getString('mediaImageSettingsHint', 'Applies to ZIP / cloud / local exports')}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-6">
          <div>
            <label className="block text-gray-700 mb-2 text-sm">
              {getString('mediaImageSizeLabel', 'Image size')}
            </label>
            <select
              value={mediaState.imageSettings.sizePreset}
              onChange={(event) => {
                handleImageSettingChange(
                  'sizePreset',
                  event.target.value as (typeof mediaState.imageSettings)['sizePreset'],
                );
                if (restBaseUrl) {
                  void saveMediaImageSettings(restBaseUrl, {
                    ...mediaState.imageSettings,
                    sizePreset: event.target.value as (typeof mediaState.imageSettings)['sizePreset'],
                  });
                }
              }}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF3A2E]"
            >
              {SIZE_OPTION_KEYS.map((key) => (
                <option key={key} value={key}>
                  {getString(
                    `mediaImageSizeOption_${key}`,
                    key === 'full'
                      ? 'Full Size (Original)'
                      : key === 'large'
                        ? 'Large (1024x1024)'
                        : key === 'medium'
                          ? 'Medium (300x300)'
                          : 'Thumbnail (150x150)',
                  )}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-gray-700 mb-2 text-sm">
              {getString('mediaImageQualityLabel', 'Quality')}
            </label>
            <select
              value={mediaState.imageSettings.quality}
              onChange={(event) => {
                handleImageSettingChange(
                  'quality',
                  event.target.value as (typeof mediaState.imageSettings)['quality'],
                );
                if (restBaseUrl) {
                  void saveMediaImageSettings(restBaseUrl, {
                    ...mediaState.imageSettings,
                    quality: event.target.value as (typeof mediaState.imageSettings)['quality'],
                  });
                }
              }}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF3A2E]"
            >
              {QUALITY_OPTION_KEYS.map((key) => (
                <option key={key} value={key}>
                  {getString(
                    `mediaImageQualityOption_${key}`,
                    key === 'original'
                      ? 'Original quality'
                      : key === 'high'
                        ? 'High (90%)'
                        : key === 'medium'
                          ? 'Medium (70%)'
                          : 'Low (50%)',
                  )}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-gray-700 mb-2 text-sm">
              {getString('mediaFilenamePatternLabel', 'Filename Pattern')}
            </label>
            <input
              type="text"
              value={mediaState.imageSettings.filenamePattern}
              onChange={(event) => {
                handleImageSettingChange('filenamePattern', event.target.value);
                if (restBaseUrl) {
                  void saveMediaImageSettings(restBaseUrl, {
                    ...mediaState.imageSettings,
                    filenamePattern: event.target.value,
                  });
                }
              }}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF3A2E]"
            />
            <p className="text-gray-500 mt-2 text-xs">
              {getString('mediaFilenamePatternHint', 'Available variables: {product-name}, {sku}, {id}, {date}')}
            </p>
          </div>

          <div className="flex items-center gap-3 md:col-span-2">
            <input
              type="checkbox"
              id="include_gallery"
              checked={mediaState.imageSettings.includeGallery}
              onChange={(event) => {
                handleImageSettingChange('includeGallery', event.target.checked);
                if (restBaseUrl) {
                  void saveMediaImageSettings(restBaseUrl, {
                    ...mediaState.imageSettings,
                    includeGallery: event.target.checked,
                  });
                }
              }}
              className="w-4 h-4 text-[#FF3A2E] border-gray-300 rounded focus:ring-[#FF3A2E]"
            />
            <label htmlFor="include_gallery" className="text-gray-700 text-sm">
              {getString('mediaIncludeGalleryLabel', 'Include gallery images (not just featured image)')}
            </label>
          </div>

          <div className="flex items-center gap-3 md:col-span-2">
            <input
              type="checkbox"
              id="replace_urls"
              checked={mediaState.imageSettings.replaceUrls}
              onChange={(event) => {
                handleImageSettingChange('replaceUrls', event.target.checked);
                if (restBaseUrl) {
                  void saveMediaImageSettings(restBaseUrl, {
                    ...mediaState.imageSettings,
                    replaceUrls: event.target.checked,
                  });
                }
              }}
              className="w-4 h-4 text-[#FF3A2E] border-gray-300 rounded focus:ring-[#FF3A2E]"
            />
            <label htmlFor="replace_urls" className="text-gray-700 text-sm">
              {getString('mediaReplaceUrlsLabel', 'Replace URLs with new paths after upload')}
            </label>
          </div>
        </div>
      </div>

      {/* History */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-gray-900 block-heading">
            {getString('mediaHistoryTitle', 'Recent media exports')}
          </h3>
          <span className="text-xs text-gray-500">
            {getString('mediaHistoryAutoUpdateHint', 'Auto-updates without page reload')}
          </span>
        </div>
        {mediaState.history.entries.length === 0 ? (
          <p className="text-sm text-gray-500">
            {getString(
              'mediaHistoryEmpty',
              'No exports yet. Run a ZIP, cloud, or local export to see entries here.',
            )}
          </p>
        ) : (
          <div className="space-y-3">
            {mediaState.history.entries.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 p-3 border border-gray-100 rounded-xl"
              >
                <div>
                  <p className="text-gray-900 text-sm font-semibold">
                    {entry.destination === 'cloud'
                      ? providerLabelMap[entry.provider] ?? entry.provider
                      : entry.provider === 'local'
                      ? getString('mediaHistoryLocalProviderLabel', 'Local folder')
                      : entry.provider}
                  </p>
                  <p className="text-xs text-gray-500">{formatHistoryDate(entry.createdAt)}</p>
                  {entry.details && <p className="text-xs text-gray-500 mt-1">{entry.details}</p>}
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span className="px-2 py-1 rounded-full bg-gray-100">{entry.format.toUpperCase()}</span>
                  <span>{entry.sizeLabel}</span>
                  <button
                    type="button"
                    className="text-gray-400 hover:text-red-500"
                    onClick={() => removeHistoryEntry(entry.id)}
                    aria-label={getString('mediaHistoryRemoveEntryAria', 'Remove history entry')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isCloudModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-8">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h3 className="text-gray-900 block-heading">
                  {getString('mediaCloudModalTitle', 'Configure cloud upload')}
                </h3>
                <p className="text-sm text-gray-500">
                  {getString(
                    'mediaCloudModalDescription',
                    'Select a provider and enter the required credentials.',
                  )}
                </p>
              </div>
              <button className="p-2 rounded-lg hover:bg-gray-100" onClick={() => setCloudModalOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100">
              <div className="p-6 space-y-3">
                {mediaState.cloud.providers.map((provider) => (
                  <button
                    key={provider.id}
                    className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${
                      cloudModalProviderId === provider.id
                        ? 'border-[#FF3A2E] text-[#FF3A2E] bg-[#FFF4F2]'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                    onClick={() => {
                      setCloudModalProviderId(provider.id);
                      setCloudModalFields({ ...(mediaState.cloud.connections[provider.id] ?? {}) });
                    }}
                  >
                    <p className="font-medium">{provider.label}</p>
                    {provider.description && <p className="text-xs text-gray-500">{provider.description}</p>}
                  </button>
                ))}
              </div>
              <div className="p-6 md:col-span-2 space-y-4">
                {cloudProviderFields(cloudModalProviderId)?.fields.map((field) => (
                  <div key={field.name}>
                    <label className="block text-sm text-gray-700 mb-1">{field.label}</label>
                    {field.type === 'textarea' ? (
                      <textarea
                        value={cloudModalFields[field.name] ?? ''}
                        onChange={(event) =>
                          setCloudModalFields((prev) => ({
                            ...prev,
                            [field.name]: event.target.value,
                          }))
                        }
                        rows={3}
                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF3A2E]"
                      />
                    ) : (
                      <input
                        type={field.type === 'password' ? 'password' : field.type === 'number' ? 'number' : 'text'}
                        value={cloudModalFields[field.name] ?? ''}
                        onChange={(event) =>
                          setCloudModalFields((prev) => ({
                            ...prev,
                            [field.name]: event.target.value,
                          }))
                        }
                        placeholder={field.placeholder}
                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF3A2E]"
                      />
                    )}
                    {field.description && (
                      <p className="text-xs text-gray-500 mt-1">{field.description}</p>
                    )}
                  </div>
                ))}

                {cloudProviderFields(cloudModalProviderId)?.supportsZipToggle && (
                  <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={cloudModalAttachZip}
                      onChange={(event) => setCloudModalAttachZip(event.target.checked)}
                      className="w-4 h-4 text-[#FF3A2E] border-gray-300 rounded focus:ring-[#FF3A2E]"
                    />
                    {getString(
                      'mediaCloudAttachZipLabel',
                      'Attach exported images as a single ZIP archive',
                    )}
                  </label>
                )}

                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-700">
                  <span>
                    {getString('mediaCloudTransferFormatLabel', 'Transfer format:')}
                  </span>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="cloud-format"
                      value="files"
                      checked={cloudModalFormat === 'files'}
                      onChange={() => setCloudModalFormat('files')}
                    />
                    {getString('mediaCloudTransferFormatFiles', 'Files')}
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="cloud-format"
                      value="zip"
                      checked={cloudModalFormat === 'zip'}
                      onChange={() => setCloudModalFormat('zip')}
                    />
                    {getString('mediaCloudTransferFormatZip', 'ZIP')}
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-700"
                    onClick={() => setCloudModalOpen(false)}
                  >
                    {getString('mediaCloudModalCancel', 'Cancel')}
                  </button>
                  <button
                    type="button"
                    className="px-6 py-2 rounded-xl bg-[#FF3A2E] text-white text-sm hover:bg-red-600 transition-colors"
                    onClick={handleApplyCloudModal}
                  >
                    {getString('mediaCloudModalApply', 'Apply')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
