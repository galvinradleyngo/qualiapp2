// Per-project PIN/password + recovery question, stored in that project's own
// database (see projectDb.ts) so each project locks independently. The
// Participant Vault has its own separate password, stored under a different
// key, so it can be locked independently of the main project password.

import { secPbkdf2Hash, secPbkdf2Verify } from '../backup/crypto';
import { dataGet, dataSet, type ProjectDB } from './projectDb';
import { SEC_APP_PIN_KEY, SEC_PARTICIPANT_PIN_KEY, SEC_RECOVERY_KEY } from './securityKeys';

export interface PinRecord {
  hash: string;
  salt: string;
}

export interface RecoveryRecord {
  question: string;
  answerHash: string;
  answerSalt: string;
}

async function hasPin(db: ProjectDB, key: string): Promise<boolean> {
  return (await dataGet<PinRecord>(db, key)) !== undefined;
}

async function setPin(db: ProjectDB, key: string, password: string): Promise<void> {
  await dataSet(db, key, await secPbkdf2Hash(password));
}

async function verifyPin(db: ProjectDB, key: string, password: string): Promise<boolean> {
  const record = await dataGet<PinRecord>(db, key);
  if (!record) return false;
  return secPbkdf2Verify(password, record.hash, record.salt);
}

export const hasPassword = (db: ProjectDB) => hasPin(db, SEC_APP_PIN_KEY);
export const setPassword = (db: ProjectDB, password: string) => setPin(db, SEC_APP_PIN_KEY, password);
export const verifyPassword = (db: ProjectDB, password: string) => verifyPin(db, SEC_APP_PIN_KEY, password);

export const hasParticipantPassword = (db: ProjectDB) => hasPin(db, SEC_PARTICIPANT_PIN_KEY);
export const setParticipantPassword = (db: ProjectDB, password: string) => setPin(db, SEC_PARTICIPANT_PIN_KEY, password);
export const verifyParticipantPassword = (db: ProjectDB, password: string) => verifyPin(db, SEC_PARTICIPANT_PIN_KEY, password);

export async function hasRecovery(db: ProjectDB): Promise<boolean> {
  return (await dataGet<RecoveryRecord>(db, SEC_RECOVERY_KEY)) !== undefined;
}

const normalizeRecoveryAnswer = (answer: string): string => answer.trim().toLowerCase();

export async function setRecovery(db: ProjectDB, question: string, answer: string): Promise<void> {
  const cleanQuestion = question.trim();
  const cleanAnswer = normalizeRecoveryAnswer(answer);
  if (!cleanQuestion || !cleanAnswer) return;
  const { hash: answerHash, salt: answerSalt } = await secPbkdf2Hash(cleanAnswer);
  await dataSet(db, SEC_RECOVERY_KEY, { question: cleanQuestion, answerHash, answerSalt });
}

export async function verifyRecovery(db: ProjectDB, answer: string): Promise<boolean> {
  const record = await dataGet<RecoveryRecord>(db, SEC_RECOVERY_KEY);
  if (!record) return false;
  return secPbkdf2Verify(normalizeRecoveryAnswer(answer), record.answerHash, record.answerSalt);
}

export async function getRecoveryQuestion(db: ProjectDB): Promise<string | undefined> {
  const record = await dataGet<RecoveryRecord>(db, SEC_RECOVERY_KEY);
  return record?.question;
}
