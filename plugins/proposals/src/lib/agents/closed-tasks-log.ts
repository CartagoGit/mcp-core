/**
 * closed-tasks-log.ts
 *
 * Append-only log of closed tasks, stored at .cache/agent-queue/closed-tasks.json.
 * FIFO eviction at 32 entries (oldest discarded).
 *
 * original cap was 256 entries.
 * cap reduced from 256 to 32 — for enjambres of 2-4 agents the
 * log is only consulted for tail diagnostics, so a 32-entry window
 * (the most recent 32 closed tasks) is more than enough. Smaller cap
 * also keeps the file well under 8 KB so the periodic `report()` can
 * include a digest without scanning the queue itself.
 */

import { readFile, rename, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Max entries constant
// ---------------------------------------------------------------------------

const MAX_ENTRIES = 32;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IClosedTaskRecord {
	readonly taskId: string;
	readonly closedAt: string;
	readonly agentName: string;
	readonly filesOwned: readonly string[];
}

// ---------------------------------------------------------------------------
// Zod schema for validation
// ---------------------------------------------------------------------------

const ClosedTaskRecordSchema = z.object({
	taskId: z.string().min(1),
	closedAt: z.string().min(1),
	agentName: z.string().min(1),
	filesOwned: z.array(z.string()),
});

const ClosedTasksLogSchema = z.array(ClosedTaskRecordSchema);

// ---------------------------------------------------------------------------
// readClosedTasks — defensive read, returns empty array on any error
// ---------------------------------------------------------------------------

export const readClosedTasks = async (
	logPath: string
): Promise<IClosedTaskRecord[]> => {
	try {
		const raw = await readFile(logPath, 'utf8');
		const parsed = JSON.parse(raw) as unknown;
		const result = ClosedTasksLogSchema.safeParse(parsed);
		if (!result.success) {
			return [];
		}
		return result.data as IClosedTaskRecord[];
	} catch {
		return [];
	}
};

// ---------------------------------------------------------------------------
// appendToClosedTasks — idempotent append with FIFO eviction
// ---------------------------------------------------------------------------

export const appendToClosedTasks = async (
	logPath: string,
	record: IClosedTaskRecord
): Promise<void> => {
	const existing = await readClosedTasks(logPath);

	// Idempotency: skip if same taskId already present
	if (existing.some((r) => r.taskId === record.taskId)) {
		return;
	}

	const updated = [...existing, record];

	// FIFO eviction: keep only the last MAX_ENTRIES
	const trimmed =
		updated.length > MAX_ENTRIES
			? updated.slice(updated.length - MAX_ENTRIES)
			: updated;

	// Atomic write: tmp + rename
	const tmpPath = join(
		tmpdir(),
		`mcp-core-ctl-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
	);
	await writeFile(tmpPath, JSON.stringify(trimmed, null, 2), 'utf8');
	await rename(tmpPath, logPath);
};
