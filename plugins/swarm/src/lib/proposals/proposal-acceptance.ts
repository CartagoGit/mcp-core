/**
 * proposal-acceptance.ts
 *
 * T3 slice of p34 (Proposal Budget + Execution Plan Tool).
 *
 * Executes the `IAcceptanceCriterion[]` declared in a proposal's
 * frontmatter and returns a structured verdict that `delivery_verifier`
 * consumes to gate proposal closure.
 *
 * The implementation is intentionally thin: one subprocess per criterion,
 * captured stdout + stderr + exitCode, with a configurable per-criterion
 * timeout. The shape is documented in the
 * `affairs-proposal-workflow.md` skill and locked by
 * `tests/src/lib/proposals/executable-acceptance.spec.ts`.
 *
 * Runtime: `Bun.spawn`. The script NEVER shells out via `node:child_process`
 * so the run inherits Bun's `BUN_BIN` resolution and respects
 * `bunfig.toml`. We use `bun -e` for inline one-liners (e.g. `process.exit(1)`)
 * to keep the test commands self-contained.
 *
 * Policy (from p34 proposal §T3 point 10):
 *   - `exit0`  → exit code must be 0.
 *   - `pass`   → exit code must be 0 (semantic alias for `exit0`; the
 *                proposal convention uses `pass` for vitest-style
 *                commands whose meaningful output is on stdout).
 *   - `synchronized` → exit code must be 0 (alias for `exit0`; the
 *                      `affairs_audit_*` tools return a structured
 *                      `synchronized | drift` verdict and the criterion
 *                      is satisfied when the process exits 0, leaving
 *                      the structural check to the runtime assertion).
 *   - `contains:<substring>` → exit code must be 0 AND the captured
 *                               stdout+stderr must contain the substring.
 *
 * The function NEVER throws for a failing criterion. It throws ONLY for
 * pre-spawn validation failures (empty command, unknown `expect` literal)
 * so that the caller's batch loop is the single source of truth for
 * "all passed?" / "any failed?".
 */

import type { IAcceptanceCriterion } from './proposal-document';
import { ProposalParseError } from './proposal-errors';

// ---------------------------------------------------------------------------
// Public response shape
// ---------------------------------------------------------------------------

export interface IAcceptanceResult {
	readonly command: string;
	readonly expect: string;
	readonly passed: boolean;
	readonly actual: string;
	readonly exitCode: number | null;
	readonly reason?: string;
	readonly durationMs: number;
}

