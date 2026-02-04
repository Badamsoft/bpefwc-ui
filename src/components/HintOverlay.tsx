import { useEffect, useMemo, useState, type ReactElement } from 'react';
import type { HintPayload } from '@/context/HintContext';

interface HintOverlayProps {
  hint: HintPayload | null;
  onDismiss: () => void;
}

type HintVariant = 'info' | 'warning' | 'success';

type VariantConfig = {
  border: string;
  background: string;
  titleText: string;
  descriptionText: string;
};

const DEFAULT_VARIANT: HintVariant = 'info';

const VARIANT_STYLES: Record<HintVariant, VariantConfig> = {
  info: {
    border: 'border-blue-200',
    background: 'bg-blue-50',
    titleText: 'text-blue-900',
    descriptionText: 'text-blue-700',
  },
  warning: {
    border: 'border-amber-200',
    background: 'bg-amber-50',
    titleText: 'text-amber-900',
    descriptionText: 'text-amber-700',
  },
  success: {
    border: 'border-emerald-200',
    background: 'bg-emerald-50',
    titleText: 'text-emerald-900',
    descriptionText: 'text-emerald-700',
  },
};

export function HintOverlay({ hint, onDismiss }: HintOverlayProps): ReactElement | null {
  const [isMounted, setIsMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (hint) {
      setIsMounted(true);
      const entryTimer = window.setTimeout(() => {
        setIsVisible(true);
      }, 10);

      return () => window.clearTimeout(entryTimer);
    }

    if (isMounted) {
      setIsVisible(false);
      const exitTimer = window.setTimeout(() => {
        setIsMounted(false);
      }, 180);

      return () => window.clearTimeout(exitTimer);
    }

    return undefined;
  }, [hint, isMounted]);

  const styles = useMemo(() => {
    const variantKey = hint?.variant;

    const variant: HintVariant =
      variantKey && variantKey in VARIANT_STYLES
        ? (variantKey as HintVariant)
        : DEFAULT_VARIANT;

    return VARIANT_STYLES[variant];
  }, [hint]);

  const handleDismiss = () => {
    setIsVisible(false);
    window.setTimeout(onDismiss, 180);
  };

  if (!isMounted) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 sm:bottom-8 sm:right-8 z-50 flex flex-col items-end gap-3">
      <div className="pointer-events-auto" aria-live="assertive">
        <button type="button" onClick={handleDismiss}>
          <div
            className={`w-full max-w-xs sm:max-w-sm md:max-w-md rounded-2xl border ${styles.border} ${styles.background} shadow-xl transition-all duration-200 ease-out transform text-left ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
            } text-body`}
          >
            {hint && (
              <div className="px-5 py-4">
                <p className={`font-semibold text-base mb-1 ${styles.titleText}`}>{hint.title}</p>
                <p className={`text-sm leading-relaxed ${styles.descriptionText}`}>{hint.description}</p>
              </div>
            )}
          </div>
        </button>
      </div>
    </div>
  );
}
