import React from 'react';
import type { ReactElement } from 'react';
import {
  HelpCircle,
  BookMarked,
  PlayCircle,
  FileText,
  LifeBuoy,
  ShieldCheck,
  Settings as SettingsIcon,
} from 'lucide-react';

const QUICK_START_STEPS = [
  'Open the "Quick Export" tab and load the default field preset.',
  'Choose export format (CSV, XML, XLSX) and file parameters.',
  'Configure category, price, stock, and relative date filters.',
  'Add/remove columns, rename fields, and reorder as needed.',
  'Save layout to Templates or run a manual export.',
];

const VIDEO_TUTORIALS = [
  { title: 'Quick Export overview', duration: '5:10' },
  { title: 'Advanced Filters and condition builder', duration: '7:45' },
  { title: 'Managing Templates and Automations', duration: '6:20' },
  { title: 'Media Export & ZIP archives', duration: '8:05' },
  { title: 'Access Control and roles', duration: '4:40' },
];

const DOCUMENTATION_SECTIONS = [
  'Quick Export user guide',
  'Advanced Filters reference',
  'Media Export & ZIP/Cloud',
  'REST API & Automations',
  'Access matrix overview',
  'Troubleshooting & FAQ',
];

const DIAGNOSTIC_ROWS = [
  { label: 'WordPress version', value: '—' },
  { label: 'WooCommerce version', value: '—' },
  { label: 'PHP version', value: '—' },
  { label: 'Memory available', value: '—' },
  { label: 'Plugin version', value: '—' },
];

export function HelpDocs(): ReactElement {
  return (
    <div className="p-8 space-y-6 bg-gray-50 min-h-full">
      <header className="bg-white border border-gray-200 rounded-2xl px-6 py-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#F3F7FF] text-[#2F5BFF] flex items-center justify-center">
            <HelpCircle className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-gray-900 page-heading">Help / Docs</h1>
            <p className="text-gray-500 page-subheading">Documentation, videos and support</p>
          </div>
        </div>
        <div className="text-gray-500 text-label">
          Last updated: {new Date().toLocaleDateString()}
        </div>
      </header>

      <section className="space-y-4">
        <article className="bg-white border border-gray-200 rounded-2xl p-6">
          <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
            <div className="w-9 h-9 rounded-xl bg-[#EEF4FF] text-[#2F5BFF] flex items-center justify-center">
              <BookMarked className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-gray-900 font-semibold block-heading">
                Quick Start
              </h2>
              <p className="text-sm text-gray-500 block-subheading">
                Follow these steps to prepare your first export
              </p>
            </div>
          </div>
          <ol className="mt-6 space-y-3">
            {QUICK_START_STEPS.map((step, index) => (
              <li key={step} className="flex items-start gap-4">
                <span className="w-8 h-8 rounded-full bg-[#F3F7FF] text-[#2F5BFF] flex items-center justify-center font-semibold">
                  {index + 1}
                </span>
                <p className="text-gray-700 text-body">{step}</p>
              </li>
            ))}
          </ol>
        </article>

        <article className="bg-white border border-gray-200 rounded-2xl p-6">
          <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
            <div className="w-9 h-9 rounded-xl bg-[#FFF3F0] text-[#FF5733] flex items-center justify-center">
              <PlayCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-gray-900 font-semibold block-heading">
                Video Tutorials
              </h2>
              <p className="text-sm text-gray-500 block-subheading">
                Short walkthroughs covering the most used workflows
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {VIDEO_TUTORIALS.map((video) => (
              <button
                key={video.title}
                type="button"
                className="w-full flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3 text-left hover:border-gray-200 text-body"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#EEF2FF] text-[#4C1D95] flex items-center justify-center">
                    <PlayCircle className="w-5 h-5" />
                  </div>
                  <span className="text-gray-800">{video.title}</span>
                </div>
                <span className="text-sm text-gray-500">{video.duration}</span>
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs text-gray-500">› Link will be added later</p>
        </article>

        <article className="bg-white border border-gray-200 rounded-2xl p-6">
          <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
            <div className="w-9 h-9 rounded-xl bg-[#E9FAF3] text-[#0F9D58] flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-gray-900 font-semibold block-heading">
                Documentation
              </h2>
              <p className="text-sm text-gray-500 block-subheading">
                Guides that document every module in the plugin
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {DOCUMENTATION_SECTIONS.map((doc) => (
              <button
                type="button"
                key={doc}
                className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3 text-left hover:border-gray-200 text-body"
              >
                <span className="text-gray-800">{doc}</span>
                <span className="text-xs text-gray-500">› Link will be added later</span>
              </button>
            ))}
          </div>
        </article>

        <article className="bg-white border border-gray-200 rounded-2xl p-6">
          <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
            <div className="w-9 h-9 rounded-xl bg-[#F2F4FF] text-[#4A63E7] flex items-center justify-center">
              <LifeBuoy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-gray-900 font-semibold block-heading">
                Support
              </h2>
              <p className="text-sm text-gray-500 block-subheading">
                Need help? We are ready to assist you.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button className="px-5 py-2 rounded-xl bg-[#2F5BFF] text-white hover:bg-[#1f4be0]" type="button">
              Contact Support
            </button>
            <button className="px-5 py-2 rounded-xl border border-gray-200 text-gray-700" type="button">
              Knowledge Base
            </button>
            <button className="px-5 py-2 rounded-xl border border-gray-200 text-gray-700" type="button">
              Report an Issue
            </button>
          </div>
          <p className="mt-4 text-xs text-gray-500">› Link will be added later</p>
        </article>

        <article className="bg-white border border-gray-200 rounded-2xl p-6">
          <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
            <div className="w-9 h-9 rounded-xl bg-[#FFF7E6] text-[#F59E0B] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-gray-900 font-semibold block-heading">
                Diagnostics
              </h2>
              <p className="text-sm text-gray-500 block-subheading">
                Collect system info before contacting support
              </p>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm text-gray-600">
            {DIAGNOSTIC_ROWS.map((row) => (
              <div key={row.label} className="flex justify-between">
                <dt>{row.label}</dt>
                <dd className="font-medium text-gray-800">{row.value}</dd>
              </div>
            ))}
          </dl>
          <button
            type="button"
            className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:border-gray-300"
          >
            <SettingsIcon className="w-4 h-4" />
            Download diagnostic logs
          </button>
        </article>
      </section>
    </div>
  );
}
