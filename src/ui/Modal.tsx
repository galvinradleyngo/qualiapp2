import { useEffect, type ReactNode } from 'react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'sm' | 'md' | 'lg';
}

const widthClass = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' };

export function Modal({ title, onClose, children, footer, width = 'md' }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full ${widthClass[width]} rounded-xl bg-white shadow-popover`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <button className="btn-icon" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-border px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}

interface ConfirmDialogProps {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, message, confirmLabel = 'Confirm', danger, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      width="sm"
      footer={
        <>
          <button className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-ink-soft">{message}</p>
    </Modal>
  );
}
