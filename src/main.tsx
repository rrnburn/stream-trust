import '@/lib/logger'; // init console interception early
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initStatusBar } from '@/lib/statusBar';
import { Capacitor } from '@capacitor/core';

// Unregister any PWA service workers when running in Capacitor native.
// Capacitor serves from https://localhost and stale SW caches cause blank screens.
if (Capacitor.isNativePlatform() && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const reg of registrations) {
      reg.unregister();
    }
  });
}

initStatusBar();

createRoot(document.getElementById('root')!).render(<App />);
