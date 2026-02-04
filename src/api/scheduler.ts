import type { AjaxResponse } from './http';
import { postForm, restGet } from './http';
import type { SchedulerTask } from '@/types/app-state';

export interface ScheduleCommandResponse {
  success?: boolean;
  message?: string;
  code?: string;
  notices?: Array<{ code: string; message: string; type: string }>;
}

export type ScheduleAjaxResponse<T = ScheduleCommandResponse> = AjaxResponse<T>;

type SchedulerAjaxAction = 'create' | 'toggle' | 'delete' | 'run' | 'clear_error';

function schedulerAjax<T>(ajaxUrl: string, nonce: string, scheduleAction: SchedulerAjaxAction, params: Record<string, unknown> = {}): Promise<ScheduleAjaxResponse<T>> {
  return postForm<T>(ajaxUrl, {
    action: 'prodexfo_schedule_action',
    prodexfo_schedule_nonce: nonce,
    prodexfo_schedule_action: scheduleAction,
    ...params,
  });
}

export async function createOrUpdateSchedule(
  ajaxUrl: string,
  nonce: string,
  payload: Record<string, unknown>,
): Promise<ScheduleAjaxResponse<ScheduleCommandResponse>> {
  return schedulerAjax<ScheduleCommandResponse>(ajaxUrl, nonce, 'create', payload);
}

export async function toggleSchedule(
  ajaxUrl: string,
  nonce: string,
  taskId: number,
): Promise<ScheduleAjaxResponse<ScheduleCommandResponse>> {
  return schedulerAjax<ScheduleCommandResponse>(ajaxUrl, nonce, 'toggle', { task_id: taskId });
}

export async function clearScheduleError(
  ajaxUrl: string,
  nonce: string,
  taskId: number,
): Promise<ScheduleAjaxResponse<ScheduleCommandResponse>> {
  return schedulerAjax<ScheduleCommandResponse>(ajaxUrl, nonce, 'clear_error', { task_id: taskId });
}

export async function deleteSchedule(
  ajaxUrl: string,
  nonce: string,
  taskId: number,
): Promise<ScheduleAjaxResponse<ScheduleCommandResponse>> {
  return schedulerAjax<ScheduleCommandResponse>(ajaxUrl, nonce, 'delete', { task_id: taskId });
}

export async function runScheduleNow(
  ajaxUrl: string,
  nonce: string,
  taskId: number,
): Promise<ScheduleAjaxResponse<ScheduleCommandResponse>> {
  return schedulerAjax<ScheduleCommandResponse>(ajaxUrl, nonce, 'run', { task_id: taskId });
}

export async function fetchSchedulerTasks(restBaseUrl: string): Promise<{ tasks: SchedulerTask[] }> {
  return restGet<{ tasks: SchedulerTask[] }>(`${restBaseUrl}scheduler/tasks`);
}
