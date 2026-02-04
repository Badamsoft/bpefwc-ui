import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { HintOverlay } from '@/components/HintOverlay';

type HintVariant = 'info' | 'warning' | 'success';

export interface HintPayload {
  id: string;
  title: string;
  description: string;
  variant?: HintVariant;
}

interface HintContextValue {
  showHint: (hint: HintPayload) => void;
  dismissHint: () => void;
}

const HintContext = createContext<HintContextValue | null>(null);

interface HintProviderProps {
  children: ReactNode;
}

export function HintProvider({ children }: HintProviderProps) {
  const queueRef = useRef<HintPayload[]>([]);
  const [activeHint, setActiveHint] = useState<HintPayload | null>(null);

  const flushQueue = useCallback(() => {
    if (activeHint !== null) {
      return;
    }

    const next = queueRef.current.shift() ?? null;
    if (next) {
      setActiveHint(next);
    }
  }, [activeHint]);

  const showHint = useCallback(
    (hint: HintPayload) => {
      const existsAsActive = activeHint?.id === hint.id;
      const existsInQueue = queueRef.current.some((queued) => queued.id === hint.id);

      if (existsAsActive || existsInQueue) {
        return;
      }

      queueRef.current = [...queueRef.current, hint];
      if (!activeHint) {
        flushQueue();
      }
    },
    [activeHint, flushQueue]
  );

  const dismissHint = useCallback(() => {
    setActiveHint(null);
  }, []);

  useEffect(() => {
    if (activeHint === null && queueRef.current.length > 0) {
      const timeout = window.setTimeout(() => {
        flushQueue();
      }, 120);

      return () => window.clearTimeout(timeout);
    }

    return undefined;
  }, [activeHint, flushQueue]);

  const value = useMemo<HintContextValue>(
    () => ({
      showHint,
      dismissHint,
    }),
    [dismissHint, showHint]
  );

  return (
    <HintContext.Provider value={value}>
      {children}
      <HintOverlay hint={activeHint} onDismiss={dismissHint} />
    </HintContext.Provider>
  );
}

export function useHint(): HintContextValue {
  const context = useContext(HintContext);

  if (!context) {
    throw new Error('useHint must be used within a HintProvider');
  }

  return context;
}
