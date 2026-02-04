import { postForm } from './http';

export const TEMPLATE_CREATE_ACTION = 'prodexfo_template_create';
export const TEMPLATE_UPDATE_ACTION = 'prodexfo_template_update';
export const TEMPLATE_DELETE_ACTION = 'prodexfo_template_delete';
export const TEMPLATE_EXPORT_ACTION = 'prodexfo_template_export';
export const TEMPLATE_IMPORT_ACTION = 'prodexfo_template_import';
export const TEMPLATE_SELECT_ACTION = 'prodexfo_template_select';

interface DeleteTemplatePayload {
  deleted: boolean;
  template_id: string;
}

interface SelectTemplatePayload {
  template_id: string;
  template?: {
    id: string;
    name: string;
    description?: string;
    updated_at?: string;
    [key: string]: unknown;
  };
}

export async function deleteTemplate(ajaxUrl: string, nonce: string, templateId: string) {
  return postForm<DeleteTemplatePayload>(ajaxUrl, {
    action: TEMPLATE_DELETE_ACTION,
    nonce,
    template_id: templateId,
  });
}

export async function selectTemplate(ajaxUrl: string, nonce: string, templateId: string | '') {
  return postForm<SelectTemplatePayload>(ajaxUrl, {
    action: TEMPLATE_SELECT_ACTION,
    nonce,
    template_id: templateId,
  });
}

interface SaveTemplatePayload {
  template: Record<string, unknown>;
  data: Record<string, unknown>;
}

type TemplateRequestValue = string | number | boolean | Array<string | number>;

export async function saveTemplate(
  ajaxUrl: string,
  payload: Record<string, TemplateRequestValue>
) {
  return postForm<SaveTemplatePayload>(ajaxUrl, payload);
}

interface ImportTemplatesPayload {
  imported: number;
  templates: Array<{
    template?: Record<string, unknown>;
    data?: Record<string, unknown>;
  }>;
}

export async function importTemplates(
  ajaxUrl: string,
  nonce: string,
  file: File,
  replaceExisting: boolean
) {
  return postForm<ImportTemplatesPayload>(ajaxUrl, {
    action: TEMPLATE_IMPORT_ACTION,
    nonce,
    template_file: file,
    replace_existing: replaceExisting ? '1' : '',
  });
}

export function buildTemplateExportUrl(ajaxUrl: string, nonce: string, templateId: string) {
  const url = new URL(ajaxUrl, window.location.origin);
  url.searchParams.set('action', TEMPLATE_EXPORT_ACTION);
  url.searchParams.set('nonce', nonce);
  url.searchParams.set('template_id', templateId);

  return url.toString();
}

export const templateActionKeys = {
  create: TEMPLATE_CREATE_ACTION,
  update: TEMPLATE_UPDATE_ACTION,
  delete: TEMPLATE_DELETE_ACTION,
  select: TEMPLATE_SELECT_ACTION,
  export: TEMPLATE_EXPORT_ACTION,
  import: TEMPLATE_IMPORT_ACTION,
} as const;
