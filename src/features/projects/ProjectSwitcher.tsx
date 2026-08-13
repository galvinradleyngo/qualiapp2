import { useState, type FormEvent } from 'react';
import type { ProjectRecord } from '../../storage/registry';

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
    <div>
      <h1 className="app-title">QualiApp</h1>
      <p className="app-subtitle">Pick a project, start a new one, or import a legacy backup.</p>

      <div className="panel">
        <h2 style={{ marginTop: 0, fontSize: '1rem' }}>Projects</h2>
        {loading ? (
          <p className="hint-text">Loading…</p>
        ) : projects.length === 0 ? (
          <p className="hint-text">No projects yet. Create one below, or import a backup.</p>
        ) : (
          <ul className="project-list">
            {projects.map((p) => (
              <li key={p.id} className="project-row" onClick={() => onOpenProject(p)}>
                <span>{p.title}</span>
                <span className="project-row-meta">{new Date(p.updatedAt).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0, fontSize: '1rem' }}>New project</h2>
        <form onSubmit={handleCreate} className="btn-row" style={{ alignItems: 'flex-start' }}>
          <input
            aria-label="Project title"
            placeholder="Project title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            style={{ flex: 1, padding: '0.6rem 0.7rem', border: '1px solid #d6d3d1', borderRadius: 8 }}
          />
          <button type="submit" className="btn" disabled={!newTitle.trim()}>
            Create
          </button>
        </form>
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0, fontSize: '1rem' }}>Import a backup</h2>
        <p className="hint-text">
          Restore a <code>.qbk</code> backup from the old QualiApp. It always becomes a new project.
        </p>
        <button className="btn btn-secondary" onClick={onImportBackup}>
          Import .qbk backup…
        </button>
      </div>
    </div>
  );
}
