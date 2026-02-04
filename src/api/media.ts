import { restDelete, restGet, restPost } from './http';
import type { MediaCloudState, MediaHistoryEntry, MediaImageSettings, MediaLocalState } from '@/types/app-state';

export type MediaHistoryEntryApi = {
  id: string;
  provider: string;
  destination: 'urls' | 'zip' | 'cloud' | 'local';
  format: 'files' | 'zip';
  sizeLabel: string;
  createdAt: string;
  details?: string;
  fileUrl?: string;
  status?: string;
};

function normalizeHistoryEntry(entry: MediaHistoryEntryApi): MediaHistoryEntry {
  return {
    id: entry.id,
    provider: entry.provider,
    destination: entry.destination,
    format: entry.format,
    sizeLabel: entry.sizeLabel,
    createdAt: entry.createdAt,
    ...(entry.details ? { details: entry.details } : {}),
  };
}

export async function saveMediaCloudConfig(
  restBaseUrl: string,
  payload: {
    provider: string;
    fields: Record<string, string>;
    attachAsZip: boolean;
    transferFormat: 'files' | 'zip';
  },
): Promise<{ cloud: Omit<MediaCloudState, 'providers'> }> {
  return restPost<{ cloud: Omit<MediaCloudState, 'providers'> }>(`${restBaseUrl}media/cloud-config`, payload);
}

export async function saveMediaLocalPreferences(
  restBaseUrl: string,
  payload: { targetPath: string; format: 'files' | 'zip' },
): Promise<{ local: MediaLocalState }> {
  return restPost<{ local: MediaLocalState }>(`${restBaseUrl}media/local`, payload);
}

export async function saveMediaImageSettings(
  restBaseUrl: string,
  settings: MediaImageSettings,
): Promise<{ imageSettings: MediaImageSettings }> {
  return restPost<{ imageSettings: MediaImageSettings }>(`${restBaseUrl}media/settings`, { settings });
}

export async function exportMediaZip(
  restBaseUrl: string,
  payload: { filters?: Record<string, unknown> } = {},
): Promise<{ historyEntry: MediaHistoryEntry; zip?: unknown }> {
  const response = await restPost<{ historyEntry: MediaHistoryEntryApi; zip?: unknown }>(`${restBaseUrl}media/export/zip`, payload);
  return {
    zip: response.zip,
    historyEntry: normalizeHistoryEntry(response.historyEntry),
  };
}

export async function exportMediaLocal(
  restBaseUrl: string,
  payload: { filters?: Record<string, unknown>; targetPath?: string; format?: 'files' | 'zip' } = {},
): Promise<{ historyEntry: MediaHistoryEntry; files?: unknown }> {
  const response = await restPost<{ historyEntry: MediaHistoryEntryApi; files?: unknown }>(`${restBaseUrl}media/export/local`, payload);
  return {
    files: response.files,
    historyEntry: normalizeHistoryEntry(response.historyEntry),
  };
}

export async function exportMediaCloud(
  restBaseUrl: string,
  payload: { filters?: Record<string, unknown>; provider?: string; transferFormat?: 'files' | 'zip' } = {},
): Promise<{ historyEntry: MediaHistoryEntry; uploads?: unknown }> {
  const response = await restPost<{ historyEntry: MediaHistoryEntryApi; uploads?: unknown }>(`${restBaseUrl}media/export/cloud`, payload);
  return {
    uploads: response.uploads,
    historyEntry: normalizeHistoryEntry(response.historyEntry),
  };
}

export async function fetchMediaHistory(restBaseUrl: string): Promise<{ entries: MediaHistoryEntry[] }> {
  const response = await restGet<{ entries: MediaHistoryEntryApi[] }>(`${restBaseUrl}media/history`);
  return { entries: Array.isArray(response.entries) ? response.entries.map(normalizeHistoryEntry) : [] };
}

export async function deleteMediaHistoryEntry(restBaseUrl: string, id: string): Promise<{ deleted: boolean }> {
  return restDelete<{ deleted: boolean }>(`${restBaseUrl}media/history/${encodeURIComponent(id)}`);
}
