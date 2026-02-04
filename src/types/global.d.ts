import type { AppState } from './app-state';

declare global {
  interface Window {
    PRODEXFO_APP_STATE?: AppState;
  }
}

declare module '*.png' {
  const src: string;
  export default src;
}

export {};
