/**
 * components/Toast.jsx
 * Global toast notification system.
 * Usage: wrap app in <ToastProvider>, call useToast() hook anywhere.
 */
import { createContext, useContext, useState, useCallback, useRef } from 'react';

const ToastCtx = createContext(null);

let _idSeed = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts(t => t.filter(x => x.id !== id));
  }, []);

  const toast = useCallback((message, type = 'success', duration = 3500) => {
    const id = ++_idSeed;
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => dismiss(id), duration);
  }, [dismiss]);

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="toast-container" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`} role="alert">
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
