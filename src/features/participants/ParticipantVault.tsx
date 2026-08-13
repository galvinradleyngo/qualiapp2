import { useEffect, useState } from 'react';
import type { Participant } from '../../data/types';
import { useProjectStore } from '../workspace/ProjectStore';
import {
  hasParticipantPassword,
  setParticipantPassword,
  verifyParticipantPassword,
  verifyPassword,
} from '../../storage/security';
import { fileGet, fileSet, type ProjectDB } from '../../storage/projectDb';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { TextField } from '../../ui/TextField';

export function ParticipantVault() {
  const { db } = useProjectStore();
  const [unlocked, setUnlocked] = useState(false);

  // Re-locks every time this view is entered, matching the legacy app.
  useEffect(() => {
    setUnlocked(false);
  }, []);

  return unlocked ? <ParticipantVaultContent /> : <VaultGate db={db} onUnlock={() => setUnlocked(true)} />;
}

function VaultGate({ db, onUnlock }: { db: ProjectDB; onUnlock: () => void }) {
  const [isSetup, setIsSetup] = useState<boolean | null>(null);
  const [password, setPasswordInput] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void hasParticipantPassword(db).then((has) => setIsSetup(has));
  }, [db]);

  const handleFirstTimeSetup = async () => {
    if (password.length < 4) {
      setError('Password must be at least 4 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (await verifyPassword(db, password)) {
      setError('Use a different password here than your main project password, for extra protection.');
      return;
    }
    await setParticipantPassword(db, password);
    onUnlock();
  };

  const handleUnlock = async () => {
    const ok = await verifyParticipantPassword(db, password);
    if (!ok) {
      setError('Incorrect password.');
      return;
    }
    onUnlock();
  };

  if (isSetup === null) return <p className="text-sm text-ink-soft">Loading…</p>;

  return (
    <div className="mx-auto max-w-md py-12">
      <h1 className="app-title">Participant Vault</h1>
      <p className="app-subtitle mb-6">
        {isSetup ? 'Enter the vault password to continue.' : 'Set a password to protect participant records.'}
      </p>
      <Card>
        {!isSetup && (
          <p className="mb-3 text-sm text-ink-soft">
            Use a different password here than your main project password — this adds a second layer of protection for
            participant identities.
          </p>
        )}
        <div className="mb-4">
          <TextField label="Password" type="password" value={password} onChange={(e) => setPasswordInput(e.target.value)} autoFocus />
        </div>
        {!isSetup && (
          <div className="mb-4">
            <TextField label="Confirm password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
        )}
        {error && <p className="mb-3 text-sm text-red-700">{error}</p>}
        <Button onClick={isSetup ? handleUnlock : handleFirstTimeSetup} disabled={!password}>
          {isSetup ? 'Unlock' : 'Set password & continue'}
        </Button>
      </Card>
    </div>
  );
}

function ParticipantVaultContent() {
  const { db, data, set } = useProjectStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ pseudonym: '', actualName: '', interviewDate: '', notes: '' });

  const resetForm = () => {
    setEditingId(null);
    setForm({ pseudonym: '', actualName: '', interviewDate: '', notes: '' });
  };

  const startEdit = (p: Participant) => {
    setEditingId(p.id);
    setForm({ pseudonym: p.pseudonym, actualName: p.actualName, interviewDate: p.interviewDate, notes: p.notes });
  };

  const submit = async () => {
    if (!form.pseudonym.trim()) return;
    if (editingId) {
      await set(
        'participants',
        data.participants.map((p) => (p.id === editingId ? { ...p, ...form } : p)),
      );
    } else {
      const participant: Participant = {
        id: `${Date.now()}`,
        pseudonym: form.pseudonym.trim(),
        actualName: form.actualName,
        interviewDate: form.interviewDate,
        notes: form.notes,
        createdAt: new Date().toISOString(),
        consentFormId: null,
        consentFileName: null,
      };
      await set('participants', [participant, ...data.participants]);
    }
    resetForm();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this participant?')) return;
    await set(
      'participants',
      data.participants.filter((p) => p.id !== id),
    );
    if (editingId === id) resetForm();
  };

  const uploadConsent = async (participant: Participant, file: File) => {
    const key = `consent_${participant.id}_${Date.now()}`;
    await fileSet(db, key, file, { name: file.name, lastModified: file.lastModified });
    await set(
      'participants',
      data.participants.map((p) => (p.id === participant.id ? { ...p, consentFormId: key, consentFileName: file.name } : p)),
    );
  };

  const downloadConsent = async (participant: Participant) => {
    if (!participant.consentFormId) return;
    const row = await fileGet(db, participant.consentFormId);
    if (!row) return;
    const url = URL.createObjectURL(row.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = participant.consentFileName ?? 'consent';
    a.click();
    URL.revokeObjectURL(url);
  };

  const removeConsent = async (participant: Participant) => {
    await set(
      'participants',
      data.participants.map((p) => (p.id === participant.id ? { ...p, consentFormId: null, consentFileName: null } : p)),
    );
  };

  return (
    <div>
      <h1 className="app-title">Participant Vault</h1>
      <p className="app-subtitle mb-6">Pseudonyms, interview dates, and consent forms — kept separate from the main app lock.</p>

      <Card title={editingId ? 'Edit participant' : 'Add participant'} className="mb-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Pseudonym" placeholder="P-001" value={form.pseudonym} onChange={(e) => setForm({ ...form, pseudonym: e.target.value })} />
          <TextField label="Actual name (optional)" value={form.actualName} onChange={(e) => setForm({ ...form, actualName: e.target.value })} />
          <TextField label="Interview date" type="date" value={form.interviewDate} onChange={(e) => setForm({ ...form, interviewDate: e.target.value })} />
        </div>
        <div className="field mt-4">
          <label htmlFor="participant-notes">Notes</label>
          <textarea
            id="participant-notes"
            className="textarea"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Context, demographics, special considerations"
          />
        </div>
        <div className="mt-4 flex gap-2">
          <Button onClick={submit} disabled={!form.pseudonym.trim()}>
            {editingId ? 'Save changes' : 'Add participant'}
          </Button>
          {editingId && (
            <Button variant="secondary" onClick={resetForm}>
              Cancel
            </Button>
          )}
        </div>
      </Card>

      <div className="overflow-x-auto rounded-lg border border-border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-surface-alt text-left text-xs uppercase tracking-wide text-ink-soft">
            <tr>
              <th className="px-3 py-2">Pseudonym</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Interview date</th>
              <th className="px-3 py-2">Consent form</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {data.participants.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-3 py-2 font-medium">{p.pseudonym}</td>
                <td className="px-3 py-2 text-ink-soft">{p.actualName || '—'}</td>
                <td className="px-3 py-2 text-ink-soft">{p.interviewDate || '—'}</td>
                <td className="px-3 py-2">
                  {p.consentFileName ? (
                    <span className="flex items-center gap-2 text-xs">
                      {p.consentFileName}
                      <button className="link-btn" onClick={() => downloadConsent(p)}>
                        Download
                      </button>
                      <button className="link-btn" onClick={() => removeConsent(p)}>
                        Remove
                      </button>
                    </span>
                  ) : (
                    <label className="link-btn cursor-pointer">
                      Upload
                      <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && uploadConsent(p, e.target.files[0])} />
                    </label>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <button className="link-btn mr-3" onClick={() => startEdit(p)}>
                    Edit
                  </button>
                  <button className="text-xs text-red-700 hover:text-red-800" onClick={() => remove(p.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {data.participants.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-ink-soft">
                  No participants yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
