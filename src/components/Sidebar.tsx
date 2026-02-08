import React from 'react';
import type { ReactElement } from 'react';
import { Download, FileText, History, Settings, HelpCircle, CalendarDays, Image as ImageIcon, Crown, Zap } from 'lucide-react';
import { ImageWithFallback } from './ui/ImageWithFallback';
import { pluginBranding } from '../config/branding';
import type { ScreenId } from '../App';
import { useAppState } from '@/context/AppStateContext';

const badamsoftLogo = new URL('../assets/badamsoft-logo.png', import.meta.url).toString();

interface SidebarProps {
  activeScreen: ScreenId;
  onNavigate: (screen: ScreenId) => void;
}

type SidebarItem = {
  id: ScreenId;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  href?: string;
  isUpgrade?: boolean;
};

const DOCS_URL = 'https://badamsoft.com/documentation/?doc_product=exporter&cat=exporter-guide';

export function Sidebar({ activeScreen, onNavigate }: SidebarProps): ReactElement {
  const { state } = useAppState();
  const isProInstalled = Boolean(state.isProBuild);
  const pluginInfo = state.strings?.plugin ?? {};
  const licenseStatus = typeof pluginInfo.status === 'string' ? pluginInfo.status : '';
  const isProActive = Boolean(pluginInfo?.isPro) || ['valid', 'active'].includes(licenseStatus);
  const pluginVersion = typeof pluginInfo.version === 'string' ? pluginInfo.version : '';
  const productName = isProInstalled ? pluginBranding.productNamePro : pluginBranding.productName;
  const pluginDisplayName = pluginVersion ? `${productName} ${pluginVersion}` : productName;
  const getString = (key: string, fallback: string): string => {
    const raw = state.strings?.[key];
    return typeof raw === 'string' ? raw : fallback;
  };

  const menuItems: SidebarItem[] = [
    { id: 'export', label: getString('menuExport', 'Export'), icon: Download },
    { id: 'templates', label: getString('menuTemplates', 'Templates'), icon: FileText },
    { id: 'history', label: getString('menuHistory', 'History'), icon: History },
  ];

  if (isProInstalled) {
    menuItems.push(
      { id: 'scheduler', label: getString('menuAutomations', 'Automations'), icon: CalendarDays },
      { id: 'media', label: getString('menuMediaExport', 'Media Export'), icon: ImageIcon },
    );
  }

  menuItems.push(
    { id: 'settings', label: getString('menuSettings', 'Settings'), icon: Settings },
    { id: 'help', label: getString('menuHelpDocs', 'Help / Docs'), icon: HelpCircle, href: DOCS_URL },
  );

  if (!isProInstalled && !isProActive) {
    menuItems.push({ id: 'upgrade', label: getString('menuUpgradePro', 'Upgrade to PRO'), icon: Crown, isUpgrade: true });
  }

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
      <div className="p-6 border-b border-gray-200 flex flex-col items-center text-center gap-3">
        <ImageWithFallback
          src={badamsoftLogo}
          alt="BadamSoft Logo"
          className="w-40 h-auto object-contain"
        />
        <p className="text-gray-900 font-semibold text-[2.8rem] leading-10 text-center w-[12.5rem]">
          {pluginDisplayName}
        </p>
      </div>

      <nav className="flex-1 p-4 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isExternal = Boolean(item.href);
          const isActive = !isExternal && activeScreen === item.id;
          
          if (item.isUpgrade) {
            const upgradeButtonStyle: React.CSSProperties = {
              fontFamily: 'Montserrat, sans-serif',
              background: isActive
                ? 'linear-gradient(90deg, #FF3A2E 0%, #E02424 100%)'
                : 'linear-gradient(90deg, rgba(255, 58, 46, 0.12) 0%, rgba(224, 36, 36, 0.12) 100%)',
              color: isActive ? '#ffffff' : '#FF3A2E',
              border: isActive ? '1px solid transparent' : '1px solid rgba(255, 58, 46, 0.2)',
              boxShadow: isActive ? '0 12px 24px -14px rgba(255, 58, 46, 0.6)' : 'none',
            };

            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl mb-2 transition-all hover:opacity-90"
                style={upgradeButtonStyle}
              >
                <Icon className="w-5 h-5" />
                <span className="flex-1 text-left">{item.label}</span>
                <Zap className="w-4 h-4" />
              </button>
            );
          }

          const className = `w-full flex items-center gap-3 px-4 py-3 rounded-xl mb-2 transition-all ${
            isActive
              ? 'bg-[#FF3A2E] text-white shadow-lg shadow-red-500/20'
              : 'text-gray-600 hover:bg-gray-50'
          }`;

          if (isExternal) {
            return (
              <a
                key={item.id}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className={className}
              >
                <Icon className="w-5 h-5" />
                <span className="flex-1 text-left menu-item-text">{item.label}</span>
              </a>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={className}
            >
              <Icon className="w-5 h-5" />
              <span className="flex-1 text-left menu-item-text">{item.label}</span>
            </button>
          );
        })}
      </nav>

    </aside>
  );
}