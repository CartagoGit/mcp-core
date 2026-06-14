import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * A unit of the deterministic registration sequence. Registration
 * order is semantically load-bearing (see p40c in the Affairs host),
 * so it is expressed as data and planned by `planRegistrationOrder`
 * instead of being implicit in call order.
 */
export interface IToolRegistration {
	/** Stable registration id, unique within the sequence. */
	readonly id: string;
	/**
	 * Insert this registration immediately after the registration
	 * with the given id. When omitted the registration is appended
	 * at the end of the sequence, preserving declaration order.
	 */
	readonly registerAfter?: string | undefined;
	register(server: McpServer): Promise<void>;
}

export interface IPromptRegistration {
	readonly id: string;
	register(server: McpServer): Promise<void>;
}

export interface IResourceRegistration {
	readonly id: string;
	register(server: McpServer): Promise<void>;
}
