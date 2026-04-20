import '@/lib/logger'; // init console interception early
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initStatusBar } from '@/lib/statusBar';

initStatusBar();

createRoot(document.getElementById('root')!).render(<App />);
