import { useEffect, useState } from 'react';
import type { ProjectDB } from '../../storage/projectDb';
import { dataGetAll } from '../../storage/projectDb';
import { hasPassword, setPassword, setRecovery } from '../../storage/security';
import type { ProjectRecord } from '../../storage/registry';

interface ProjectWorkspaceProps {
  project: ProjectRecord;
  db: ProjectDB;
  onClose: () => void;
}

const isCountable = (v: unknown): v is unknown[] => Array.isArray(v);

export function ProjectWorkspace({ project, db, onClose }: ProjectWorkspaceProps) {
  const [summary, setSummary] = useState<Record<string, number> | null>(null);
  const [fileCount, setFileCount] = useState<number>(0);
  const [locked, setLocked] = useState<boolean | null>(null);
  const [showSecurityForm, setShowSecurityForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [recoveryQuestion, setRecoveryQuestionInput] = useState('');
  const [recoveryAnswer, setRecoveryAnswerInput] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const all = await dataGetAll(db);
      const counts: Record<string, number> = {};
      for (const [key, value] of Object.entries(all)) {
        if (key.startsWith('sec_')) continue;
        if (isCountable(value)) counts[key] = value.length;
      }
      const files = await db.files.count();
      const isLocked = await hasPassword(db);
      if (!cancelled) {
        setSummary(counts);
        setFileCount(files);
        setLocked(isLocked);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db]);

  const handleSaveSecurity = async () => {
    if (newPassword.trim()) await setPassword(db, newPassword);
    if (recoveryQuestion.trim() && recoveryAnswer.trim()) await setRecovery(db, recoveryQuestion, recoveryAnswer);
    setLocked(true);
    setNewPassword('');
    setRecoveryQuestionInput('');
    setRecoveryAnswerInput('');
    setShowSecurityForm(false);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  return (
    <div>
      <div className="btn-row" style={{ justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <h1 className="app-title" style={{ marginBottom: 0 }}>
          {project.title}
        </h1>
        <button className="btn btn-secondary" onClick={onClose}>
          Close project
        </button>
      </div>
      <p className="app-subtitle">
        Phase 0 workspace — the full editor, codebook, and analysis tools land in later phases. This
        confirms the project's data imported and is stored correctly.
      </p>

      <div className="panel">
        <h2 style={{ marginTop: 0, fontSize: '1rem' }}>Data summary</h2>
        {summary === null ? (
          <p className="hint-text">Loading…</p>
        ) : Object.keys(summary).length === 0 && fileCount === 0 ? (
          <p className="hint-text">Empty project — nothing imported yet.</p>
        ) : (
          <ul>
            {Object.entries(summary).map(([key, count]) => (
              <li key={key}>
                {key}: {count}
              </li>
            ))}
            <li>files: {fileCount}</li>
          </ul>
        )}
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0, fontSize: '1rem' }}>Security</h2>
        <p className="hint-text">
          {locked === null ? 'Checking…' : locked ? 'Password protection is on for this project.' : 'No password set for this project.'}
        </p>
        {savedNotice && <p className="progress-text">Saved.</p>}
        {!showSecurityForm ? (
          <button className="btn btn-secondary" onClick={() => setShowSecurityForm(true)}>
            {locked ? 'Change password' : 'Set password'}
          </button>
        ) : (
          <>
            <div className="field">
              <label htmlFor="new-pw">New password</label>
              <input id="new-pw" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="rec-q">Recovery question</label>
              <input id="rec-q" value={recoveryQuestion} onChange={(e) => setRecoveryQuestionInput(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="rec-a">Recovery answer</label>
              <input id="rec-a" value={recoveryAnswer} onChange={(e) => setRecoveryAnswerInput(e.target.value)} />
            </div>
            <div className="btn-row">
              <button className="btn" onClick={handleSaveSecurity} disabled={!newPassword.trim()}>
                Save
              </button>
              <button className="btn btn-secondary" onClick={() => setShowSecurityForm(false)}>
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
