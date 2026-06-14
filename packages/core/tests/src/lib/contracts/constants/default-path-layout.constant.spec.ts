import { describe, expect, it } from 'vitest';

import { DEFAULT_PATH_LAYOUT } from '@cartago-git/mcp-core/lib/contracts/constants/default-path-layout.constant';

describe('DEFAULT_PATH_LAYOUT', () => {
	it('pins the historical Affairs workspace layout as the default', () => {
		// Snapshot-style pin: these literals are load-bearing for the
		// first host (Affairs). Changing any of them is a breaking
		// change for hosts that rely on the defaults.
		expect(DEFAULT_PATH_LAYOUT).toEqual({
			lockFile: '.cache/agents.lock.json',
			subagentRegistryFile: '.cache/subagent-registry.json',
			roundContextDigestFile: '.cache/round-context.digest.json',
			taskQueueDir: '.cache/agent-queue',
			taskQueueFile: '.cache/agent-queue/queue.json',
			taskQueueHeartbeatFile: '.cache/agent-queue/heartbeat.json',
			closedTasksFile: '.cache/agent-queue/closed-tasks.json',
			orchestratorCheckpointFile:
				'.cache/agent/orchestrator/checkpoint.json',
			orchestratorChatContextFile:
				'.cache/agent/orchestrator/chat-context.json',
			finishDayReportFile: '.cache/agent/finish-day/last-report.json',
			finishDayJournalFile: '.cache/agent/finish-day/journal.log',
			proposalsDir: 'docs/proposals',
			proposalIndexFile: 'docs/proposals/index.json',
			scratchDir: '.cache',
		});
	});

	it('keeps every artefact inside the scratch or proposals dirs', () => {
		const { proposalsDir, scratchDir, ...artefacts } = DEFAULT_PATH_LAYOUT;
		for (const value of Object.values(artefacts)) {
			const inScratch = value.startsWith(`${scratchDir}/`);
			const inProposals = value.startsWith(`${proposalsDir}/`);
			expect(inScratch || inProposals).toBe(true);
		}
	});
});
