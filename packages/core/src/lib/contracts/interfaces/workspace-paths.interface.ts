/**
 * Resolves workspace-relative paths to absolute paths. The host
 * project decides where its workspace root lives; mcp-core code must
 * never call `process.cwd()` or hardcode directory layouts.
 */
export interface IWorkspacePathProvider {
	/** Absolute workspace root. */
	readonly root: string;
	/** Resolve a workspace-relative path to an absolute path. */
	resolve(relativePath: string): string;
}

/**
 * Workspace-relative locations of every artefact the framework
 * persists. Each host project supplies its own layout (or accepts
 * the defaults in `default-path-layout.constant.ts`). All values are
 * relative to `IWorkspacePathProvider.root`.
 */
export interface IHostPathLayout {
	/** File-level mutex with heartbeat (agent lock subsystem). */
	readonly lockFile: string;
	/** Registry of spawned subagents. */
	readonly subagentRegistryFile: string;
	/** Round-context digest cache (staleness detection). */
	readonly roundContextDigestFile: string;
	/** Directory holding the persistent task queue artefacts. */
	readonly taskQueueDir: string;
	/** Persistent task queue. */
	readonly taskQueueFile: string;
	/** Task queue heartbeat. */
	readonly taskQueueHeartbeatFile: string;
	/** Log of closed tasks. */
	readonly closedTasksFile: string;
	/** Orchestrator checkpoint. */
	readonly orchestratorCheckpointFile: string;
	/** Orchestrator chat context. */
	readonly orchestratorChatContextFile: string;
	/** Last end-of-day report. */
	readonly finishDayReportFile: string;
	/** Append-only end-of-day journal. */
	readonly finishDayJournalFile: string;
	/** Directory holding the proposal documents. */
	readonly proposalsDir: string;
	/** Machine-readable proposal index. */
	readonly proposalIndexFile: string;
	/** Scratch directory for transient agent artefacts. */
	readonly scratchDir: string;
}
