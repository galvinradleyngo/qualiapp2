import { useEffect, useState } from 'react';
import './index.css';
import { ProjectSwitcher } from './features/projects/ProjectSwitcher';
import { ImportBackupDialog } from './features/projects/ImportBackupDialog';
import { UnlockScreen } from './features/projects/UnlockScreen';
import { Workspace } from './features/workspace/Workspace';
import { ToastProvider } from './ui/Toast';
import { createProjectRecord, listProjects, touchProjectRecord, type ProjectRecord } from './storage/registry';
import { openProjectDb } from './storage/projectDb';
import { hasPassword } from './storage/security';

type Screen =
  | { kind: 'switcher' }
  | { kind: 'import' }
  | { kind: 'unlock'; project: ProjectRecord }
  | { kind: 'workspace'; project: ProjectRecord };

function App() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>({ kind: 'switcher' });

  const refreshProjects = async () => {
    setLoading(true);
    setProjects(await listProjects());
    setLoading(false);
  };

  useEffect(() => {
    void refreshProjects();
  }, []);

  const openProject = async (project: ProjectRecord) => {
    const db = openProjectDb(project.id);
    const locked = await hasPassword(db);
    await touchProjectRecord(project.id);
    setScreen(locked ? { kind: 'unlock', project } : { kind: 'workspace', project });
  };

  const handleCreateProject = async (title: string) => {
    const project = await createProjectRecord(title);
    await refreshProjects();
    setScreen({ kind: 'workspace', project });
  };

  const handleImported = async (project: ProjectRecord) => {
    await refreshProjects();
    setScreen({ kind: 'workspace', project });
  };

  return (
    <ToastProvider>
      {screen.kind === 'switcher' && (
        <ProjectSwitcher
          projects={projects}
          loading={loading}
          onOpenProject={openProject}
          onCreateProject={handleCreateProject}
          onImportBackup={() => setScreen({ kind: 'import' })}
        />
      )}
      {screen.kind === 'import' && (
        <ImportBackupDialog onImported={handleImported} onCancel={() => setScreen({ kind: 'switcher' })} />
      )}
      {screen.kind === 'unlock' && (
        <UnlockScreen
          project={screen.project}
          db={openProjectDb(screen.project.id)}
          onUnlocked={() => setScreen({ kind: 'workspace', project: screen.project })}
          onCancel={() => setScreen({ kind: 'switcher' })}
        />
      )}
      {screen.kind === 'workspace' && (
        <Workspace
          project={screen.project}
          db={openProjectDb(screen.project.id)}
          onClose={async () => {
            await refreshProjects();
            setScreen({ kind: 'switcher' });
          }}
          onLock={() => setScreen({ kind: 'unlock', project: screen.project })}
        />
      )}
    </ToastProvider>
  );
}

export default App;
