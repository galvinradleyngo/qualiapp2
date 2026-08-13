import { useState } from 'react';
import type { ProjectDB } from '../../storage/projectDb';
import type { ProjectRecord } from '../../storage/registry';
import { AppShell, type NavItem } from '../../ui/AppShell';
import { ProjectStoreProvider } from './ProjectStore';
import { SettingsView } from './SettingsView';
import { TranscriptsDashboard } from '../transcripts/TranscriptsDashboard';
import { TranscriptEditor } from '../transcripts/TranscriptEditor';
import { CodebookView } from '../codebook/CodebookView';
import { ArtifactsDashboard } from '../artifacts/ArtifactsDashboard';
import { ObservationsDashboard } from '../observations/ObservationsDashboard';
import { ObservationEditor } from '../observations/ObservationEditor';
import { ParticipantVault } from '../participants/ParticipantVault';
import { AnalysisBoardView } from '../analysis/AnalysisBoardView';
import { TriangulationView } from '../triangulation/TriangulationView';

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
  const [activeObservationId, setActiveObservationId] = useState<string | null>(null);
  const [activeCanvasId, setActiveCanvasId] = useState<string | null>(null);

  return (
    <ProjectStoreProvider db={db}>
      <AppShell
        projectTitle={project.title}
        navItems={NAV_ITEMS}
        activeNavId={activeTranscriptId ? 'transcripts' : activeObservationId ? 'observations' : view}
        onNavigate={(id) => {
          setActiveTranscriptId(null);
          setActiveObservationId(null);
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
        {view === 'artifacts' && <ArtifactsDashboard />}
        {view === 'observations' &&
          (activeObservationId ? (
            <ObservationEditor observationId={activeObservationId} onBack={() => setActiveObservationId(null)} />
          ) : (
            <ObservationsDashboard onOpenObservation={setActiveObservationId} />
          ))}
        {view === 'participants' && <ParticipantVault />}
        {view === 'analysis' && (
          <AnalysisBoardView panelMode="analysis" activeCanvasId={activeCanvasId} onActiveCanvasIdChange={setActiveCanvasId} />
        )}
        {view === 'connecting' && (
          <AnalysisBoardView panelMode="connecting" activeCanvasId={activeCanvasId} onActiveCanvasIdChange={setActiveCanvasId} />
        )}
        {view === 'codebook' && <CodebookView />}
        {view === 'triangulation' && <TriangulationView />}
        {view === 'backup' && <ComingSoon label="Backup & Restore" />}
        {view === 'settings' && <SettingsView projectTitle={project.title} />}
      </AppShell>
    </ProjectStoreProvider>
  );
}
