import { restPost } from './http';
import type { SettingsState } from '@/types/app-state';

export interface SaveSettingsResponse {
  settings: SettingsState;
}

export interface CleanupResponse {
  status: string;
  message?: string;
}

export async function saveSettings(restBaseUrl: string, settings: SettingsState): Promise<SettingsState> {
  const endpoint = `${restBaseUrl}settings`;
  const response = await restPost<SaveSettingsResponse>(endpoint, { settings });

  if (!response || typeof response !== 'object' || !('settings' in response)) {
    throw new Error('Malformed response while saving settings.');
  }

  return response.settings;
}

export async function cleanupDatabase(restBaseUrl: string): Promise<CleanupResponse> {
  const endpoint = `${restBaseUrl}settings/cleanup`;
  const response = await restPost<CleanupResponse>(endpoint);

  if (!response || typeof response !== 'object' || !('status' in response)) {
    throw new Error('Malformed response while triggering cleanup.');
  }

  return response;
}
