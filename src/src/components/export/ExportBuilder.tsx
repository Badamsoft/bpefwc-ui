"use client";

import { useEffect, useRef, useState, type DragEvent, type PointerEvent } from 'react';
import { GripVertical, Trash2, Settings as SettingsIcon } from 'lucide-react';
import type { FieldDescriptor } from '@/utils/field-sections';
import { useHint } from '@/context/HintContext';
import { useAppState } from '@/context/AppStateContext';

interface ExportBuilderProps {
  fields: FieldDescriptor[];
  onRemoveField: (fieldId: string) => void;
  onReorderFields: (fromIndex: number, toIndex: number) => void;
}

export function ExportBuilder({ fields, onRemoveField, onReorderFields }: ExportBuilderProps) {
  const { state } = useAppState();
  const getString = (key: string, fallback: string): string => {
    const raw = state.strings?.[key];
    return typeof raw === 'string' ? raw : fallback;
  };
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [activeHandleIndex, setActiveHandleIndex] = useState<number | null>(null);
  const [customLabels, setCustomLabels] = useState<Record<string, string>>({});
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const editingInputRef = useRef<HTMLInputElement | null>(null);
  const { showHint } = useHint();
  const hasShownProTipRef = useRef(false);

  const handlePointerDown = (index: number) => (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) {
      return;
    }

    setActiveHandleIndex(index);
  };

  const clearActiveHandle = () => {
    setActiveHandleIndex(null);
  };

  const resetDragState = () => {
    setDraggingIndex(null);
    setDragOverIndex(null);
    setActiveHandleIndex(null);
  };

  const handleDragStart = (index: number) => (event: DragEvent<HTMLDivElement>) => {
    if (activeHandleIndex !== index) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
    setDraggingIndex(index);
    setDragOverIndex(index);
  };

  const handleDragOver = (index: number) => (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = (index: number) => () => {
    if (dragOverIndex === index) {
      setDragOverIndex(null);
    }
  };

  const handleDrop = (index: number) => (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const fromIndex = Number(event.dataTransfer.getData('text/plain'));

    if (!Number.isNaN(fromIndex) && fromIndex !== index) {
      onReorderFields(fromIndex, index);
    }

    resetDragState();
  };

  const handleDragEnd = () => {
    resetDragState();
  };

  const handleStartEditing = (field: FieldDescriptor) => {
    setEditingFieldId(field.id);
    setEditingValue(customLabels[field.id] ?? field.name);
  };

  const handleFinishEditing = (mode: 'save' | 'cancel') => {
    if (!editingFieldId) {
      return;
    }

    const initialValue = fields.find((field) => field.id === editingFieldId)?.name ?? '';

    if (mode === 'cancel') {
      setEditingFieldId(null);
      setEditingValue(initialValue);
      return;
    }

    const trimmed = editingValue.trim();

    if (trimmed === '') {
      setCustomLabels((prev: Record<string, string>) => {
        if (!prev[editingFieldId]) {
          return prev;
        }

        const next = { ...prev };
        delete next[editingFieldId];
        return next;
      });
      setEditingFieldId(null);
      setEditingValue(initialValue);
      return;
    }

    if (trimmed === initialValue) {
      setCustomLabels((prev: Record<string, string>) => {
        if (!prev[editingFieldId]) {
          return prev;
        }

        const next = { ...prev };
        delete next[editingFieldId];
        return next;
      });
    } else {
      setCustomLabels((prev: Record<string, string>) => ({
        ...prev,
        [editingFieldId]: trimmed,
      }));
    }

    setEditingFieldId(null);
    setEditingValue(trimmed);
  };

  useEffect(() => {
    if (!editingFieldId) {
      return;
    }

    requestAnimationFrame(() => {
      if (editingInputRef.current) {
        editingInputRef.current.focus();
        editingInputRef.current.select();
      }
    });
  }, [editingFieldId]);

  useEffect(() => {
    setCustomLabels((prev) => {
      const allowedIds = new Set(fields.map((field) => field.id));
      let changed = false;
      const next: Record<string, string> = {};

      Object.entries(prev).forEach(([fieldId, label]) => {
        if (allowedIds.has(fieldId)) {
          next[fieldId] = label;
        } else {
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [fields]);

  useEffect(() => {
    if (editingFieldId && !fields.some((field) => field.id === editingFieldId)) {
      setEditingFieldId(null);
      setEditingValue('');
    }
  }, [fields, editingFieldId]);

  useEffect(() => {
    if (fields.length > 0 && !hasShownProTipRef.current) {
      showHint({
        id: 'export-builder-pro-tip',
        title: 'Pro Tip',
        description: 'Click a column to rename it or adjust formatting.',
        variant: 'info',
      });
      hasShownProTipRef.current = true;
    }
  }, [fields.length, showHint]);

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-200 h-full flex flex-col">
      <div className="mb-4">
        <h3 className="text-gray-900 font-semibold mb-2 block-heading">
          {getString('exportColumnsTitle', 'Export Columns')}
        </h3>
        <p className="text-gray-500 block-subheading">
          {getString('exportColumnsSubtitle', 'Drag to reorder · %d columns selected').replace('%d', String(fields.length))}
        </p>
      </div>

      {fields.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <SettingsIcon className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-900 mb-1 field-label">
              {getString('exportNoFieldsSelectedTitle', 'No fields selected')}
            </p>
            <p className="text-gray-500 text-label">
              {getString('exportNoFieldsSelectedDescription', 'Select fields from the left panel to start building your export')}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto space-y-2">
          {fields.map((field, index) => {
            const isDragging = draggingIndex === index;
            const isDragOver = dragOverIndex === index && draggingIndex !== index;
            const isEditing = editingFieldId === field.id;
            const displayName = customLabels[field.id]?.trim() || field.name;

            return (
              <div
                key={field.id}
                role="listitem"
                draggable
                onDragStart={handleDragStart(index)}
                onDragOver={handleDragOver(index)}
                onDragLeave={handleDragLeave(index)}
                onDrop={handleDrop(index)}
                onDragEnd={handleDragEnd}
                className={`group bg-gray-50 border border-gray-200 rounded-xl p-4 transition-all ${
                  isDragging ? 'opacity-70 border-[#FF3A2E]/70 shadow-sm' : ''
                } ${isDragOver ? 'border-[#FF3A2E] bg-white shadow-md' : 'hover:border-[#FF3A2E] hover:shadow-sm'}`}
              >
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    data-drag-handle="true"
                    className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
                    onPointerDown={handlePointerDown(index)}
                    onPointerUp={clearActiveHandle}
                    onPointerLeave={clearActiveHandle}
                  >
                    <GripVertical className="w-5 h-5" />
                  </button>

                  <div className="flex-1">
                    {isEditing ? (
                      <input
                        ref={editingFieldId === field.id ? editingInputRef : null}
                        type="text"
                        className="w-full bg-white border border-gray-300 focus:border-[#FF3A2E] focus:ring-[#FF3A2E] rounded-lg px-3 py-1.5 text-gray-900"
                        value={editingValue}
                        onChange={(event) => setEditingValue(event.target.value)}
                        onBlur={() => handleFinishEditing('save')}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            handleFinishEditing('save');
                          } else if (event.key === 'Escape') {
                            event.preventDefault();
                            handleFinishEditing('cancel');
                          }
                        }}
                      />
                    ) : (
                      <p className="text-gray-900 field-label">
                        {displayName}
                      </p>
                    )}
                    <p className="text-gray-500 text-label">
                      {field.section} · Column {index + 1}
                    </p>
                  </div>

                  <div
                    className={`flex items-center gap-1 transition-opacity ${
                      isEditing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    <button
                      type="button"
                      className="p-2 hover:bg-white rounded-lg transition-colors"
                      onClick={() => handleStartEditing(field)}
                    >
                      <span className="dashicons dashicons-admin-generic text-gray-600" />
                    </button>
                    <button
                      onClick={() => onRemoveField(field.id)}
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-[#FF3A2E]" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
