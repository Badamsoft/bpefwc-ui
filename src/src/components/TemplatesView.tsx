import { Plus, Search, Download, Edit2, Copy, Trash2, FileText } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  format: string;
  fields: number;
  lastUpdated: string;
  description: string;
}

export function TemplatesView() {
  const templates: Template[] = [
    {
      id: '1',
      name: 'Google Shopping Feed',
      format: 'XML',
      fields: 24,
      lastUpdated: '2 days ago',
      description: 'Complete Google Merchant Center export',
    },
    {
      id: '2',
      name: 'Basic Product List',
      format: 'CSV',
      fields: 12,
      lastUpdated: '1 week ago',
      description: 'Simple product export with core fields',
    },
    {
      id: '3',
      name: 'Full Catalog Backup',
      format: 'XLSX',
      fields: 45,
      lastUpdated: '3 days ago',
      description: 'Complete product data with all custom fields',
    },
    {
      id: '4',
      name: 'Facebook Catalog',
      format: 'CSV',
      fields: 18,
      lastUpdated: '5 days ago',
      description: 'Optimized for Facebook product ads',
    },
  ];

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-gray-900 mb-2">Export Templates</h2>
          <p className="text-gray-600">
            Save and reuse your export configurations
          </p>
        </div>

        {/* Actions Bar */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search templates..."
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[var(--badam-red)] focus:border-transparent"
            />
          </div>
          <button className="px-5 py-3 bg-gradient-to-r from-[var(--badam-red)] to-red-600 text-white rounded-xl hover:shadow-lg transition-all flex items-center gap-2">
            <Plus size={20} />
            Create Template
          </button>
          <button className="px-5 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-2">
            <Download size={20} />
            Import
          </button>
        </div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <div
              key={template.id}
              className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg hover:border-[var(--badam-red)] transition-all group"
            >
              {/* Icon */}
              <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center mb-4 group-hover:bg-[var(--badam-red)] transition-colors">
                <FileText className="text-[var(--badam-red)] group-hover:text-white transition-colors" size={24} />
              </div>

              {/* Content */}
              <h3 className="text-gray-900 mb-2">{template.name}</h3>
              <p className="text-sm text-gray-500 mb-4 line-clamp-2">
                {template.description}
              </p>

              {/* Meta */}
              <div className="flex items-center gap-4 mb-4 text-sm text-gray-600">
                <span className="px-3 py-1 bg-gray-100 rounded-lg">
                  {template.format}
                </span>
                <span>{template.fields} fields</span>
              </div>
              <p className="text-xs text-gray-400 mb-4">
                Updated {template.lastUpdated}
              </p>

              {/* Actions */}
              <div className="flex gap-2">
                <button className="flex-1 px-4 py-2 bg-gradient-to-r from-[var(--badam-red)] to-red-600 text-white rounded-lg hover:shadow-md transition-all">
                  Export Now
                </button>
                <button className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <Edit2 size={18} className="text-gray-600" />
                </button>
                <button className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <Copy size={18} className="text-gray-600" />
                </button>
                <button className="p-2 border border-gray-200 rounded-lg hover:bg-red-50 transition-colors">
                  <Trash2 size={18} className="text-red-600" />
                </button>
              </div>
            </div>
          ))}

          {/* Empty State Card */}
          <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl border-2 border-dashed border-gray-300 p-6 flex flex-col items-center justify-center text-center hover:border-[var(--badam-red)] transition-colors cursor-pointer">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <Plus size={24} className="text-gray-400" />
            </div>
            <h4 className="text-gray-900 mb-2">Create New Template</h4>
            <p className="text-sm text-gray-500">
              Save your current export configuration
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
