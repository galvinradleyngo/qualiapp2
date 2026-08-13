import { useState } from 'react';
import type { ProjectDB } from '../../storage/projectDb';
import type { ProjectRecord } from '../../storage/registry';
import { AppShell, type NavItem } from '../../ui/AppShell';
import { ProjectStoreProvider } from './ProjectStore';
import { SettingsView } from './SettingsView';
import { TranscriptsDashboard } from '../transcripts/TranscriptsDashboard';
import { TranscriptEditor } from '../transcripts/TranscriptEditor';
import { CodebookView } from '../codebook/CodebookView';

interface WorkspaceProps {
  project: ProjectRecord;
  db: ProjectDB;
  onClose: () => void;
}

type ViewId =
  | 'transcripts'
  | 'artifacts'
  | 'observations'
  | 'participants'
  | 'analysis'
  | 'connecting'
  | 'codebook'
  | 'triangulation'
  | 'backup'
  | 'settings';

const NAV_ITEMS: NavItem[] = [
  { id: 'transcripts', label: 'Transcripts', icon: '📝' },
  { id: 'artifacts', label: 'Project Artifacts', icon: '📎' },
  { id: 'observations', label: 'Onsite Observations', icon: '🧭' },
  { id: 'participants', label: 'Participant Vault', icon: '🔒' },
  { id: 'analysis', label: 'Analysis Canvas', icon: '🗂️' },
  { id: 'connecting', label: 'Connecting Analysis', icon: '🔗' },
  { id: 'codebook', label: 'Codebook', icon: '📖' },
  { id: 'triangulation', label: 'Triangulation', icon: '🧪' },
  { id: 'backup', label: 'Backup & Restore', icon: '💾' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

function ComingSoon({ label }: { label: string }) {
  return (
    <div>
      <h1 className="app-title">{label}</h1>
      <p className="app-subtitle">This section is being rebuilt and will land in a follow-up update.</p>
    </div>
  );
}

export function Workspace({ project, db, onClose }: WorkspaceProps) {
  const [view, setView] = useState<ViewId>('transcripts');
  const [activeTranscriptId, setActiveTranscriptId] = useState<string | null>(null);

  return (
    <ProjectStoreProvider db={db}>
      <AppShell
        projectTitle={project.title}
        navItems={NAV_ITEMS}
        activeNavId={activeTranscriptId ? 'transcripts' : view}
        onNavigate={(id) => {
          setActiveTranscriptId(null);
          setView(id as ViewId);
        }}
        onCloseProject={onClose}
      >
        {view === 'transcripts' &&
          (activeTranscriptId ? (
            <TranscriptEditor transcriptId={activeTranscriptId} onBack={() => setActiveTranscriptId(null)} />
          ) : (
            <TranscriptsDashboard onOpenTranscript={setActiveTranscriptId} />
          ))}
        {view === 'artifacts' && <ComingSoon label="Project Artifacts" />}
        {view === 'observations' && <ComingSoon label="Onsite Observations" />}
        {view === 'participants' && <ComingSoon label="Participant Vault" />}
        {view === 'analysis' && <ComingSoon label="Analysis Canvas" />}
        {view === 'connecting' && <ComingSoon label="Connecting Analysis" />}
        {view === 'codebook' && <CodebookView />}
        {view === 'triangulation' && <ComingSoon label="Triangulation" />}
        {view === 'backup' && <ComingSoon label="Backup & Restore" />}
        {view === 'settings' && <SettingsView projectTitle={project.title} />}
      </AppShell>
    </ProjectStoreProvider>
  );
}
