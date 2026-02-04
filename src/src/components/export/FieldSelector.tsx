import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Check, Lock } from 'lucide-react';
import type { FieldDescriptor, FieldSection } from '@/utils/field-sections';
import { useAppState } from '@/context/AppStateContext';

interface FieldSelectorProps {
  sections: FieldSection[];
  onAddField: (fieldId: string) => void;
  selectedFieldIds: string[];
  mediaFieldsEnabled?: boolean;
}

export function FieldSelector({ sections, onAddField, selectedFieldIds, mediaFieldsEnabled = true }: FieldSelectorProps) {
  const { state } = useAppState();
  const getString = (key: string, fallback: string): string => {
    const raw = state.strings?.[key];
    return typeof raw === 'string' ? raw : fallback;
  };

  const defaultExpanded = useMemo(() => sections.slice(0, 2).map((section) => section.id), [sections]);
  const [expandedSections, setExpandedSections] = useState<string[]>(defaultExpanded);

  const toggleSection = (sectionName: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionName)
        ? prev.filter(s => s !== sectionName)
        : [...prev, sectionName]
    );
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-200 h-full flex flex-col">
      <div className="mb-4">
        <h3 className="text-gray-900 font-semibold mb-2 block-heading">
          {getString('exportAvailableFieldsTitle', 'Available Fields')}
        </h3>
        <p className="text-gray-500 block-subheading">
          {getString('exportAvailableFieldsSubtitle', 'Select fields to export')}
        </p>
      </div>

      <div className="flex-1 overflow-auto">
        {sections.map((section) => {
          const isMediaSection = section.id === 'media';
          const sectionDisabled = isMediaSection && !mediaFieldsEnabled;

          return (
            <div key={section.id} className="mb-2">
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-2">
                  {expandedSections.includes(section.id) ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                  <span className="text-gray-700 section-heading">
                    {getString(`exportFieldGroup_${section.id}`, section.label)}
                  </span>
                </div>
                <span className="text-gray-400 text-label">
                  {section.fields.length}
                </span>
              </button>

              {expandedSections.includes(section.id) && (
                <div className="ml-6 mt-1 space-y-1">
                  {section.fields.map((field) => {
                    const isSelected = selectedFieldIds.includes(field.id);
                    return (
                      <button
                        key={field.id}
                        onClick={() => (sectionDisabled ? undefined : onAddField(field.id))}
                        disabled={sectionDisabled}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-left ${
                          isSelected
                            ? 'bg-red-50 text-[#FF3A2E]'
                            : sectionDisabled
                            ? 'text-gray-400 cursor-not-allowed'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span className="text-gray-700 field-label">
                          {field.label}
                        </span>
                        {isSelected ? (
                          <Check className="w-4 h-4 text-[#FF3A2E]" />
                        ) : (
                          <Plus className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
