import { useState } from 'react';
import type { ProjectDB } from '../../storage/projectDb';
import { getRecoveryQuestion, verifyPassword, verifyRecovery, setPassword } from '../../storage/security';
import type { ProjectRecord } from '../../storage/registry';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { TextField } from '../../ui/TextField';

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
      <div className="mx-auto max-w-md px-6 py-16">
        <h1 className="app-title">Reset password</h1>
        <p className="app-subtitle mb-6">{project.title}</p>
        <Card>
          {recoveryQuestion ? (
            <>
              <div className="mb-4">
                <TextField label={recoveryQuestion} value={recoveryAnswer} onChange={(e) => setRecoveryAnswer(e.target.value)} />
              </div>
              <div className="mb-4">
                <TextField
                  label="New password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              {error && <p className="mb-3 text-sm text-red-700">{error}</p>}
              <div className="flex gap-3">
                <Button onClick={handleRecover} disabled={busy || !recoveryAnswer.trim()}>
                  Reset password
                </Button>
                <Button variant="secondary" onClick={() => setRecoveryMode(false)} disabled={busy}>
                  Back
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="mb-3 text-sm text-ink-soft">No recovery question is set up for this project.</p>
              <Button variant="secondary" onClick={() => setRecoveryMode(false)}>
                Back
              </Button>
            </>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <h1 className="app-title">{project.title}</h1>
      <p className="app-subtitle mb-6">Enter the project password to continue.</p>
      <Card>
        <div className="mb-4">
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPasswordInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
            autoFocus
          />
        </div>
        {error && <p className="mb-3 text-sm text-red-700">{error}</p>}
        <div className="flex gap-3">
          <Button onClick={handleUnlock} disabled={busy || !password}>
            Unlock
          </Button>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Back to projects
          </Button>
        </div>
        <p className="mt-4">
          <button className="link-btn" onClick={openRecovery}>
            Forgot password?
          </button>
        </p>
      </Card>
    </div>
  );
}
