import type { ICloseMarkerSet } from './close-markers.interface';
import type { IKnowledgeEntry, ISkillEntry } from './knowledge.interface';
import type { IModelRoutingTable } from './model-routing.interface';
import type { IProposalStoreConfig } from './proposal-store.interface';
import type { IMcpCoreServerMetadata } from './server-metadata.interface';
import type { IStatusCollector } from './status-collector.interface';
import type {
	IPromptRegistration,
	IResourceRegistration,
	IToolRegistration,
} from './tool-registration.interface';
import type { IValidationMatrix } from './validation-matrix.interface';
import type {
	IHostPathLayout,
	IWorkspacePathProvider,
} from './workspace-paths.interface';

/**
 * Everything a host project injects to assemble an MCP server on top
 * of mcp-core. The framework owns the mechanics (deterministic
 * registration, locks, queue, proposal lifecycle — migrated in later
 * slices); the host owns every project-specific value: names, paths,
 * families, markers, models, commands, tools, skills and knowledge.
 */
export interface IMcpCoreHostConfig {
	readonly metadata: IMcpCoreServerMetadata;
	/**
	 * Prefix for host tool names, e.g. `affairs` → `affairs_*`.
	 * mcp-core never invents tool names outside this namespace.
	 */
	readonly namespacePrefix: string;
	readonly workspace: IWorkspacePathProvider;
	readonly pathLayout: IHostPathLayout;
	readonly proposalStore: IProposalStoreConfig;
	readonly closeMarkers: ICloseMarkerSet;
	readonly modelRouting: IModelRoutingTable;
	readonly validationMatrix: IValidationMatrix;
	/** Host runtime status seams (e.g. the Affairs engine loop). */
	readonly statusCollectors?: readonly IStatusCollector[] | undefined;
	readonly knowledge?: readonly IKnowledgeEntry[] | undefined;
	readonly skills?: readonly ISkillEntry[] | undefined;
	/**
	 * Host tools appended to (or anchored inside) the core
	 * registration sequence. See `IToolRegistration.registerAfter`.
	 */
	readonly extraTools?: readonly IToolRegistration[] | undefined;
	readonly extraPrompts?: readonly IPromptRegistration[] | undefined;
	readonly extraResources?: readonly IResourceRegistration[] | undefined;
}
