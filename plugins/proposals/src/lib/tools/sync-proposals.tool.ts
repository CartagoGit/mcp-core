import type { IToolRegistration } from '@cartago-git/mcp-core/public';

import { syncProposalRegistry } from '../proposals/sync-proposal-registry';

export interface ISyncProposalsToolOptions {
	readonly namespacePrefix: string;
	/** Absolute workspace root the engine resolves proposal paths under. */
	readonly workspaceRoot: string;
}

/**
 * Post-mutation hook: regenerates the proposal index from the markdown
 * files under the proposals dir. Idempotent; reports whether the index
 * changed. Call after creating or renaming files under the proposals
 * dir. Thin adapter over the (tested) sync engine.
 */
export const buildSyncProposalsRegistration = (
	options: ISyncProposalsToolOptions
): IToolRegistration => ({
	id: 'sync_proposals',
	register: async (server) => {
		server.registerTool(
			`${options.namespacePrefix}_sync_proposals`,
			{
				description:
					'Regenerate the proposal index from the .md files under the proposals dir. Idempotent. Invoke after any create or rename under the proposals dir. Returns { changed, count, indexPath, errors }.',
			},
			async () => {
				const result = await syncProposalRegistry(options.workspaceRoot);
				return {
					content: [
						{
							type: 'text' as const,
							text: JSON.stringify(
								{
									changed: result.changed,
									count: result.count,
									indexPath: result.indexPath,
									errors: result.errors,
								},
								null,
								'\t'
							),
						},
					],
				};
			}
		);
	},
});
