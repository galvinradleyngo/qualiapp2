import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'success' | 'error';
}

interface ToastContextValue {
  notify: (message: string, tone?: Toast['tone']) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const toneClass: Record<Toast['tone'], string> = {
  info: 'bg-ink text-white',
  success: 'bg-accent-700 text-white',
  error: 'bg-red-700 text-white',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const notify = useCallback((message: string, tone: Toast['tone'] = 'info') => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3200);
  }, []);

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={`rounded-lg px-4 py-2.5 text-sm font-medium shadow-popover ${toneClass[t.tone]}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
