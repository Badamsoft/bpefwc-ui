import { useCallback } from 'react';
import { toast } from 'sonner';
import { useAppState } from '@/context/AppStateContext';
import type { NotificationSettings } from '@/types/app-state';

type NotificationKey = keyof NotificationSettings;
type NotificationSeverity = 'success' | 'error' | 'info';

const MAX_NOTICES = 20;

export function useNotifications() {
  const { state, setState } = useAppState();
  const preferences = state.settings.notifications;

  const notify = useCallback(
    (
      key: NotificationKey,
      message: string,
      options: {
        severity?: NotificationSeverity;
        persist?: boolean;
      } = {}
    ) => {
      if (!preferences?.[key]) {
        return;
      }

      const severity: NotificationSeverity =
        options.severity ?? (key.toLowerCase().includes('error') ? 'error' : 'success');

      if (options.persist !== false) {
        setState((prev) => ({
          ...prev,
          notices: [
            ...(prev.notices ?? []).slice(-(MAX_NOTICES - 1)),
            {
              code: `${key}-${Date.now()}`,
              message,
              type: severity === 'error' ? 'error' : 'updated',
            },
          ],
        }));
      }

      switch (severity) {
        case 'error':
          toast.error(message);
          break;
        case 'info':
          toast(message);
          break;
        default:
          toast.success(message);
          break;
      }
    },
    [preferences, setState]
  );

  const clearNotices = useCallback(() => {
    setState((prev) => ({
      ...prev,
      notices: [],
    }));
  }, [setState]);

  return { notify, clearNotices };
}
