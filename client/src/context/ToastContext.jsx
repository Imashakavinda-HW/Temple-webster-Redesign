import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(() => {});

// The small gold notification pill from the design, available to every component.
// Skill rules: auto-dismiss after 3–5 s (4 s here, 7 s when there's an Undo button),
// never steal focus, announce politely to screen readers.
export function ToastProvider({ children }) {
  const [toastState, setToastState] = useState({ msg: '', action: null, show: false });
  const timer = useRef();

  const toast = useCallback((msg, { action } = {}) => {
    setToastState({ msg, action: action || null, show: true });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToastState((t) => ({ ...t, show: false })), action ? 7000 : 4000);
  }, []);

  const { msg, action, show } = toastState;
  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className={`toast${show ? ' show' : ''}${action && show ? ' has-action' : ''}`} role="status" aria-live="polite">
        <span>{msg}</span>
        {action && show && (
          <button type="button" className="toast-action" onClick={() => {
            action.onClick();
            clearTimeout(timer.current);
            setToastState((t) => ({ ...t, show: false }));
          }}>{action.label}</button>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
