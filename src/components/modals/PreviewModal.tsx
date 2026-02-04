import { useEffect, useMemo, useState } from 'react';
import { X, Download } from 'lucide-react';
import type { FieldDescriptor } from '@/utils/field-sections';
import type { PreviewConfig } from '@/types/app-state';

interface PreviewModalProps {
  fields: FieldDescriptor[];
  payload: Record<string, string | string[]>;
  ajaxUrl: string;
  config: PreviewConfig;
  nonce: string;
  onClose: () => void;
  onExport: () => void;
}

interface PreviewColumn {
  key: string;
  label: string;
  private?: boolean;
  group?: string;
}

type PreviewRow = Record<string, unknown>;

interface PreviewResponse {
  columns: PreviewColumn[];
  rows: PreviewRow[];
  count: number;
  limit: number;
  truncated: boolean;
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((entry) => formatValue(entry)).join(', ');
  }

  if (value === null || value === undefined) {
    return '—';
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (error) {
      return String(value);
    }
  }

  const trimmed = String(value).trim();
  return trimmed === '' ? '—' : trimmed;
}

function buildFallbackColumns(fields: FieldDescriptor[]): PreviewColumn[] {
  return fields.map((field) => ({
    key: field.id,
    label: field.name,
  }));
}

export function PreviewModal({ fields, payload, ajaxUrl, config, nonce, onClose, onExport }: PreviewModalProps) {
  const [data, setData] = useState<PreviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchPreview() {
      setIsLoading(true);
      setError(null);

      try {
        const formData = new FormData();

        Object.entries(payload).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            value.forEach((entry) => {
              formData.append(key, String(entry));
            });
          } else {
            formData.append(key, String(value));
          }
        });

        if (config.action && !formData.has('action')) {
          formData.append('action', config.action);
        }

        if (!formData.has('nonce')) {
          formData.append('nonce', nonce);
        }

        const limitValue = String(config.limit ?? 20);
        if (!formData.has('limit')) {
          formData.append('limit', limitValue);
        }

        const response = await fetch(ajaxUrl, {
          method: 'POST',
          body: formData,
          credentials: 'same-origin',
          headers: {
            'X-Requested-With': 'XMLHttpRequest',
          },
          signal: controller.signal,
        });

        const raw = await response.text();
        const parsed = raw ? JSON.parse(raw) : {};

        if (!response.ok || !parsed || typeof parsed !== 'object' || !parsed.success) {
          const message =
            (parsed && parsed.data && typeof parsed.data === 'object' && 'message' in parsed.data)
              ? String(parsed.data.message)
              : response.statusText || 'Unable to load preview.';
          throw new Error(message || 'Unable to load preview.');
        }

        const payloadData = parsed.data as Partial<PreviewResponse>;

        setData({
          columns: Array.isArray(payloadData.columns) ? payloadData.columns : [],
          rows: Array.isArray(payloadData.rows) ? payloadData.rows : [],
          count: typeof payloadData.count === 'number' ? payloadData.count : (Array.isArray(payloadData.rows) ? payloadData.rows.length : 0),
          limit: typeof payloadData.limit === 'number' ? payloadData.limit : Number(limitValue),
          truncated: Boolean(payloadData.truncated),
        });
      } catch (exception) {
        if (controller.signal.aborted) {
          return;
        }

        setError(exception instanceof Error ? exception.message : 'Unable to load preview.');
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    fetchPreview().catch(() => {
      setError('Unable to load preview.');
      setIsLoading(false);
    });

    return () => {
      controller.abort();
    };
  }, [ajaxUrl, config.action, config.limit, nonce, payload]);

  const columns: PreviewColumn[] = useMemo(() => {
    if (data && data.columns.length > 0) {
      return data.columns;
    }

    return buildFallbackColumns(fields);
  }, [data, fields]);

  const rows = data?.rows ?? [];
  const summaryText = useMemo(() => {
    if (!data) {
      return '';
    }

    if (!rows.length) {
      return 'No data found for the selected filters.';
    }

    if (data.truncated) {
      return `Showing first ${data.limit} rows · ${columns.length} columns`;
    }

    const rowLabel = data.count === 1 ? 'row' : 'rows';
    return `Showing ${data.count} ${rowLabel} · ${columns.length} columns`;
  }, [columns.length, data, rows.length]);

  const renderBody = () => {
    if (isLoading) {
      return (
        <div className="flex-1 flex items-center justify-center p-10">
          <p className="text-gray-500 text-label">
            Loading preview…
          </p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex-1 flex items-center justify-center p-10">
          <p className="text-red-600 text-label">
            {error}
          </p>
        </div>
      );
    }

    if (!rows.length) {
      return (
        <div className="flex-1 flex items-center justify-center p-10">
          <p className="text-gray-500 text-label">
            No data found for the selected filters.
          </p>
        </div>
      );
    }

    return (
      <div className="flex-1 overflow-auto p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={`px-4 py-3 text-left text-gray-600 border-b border-gray-200 text-caption uppercase tracking-wide ${column.private ? 'italic' : ''}`}
                  >
                    {column.label || column.key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-gray-50">
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-4 py-3 text-gray-900 text-label ${column.private ? 'italic text-gray-500' : ''}`}
                    >
                      {formatValue((row as PreviewRow)[column.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-8">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-gray-900 block-heading mb-1">Data Preview</h2>
            {summaryText && (
              <p className="text-gray-500 text-label">{summaryText}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {renderBody()}

        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <p className="text-gray-500 text-label">Preview reflects current field order and filter settings.</p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onExport();
              }}
              className="px-6 py-3 bg-[#FF3A2E] text-white rounded-xl hover:bg-red-600 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
