import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Silently trap and ignore benign Vite HMR websocket connection errors in development
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = String(event.reason?.message || event.reason || '');
    if (
      reason.includes('WebSocket') || 
      reason.includes('websocket') || 
      reason.includes('failed to connect') ||
      reason.includes('connection')
    ) {
      event.preventDefault();
      console.debug('Caught and suppressed benign websocket unhandled rejection:', reason);
    }
  });

  window.addEventListener('error', (event) => {
    const msg = String(event.message || '');
    if (
      msg.includes('WebSocket') || 
      msg.includes('websocket') || 
      msg.includes('failed to connect')
    ) {
      event.preventDefault();
      console.debug('Caught and suppressed benign websocket error:', msg);
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

