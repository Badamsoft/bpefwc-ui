import { restDelete, restGet, restPost } from './http';
import type { HistoryRun, HistoryState } from '@/types/app-state';

export type HistoryFiltersPayload = HistoryState['filters'];

export async function fetchHistory(
  baseRestUrl: string,
  params: Partial<HistoryFiltersPayload> = {}
): Promise<HistoryState> {
  const endpoint = `${baseRestUrl}history`;
  const response = await restGet<HistoryState>(endpoint, params);

  return response;
}

export async function deleteHistoryRun(baseRestUrl: string, id: number): Promise<void> {
  const endpoint = `${baseRestUrl}history/${id}`;
  await restDelete(endpoint);
}

export interface HistoryBulkDeleteResponse {
  deleted: number;
  failed: number[];
}

export async function deleteHistoryRunsBulk(baseRestUrl: string, ids: number[]): Promise<HistoryBulkDeleteResponse> {
  if (!ids.length) {
    return { deleted: 0, failed: [] };
  }

  const endpoint = `${baseRestUrl}history/bulk-delete`;
  return restPost<HistoryBulkDeleteResponse>(endpoint, { ids });
}

export async function retryHistoryRun(baseRestUrl: string, id: number): Promise<HistoryRun> {
  const endpoint = `${baseRestUrl}history/${id}/retry`;
  const response = await restPost<{ run: HistoryRun }>(endpoint);

  if (!response?.run) {
    throw new Error('Malformed response while retrying export.');
  }

  return response.run;
}
