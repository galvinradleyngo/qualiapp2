// Per-project PIN/password + recovery question, stored in that project's own
// database (see projectDb.ts) so each project locks independently.

import { secPbkdf2Hash, secPbkdf2Verify } from '../backup/crypto';
import { dataGet, dataSet, type ProjectDB } from './projectDb';
import { SEC_APP_PIN_KEY, SEC_RECOVERY_KEY } from './securityKeys';

export interface PinRecord {
  hash: string;
  salt: string;
}

export interface RecoveryRecord {
  question: string;
  answerHash: string;
  answerSalt: string;
}

export async function hasPassword(db: ProjectDB): Promise<boolean> {
  return (await dataGet<PinRecord>(db, SEC_APP_PIN_KEY)) !== undefined;
}

export async function hasRecovery(db: ProjectDB): Promise<boolean> {
  return (await dataGet<RecoveryRecord>(db, SEC_RECOVERY_KEY)) !== undefined;
}

export async function setPassword(db: ProjectDB, password: string): Promise<void> {
  const record = await secPbkdf2Hash(password);
  await dataSet(db, SEC_APP_PIN_KEY, record);
}

export async function verifyPassword(db: ProjectDB, password: string): Promise<boolean> {
  const record = await dataGet<PinRecord>(db, SEC_APP_PIN_KEY);
  if (!record) return false;
  return secPbkdf2Verify(password, record.hash, record.salt);
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
