import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

export function Card({ title, description, actions, children, className = '', ...rest }: CardProps) {
  return (
    <div className={`card ${className}`} {...rest}>
      {(title || actions) && (
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title && <h2 className="text-base font-semibold text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-ink-soft">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border-strong px-6 py-10 text-center">
      <p className="text-sm font-medium text-ink-soft">{title}</p>
      {hint && <p className="mt-1 text-sm text-ink-soft/80">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
