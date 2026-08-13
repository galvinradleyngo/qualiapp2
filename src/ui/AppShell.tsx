import type { ReactNode } from 'react';

export interface NavItem {
  id: string;
  label: string;
  icon: ReactNode;
}

interface AppShellProps {
  projectTitle: string;
  navItems: NavItem[];
  activeNavId: string;
  onNavigate: (id: string) => void;
  onCloseProject: () => void;
  children: ReactNode;
}

export function AppShell({ projectTitle, navItems, activeNavId, onNavigate, onCloseProject, children }: AppShellProps) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-surface-sunken">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-white">
        <div className="border-b border-border px-4 py-4">
          <p className="truncate text-sm font-semibold text-ink" title={projectTitle}>
            {projectTitle}
          </p>
          <button className="link-btn mt-1" onClick={onCloseProject}>
            ← All projects
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                activeNavId === item.id ? 'bg-accent-50 text-accent-800' : 'text-ink-soft hover:bg-surface-alt'
              }`}
            >
              <span className="shrink-0 text-base leading-none">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
