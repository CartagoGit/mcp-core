/**
 * proposal-errors.ts
 *
 * ProposalParseError and the closed IProposalErrorCode union used across the
 * proposals module. T2 and T3 may add more error codes; the union is extended
 * here, not in consumer modules.
 */

export type IProposalErrorCode =
	| 'INVALID_FRONTMATTER'
	| 'INVALID_BUDGET'
	| 'INVALID_CRITERION'
	| 'PROPOSAL_NOT_FOUND'
	| 'INVALID_PROPOSAL_ID'
	| 'INVALID_SWARM_BUDGET'
	| 'INVALID_CONTINUITY_POLICY';

/**
 * Thrown by `parseProposalDocument` and related functions when a proposal
 * file contains invalid or missing frontmatter.
 */
export class ProposalParseError extends Error {
	readonly code: IProposalErrorCode;
	readonly path: string;

	constructor(code: IProposalErrorCode, path: string, message: string) {
		super(message);
		this.name = 'ProposalParseError';
		this.code = code;
		this.path = path;
	}
}