export interface IAcceptanceRunResult {
	readonly results: readonly IAcceptanceResult[];
	readonly allPassed: boolean;
	readonly totalDurationMs: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_CAPTURED_BYTES = 64 * 1024; // 64 KiB per stream; truncate beyond.

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Runs every criterion sequentially and returns a structured verdict.
 * Sequential is intentional: a flaky first criterion shouldn't race with a
 * later one, and the total runtime is dominated by the slowest single
 * criterion, not the sum.
 */
export const runAcceptanceCriteria = async (
	criteria: readonly IAcceptanceCriterion[]
): Promise<IAcceptanceRunResult> => {
	const startedAt = Date.now();
	const results: IAcceptanceResult[] = [];

	for (const criterion of criteria) {
		// 1. Pre-spawn validation. We re-validate here (the parser also
		//    validates) because a caller can build an `IAcceptanceCriterion`
		//    by hand without going through `parseProposalDocument`.
		if (
			typeof criterion.command !== 'string' ||
			criterion.command.length === 0
		) {
			throw new ProposalParseError(
				'INVALID_CRITERION',
				'',
				'runAcceptanceCriteria: command must be a non-empty string'
			);
		}
		if (!isValidExpect(criterion.expect)) {
			throw new ProposalParseError(
				'INVALID_CRITERION',
				'',
				`runAcceptanceCriteria: invalid expect value "${String(
					criterion.expect
				)}" (must be exit0 | pass | synchronized | contains:<substring>)`
			);
		}

		// 2. Spawn the subprocess via Bun. We never mock this — the spec is
		//    an integration spec and the whole point of acceptance criteria
		//    is to verify the actual command runs in the actual environment.
		//    If Bun is unavailable in the host, every spawn throws
		//    synchronously and the per-criterion `passed: false` is returned
		//    with a clear reason. The spec at
		//    `tests/src/lib/proposals/executable-acceptance.spec.ts` adds
		//    a `skipIf(!Bun.which('bun'))` guard for that case.
		const result = await runOne(criterion);
		results.push(result);
	}

	const allPassed = results.every((r) => r.passed);
	return {
		results,
		allPassed,
		totalDurationMs: Date.now() - startedAt,
	};
};

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const isValidExpect = (
	value: unknown
): value is IAcceptanceCriterion['expect'] => {
	if (typeof value !== 'string') return false;
	if (value === 'exit0' || value === 'pass' || value === 'synchronized') {
		return true;
	}
	return value.startsWith('contains:');
};

/**
 * Truncates a captured stream buffer to MAX_CAPTURED_BYTES. Returns the
 * original string when the buffer fits, otherwise appends a truncation
 * marker so the spec can still assert on it.
 */
const truncateCaptured = (raw: string): string => {
	if (raw.length <= MAX_CAPTURED_BYTES) return raw;
	return `${raw.slice(0, MAX_CAPTURED_BYTES)}\n...[truncated ${raw.length - MAX_CAPTURED_BYTES} bytes]`;
};

/**
 * Runs a single criterion to completion (or timeout). Returns a structured
 * `IAcceptanceResult`. The function never throws for a spawn failure; it
 * returns `passed: false` with a descriptive `reason`.
 */
const runOne = async (
	criterion: IAcceptanceCriterion
): Promise<IAcceptanceResult> => {
	const startedAt = Date.now();
	const timeoutMs = criterion.timeoutMs ?? DEFAULT_TIMEOUT_MS;

	// Bun availability check. `Bun.which` returns null when the binary is
	// not on PATH (or when running in a host that has no `Bun` global at
	// all). We surface this as a per-criterion failure rather than a
	// module-load crash so the caller can still see a coherent report.
	if (typeof Bun === 'undefined' || Bun.which('bun') === null) {
		return {
			command: criterion.command,
			expect: criterion.expect,
			passed: false,
			actual: '',
			exitCode: null,
			reason: 'Bun is not available in this host',
			durationMs: Date.now() - startedAt,
		};
	}

	// Use `bun -c <command>` to run the command via Bun's shell-less exec.
	// We split the command on whitespace; this is a deliberate trade-off —
	// full shell parsing is out of scope for the p34 round, and the
	// proposal convention is to keep acceptance commands as single
	// `bun <args>` invocations.
	const parts = criterion.command.split(/\s+/).filter((p) => p.length > 0);
	if (parts.length === 0) {
		// Re-checked at the public API level, but defensive.
		return {
			command: criterion.command,
			expect: criterion.expect,
			passed: false,
			actual: '',
			exitCode: null,
			reason: 'command is empty after tokenisation',
			durationMs: Date.now() - startedAt,
		};
	}
	const [cmd, ...args] = parts as [string, ...string[]];

	let proc: ReturnType<typeof Bun.spawn>;
	try {
		proc = Bun.spawn({
			cmd: [cmd, ...args],
			stdout: 'pipe',
			stderr: 'pipe',
			env: process.env,
		});
	} catch (e) {
		return {
			command: criterion.command,
			expect: criterion.expect,
			passed: false,
			actual: '',
			exitCode: null,
			reason: `spawn failed: ${e instanceof Error ? e.message : String(e)}`,
			durationMs: Date.now() - startedAt,
		};
	}

	// Read both streams concurrently so a slow stderr doesn't deadlock a
	// process that fills its stdout buffer. We cap the read at
	// MAX_CAPTURED_BYTES by destroying the stream after the first chunk
	// beyond the cap. We narrow the stream type explicitly because
	// `Bun.spawn` types stdout/stderr as `number | ReadableStream<Uint8Array>
	// | undefined` (the number branch is the fd case, not relevant here).
	const stdoutStream = proc.stdout as
		| ReadableStream<Uint8Array<ArrayBufferLike>>
		| undefined;
	const stderrStream = proc.stderr as
		| ReadableStream<Uint8Array<ArrayBufferLike>>
		| undefined;
	const readStreamCapped = async (
		stream: ReadableStream<Uint8Array<ArrayBufferLike>> | undefined
	): Promise<string> => {
		if (!stream) return '';
		const reader = stream.getReader();
		const chunks: Uint8Array[] = [];
		let total = 0;
		try {
			while (true) {
				const { value, done } = await reader.read();
				if (done) break;
				if (value === undefined) break;
				total += value.byteLength;
				if (total > MAX_CAPTURED_BYTES) {
					chunks.push(value);
					break;
				}
				chunks.push(value);
			}
		} finally {
			try {
				await reader.cancel();
			} catch {
				// ignore
			}
		}
		const buf = new Uint8Array(
			chunks.reduce((acc, c) => acc + c.byteLength, 0)
		);
		let offset = 0;
		for (const c of chunks) {
			buf.set(c, offset);
			offset += c.byteLength;
		}
		return truncateCaptured(new TextDecoder().decode(buf));
	};

	const stdoutPromise = readStreamCapped(stdoutStream);
	const stderrPromise = readStreamCapped(stderrStream);

	// Race the process exit against a timeout. The timer is cleared in
	// both branches so we don't leak handles.
	let timer: ReturnType<typeof setTimeout> | null = null;
	const timeoutPromise = new Promise<number>((resolve) => {
		timer = setTimeout(() => {
			try {
				proc.kill();
			} catch {
				// ignore — the process may have just exited
			}
			resolve(-1);
		}, timeoutMs);
	});

	const exitCode = await Promise.race([
		proc.exited.then(() => {
			if (timer !== null) clearTimeout(timer);
			return proc.exitCode;
		}),
		timeoutPromise,
	]);

	const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise]);

	if (exitCode === -1) {
		// Timed out. The process was killed; exitCode is whatever the
		// signal returned (null on some platforms). We synthesise a
		// negative code so the reason string is unambiguous.
		return {
			command: criterion.command,
			expect: criterion.expect,
			passed: false,
			actual: stdout + (stderr ? `\n${stderr}` : ''),
			exitCode: null,
			reason: `timeout: command did not exit within ${timeoutMs}ms`,
			durationMs: Date.now() - startedAt,
		};
	}

	const combined = stdout + (stderr ? `\n${stderr}` : '');

	if (criterion.expect === 'contains:') {
		// Edge case: empty substring. We treat this as "always pass when
		// exit 0" so the criterion is still meaningful.
		if (exitCode === 0) {
			return {
				command: criterion.command,
				expect: criterion.expect,
				passed: true,
				actual: combined,
				exitCode,
				durationMs: Date.now() - startedAt,
			};
		}
		return {
			command: criterion.command,
			expect: criterion.expect,
			passed: false,
			actual: combined,
			exitCode,
			reason: `exit code ${String(exitCode)}`,
			durationMs: Date.now() - startedAt,
		};
	}

	if (criterion.expect.startsWith('contains:')) {
		const needle = criterion.expect.slice('contains:'.length);
		if (exitCode !== 0) {
			return {
				command: criterion.command,
				expect: criterion.expect,
				passed: false,
				actual: combined,
				exitCode,
				reason: `exit code ${String(exitCode)} (substring not checked)`,
				durationMs: Date.now() - startedAt,
			};
		}
		if (!combined.includes(needle)) {
			return {
				command: criterion.command,
				expect: criterion.expect,
				passed: false,
				actual: combined,
				exitCode,
				reason: `substring not found: "${needle}"`,
				durationMs: Date.now() - startedAt,
			};
		}
		return {
			command: criterion.command,
			expect: criterion.expect,
			passed: true,
			actual: combined,
			exitCode,
			durationMs: Date.now() - startedAt,
		};
	}

	// exit0 | pass | synchronized → exit code must be 0.
	if (exitCode === 0) {
		return {
			command: criterion.command,
			expect: criterion.expect,
			passed: true,
			actual: combined,
			exitCode,
			durationMs: Date.now() - startedAt,
		};
	}
	return {
		command: criterion.command,
		expect: criterion.expect,
		passed: false,
		actual: combined,
		exitCode,
		reason: `exit code ${String(exitCode)}`,
		durationMs: Date.now() - startedAt,
	};
};
