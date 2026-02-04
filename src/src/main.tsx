import { createRoot } from 'react-dom/client';
import App from './App';
import { AppStateProvider } from './context/AppStateContext';
import { HintProvider } from './context/HintContext';
import './index.css';
import './styles/globals.css';

const container = document.getElementById('wpe-admin-app') ?? document.getElementById('prodexfo-admin-app');

if (container) {
  document.body.classList.add('wpe-admin-app-active');

  const preventSubmit = (event: Event): void => {
    event.preventDefault();
    event.stopPropagation();
  };

  container.addEventListener('submit', preventSubmit, true);

  const updateLayoutVars = (): void => {
    const adminbar = document.getElementById('wpadminbar');
    const height = adminbar ? adminbar.offsetHeight : 0;
    document.documentElement.style.setProperty('--wpe-adminbar-height', `${height}px`);

    const footer = document.getElementById('wpfooter');
    const footerHeight = footer ? footer.offsetHeight : 0;
    document.documentElement.style.setProperty('--wpe-footer-height', `${footerHeight}px`);
  };

  updateLayoutVars();

  const adminbar = document.getElementById('wpadminbar');
  const footer = document.getElementById('wpfooter');
  const resizeObserver = new ResizeObserver(() => updateLayoutVars());
  if (adminbar) {
    resizeObserver.observe(adminbar);
  }
  if (footer) {
    resizeObserver.observe(footer);
  }

  window.addEventListener('resize', updateLayoutVars);

  createRoot(container).render(
    <AppStateProvider>
      <HintProvider>
        <App />
      </HintProvider>
    </AppStateProvider>
  );

  window.addEventListener('beforeunload', () => {
    container.removeEventListener('submit', preventSubmit, true);
    window.removeEventListener('resize', updateLayoutVars);
    resizeObserver.disconnect();
  });
}