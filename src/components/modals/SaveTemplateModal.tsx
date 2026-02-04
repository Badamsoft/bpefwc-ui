import { useEffect, useMemo, useState } from 'react';
import { X, Save as SaveIcon } from 'lucide-react';
import type { ExportTemplateItem } from '@/types/app-state';

interface SaveTemplateModalProps {
  templates: ExportTemplateItem[];
  onClose: () => void;
  onSave: (payload: { name: string; templateId?: string }) => Promise<void>;
  guard?: {
    message: string;
    type?: 'error' | 'info';
    disableSave?: boolean;
  } | null;
}

export function SaveTemplateModal({ templates, onClose, onSave, guard }: SaveTemplateModalProps) {
  const [name, setName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (guard?.message && guard.disableSave) {
      setFormError(guard.message);
    } else if (!guard?.disableSave) {
      setFormError(null);
    }
  }, [guard?.message, guard?.disableSave]);

  const trimmedName = name.trim();

  const suggestions = useMemo(() => {
    const query = trimmedName.toLowerCase();

    if (!query) {
      return templates.slice(0, 8);
    }

    return templates
      .filter((template) => template.name.toLowerCase().includes(query))
      .slice(0, 8);
  }, [templates, trimmedName]);

  const matchedTemplate = useMemo(() => {
    const query = trimmedName.toLowerCase();

    if (!query) {
      return null;
    }

    return templates.find((template) => template.name.toLowerCase() === query) ?? null;
  }, [templates, trimmedName]);

  const modeLabel = matchedTemplate ? 'Update existing template' : 'Create new template';

  const handleSubmit = async (event?: React.SyntheticEvent) => {
    event?.preventDefault?.();

    if (guard?.disableSave) {
      if (guard.message) {
        setFormError(guard.message);
      }
      return;
    }

    if (!trimmedName) {
      setFormError('Enter a template name.');
      return;
    }

    setFormError(null);
    setIsSaving(true);

    try {
      await onSave({ name: trimmedName, templateId: matchedTemplate?.id });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save template.';
      setFormError(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-8">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-gray-900 block-heading mb-1">Save template</h2>
            <p className="text-gray-500 text-label">{modeLabel}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col" noValidate>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-gray-700 text-label mb-2">Template name</label>
              <div className="relative">
                <input
                  type="text"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    if (!guard?.disableSave) {
                      setFormError(null);
                    }
                  }}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => {
                    // delay so the user can click suggestions
                    setTimeout(() => setIsFocused(false), 150);
                  }}
                  placeholder="e.g., Catalog export"
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF3A2E] focus:border-transparent text-body"
                />

                {isFocused && suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-auto z-10">
                    {suggestions.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setName(template.name);
                          setFormError(null);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 text-label"
                      >
                        {template.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-gray-500 text-caption mt-2">
                Pick an existing template from the list or enter a new name to create one.
              </p>
            </div>

            {matchedTemplate && (
              <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl">
                <p className="text-gray-700 text-body">Template “{matchedTemplate.name}” will be updated.</p>
              </div>
            )}

            {formError && (
              <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-label">
                {formError}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between p-6 border-t border-gray-200">
            <p className="text-gray-500 text-label">Current fields, filters, and file settings will be stored in the template.</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSaving}
                className={`px-6 py-3 rounded-2xl text-white transition-colors flex items-center gap-3 text-label ${
                  isSaving ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#FF3A2E] hover:bg-red-600'
                }`}
              >
                <SaveIcon className="w-5 h-5" />
                Save
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
