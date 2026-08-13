import { useState, type FormEvent } from 'react';
import type { ProjectRecord } from '../../storage/registry';
import { Button } from '../../ui/Button';
import { Card, EmptyState } from '../../ui/Card';
import { TextField } from '../../ui/TextField';

interface ProjectSwitcherProps {
  projects: ProjectRecord[];
  loading: boolean;
  onOpenProject: (project: ProjectRecord) => void;
  onCreateProject: (title: string) => void;
  onImportBackup: () => void;
}

export function ProjectSwitcher({ projects, loading, onOpenProject, onCreateProject, onImportBackup }: ProjectSwitcherProps) {
  const [newTitle, setNewTitle] = useState('');

  const handleCreate = (e: FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    onCreateProject(title);
    setNewTitle('');
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="app-title text-3xl">QualiApp</h1>
      <p className="app-subtitle mb-8">Pick a project, start a new one, or import a legacy backup.</p>

      <Card title="Projects" className="mb-5">
        {loading ? (
          <p className="text-sm text-ink-soft">Loading…</p>
        ) : projects.length === 0 ? (
          <EmptyState title="No projects yet" hint="Create one below, or import a backup." />
        ) : (
          <ul className="flex flex-col gap-2">
            {projects.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => onOpenProject(p)}
                  className="flex w-full items-center justify-between rounded-lg border border-border bg-surface-alt px-4 py-3 text-left transition-colors hover:border-border-strong hover:bg-white"
                >
                  <span className="font-medium text-ink">{p.title}</span>
                  <span className="text-xs text-ink-soft">{new Date(p.updatedAt).toLocaleDateString()}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="New project" className="mb-5">
        <form onSubmit={handleCreate} className="flex items-end gap-3">
          <div className="flex-1">
            <TextField
              label="Project title"
              placeholder="e.g. Fall 2025 Interviews"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={!newTitle.trim()}>
            Create
          </Button>
        </form>
      </Card>

      <Card title="Import a backup">
        <p className="mb-3 text-sm text-ink-soft">
          Restore a <code className="rounded bg-surface-alt px-1 py-0.5">.qbk</code> backup from the old QualiApp. It
          always becomes a new project — it never overwrites an existing one.
        </p>
        <Button variant="secondary" onClick={onImportBackup}>
          Import .qbk backup…
        </Button>
      </Card>
    </div>
  );
}
