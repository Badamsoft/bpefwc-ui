import { useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Plus, FileText, Download, Edit, Eye, Trash2, Clock, AlertCircle, UploadCloud } from 'lucide-react';
import { useAppState } from '@/context/AppStateContext';
import type { ExportTemplateItem, ExportFilters } from '@/types/app-state';
import { buildTemplateExportUrl, deleteTemplate, importTemplates, selectTemplate, saveTemplate, TEMPLATE_CREATE_ACTION } from '@/api/templates';
import { SaveTemplateModal } from './modals/SaveTemplateModal';
import { PreviewModal } from './modals/PreviewModal';
import { serializeFiltersForTemplate, mapTemplateFromResponse, mergeTemplateItems, resolveTemplateAction } from '@/utils/templates';
import type { TemplateRequestValue } from '@/utils/templates';
import { buildSelectedFieldList } from '@/utils/field-sections';
import type { FieldDescriptor } from '@/utils/field-sections';

type TemplatesStatusType = 'success' | 'error';

interface TemplatesStatusMessage {
  readonly type: TemplatesStatusType;
  readonly text: string;
}

type PreviewPayload = Record<string, string | string[]>;

interface TemplatesProps {
}

export function Templates({}: TemplatesProps): ReactElement {
  const { state, setState } = useAppState();
  const templateState = state.export.templates;
  const templateStrings = templateState?.strings ?? {};
  const getTemplateString = (key: string, fallback: string): string => {
    const raw = templateStrings[key];
    return typeof raw === 'string' ? raw : fallback;
  };
  const canManageTemplates = state.capabilities['prodexfo_access_templates'] ?? false;
  const canExport = state.capabilities[state.export.templates?.strings?.exportCapability ?? 'prodexfo_access_manual_export'] ?? false;
  const [searchQuery, setSearchQuery] = useState('');
  const [busyTemplateId, setBusyTemplateId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<TemplatesStatusMessage | null>(null);
  const [pendingAction, setPendingAction] = useState<'create' | 'duplicate' | null>(null);
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [showImportArea, setShowImportArea] = useState(false);
  const ajaxUrl = state.urls?.ajax ?? '';
  const templatesNonce = state.nonces?.templates ?? '';
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const items = templateState?.items ?? [];
  const exportState = state.export;
  const filtersSnapshot = exportState.filters as ExportFilters;
  const selectedFields = exportState.initialFields;
  const currentFormat = exportState.selectedFormat ?? Object.keys(exportState.formatOptions ?? {})[0] ?? 'csv';
  const fileSettings = exportState.fileSettings ?? {};
  const attachImagesZip = Boolean(fileSettings.attach_images_zip);
  const filename = typeof fileSettings.filename === 'string' ? fileSettings.filename : 'wc-products-export-{{date}}';
  const delimiter = typeof fileSettings.delimiter === 'string' ? fileSettings.delimiter : ',';
  const encoding = typeof fileSettings.encoding === 'string' ? fileSettings.encoding : 'UTF-8';

  const previewConfig = exportState.preview;
  const previewNonce = state.nonces?.preview ?? '';
  const canPreviewTemplates = Boolean(previewConfig?.action && previewNonce);

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewFields, setPreviewFields] = useState<FieldDescriptor[]>([]);
  const [previewPayload, setPreviewPayload] = useState<PreviewPayload | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<ExportTemplateItem | null>(null);

  const importDisabled = !canManageTemplates || !ajaxUrl || !templatesNonce;

  const filteredTemplates = useMemo(() => {
    const lowerQuery = searchQuery.trim().toLowerCase();
    if (!lowerQuery) {
      return items;
    }

    return items.filter((template) => template.name.toLowerCase().includes(lowerQuery));
  }, [items, searchQuery]);

  const ensureTemplateAccess = () => {
    if (!canManageTemplates) {
      setStatusMessage({
        type: 'error',
        text: getTemplateString(
          'templatePermissionError',
          'You do not have permission to manage templates.',
        ),
      });
      return false;
    }

    if (!ajaxUrl || !templatesNonce) {
      setStatusMessage({
        type: 'error',
        text: getTemplateString(
          'actionsUnavailable',
          'Template actions unavailable. Please refresh the page.'
        ),
      });
      return false;
    }

    return true;
  };

  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processImportFile = async (file: File | null) => {
    if (!file) {
      setStatusMessage({
        type: 'error',
        text: getTemplateString('errorNoFile', 'Select a CSV file to import.'),
      });
      return;
    }

    if (!ensureTemplateAccess()) {
      resetFileInput();
      return;
    }

    if (!/\.csv$/i.test(file.name)) {
      setStatusMessage({
        type: 'error',
        text: getTemplateString('importInvalidFile', 'Only CSV files are supported.'),
      });
      resetFileInput();
      return;
    }

    setIsImporting(true);
    setStatusMessage(null);

    try {
      const response = await importTemplates(ajaxUrl, templatesNonce, file, replaceExisting);

      if (!response || !response.success) {
        throw new Error(
          getTemplateString('importFailedInternal', 'Failed to import templates.')
        );
      }

      const rawTemplates = response.data?.templates ?? [];

      if (!rawTemplates.length) {
        setStatusMessage({
          type: 'error',
          text: getTemplateString(
            'importFileNoData',
            'The file does not contain template data.'
          ),
        });
        return;
      }

      const mappedTemplates = rawTemplates
        .map((entry, index) => {
          const payload = entry.data ?? entry.template ?? {};
          const fallbackId = typeof payload.id === 'string' && payload.id
            ? payload.id
            : `imported-${Date.now()}-${index}`;
          const fallbackName = typeof payload.name === 'string' && payload.name.length > 0
            ? payload.name
            : `Imported template ${index + 1}`;

          return mapTemplateFromResponse(payload, {
            id: fallbackId,
            name: fallbackName,
          });
        })
        .filter((template) => Boolean(template?.id));

      if (!mappedTemplates.length) {
        setStatusMessage({
          type: 'error',
          text: getTemplateString(
            'importParseFailed',
            'Unable to parse templates from file.'
          ),
        });
        return;
      }

      const templateForQuickExport = mappedTemplates[0] ?? null;

      setState((prev) => ({
        ...prev,
        initialScreen: templateForQuickExport ? 'export' : prev.initialScreen,
        export: {
          ...prev.export,
          templateToLoad: templateForQuickExport ?? prev.export.templateToLoad ?? null,
          templates: prev.export.templates
            ? {
                ...prev.export.templates,
                editing: null,
              }
            : prev.export.templates,
        },
      }));

      setStatusMessage({
        type: 'success',
        text: templateForQuickExport
          ? getTemplateString(
              'importSuccessWithQuickExport',
              `${mappedTemplates.length} template(s) imported. First template loaded into Quick Export; save it if needed.`
            )
          : getTemplateString(
              'importSuccess',
              `${mappedTemplates.length} template(s) imported.`
            ),
      });
    } catch (error) {
      const fallback = getTemplateString('importFailed', 'Template import failed.');
      const message = error instanceof Error ? error.message : fallback;
      setStatusMessage({ type: 'error', text: message });
    } finally {
      setIsImporting(false);
      resetFileInput();
    }
  };

  const handleImportButtonClick = () => {
    if (!ensureTemplateAccess()) {
      return;
    }

    if (!showImportArea) {
      setShowImportArea(true);
    }

    fileInputRef.current?.click();
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files && event.target.files[0] ? event.target.files[0] : null;
    void processImportFile(file);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragActive(false);

    if (importDisabled) {
      return;
    }

    const file = event.dataTransfer?.files && event.dataTransfer.files[0] ? event.dataTransfer.files[0] : null;

    if (file) {
      void processImportFile(file);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!importDisabled) {
      setIsDragActive(true);
    }
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (event.currentTarget.contains(event.relatedTarget as Node)) {
      return;
    }

    setIsDragActive(false);
  };

  const handleExport = (template: ExportTemplateItem) => {
    if (!canExport) {
      setStatusMessage({
        type: 'error',
        text: getTemplateString(
          'exportPermissionError',
          'You do not have permission to export.',
        ),
      });
      return;
    }

    if (!ajaxUrl || !templatesNonce) {
      setStatusMessage({
        type: 'error',
        text: getTemplateString(
          'exportEndpointUnavailable',
          'Export endpoint is not available. Please reload the page.'
        ),
      });
      return;
    }

    const url = buildTemplateExportUrl(ajaxUrl, templatesNonce, template.id);
    window.open(url, '_blank', 'noopener');
  };

  const handleCreateTemplate = () => {
    if (!canManageTemplates) {
      setStatusMessage({
        type: 'error',
        text: getTemplateString(
          'templatePermissionError',
          'You do not have permission to manage templates.',
        ),
      });
      return;
    }

    setState((prev) => ({
      ...prev,
      initialScreen: 'export',
      export: {
        ...prev.export,
        templates: prev.export.templates
          ? {
              ...prev.export.templates,
              editing: null,
            }
          : prev.export.templates,
        pendingReset: true,
      },
    }));
  };

  const handleSaveTemplate = async ({ name, templateId }: { name: string; templateId?: string }) => {
    if (!ajaxUrl || !templatesNonce) {
      throw new Error(
        getTemplateString(
          'templateAjaxUnavailable',
          'Template AJAX endpoint unavailable. Please refresh the page.'
        )
      );
    }

    const trimmedName = name.trim();
    const normalizedName = trimmedName.toLowerCase();

    const itemsForLookup = templateState?.items ?? [];
    const exactMatch = itemsForLookup.find((item) => item.name.toLowerCase() === normalizedName);
    const mode: 'create' | 'update' = templateId ? 'update' : (exactMatch ? 'update' : 'create');
    const existingTemplate = templateId ? itemsForLookup.find((item) => item.id === templateId) : exactMatch;
    const resolvedTemplateId = existingTemplate?.id ?? templateId ?? '';

    const payload: Record<string, TemplateRequestValue> = {
      action: resolveTemplateAction(mode),
      nonce: templatesNonce,
      template_name: trimmedName,
      template_description: existingTemplate?.description ?? '',
    };

    if (mode === 'update' && resolvedTemplateId) {
      payload.template_id = resolvedTemplateId;
    }

    payload.fields = selectedFields;
    payload.fields_order = JSON.stringify(selectedFields);
    payload.export_format = currentFormat;
    payload.export_delimiter = delimiter;
    payload.export_encoding = encoding;
    payload.export_filename = filename;

    if (attachImagesZip) {
      payload.export_attach_images_zip = 1;
    }

    const filterPayload = serializeFiltersForTemplate(filtersSnapshot);
    Object.entries(filterPayload).forEach(([key, value]) => {
      payload[key] = value;
    });

    const response = await saveTemplate(ajaxUrl, payload);

    if (!response || !response.success) {
      throw new Error(getTemplateString('templateSaveFailed', 'Failed to save template.'));
    }

    const templatePayload = response.data?.template ?? response.data?.data ?? {};
    const mappedTemplate = mapTemplateFromResponse(templatePayload, {
      id: resolvedTemplateId || (typeof templatePayload.id === 'string' ? templatePayload.id : ''),
      name: trimmedName,
    });

    setState((prev) => {
      const currentTemplates = prev.export.templates ?? {
        items: [],
        selected: '',
        strings: {},
      };

      const updatedItems = mergeTemplateItems(currentTemplates.items ?? [], mappedTemplate);

      return {
        ...prev,
        export: {
          ...prev.export,
          templates: {
            ...currentTemplates,
            items: updatedItems,
            selected: mappedTemplate.id,
          },
        },
      };
    });

    setStatusMessage({
      type: 'success',
      text:
        mode === 'update'
          ? getTemplateString('toastUpdated', 'Template updated.')
          : getTemplateString('toastSaved', 'Template saved.'),
    });

    setPendingAction(null);
    setPendingTemplateId(null);
  };

  const handleDuplicateConfirm = async ({ name }: { name: string; templateId?: string }) => {
    if (!pendingTemplateId) {
      return;
    }

    const sourceTemplate = items.find((item) => item.id === pendingTemplateId);

    if (!sourceTemplate) {
      throw new Error(
        getTemplateString('duplicateOriginalNotFound', 'Original template not found.')
      );
    }

    if (!ajaxUrl || !templatesNonce) {
      throw new Error('Template AJAX endpoint unavailable. Please refresh the page.');
    }

    const trimmedName = name.trim();

    const payload: Record<string, TemplateRequestValue> = {
      action: TEMPLATE_CREATE_ACTION,
      nonce: templatesNonce,
      template_name: trimmedName,
      template_description: sourceTemplate.description ?? '',
      fields: sourceTemplate.fields ?? [],
      fields_order: JSON.stringify(sourceTemplate.fields ?? []),
      export_format: sourceTemplate.format ?? currentFormat,
      export_delimiter: (sourceTemplate.settings?.delimiter as string) ?? delimiter,
      export_encoding: (sourceTemplate.settings?.encoding as string) ?? encoding,
      export_filename: (sourceTemplate.settings?.filename as string) ?? filename,
    };

    if (sourceTemplate.settings?.attach_images_zip) {
      payload.export_attach_images_zip = 1;
    }

    const filterPayload = sourceTemplate.filters
      ? serializeFiltersForTemplate(sourceTemplate.filters as unknown as ExportFilters)
      : {};
    Object.entries(filterPayload).forEach(([key, value]) => {
      payload[key] = value;
    });

    const response = await saveTemplate(ajaxUrl, payload);

    if (!response || !response.success) {
      throw new Error('Failed to save template.');
    }

    const templatePayload = response.data?.template ?? response.data?.data ?? {};
    const mappedTemplate = mapTemplateFromResponse(templatePayload, {
      id: typeof templatePayload.id === 'string' ? templatePayload.id : '',
      name: trimmedName,
    });

    setState((prev) => {
      const currentTemplates = prev.export.templates ?? {
        items: [],
        selected: '',
        strings: {},
      };

      const updatedItems = mergeTemplateItems(currentTemplates.items ?? [], mappedTemplate);

      return {
        ...prev,
        export: {
          ...prev.export,
          templates: {
            ...currentTemplates,
            items: updatedItems,
            selected: mappedTemplate.id,
          },
        },
      };
    });

    setStatusMessage({
      type: 'success',
      text: getTemplateString('toastSaved', 'Template saved.'),
    });
    setPendingAction(null);
    setPendingTemplateId(null);
  };

  const handleEdit = (template: ExportTemplateItem) => {
    if (!canManageTemplates) {
      setStatusMessage({
        type: 'error',
        text: getTemplateString(
          'templatePermissionError',
          'You do not have permission to manage templates.',
        ),
      });
      return;
    }

    const templateId = template.id;

    setState((prev) => ({
      ...prev,
      initialScreen: 'export',
      export: {
        ...prev.export,
        templates: prev.export.templates
          ? {
              ...prev.export.templates,
              editing: { templateId },
            }
          : prev.export.templates,
      },
    }));
  };

  const handleDuplicate = (template: ExportTemplateItem) => {
    if (!canManageTemplates) {
      setStatusMessage({
        type: 'error',
        text: getTemplateString(
          'templatePermissionError',
          'You do not have permission to manage templates.',
        ),
      });
      return;
    }

    setPendingAction('duplicate');
    setPendingTemplateId(template.id);
  };

  const handlePreview = (template: ExportTemplateItem) => {
    if (!canPreviewTemplates || !previewConfig || !previewConfig.action || !previewNonce || !ajaxUrl) {
      setStatusMessage({
        type: 'error',
        text: getTemplateString(
          'previewUnavailable',
          'Preview is unavailable. Please refresh the page.'
        ),
      });
      if (!canPreviewTemplates) {
        setStatusMessage({
          type: 'error',
          text: getTemplateString(
            'previewUnavailable',
            'Preview is unavailable. Please refresh the page.',
          ),
        });
      }
      return;
    }

    if (!template.fields || template.fields.length === 0) {
      setStatusMessage({
        type: 'error',
        text: getTemplateString(
          'previewNoColumns',
          'Template has no columns selected for preview.'
        ),
      });
      return;
    }

    const fieldDescriptors = buildSelectedFieldList(exportState, template.fields);

    if (!fieldDescriptors.length) {
      setStatusMessage({
        type: 'error',
        text: getTemplateString(
          'previewPrepareFailed',
          'Unable to prepare fields for preview.'
        ),
      });
      return;
    }

    const payload: Record<string, string | string[]> = {};
    payload['fields[]'] = template.fields.map((field) => String(field));
    payload.fields_order = JSON.stringify(template.fields);

    if (template.filters) {
      const filterPayload = serializeFiltersForTemplate(template.filters as unknown as ExportFilters);
      Object.entries(filterPayload).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          payload[key] = value.map((entry) => String(entry));
        } else {
          payload[key] = String(value);
        }
      });
    }

    const limitValue = String(previewConfig.limit ?? 20);
    payload.action = previewConfig.action;
    payload.nonce = previewNonce;
    payload.limit = limitValue;

    setStatusMessage(null);
    setPreviewTemplate(template);
    setPreviewFields(fieldDescriptors);
    setPreviewPayload(payload);
    setIsPreviewOpen(true);
  };

  const handleDelete = async (template: ExportTemplateItem) => {
    if (!canManageTemplates) {
      setStatusMessage({
        type: 'error',
        text: getTemplateString(
          'templatePermissionError',
          'You do not have permission to manage templates.',
        ),
      });
      return;
    }

    if (!ajaxUrl || !templatesNonce) {
      setStatusMessage({
        type: 'error',
        text: getTemplateString(
          'actionsUnavailableReload',
          'Template actions are unavailable. Please reload the page.'
        ),
      });
      return;
    }

    // Prevent concurrent operations on multiple templates
    if (busyTemplateId) {
      return;
    }

    setBusyTemplateId(template.id);
    setStatusMessage(null);

    try {
      await deleteTemplate(ajaxUrl, templatesNonce, template.id);

      setState((prev) => {
        if (!prev.export.templates) {
          return prev;
        }

        const updatedItems = prev.export.templates.items.filter((item) => item.id !== template.id);
        const selected = prev.export.templates.selected === template.id ? '' : prev.export.templates.selected;

        return {
          ...prev,
          export: {
            ...prev.export,
            templates: {
              ...prev.export.templates,
              items: updatedItems,
              selected,
            },
          },
        };
      });

      setStatusMessage({
        type: 'success',
        text: getTemplateString('toastDeleted', 'Template deleted successfully.'),
      });
    } catch (error) {
      const fallback = getTemplateString('deleteFailed', 'Failed to delete template.');
      const message = error instanceof Error ? error.message : fallback;
      setStatusMessage({ type: 'error', text: message });
    } finally {
      setBusyTemplateId(null);
    }
  };

  const handleSelect = async (templateId: string) => {
    if (!canManageTemplates) {
      return;
    }

    if (!ajaxUrl || !templatesNonce) {
      setStatusMessage({ type: 'error', text: 'Template actions are unavailable. Please reload the page.' });
      return;
    }

    if (busyTemplateId === templateId) {
      return;
    }

    setBusyTemplateId(templateId);
    try {
      const response = await selectTemplate(ajaxUrl, templatesNonce, templateId);
      const payload = response.data;

      setState((prev) => {
        if (!prev.export.templates) {
          return prev;
        }

        const updatedItems = payload.template
          ? prev.export.templates.items.map((item) => (item.id === payload.template?.id ? { ...item, ...payload.template } : item))
          : prev.export.templates.items;

        return {
          ...prev,
          export: {
            ...prev.export,
            templates: {
              ...prev.export.templates,
              selected: payload.template_id ?? '',
              items: updatedItems,
            },
          },
        };
      });

      setStatusMessage({
        type: 'success',
        text: getTemplateString('statusApplied', 'Template applied as default.'),
      });
    } catch (error) {
      const fallback = getTemplateString('applyFailed', 'Failed to apply template.');
      const message = error instanceof Error ? error.message : fallback;
      setStatusMessage({ type: 'error', text: message });
    } finally {
      setBusyTemplateId(null);
    }
  };

  const handleModalSave = async (payload: { name: string; templateId?: string }) => {
    if (pendingAction === 'duplicate') {
      await handleDuplicateConfirm(payload);
    } else {
      await handleSaveTemplate(payload);
    }
  };

  const handleModalClose = () => {
    setPendingAction(null);
    setPendingTemplateId(null);
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-gray-900 font-semibold mb-2 page-heading">
          {getTemplateString('templatesTitle', 'Export Templates')}
        </h1>
        <p className="text-gray-600 page-subheading">
          {getTemplateString('templatesSubtitle', 'Save and reuse your export configurations')}
        </p>
      </div>

      <div className="mb-6 flex items-center gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder={getTemplateString('templatesSearchPlaceholder', 'Search templates...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF3A2E] focus:border-transparent text-body"
          />
        </div>
        <button
          onClick={handleCreateTemplate}
          className="px-6 py-3 bg-[#FF3A2E] text-white rounded-xl hover:bg-red-600 transition-colors flex items-center gap-2 shadow-lg shadow-red-500/20"
          type="button"
        >
          <Plus className="w-5 h-5" />
          {getTemplateString('templatesCreateButton', 'Create Template')}
        </button>
        <button
          type="button"
          onClick={handleImportButtonClick}
          disabled={importDisabled || isImporting}
          className={`px-6 py-3 rounded-xl transition-colors flex items-center gap-2 border ${
            importDisabled
              ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Download className="w-5 h-5" />
          {isImporting
            ? getTemplateString('templatesImportingLabel', 'Importing…')
            : getTemplateString('templatesImportButton', 'Import')}
        </button>
      </div>

      {showImportArea && (
        <div
          className={`mb-6 rounded-2xl border-2 border-dashed p-6 transition-colors ${
            importDisabled
              ? 'border-gray-200 bg-gray-50 text-gray-400'
              : isDragActive
                  ? 'border-[#FF3A2E] bg-red-50'
                  : 'border-gray-200 bg-white'
          }`}
          onDragEnter={handleDragOver}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          aria-disabled={importDisabled}
        >
          <div className="flex flex-col items-center text-center gap-3">
            <UploadCloud className="w-10 h-10 text-gray-500" />
            <p className="text-gray-700">
              {getTemplateString(
                'templatesDropHint',
                'Drag a CSV export file here or select it manually.'
              )}
            </p>
            <div className="flex flex-col items-center gap-4">
              <button
                type="button"
                onClick={handleImportButtonClick}
                disabled={importDisabled || isImporting}
                className={`px-6 py-2 rounded-xl border transition-colors ${
                  importDisabled
                    ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                    : 'border-gray-300 text-gray-700 hover:border-[#FF3A2E] hover:text-[#FF3A2E]'
                }`}
              >
                {isImporting
                  ? getTemplateString('templatesImportingLabel', 'Importing…')
                  : getTemplateString('templatesChooseFileButton', 'Choose CSV File')}
              </button>
              <label className={`flex items-center gap-2 text-sm ${importDisabled ? 'text-gray-400' : 'text-gray-600'}`}>
                <input
                  type="checkbox"
                  checked={replaceExisting}
                  onChange={(event) => setReplaceExisting(event.target.checked)}
                  disabled={importDisabled || isImporting}
                />
                {getTemplateString(
                  'templatesReplaceExistingLabel',
                  'Replace templates with the same ID'
                )}
              </label>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv,application/vnd.ms-excel"
            className="hidden"
            onChange={handleFileInputChange}
            disabled={importDisabled}
          />
        </div>
      )}

      {statusMessage && (
        <div
          className={`mb-6 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
            statusMessage.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-green-200 bg-green-50 text-green-700'
          }`}
          role="status"
        >
          <AlertCircle className="w-4 h-4" />
          <span>{statusMessage.text}</span>
        </div>
      )}

      {filteredTemplates.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-900 mb-2 field-label">
            {getTemplateString('templatesEmptyTitle', 'No templates found')}
          </p>
          <p className="text-gray-500 text-label">
            {getTemplateString(
              'templatesEmptySubtitle',
              'Create your first export template to get started'
            )}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-6">
          {filteredTemplates.map((template) => {
            const isSelected = templateState?.selected === template.id;

            return (
              <div
                key={template.id}
                className={`bg-white rounded-2xl border p-6 transition-all group ${
                  isSelected
                    ? 'border-[#FF3A2E] shadow-lg'
                    : 'border-gray-200 hover:border-[#FF3A2E] hover:shadow-lg'
                }`}
                onClick={() => handleSelect(template.id)}
                role={canManageTemplates ? 'button' : undefined}
                tabIndex={canManageTemplates ? 0 : -1}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-[#FF3A2E] to-red-600 rounded-xl flex items-center justify-center">
                    <FileText className="w-6 h-6 text-white" />
                  </div>
                  <div className="space-y-2 mb-4 flex-1 ml-4">
                    <div className="text-gray-900 text-base font-semibold">
                      {template.name || getTemplateString('templatesUnnamedLabel', 'Untitled template')}
                    </div>
                    <div className="flex items-center justify-between text-gray-600 text-label">
                      <span>{getTemplateString('templatesFormatLabel', 'Format:')}</span>
                      <span className="text-gray-900">{template.format?.toUpperCase() ?? '—'}</span>
                    </div>
                    <div className="flex items-center justify-between text-gray-600 text-label">
                      <span>{getTemplateString('templatesFieldsLabel', 'Fields:')}</span>
                      <span className="text-gray-900">
                        {template.fields?.length ?? '—'}{' '}
                        {getTemplateString('templatesColumnsSuffix', 'columns')}
                      </span>
                    </div>
                    {template.updated_at && (
                      <div className="flex items-center gap-2 text-gray-500 text-caption">
                        <Clock className="w-3 h-3" />
                        <span>
                          {getTemplateString('templatesUpdatedPrefix', 'Updated')}{' '}
                          {template.updated_at}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleExport(template)}
                    disabled={!canExport}
                    className={`flex-1 px-4 py-2 rounded-xl transition-colors ${
                      canExport
                        ? 'bg-[#FF3A2E] text-white hover:bg-red-600 shadow-sm'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    } text-label`}
                  >
                    {getTemplateString('templatesExportButton', 'Export')}
                  </button>
                  <button
                    className="p-2 hover:bg-gray-50 rounded-xl transition-colors"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleEdit(template);
                    }}
                    disabled={!canManageTemplates}
                    type="button"
                  >
                    <Edit className="w-4 h-4 text-gray-600" />
                  </button>
                  <button
                    className="p-2 hover:bg-gray-50 rounded-xl transition-colors"
                    onClick={(event) => {
                      event.stopPropagation();
                      handlePreview(template);
                    }}
                    disabled={!canPreviewTemplates}
                    type="button"
                  >
                    <Eye className="w-4 h-4 text-gray-600" />
                  </button>
                  <button
                    className="p-2 hover:bg-red-50 rounded-xl transition-colors"
                    onClick={() => handleDelete(template)}
                    disabled={!canManageTemplates || busyTemplateId === template.id}
                  >
                    <Trash2 className="w-4 h-4 text-[#FF3A2E]" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pendingAction && canManageTemplates && (
        <SaveTemplateModal
          templates={items}
          onClose={handleModalClose}
          onSave={async (formData) => {
            await handleModalSave(formData);
          }}
        />
      )}

      {isPreviewOpen && previewPayload && previewConfig && previewTemplate && (
        <PreviewModal
          fields={previewFields}
          payload={previewPayload}
          ajaxUrl={ajaxUrl}
          config={previewConfig}
          nonce={previewNonce}
          onClose={() => {
            setIsPreviewOpen(false);
            setTimeout(() => {
              setPreviewTemplate(null);
              setPreviewPayload(null);
              setPreviewFields([]);
            }, 0);
          }}
          onExport={() => {
            if (previewTemplate) {
              handleExport(previewTemplate);
            }
          }}
        />
      )}
    </div>
  );
}
