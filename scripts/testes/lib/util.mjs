import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const REPORT_DIR = path.join(ROOT, 'relatorios-testes');

export function normalizePath(value) {
  return value.split(path.sep).join('/');
}

export function walk(dir, options = {}) {
  const ignored = new Set(options.ignored ?? ['.git', '.next', 'node_modules', 'relatorios-testes']);
  const files = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full, options));
    else files.push(full);
  }
  return files;
}

export function result(status, area, title, details = '', recommendation = '', meta = {}) {
  return { status, area, title, details, recommendation, ...meta };
}

export function runCommand(command, args = [], options = {}) {
  const startedAt = Date.now();
  const execution = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 20 * 1024 * 1024,
    ...options,
  });
  return {
    command: [command, ...args].join(' '),
    code: execution.status ?? 1,
    stdout: execution.stdout ?? '',
    stderr: execution.stderr ?? '',
    durationMs: Date.now() - startedAt,
    error: execution.error?.message ?? null,
  };
}

export function safeRead(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch { return ''; }
}

export function fileHash(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

export function ensureReportDir() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

export function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}
