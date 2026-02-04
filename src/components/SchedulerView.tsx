import { Plus, Play, Pause, Edit2, Trash2, Clock, CheckCircle, XCircle, Mail, HardDrive, Cloud } from 'lucide-react';

interface ScheduledTask {
  id: string;
  name: string;
  template: string;
  frequency: string;
  status: 'active' | 'paused' | 'error';
  lastRun: string;
  nextRun: string;
  actions: string[];
}

export function SchedulerView({ onCreateAutomation }: { onCreateAutomation: () => void }) {
  const tasks: ScheduledTask[] = [
    {
      id: '1',
      name: 'Daily Google Shopping Feed',
      template: 'Google Shopping Feed',
      frequency: 'Every day at 2:00 AM',
      status: 'active',
      lastRun: '23 hours ago',
      nextRun: 'In 1 hour',
      actions: ['Email', 'FTP Upload'],
    },
    {
      id: '2',
      name: 'Weekly Catalog Backup',
      template: 'Full Catalog Backup',
      frequency: 'Every Monday at 1:00 AM',
      status: 'active',
      lastRun: '5 days ago',
      nextRun: 'In 2 days',
      actions: ['Google Drive', 'Email'],
    },
    {
      id: '3',
      name: 'Facebook Ads Export',
      template: 'Facebook Catalog',
      frequency: 'Every 6 hours',
      status: 'paused',
      lastRun: '2 days ago',
      nextRun: 'Paused',
      actions: ['SFTP Upload'],
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700';
      case 'paused':
        return 'bg-yellow-100 text-yellow-700';
      case 'error':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle size={16} />;
      case 'paused':
        return <Clock size={16} />;
      case 'error':
        return <XCircle size={16} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-gray-900 mb-2">Scheduled Automations</h2>
          <p className="text-gray-600">
            Automate your exports with scheduled tasks and post-export actions
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <p className="text-gray-600 text-sm mb-2">Total Tasks</p>
            <p className="text-3xl text-gray-900">3</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <p className="text-gray-600 text-sm mb-2">Active</p>
            <p className="text-3xl text-green-600">2</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <p className="text-gray-600 text-sm mb-2">Paused</p>
            <p className="text-3xl text-yellow-600">1</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <p className="text-gray-600 text-sm mb-2">Next Run</p>
            <p className="text-xl text-gray-900">In 1 hour</p>
          </div>
        </div>

        {/* Create Button */}
        <button
          onClick={onCreateAutomation}
          className="w-full mb-6 p-6 bg-gradient-to-r from-[var(--badam-red)] to-red-600 text-white rounded-2xl hover:shadow-lg transition-all flex items-center justify-center gap-3"
        >
          <Plus size={24} />
          <span style={{ fontWeight: 600 }}>Create New Automation</span>
        </button>

        {/* Tasks List */}
        <div className="space-y-4">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-md transition-all"
            >
              <div className="flex items-start gap-4">
                {/* Status Indicator */}
                <div className={`px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm ${getStatusColor(task.status)}`}>
                  {getStatusIcon(task.status)}
                  <span className="capitalize">{task.status}</span>
                </div>

                {/* Main Content */}
                <div className="flex-1">
                  <h3 className="text-gray-900 mb-2">{task.name}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Template</p>
                      <p className="text-gray-900 mt-1">{task.template}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Frequency</p>
                      <p className="text-gray-900 mt-1">{task.frequency}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Last Run</p>
                      <p className="text-gray-900 mt-1">{task.lastRun}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Next Run</p>
                      <p className="text-gray-900 mt-1">{task.nextRun}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-sm text-gray-500">Actions:</span>
                    {task.actions.map((action, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs"
                      >
                        {action}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button className="p-2 border border-gray-200 rounded-lg hover:bg-green-50 hover:border-green-200 transition-colors">
                    <Play size={18} className="text-green-600" />
                  </button>
                  <button className="p-2 border border-gray-200 rounded-lg hover:bg-yellow-50 hover:border-yellow-200 transition-colors">
                    <Pause size={18} className="text-yellow-600" />
                  </button>
                  <button className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <Edit2 size={18} className="text-gray-600" />
                  </button>
                  <button className="p-2 border border-gray-200 rounded-lg hover:bg-red-50 hover:border-red-200 transition-colors">
                    <Trash2 size={18} className="text-red-600" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Post-Export Actions Section */}
        <div className="mt-8">
          <h3 className="text-gray-900 mb-4">Available Post-Export Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { name: 'Email', icon: Mail, description: 'Send export via email' },
              { name: 'FTP/SFTP', icon: HardDrive, description: 'Upload to FTP server' },
              { name: 'Google Drive', icon: Cloud, description: 'Save to Google Drive' },
              { name: 'Dropbox', icon: Cloud, description: 'Upload to Dropbox' },
              { name: 'AWS S3', icon: Cloud, description: 'Upload to S3 bucket' },
              { name: 'Yandex Disk', icon: Cloud, description: 'Save to Yandex Disk' },
              { name: 'Webhooks', icon: HardDrive, description: 'Send to webhook URL' },
              { name: 'ZIP Images', icon: HardDrive, description: 'Create image archive' },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <div
                  key={action.name}
                  className="bg-white rounded-xl border border-gray-200 p-4 hover:border-[var(--badam-red)] hover:shadow-sm transition-all cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-lg bg-gray-100 group-hover:bg-red-50 flex items-center justify-center mb-3 transition-colors">
                    <Icon className="text-gray-600 group-hover:text-[var(--badam-red)] transition-colors" size={20} />
                  </div>
                  <h4 className="text-gray-900 mb-1">{action.name}</h4>
                  <p className="text-xs text-gray-500">{action.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
