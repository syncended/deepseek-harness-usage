import { randomUUID } from 'node:crypto'
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises'
import type { FileHandle } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import type { SessionUsage, UsageRecord } from './types.js'

export interface CachedSession {
  revision: string
  usage: SessionUsage
}

const MAX_DATE = 8_640_000_000_000_000

function invalid(): never {
  // Do not include untrusted checkpoint contents in errors or logs.
  throw new Error('Invalid usage checkpoint')
}

function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) invalid()
  return value as Record<string, unknown>
}

function string(value: unknown): string {
  if (typeof value !== 'string') invalid()
  return value
}

function timestamp(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > MAX_DATE) invalid()
  return value
}

function tokens(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) invalid()
  return value
}

function sanitizeRecord(value: unknown, sessionId: string): UsageRecord {
  const record = object(value)
  if (string(record.sessionId) !== sessionId) invalid()
  return {
    sessionId,
    timestamp: timestamp(record.timestamp),
    provider: string(record.provider),
    model: string(record.model),
    input: tokens(record.input),
    output: tokens(record.output),
    cacheRead: tokens(record.cacheRead),
    cacheWrite: tokens(record.cacheWrite),
  }
}

function sanitizeEntries(value: unknown): Map<string, CachedSession> {
  if (!Array.isArray(value)) invalid()
  const entries = new Map<string, CachedSession>()
  for (const entry of value) {
    if (!Array.isArray(entry) || entry.length !== 2) invalid()
    const sessionId = string(entry[0])
    if (entries.has(sessionId)) invalid()
    const cached = object(entry[1])
    const usage = object(cached.usage)
    if (string(usage.sessionId) !== sessionId || !Array.isArray(usage.records)) invalid()
    entries.set(sessionId, {
      revision: string(cached.revision),
      usage: {
        sessionId,
        createdAt: timestamp(usage.createdAt),
        records: usage.records.map((record: unknown) => sanitizeRecord(record, sessionId)),
      },
    })
  }
  return entries
}

export async function loadCheckpoint(path: string): Promise<Map<string, CachedSession>> {
  let contents: string
  try {
    contents = await readFile(path, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return new Map()
    throw error
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(contents)
  } catch {
    // JSON.parse errors can quote private source text; expose only a generic error.
    invalid()
  }
  const checkpoint = object(parsed)
  if (checkpoint.schemaVersion !== 1) invalid()
  return sanitizeEntries(checkpoint.entries)
}

export async function saveCheckpoint(path: string, entries: ReadonlyMap<string, CachedSession>): Promise<void> {
  // Validate and copy before touching disk; never serialize caller-owned objects.
  const sanitized = sanitizeEntries(Array.from(entries))
  const contents = JSON.stringify({ schemaVersion: 1, entries: Array.from(sanitized) })
  const directory = dirname(path)
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const temporary = join(directory, `.${basename(path)}.${randomUUID()}.tmp`)
  let handle: FileHandle | undefined
  let ownsTemporary = false
  try {
    handle = await open(temporary, 'wx', 0o600)
    ownsTemporary = true
    await handle.chmod(0o600)
    await handle.writeFile(contents, 'utf8')
    await handle.sync()
    await handle.close()
    handle = undefined
    await rename(temporary, path)
    ownsTemporary = false
  } finally {
    await handle?.close().catch(() => {})
    if (ownsTemporary) await unlink(temporary).catch(() => {})
  }
}
