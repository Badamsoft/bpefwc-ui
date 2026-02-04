import type { ExportState } from '@/types/app-state';

const GROUP_LABELS: Record<string, string> = {
  general: 'General',
  pricing: 'Pricing',
  inventory: 'Inventory',
  content: 'Content',
  taxonomy: 'Taxonomies',
  media: 'Media',
  attributes: 'Attributes',
  acf: 'Advanced Custom Fields',
  acf_fields: 'Advanced Custom Fields',
  meta: 'Meta Fields',
  multilingual: 'Multilingual',
  other: 'Other',
};

const GROUP_ALIASES: Record<string, string> = {
  acf_fields: 'acf',
  'advanced custom fields': 'acf',
};

const GROUP_ORDER = ['general', 'pricing', 'content', 'inventory', 'attributes', 'taxonomy', 'media', 'acf', 'meta'];
const GROUP_ORDER_MAP = GROUP_ORDER.reduce<Record<string, number>>((acc, group, index) => {
  acc[group] = index;
  return acc;
}, {});
const SECTION_FIELD_ORDER: Record<string, string[]> = {
  media: ['featured_image', 'gallery_images', 'all_images'],
};

export interface FieldDescriptor {
  id: string;
  name: string;
  label: string;
  section: string;
  group: string;
  isPro: boolean;
}

export interface FieldSection {
  id: string;
  label: string;
  isPro: boolean;
  fields: FieldDescriptor[];
}

export function buildFieldSections(exportState: ExportState): FieldSection[] {
  const sectionsMap = new Map<string, FieldSection>();

  Object.entries(exportState.fieldDefinitions).forEach(([fieldId, definition]) => {
    const group = typeof definition.group === 'string' && definition.group.length > 0
      ? definition.group
      : 'other';
    const normalizedGroup = group.toLowerCase();
    const resolvedGroup = GROUP_ALIASES[normalizedGroup] ?? normalizedGroup;
    const groupLabel = GROUP_LABELS[resolvedGroup] ?? GROUP_LABELS.other;
    const isPro = false;
    const metadata = exportState.fieldMetadata?.[fieldId] as { label?: unknown } | undefined;
    const metadataLabel = typeof metadata?.label === 'string' ? metadata.label : undefined;
    const label = metadataLabel ?? definition.label ?? fieldId;

    if (!sectionsMap.has(resolvedGroup)) {
      sectionsMap.set(resolvedGroup, {
        id: resolvedGroup,
        label: groupLabel,
        isPro,
        fields: [],
      });
    }

    sectionsMap.get(resolvedGroup)!.fields.push({
      id: fieldId,
      name: label,
      label,
      section: groupLabel,
      group: resolvedGroup,
      isPro,
    });
  });

  const sections = Array.from(sectionsMap.values())
    .map((section) => ({
      ...section,
      fields: section.fields.sort((a, b) => {
        const customOrder = SECTION_FIELD_ORDER[section.id];
        if (customOrder) {
          const orderMap = customOrder.reduce<Record<string, number>>((acc, fieldId, index) => {
            acc[fieldId] = index;
            return acc;
          }, {});
          const orderA = orderMap[a.id];
          const orderB = orderMap[b.id];

          if (orderA !== undefined && orderB !== undefined) {
            return orderA - orderB;
          }

          if (orderA !== undefined) {
            return -1;
          }

          if (orderB !== undefined) {
            return 1;
          }
        }

        return a.label.localeCompare(b.label);
      }),
    }))
    .sort((a, b) => {
      const orderA = GROUP_ORDER_MAP[a.id];
      const orderB = GROUP_ORDER_MAP[b.id];

      if (orderA !== undefined && orderB !== undefined) {
        return orderA - orderB;
      }

      if (orderA !== undefined) {
        return -1;
      }

      if (orderB !== undefined) {
        return 1;
      }

      return a.label.localeCompare(b.label);
    });

  return sections;
}

export function buildSelectedFieldList(
  exportState: ExportState,
  fieldIds: string[]
): FieldDescriptor[] {
  const sections = buildFieldSections(exportState);
  const descriptorIndex = new Map<string, FieldDescriptor>();

  sections.forEach((section) => {
    section.fields.forEach((field) => {
      descriptorIndex.set(field.id, field);
    });
  });

  return fieldIds
    .map((id) => descriptorIndex.get(id))
    .filter((value): value is FieldDescriptor => Boolean(value));
}
