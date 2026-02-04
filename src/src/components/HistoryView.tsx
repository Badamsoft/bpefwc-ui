import { Download, Eye, CheckCircle, XCircle, Clock, Filter } from 'lucide-react';

interface ExportRecord {
  id: string;
  type: 'manual' | 'scheduled';
  template: string;
  format: string;
  products: number;
  duration: string;
  status: 'success' | 'error' | 'processing';
  date: string;
  fileSize: string;
}

export function HistoryView() {
  const records: ExportRecord[] = [
    {
      id: '1',
      type: 'scheduled',
      template: 'Google Shopping Feed',
      format: 'XML',
      products: 1247,
      duration: '12.4s',
      status: 'success',
      date: '2025-11-25 02:00:15',
      fileSize: '2.3 MB',
    },
    {
      id: '2',
      type: 'manual',
      template: 'Basic Product List',
      format: 'CSV',
      products: 856,
      duration: '5.2s',
      status: 'success',
      date: '2025-11-24 14:32:41',
      fileSize: '1.1 MB',
    },
    {
      id: '3',
      type: 'scheduled',
      template: 'Facebook Catalog',
      format: 'CSV',
      products: 1247,
      duration: '8.7s',
      status: 'success',
      date: '2025-11-24 08:00:03',
      fileSize: '1.8 MB',
    },
    {
      id: '4',
      type: 'manual',
      template: 'Full Catalog Backup',
      format: 'XLSX',
      products: 1247,
      duration: '18.9s',
      status: 'success',
      date: '2025-11-23 16:45:22',
      fileSize: '4.7 MB',
    },
    {
      id: '5',
      type: 'scheduled',
      template: 'Google Shopping Feed',
      format: 'XML',
      products: 0,
      duration: '0.8s',
      status: 'error',
      date: '2025-11-23 02:00:11',
      fileSize: '-',
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 rounded-lg text-sm">
            <CheckCircle size={14} />
            Success
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-700 rounded-lg text-sm">
            <XCircle size={14} />
            Error
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm">
            <Clock size={14} />
            Processing
          </span>
        );
      default:
        return null;
    }
  };

  const getTypeBadge = (type: string) => {
    return type === 'scheduled' ? (
      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-md text-xs">
        Scheduled
      </span>
    ) : (
      <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs">
        Manual
      </span>
    );
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-gray-900 mb-2">Export History</h2>
          <p className="text-gray-600">
            View and download your previous exports
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <p className="text-gray-600 text-sm mb-2">Total Exports</p>
            <p className="text-3xl text-gray-900">247</p>
            <p className="text-xs text-gray-500 mt-2">All time</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <p className="text-gray-600 text-sm mb-2">This Month</p>
            <p className="text-3xl text-gray-900">42</p>
            <p className="text-xs text-green-600 mt-2">+18% from last month</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <p className="text-gray-600 text-sm mb-2">Success Rate</p>
            <p className="text-3xl text-green-600">98.4%</p>
            <p className="text-xs text-gray-500 mt-2">Last 30 days</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <p className="text-gray-600 text-sm mb-2">Avg. Duration</p>
            <p className="text-3xl text-gray-900">9.2s</p>
            <p className="text-xs text-gray-500 mt-2">Per export</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-6 flex items-center gap-4">
          <Filter size={20} className="text-gray-400" />
          <select className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm">
            <option>All Types</option>
            <option>Manual</option>
            <option>Scheduled</option>
          </select>
          <select className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm">
            <option>All Statuses</option>
            <option>Success</option>
            <option>Error</option>
          </select>
          <select className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm">
            <option>All Formats</option>
            <option>CSV</option>
            <option>XLSX</option>
            <option>XML</option>
            <option>JSON</option>
          </select>
          <div className="flex-1"></div>
          <input
            type="date"
            className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs text-gray-600 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-6 py-4 text-left text-xs text-gray-600 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-4 text-left text-xs text-gray-600 uppercase tracking-wider">
                    Template
                  </th>
                  <th className="px-6 py-4 text-left text-xs text-gray-600 uppercase tracking-wider">
                    Format
                  </th>
                  <th className="px-6 py-4 text-left text-xs text-gray-600 uppercase tracking-wider">
                    Products
                  </th>
                  <th className="px-6 py-4 text-left text-xs text-gray-600 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-4 text-left text-xs text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs text-gray-600 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-4 text-left text-xs text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {records.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      #{record.id}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {getTypeBadge(record.type)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {record.template}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md">
                        {record.format}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {record.products.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {record.duration}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {getStatusBadge(record.status)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {record.date}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex gap-2">
                        {record.status === 'success' && (
                          <button className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                            <Download size={16} className="text-gray-600" />
                          </button>
                        )}
                        <button className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                          <Eye size={16} className="text-gray-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing 1 to 5 of 247 results
            </p>
            <div className="flex gap-2">
              <button className="px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors">
                Previous
              </button>
              <button className="px-3 py-2 bg-[var(--badam-red)] text-white rounded-lg text-sm">
                1
              </button>
              <button className="px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors">
                2
              </button>
              <button className="px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors">
                3
              </button>
              <button className="px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors">
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
