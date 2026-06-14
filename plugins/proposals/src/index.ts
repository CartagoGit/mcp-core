import { definePlugin } from '@cartago-git/mcp-core/public';

import { DEFAULT_PATH_LAYOUT } from './lib/contracts/constants/default-path-layout.constant';
import { buildAgentLockRegistration } from './lib/tools/agent-lock.tool';
import { buildGetProposalWorkflowRegistration } from './lib/tools/get-proposal-workflow.tool';
import { buildRoundContextRegistration } from './lib/tools/round-context.tool';
import { buildSyncProposalsRegistration } from './lib/tools/sync-proposals.tool';
import { buildTaskQueueRegistration } from './lib/tools/task-queue.tool';

/**
 * The proposals workflow plugin. It turns mcp-core into a multi-agent
 * proposal runner: a file-based proposal store, file-level write locks
 * and a persistent task queue (the "swarm" coordination layer).
 *
 * Load it with `mcp-core --plugins=proposals`. Paths come from the
 * core's resolved roots: cache/state under `<cacheDir>/proposals`,
 * human-edited proposals under `<docsDir>/proposals`. Override the docs
 * root with `--docsDir`, the cache root with `--cacheDir`.
 *
 * Every tool is namespaced by the plugin (`proposals_*` by default)
 * and returns structured JSON so any agent or model consumes it the
 * same way.
 */
export default definePlugin({
	name: 'proposals',
	version: '0.1.0',
	describe:
		'Proposal store + file-level agent locks + persistent task queue (multi-agent swarm coordination).',
	register(ctx) {
		// All path-bearing tools share ONE layout so locks, queue,
		// round-context and the proposal store always agree. The engines
		// in this package bake this same DEFAULT_PATH_LAYOUT, so the
		// plugin uses it too (rather than ctx.pluginCacheDir) to stay
		// coherent. Relocating it is programmatic (buildSwarmPaths).
		const layout = DEFAULT_PATH_LAYOUT;
		const abs = (relativePath: string): string =>
			ctx.workspace.resolve(relativePath);

		return {
			tools: [
				buildAgentLockRegistration({
					namespacePrefix: ctx.namespacePrefix,
					lockPathAbs: abs(layout.lockFile),
					lockFileLabel: layout.lockFile,
				}),
				buildTaskQueueRegistration({
					namespacePrefix: ctx.namespacePrefix,
					paths: {
						queuePath: abs(layout.taskQueueFile),
						closedTasksPath: abs(layout.closedTasksFile),
					},
				}),
				buildSyncProposalsRegistration({
					namespacePrefix: ctx.namespacePrefix,
					workspaceRoot: ctx.workspace.root,
				}),
				buildGetProposalWorkflowRegistration({
					namespacePrefix: ctx.namespacePrefix,
					proposalsDir: layout.proposalsDir,
					indexFile: layout.proposalIndexFile,
				}),
				buildRoundContextRegistration({
					namespacePrefix: ctx.namespacePrefix,
					workspaceRoot: ctx.workspace.root,
					digestPathAbs: abs(layout.roundContextDigestFile),
					coreDocs: ['README.md', layout.proposalIndexFile],
				}),
			],
			knowledge: [
				{
					id: 'proposals-workflow',
					title: 'Proposals workflow',
					body: [
						'# Proposals workflow',
						'',
						`Tools are namespaced \`${ctx.namespacePrefix}_*\`.`,
						'',
						'1. Claim the files you will edit with `agent_lock` (action "claim", a unique task_id, and the file list). Report `lock-conflict` instead of retrying on a blocked claim.',
						'2. Do one atomic slice of work; keep edits within the claimed files.',
						'3. Release with `agent_lock` (action "release") when the slice closes.',
						'4. Use `task_queue` (enqueue/dequeue/subscribe/report) only to coordinate parallel agents (waitFor / observe / backpressure).',
						'',
						`Cache/state lives under \`${layout.scratchDir}\`; proposal documents under \`${layout.proposalsDir}\`.`,
					].join('\n'),
				},
			],
		};
	},
});
