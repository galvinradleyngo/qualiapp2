import { useState } from 'react';
import { useProjectStore } from './ProjectStore';
import { setPassword, setRecovery, hasPassword } from '../../storage/security';
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

  useState(() => {
    void hasPassword(db).then(setLocked);
  });

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

  return (
    <div>
      <h1 className="app-title">Settings</h1>
      <p className="app-subtitle mb-6">{projectTitle}</p>

      <Card title="Security">
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
      </Card>
    </div>
  );
}
