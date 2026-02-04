export interface AjaxResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface AjaxErrorShape {
  success?: boolean;
  data?: unknown;
  message?: string;
  code?: string;
}
