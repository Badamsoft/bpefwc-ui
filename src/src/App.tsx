import React, { ReactElement, useEffect, useState } from 'react';
import { MainExport } from './components/MainExport';
import { Templates } from './components/Templates';
import { History } from './components/History';
import { Settings } from './components/Settings';
import { Scheduler } from './components/Scheduler';
import { MediaExport } from './components/MediaExport';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { AdminNoticesPortal } from './components/AdminNoticesPortal';
import { useAppState } from './context/AppStateContext';
import { Toaster } from './components/ui/sonner';
import { HelpDocs } from './components/HelpDocs';
import { UpgradePro } from './components/UpgradePro';

export type ScreenId =
  | 'export'
  | 'templates'
  | 'history'
  | 'scheduler'
  | 'media'
  | 'access'
  | 'settings'
  | 'help'
  | 'upgrade';

export default function App(): ReactElement {
  const { state, setState } = useAppState();
  const [activeScreen, setActiveScreen] = useState<ScreenId>((state.initialScreen as ScreenId) ?? 'export');

  useEffect(() => {
    setActiveScreen((state.initialScreen as ScreenId) ?? 'export');
  }, [state.initialScreen]);

  const onShowPro = (): void => {
    window.open('https://badamsoft.com/wooproduct-exporter/', '_blank', 'noopener,noreferrer');
  };

  const handleNavigate = (screen: ScreenId): void => {
    setActiveScreen(screen);
    setState((prev) => (prev.initialScreen === screen ? prev : { ...prev, initialScreen: screen }));
  };

  const renderScreen = (): ReactElement => {
    switch (activeScreen) {
      case 'export':
        return <MainExport />;
      case 'templates':
        return <Templates />;
      case 'history':
        return <History />;
      case 'scheduler':
        return <Scheduler />;
      case 'media':
        return <MediaExport onShowPro={onShowPro} />;
      case 'access':
        return <Settings />;
      case 'settings':
        return <Settings />;
      case 'help':
        return <HelpDocs />;
      case 'upgrade':
        return <UpgradePro />;
      default:
        return <MainExport />;
    }
  };

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-gray-50">
      <Sidebar activeScreen={activeScreen} onNavigate={handleNavigate} />
      <div className="flex-1 flex min-h-0 flex-col overflow-hidden">
        <AdminNoticesPortal />
        <Header />
        <main className="flex-1 min-h-0 overflow-auto">
          {renderScreen()}
        </main>
      </div>
      <Toaster position="bottom-right" richColors />
    </div>
  );
}
