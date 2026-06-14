/**
 * Public surface of `@cartago-git/mcp-proposals`. The default export
 * (in `../index.ts`) is the loadable `IMcpPlugin`; this barrel exposes
 * the building blocks for hosts that wire the engines directly.
 */
export { default } from '../index';

export {
	DEFAULT_PATH_LAYOUT,
	buildSwarmPaths,
} from '../lib/contracts/constants/default-path-layout.constant';
export type { IHostPathLayout } from '../lib/contracts/interfaces/swarm-path-layout.interface';

export { buildAgentLockRegistration } from '../lib/tools/agent-lock.tool';
export type { IAgentLockToolOptions } from '../lib/tools/agent-lock.tool';
export { buildTaskQueueRegistration } from '../lib/tools/task-queue.tool';
export type { ITaskQueueToolOptions } from '../lib/tools/task-queue.tool';
export { buildSyncProposalsRegistration } from '../lib/tools/sync-proposals.tool';
export type { ISyncProposalsToolOptions } from '../lib/tools/sync-proposals.tool';
export { buildGetProposalWorkflowRegistration } from '../lib/tools/get-proposal-workflow.tool';
export type { IGetProposalWorkflowToolOptions } from '../lib/tools/get-proposal-workflow.tool';
export {
	buildRoundContextRegistration,
	buildRoundContextOutput,
} from '../lib/tools/round-context.tool';
export type {
	IRoundContextToolOptions,
	IRoundContextOutput,
} from '../lib/tools/round-context.tool';
export {
	buildProposalWorkflow,
} from '../lib/knowledge/proposal-workflow';
export type { IProposalWorkflow } from '../lib/knowledge/proposal-workflow';
