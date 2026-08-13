import { useState } from 'react';
import type { ProjectDB } from '../../storage/projectDb';
import { getRecoveryQuestion, verifyPassword, verifyRecovery, setPassword } from '../../storage/security';
import type { ProjectRecord } from '../../storage/registry';

interface UnlockScreenProps {
  project: ProjectRecord;
  db: ProjectDB;
  onUnlocked: () => void;
  onCancel: () => void;
}

export function UnlockScreen({ project, db, onUnlocked, onCancel }: UnlockScreenProps) {
  const [password, setPasswordInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryAnswer, setRecoveryAnswer] = useState('');
  const [recoveryQuestion, setRecoveryQuestion] = useState<string | undefined>(undefined);
  const [newPassword, setNewPassword] = useState('');

  const openRecovery = async () => {
    setRecoveryQuestion(await getRecoveryQuestion(db));
    setRecoveryMode(true);
    setError(null);
  };

  const handleUnlock = async () => {
    setBusy(true);
    setError(null);
    try {
      const ok = await verifyPassword(db, password);
      if (!ok) {
        setError('Incorrect password.');
        return;
      }
      onUnlocked();
    } finally {
      setBusy(false);
    }
  };

  const handleRecover = async () => {
    setBusy(true);
    setError(null);
    try {
      const ok = await verifyRecovery(db, recoveryAnswer);
      if (!ok) {
        setError('That answer doesn’t match.');
        return;
      }
      if (!newPassword.trim()) {
        setError('Enter a new password.');
        return;
      }
      await setPassword(db, newPassword);
      onUnlocked();
    } finally {
      setBusy(false);
    }
  };

  if (recoveryMode) {
    return (
      <div>
        <h1 className="app-title">Reset password</h1>
        <p className="app-subtitle">{project.title}</p>
        <div className="panel">
          {recoveryQuestion ? (
            <>
              <div className="field">
                <label>{recoveryQuestion}</label>
                <input value={recoveryAnswer} onChange={(e) => setRecoveryAnswer(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="new-password">New password</label>
                <input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </div>
              {error && <p className="error-text">{error}</p>}
              <div className="btn-row">
                <button className="btn" onClick={handleRecover} disabled={busy || !recoveryAnswer.trim()}>
                  Reset password
                </button>
                <button className="btn btn-secondary" onClick={() => setRecoveryMode(false)} disabled={busy}>
                  Back
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="hint-text">No recovery question is set up for this project.</p>
              <button className="btn btn-secondary" onClick={() => setRecoveryMode(false)}>
                Back
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="app-title">{project.title}</h1>
      <p className="app-subtitle">Enter the project password to continue.</p>
      <div className="panel">
        <div className="field">
          <label htmlFor="unlock-password">Password</label>
          <input
            id="unlock-password"
            type="password"
            value={password}
            onChange={(e) => setPasswordInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
            autoFocus
          />
        </div>
        {error && <p className="error-text">{error}</p>}
        <div className="btn-row">
          <button className="btn" onClick={handleUnlock} disabled={busy || !password}>
            Unlock
          </button>
          <button className="btn btn-secondary" onClick={onCancel} disabled={busy}>
            Back to projects
          </button>
        </div>
        <p style={{ marginTop: '0.75rem' }}>
          <button className="link-btn" onClick={openRecovery}>
            Forgot password?
          </button>
        </p>
      </div>
    </div>
  );
}
