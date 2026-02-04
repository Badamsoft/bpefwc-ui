import { useEffect, useRef, type ReactElement } from 'react';

const NOTICE_SELECTORS: readonly string[] = ['.notice', '.update-nag', '.error', '.updated'];

export function AdminNoticesPortal(): ReactElement | null {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap =
      document.querySelector('.wrap.wpe-react-wrap') ?? document.querySelector('.wrap.prodexfo-react-wrap');
    const target = document.getElementById('wpe-admin-notices') ?? document.getElementById('prodexfo-admin-notices');
    const container = containerRef.current;

    if (!wrap || !target || !container) {
      return;
    }

    target.appendChild(container);

    const moveNotices = () => {
      NOTICE_SELECTORS.forEach((selector) => {
        document.querySelectorAll<HTMLElement>(selector).forEach((notice) => {
          if (!wrap.contains(notice)) {
            return;
          }

          if (notice.dataset.prodexfoNotice === 'moved') {
            if (notice.parentElement !== container) {
              container.appendChild(notice);
            }
            return;
          }

          notice.dataset.prodexfoNotice = 'moved';
          container.appendChild(notice);
        });
      });
    };

    moveNotices();

    const observer = new MutationObserver(() => moveNotices());
    observer.observe(wrap, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return <div ref={containerRef} className="px-8 pt-6 space-y-4" />;
}
