import fs from 'node:fs/promises';
import path from 'node:path';

import type { AuditResult } from './types';

const RUN_DIR = path.join(process.cwd(), '.geo-artifacts', 'runs');

const ensureDir = async () => {
  await fs.mkdir(RUN_DIR, { recursive: true });
};

export const persistRun = async (result: AuditResult) => {
  await ensureDir();
  const file = path.join(RUN_DIR, `${result.id}.json`);
  await fs.writeFile(file, JSON.stringify(result, null, 2), 'utf8');
};

export const loadRun = async (id: string): Promise<AuditResult | null> => {
  try {
    const file = path.join(RUN_DIR, `${id}.json`);
    const content = await fs.readFile(file, 'utf8');
    return JSON.parse(content) as AuditResult;
  } catch {
    return null;
  }
};

export const listRunFiles = async () => {
  try {
    await ensureDir();
    return fs.readdir(RUN_DIR);
  } catch {
    return [];
  }
};
