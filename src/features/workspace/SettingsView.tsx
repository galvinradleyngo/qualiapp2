import { useEffect, useState } from 'react';
import { useProjectStore } from './ProjectStore';
import { setPassword, setRecovery, hasPassword } from '../../storage/security';
import { getAutoLockEnabled, setAutoLockEnabled } from '../../storage/autoLock';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { TextField } from '../../ui/TextField';
import { useToast } from '../../ui/Toast';

export function SettingsView({ projectTitle }: { projectTitle: string }) {
  const { db } = useProjectStore();
  const { notify } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [recoveryQuestion, setRecoveryQuestionInput] = useState('');
  const [recoveryAnswer, setRecoveryAnswerInput] = useState('');
  const [locked, setLocked] = useState<boolean | null>(null);
  const [autoLock, setAutoLock] = useState(true);

  useEffect(() => {
    void hasPassword(db).then(setLocked);
    void getAutoLockEnabled(db).then(setAutoLock);
  }, [db]);

  const handleSave = async () => {
    if (newPassword.trim()) await setPassword(db, newPassword);
    if (recoveryQuestion.trim() && recoveryAnswer.trim()) await setRecovery(db, recoveryQuestion, recoveryAnswer);
    setLocked(true);
    setNewPassword('');
    setRecoveryQuestionInput('');
    setRecoveryAnswerInput('');
    setShowForm(false);
    notify('Security settings saved.', 'success');
  };

  const toggleAutoLock = async (enabled: boolean) => {
    setAutoLock(enabled);
    await setAutoLockEnabled(db, enabled);
  };

  return (
    <div>
      <h1 className="app-title">Settings</h1>
      <p className="app-subtitle mb-6">{projectTitle}</p>

      <Card title="Security" className="mb-6">
        <p className="mb-3 text-sm text-ink-soft">
          {locked === null ? 'Checking…' : locked ? 'Password protection is on for this project.' : 'No password set for this project.'}
        </p>
        {!showForm ? (
          <Button variant="secondary" onClick={() => setShowForm(true)}>
            {locked ? 'Change password' : 'Set password'}
          </Button>
        ) : (
          <div className="flex flex-col gap-4">
            <TextField label="New password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <TextField label="Recovery question" value={recoveryQuestion} onChange={(e) => setRecoveryQuestionInput(e.target.value)} />
            <TextField label="Recovery answer" value={recoveryAnswer} onChange={(e) => setRecoveryAnswerInput(e.target.value)} />
            <div className="flex gap-3">
              <Button onClick={handleSave} disabled={!newPassword.trim()}>
                Save
              </Button>
              <Button variant="secondary" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
        {locked && (
          <label className="mt-4 flex items-center gap-2 border-t border-border pt-4 text-sm text-ink-soft">
            <input type="checkbox" checked={autoLock} onChange={(e) => void toggleAutoLock(e.target.checked)} />
            Automatically lock this project after 20 minutes of inactivity
          </label>
        )}
      </Card>
    </div>
  );
}
