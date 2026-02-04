import { restGet, restPost } from './http';
import type { CapabilityMap, MediaState, PluginInfoStrings } from '@/types/app-state';

export interface LicenseApiResponse {
  license: PluginInfoStrings;
  capabilities?: CapabilityMap;
  media?: MediaState;
}

export async function fetchLicenseStatus(restBaseUrl: string, refresh = false): Promise<LicenseApiResponse> {
  return restGet<LicenseApiResponse>(`${restBaseUrl}license/status`, refresh ? { refresh: 1 } : {});
}

export async function activateLicense(restBaseUrl: string, license: string): Promise<LicenseApiResponse> {
  return restPost<LicenseApiResponse>(`${restBaseUrl}license/activate`, { license });
}

export async function deactivateLicense(restBaseUrl: string): Promise<LicenseApiResponse> {
  return restPost<LicenseApiResponse>(`${restBaseUrl}license/deactivate`);
}
