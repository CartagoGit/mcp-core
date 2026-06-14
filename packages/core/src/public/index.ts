/**
 * Public surface of `@cartago-git/mcp-core`. This barrel is the ONLY
 * stable import surface of the package (same policy as
 * `@affairs/engine/public`). Everything else under `src/lib` is
 * internal and may change without notice.
 */
export {
	coreToolRegistrations,
	createMcpServer,
	planRegistrationOrder,
} from '../lib/server/create-mcp-server';
export type { IMcpCoreServer } from '../lib/server/create-mcp-server';
export { createWorkspacePathProvider } from '../lib/workspace/create-workspace-path-provider';
export { DEFAULT_PATH_LAYOUT } from '../lib/contracts/constants/default-path-layout.constant';
export type { IMcpCoreHostConfig } from '../lib/contracts/interfaces/host-config.interface';
export type { IMcpCoreServerMetadata } from '../lib/contracts/interfaces/server-metadata.interface';
export type {
	IHostPathLayout,
	IWorkspacePathProvider,
} from '../lib/contracts/interfaces/workspace-paths.interface';
export type {
	IProposalFamily,
	IProposalStoreConfig,
} from '../lib/contracts/interfaces/proposal-store.interface';
export type {
	ICloseMarker,
	ICloseMarkerSet,
} from '../lib/contracts/interfaces/close-markers.interface';
export type {
	IModelRoute,
	IModelRoutingTable,
} from '../lib/contracts/interfaces/model-routing.interface';
export type { IStatusCollector } from '../lib/contracts/interfaces/status-collector.interface';
export type {
	IPromptRegistration,
	IResourceRegistration,
	IToolRegistration,
} from '../lib/contracts/interfaces/tool-registration.interface';
export type {
	IValidationCommand,
	IValidationMatrix,
} from '../lib/contracts/interfaces/validation-matrix.interface';
export type {
	IKnowledgeEntry,
	ISkillEntry,
} from '../lib/contracts/interfaces/knowledge.interface';

// p97 — host scaffolding kit ("tools to create tools").
export {
	scaffoldAgentFile,
	scaffoldHostConfigFile,
	scaffoldHostProject,
	scaffoldInstructionsFile,
	scaffoldPromptFile,
	scaffoldServerEntryFiles,
	scaffoldSkillFile,
	scaffoldToolFile,
} from '../lib/scaffold/scaffold-host';
export type {
	IScaffoldAgentSlot,
	IScaffoldHostOptions,
	IScaffoldedFile,
} from '../lib/scaffold/scaffold-host';
export {
	SCAFFOLD_INPUT_SCHEMA,
	buildScaffoldReport,
	buildScaffoldToolRegistration,
} from '../lib/scaffold/scaffold-tool';
export type {
	IScaffoldArgs,
	IScaffoldReport,
	IScaffoldToolOptions,
} from '../lib/scaffold/scaffold-tool';
