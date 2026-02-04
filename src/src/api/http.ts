export type AjaxParams = Record<string, unknown>;

export interface AjaxResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export async function restGet<T>(endpoint: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const url = new URL(endpoint, window.location.origin);

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }

    url.searchParams.append(key, String(value));
  });

  const response = await fetch(url.toString(), {
    method: 'GET',
    credentials: 'same-origin',
    headers: {
      'X-WP-Nonce': window.PRODEXFO_APP_STATE?.nonces?.rest ?? '',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || response.statusText);
  }

  return (await response.json()) as T;
}

export async function restPost<T>(endpoint: string, body?: Record<string, unknown>): Promise<T> {
  const response = await fetch(endpoint, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'X-WP-Nonce': window.PRODEXFO_APP_STATE?.nonces?.rest ?? '',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || response.statusText);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
}

export async function restDelete<T>(endpoint: string): Promise<T> {
  const response = await fetch(endpoint, {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: {
      'X-WP-Nonce': window.PRODEXFO_APP_STATE?.nonces?.rest ?? '',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || response.statusText);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
}

function buildFormData(params: AjaxParams): FormData {
  const formData = new FormData();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }

    if (value instanceof Blob) {
      formData.append(key, value);
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (entry === undefined || entry === null) {
          return;
        }

        formData.append(`${key}[]`, String(entry));
      });
      return;
    }

    formData.append(key, String(value));
  });

  return formData;
}

export async function postForm<T>(url: string, params: AjaxParams): Promise<AjaxResponse<T>> {
  const response = await fetch(url, {
    method: 'POST',
    body: buildFormData(params),
    credentials: 'same-origin',
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
    },
  });

  const raw = await response.text();

  let parsed: unknown;
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch (error) {
    throw new Error(raw || 'Unexpected server response.');
  }

  if (!response.ok) {
    const message = (parsed as { message?: string }).message ?? response.statusText;
    throw new Error(message || 'Request failed');
  }

  if (!parsed || typeof parsed !== 'object' || !('success' in parsed)) {
    throw new Error('Malformed server response.');
  }

  return parsed as AjaxResponse<T>;
}
