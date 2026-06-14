import { definePlugin } from '@cartago-git/mcp-core/public';

import { DEFAULT_PATH_LAYOUT } from './lib/contracts/constants/default-path-layout.constant';
import { buildAgentLockRegistration } from './lib/tools/agent-lock.tool';
import { buildAgentNamesRegistration } from './lib/tools/agent-names.tool';
import { buildAutoWorkRegistration } from './lib/tools/auto-work.tool';
import { buildContinueProposalRegistration } from './lib/tools/continue-proposal.tool';
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
				buildAgentNamesRegistration({
					namespacePrefix: ctx.namespacePrefix,
					registryPathAbs: abs(layout.subagentRegistryFile),
					lockPathAbs: abs(layout.lockFile),
					queuePathAbs: abs(layout.taskQueueFile),
					closedTasksPathAbs: abs(layout.closedTasksFile),
					...(Array.isArray(ctx.options['namePool'])
						? { pool: ctx.options['namePool'] as string[] }
						: {}),
				}),
				buildContinueProposalRegistration({
					namespacePrefix: ctx.namespacePrefix,
					indexPathAbs: abs(layout.proposalIndexFile),
					lockPathAbs: abs(layout.lockFile),
					...(Array.isArray(ctx.options['familyCascade'])
						? {
								familyCascade: ctx.options[
									'familyCascade'
								] as string[],
							}
						: {}),
				}),
				buildAutoWorkRegistration({
					namespacePrefix: ctx.namespacePrefix,
					indexPathAbs: abs(layout.proposalIndexFile),
					lockPathAbs: abs(layout.lockFile),
					...(Array.isArray(ctx.options['familyCascade'])
						? {
								familyCascade: ctx.options[
									'familyCascade'
								] as string[],
							}
						: {}),
					...(typeof ctx.options['validationCommand'] === 'string'
						? {
								validationCommand: ctx.options[
									'validationCommand'
								] as string,
							}
						: {}),
				}),
			],
			knowledge: [
				{
					id: 'proposals-workflow',
					title: 'Proposals workflow',
					body: [
						'# Proposals workflow',
						'',
						`Tools are namespaced \`${ctx.namespacePrefix}_*\`. Start with \`auto_work\`.`,
						'',
						'- `auto_work` — one call: the next proposal + an ordered action plan.',
						'- `continue_proposal` — next proposal (mode "auto"), or a parallel slice plan/claim (modes "plan"/"claim").',
						'- `agent_lock` — claim files before editing, release after (claim/release/status/gc).',
						'- `get_proposal_workflow` — families, locations, naming, template.',
						'- `sync_proposals` — rebuild the index after creating/renaming proposal files.',
						'- `agent_names` — name the whole agent tree, orchestrator included.',
						'- `task_queue` / `round_context` — multi-agent coordination & resumed rounds.',
						'',
						'Loop: claim → one atomic slice → validate → sync → release. Report `lock-conflict` instead of retrying a blocked claim.',
						`State under \`${layout.scratchDir}\`; proposals under \`${layout.proposalsDir}\`.`,
					].join('\n'),
				},
			],
		};
	},
});
