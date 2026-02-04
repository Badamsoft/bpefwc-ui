import { useState } from 'react';
import { GripVertical, Eye, EyeOff, Settings, Trash2, Download, ChevronDown, Plus } from 'lucide-react';

interface Field {
  id: string;
  label: string;
  category: string;
  isPro?: boolean;
}

interface SelectedField {
  id: string;
  label: string;
  displayName: string;
  visible: boolean;
}

export function ExportView({ onOpenPreview }: { onOpenPreview: () => void }) {
  const [selectedFields, setSelectedFields] = useState<SelectedField[]>([
    { id: 'id', label: 'Product ID', displayName: 'ID', visible: true },
    { id: 'name', label: 'Product Name', displayName: 'Name', visible: true },
    { id: 'price', label: 'Regular Price', displayName: 'Price', visible: true },
  ]);

  const [fileFormat, setFileFormat] = useState('csv');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['basic']));

  const fieldCategories = [
    {
      name: 'Basic',
      id: 'basic',
      fields: [
        { id: 'id', label: 'Product ID', category: 'basic' },
        { id: 'name', label: 'Product Name', category: 'basic' },
        { id: 'sku', label: 'SKU', category: 'basic' },
        { id: 'description', label: 'Description', category: 'basic' },
        { id: 'short_desc', label: 'Short Description', category: 'basic' },
      ],
    },
    {
      name: 'Price',
      id: 'price',
      fields: [
        { id: 'price', label: 'Regular Price', category: 'price' },
        { id: 'sale_price', label: 'Sale Price', category: 'price' },
        { id: 'price_with_tax', label: 'Price with Tax', category: 'price', isPro: true },
      ],
    },
    {
      name: 'Categories',
      id: 'categories',
      fields: [
        { id: 'categories', label: 'Categories', category: 'categories' },
        { id: 'tags', label: 'Tags', category: 'categories' },
        { id: 'category_path', label: 'Category Path', category: 'categories', isPro: true },
      ],
    },
    {
      name: 'Media',
      id: 'media',
      fields: [
        { id: 'image', label: 'Featured Image', category: 'media' },
        { id: 'gallery', label: 'Gallery Images', category: 'media' },
        { id: 'image_alt', label: 'Image Alt Text', category: 'media', isPro: true },
      ],
    },
    {
      name: 'Attributes',
      id: 'attributes',
      isPro: true,
      fields: [
        { id: 'attributes', label: 'All Attributes', category: 'attributes', isPro: true },
        { id: 'variations', label: 'Variations', category: 'attributes', isPro: true },
      ],
    },
    {
      name: 'ACF Fields',
      id: 'acf',
      isPro: true,
      fields: [
        { id: 'acf_brand', label: 'Brand (ACF)', category: 'acf', isPro: true },
        { id: 'acf_warranty', label: 'Warranty (ACF)', category: 'acf', isPro: true },
      ],
    },
  ];

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const addField = (field: Field) => {
    if (!selectedFields.find((f) => f.id === field.id)) {
      setSelectedFields([
        ...selectedFields,
        { id: field.id, label: field.label, displayName: field.label, visible: true },
      ]);
    }
  };

  const removeField = (id: string) => {
    setSelectedFields(selectedFields.filter((f) => f.id !== id));
  };

  const toggleFieldVisibility = (id: string) => {
    setSelectedFields(
      selectedFields.map((f) => (f.id === id ? { ...f, visible: !f.visible } : f))
    );
  };

  return (
    <div className="flex-1 flex gap-6 p-6 overflow-hidden">
      {/* Left Panel - Field Selector */}
      <div className="w-80 bg-white rounded-2xl shadow-sm border border-gray-200 p-6 overflow-y-auto">
        <h3 className="text-gray-900 mb-4">Available Fields</h3>
        <div className="space-y-2">
          {fieldCategories.map((category) => (
            <div key={category.id} className="border border-gray-200 rounded-xl overflow-hidden">
              <button
                onClick={() => toggleCategory(category.id)}
                className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <ChevronDown
                    size={16}
                    className={`transition-transform ${
                      expandedCategories.has(category.id) ? '' : '-rotate-90'
                    }`}
                  />
                  <span className="text-gray-700">{category.name}</span>
                </div>
                {category.isPro && (
                  <span className="px-2 py-0.5 text-xs rounded-md bg-gradient-to-r from-[var(--badam-red)] to-red-600 text-white">
                    PRO
                  </span>
                )}
              </button>
              {expandedCategories.has(category.id) && (
                <div className="p-2 space-y-1">
                  {category.fields.map((field) => (
                    <button
                      key={field.id}
                      onClick={() => addField(field)}
                      disabled={field.isPro}
                      className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors ${
                        field.isPro
                          ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                          : 'hover:bg-red-50 text-gray-700 hover:text-[var(--badam-red)]'
                      }`}
                    >
                      <span className="text-sm">{field.label}</span>
                      {field.isPro && (
                        <span className="text-xs text-gray-400">PRO</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Center Panel - Selected Fields */}
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-gray-900">Export Columns</h3>
            <p className="text-sm text-gray-500 mt-1">
              {selectedFields.length} columns selected
            </p>
          </div>
          <button
            onClick={onOpenPreview}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
          >
            <Eye size={16} />
            Preview Data
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          {selectedFields.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <p>No columns selected</p>
                <p className="text-sm mt-2">Select fields from the left panel</p>
              </div>
            </div>
          ) : (
            selectedFields.map((field, index) => (
              <div
                key={field.id}
                className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl hover:border-[var(--badam-red)] hover:shadow-sm transition-all group"
              >
                <GripVertical size={20} className="text-gray-400 cursor-move" />
                <div className="flex-1">
                  <input
                    type="text"
                    value={field.displayName}
                    onChange={(e) => {
                      const newFields = [...selectedFields];
                      newFields[index].displayName = e.target.value;
                      setSelectedFields(newFields);
                    }}
                    className="w-full bg-transparent border-none outline-none text-gray-900"
                  />
                  <p className="text-xs text-gray-500 mt-1">{field.label}</p>
                </div>
                <button
                  onClick={() => toggleFieldVisibility(field.id)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  {field.visible ? (
                    <Eye size={18} className="text-gray-600" />
                  ) : (
                    <EyeOff size={18} className="text-gray-400" />
                  )}
                </button>
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <Settings size={18} className="text-gray-600" />
                </button>
                <button
                  onClick={() => removeField(field.id)}
                  className="p-2 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={18} className="text-red-600" />
                </button>
              </div>
            ))
          )}
        </div>

        <button
          className="mt-6 w-full py-4 bg-gradient-to-r from-[var(--badam-red)] to-red-600 text-white rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2"
          style={{ fontWeight: 600 }}
        >
          <Download size={20} />
          Export Now ({selectedFields.filter((f) => f.visible).length} columns)
        </button>
      </div>

      {/* Right Panel - Format & Filters */}
      <div className="w-96 space-y-4 overflow-y-auto">
        {/* File Format */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h4 className="text-gray-900 mb-4">File Format</h4>
          <div className="grid grid-cols-2 gap-2">
            {['csv', 'xlsx', 'xml', 'json'].map((format) => (
              <button
                key={format}
                onClick={() => setFileFormat(format)}
                className={`p-3 rounded-xl border-2 transition-all ${
                  fileFormat === format
                    ? 'border-[var(--badam-red)] bg-red-50 text-[var(--badam-red)]'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                }`}
              >
                {format.toUpperCase()}
              </button>
            ))}
          </div>

          {fileFormat === 'csv' && (
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-2">Delimiter</label>
                <select className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white">
                  <option value=",">Comma (,)</option>
                  <option value=";">Semicolon (;)</option>
                  <option value="\t">Tab</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-2">Encoding</label>
                <select className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white">
                  <option value="utf8">UTF-8</option>
                  <option value="utf16">UTF-16</option>
                  <option value="latin1">Latin-1</option>
                </select>
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="rounded" />
                <span className="text-sm text-gray-700">Include BOM</span>
              </label>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-gray-900">Filters</h4>
            <button className="text-[var(--badam-red)] text-sm flex items-center gap-1">
              <Plus size={16} />
              Add Filter
            </button>
          </div>
          <div className="space-y-3">
            <div className="p-3 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Product Status</span>
                <button className="text-gray-400 hover:text-gray-600">
                  <Trash2 size={14} />
                </button>
              </div>
              <select className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm">
                <option>Published</option>
                <option>Draft</option>
                <option>Pending</option>
              </select>
            </div>
            <div className="p-3 border border-gray-200 rounded-lg bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Price Range</span>
                <span className="px-2 py-0.5 text-xs rounded-md bg-gradient-to-r from-[var(--badam-red)] to-red-600 text-white">
                  PRO
                </span>
              </div>
              <div className="text-xs text-gray-400">Available in PRO version</div>
            </div>
          </div>
        </div>

        {/* Preview Stats */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-sm p-6 text-white">
          <p className="text-gray-400 text-sm mb-2">Products to Export</p>
          <p className="text-3xl">1,247</p>
          <p className="text-gray-400 text-sm mt-3">After filters applied</p>
        </div>
      </div>
    </div>
  );
}
