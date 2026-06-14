import type { IHostPathLayout } from '../interfaces/workspace-paths.interface';

/**
 * Default workspace layout. Every value is overridable by the host;
 * these defaults mirror the historical Affairs layout so the first
 * host migrates without churn. New hosts may adopt them as-is: the
 * only assumption is a scratch dir (`.cache/`) and a proposals dir
 * (`docs/proposals/`) under the workspace root.
 */
export const DEFAULT_PATH_LAYOUT: IHostPathLayout = {
	lockFile: '.cache/agents.lock.json',
	subagentRegistryFile: '.cache/subagent-registry.json',
	roundContextDigestFile: '.cache/round-context.digest.json',
	taskQueueDir: '.cache/agent-queue',
	taskQueueFile: '.cache/agent-queue/queue.json',
	taskQueueHeartbeatFile: '.cache/agent-queue/heartbeat.json',
	closedTasksFile: '.cache/agent-queue/closed-tasks.json',
	orchestratorCheckpointFile: '.cache/agent/orchestrator/checkpoint.json',
	orchestratorChatContextFile: '.cache/agent/orchestrator/chat-context.json',
	finishDayReportFile: '.cache/agent/finish-day/last-report.json',
	finishDayJournalFile: '.cache/agent/finish-day/journal.log',
	proposalsDir: 'docs/proposals',
	proposalIndexFile: 'docs/proposals/index.json',
	scratchDir: '.cache',
} as const;
