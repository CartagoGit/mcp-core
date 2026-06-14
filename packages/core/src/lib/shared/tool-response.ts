/**
 * Shared tool-response helpers. All tools should return COMPACT JSON
 * (no pretty-printing) to minimise tokens, and a consistent envelope
 * so any agent or model handles success and failure the same way:
 *
 * - success: `{ ok: true, ...data }`
 * - failure: `{ ok: false, error: { reason, nextAction? } }` + `isError`
 */
export interface IToolTextResult {
	content: Array<{ type: 'text'; text: string }>;
	isError?: boolean;
	// The MCP SDK's tool result type carries an open index signature.
	[key: string]: unknown;
}

/** Compact JSON text result (no envelope). Use for raw structured data. */
export const toolJson = (value: unknown): IToolTextResult => ({
	content: [{ type: 'text', text: JSON.stringify(value) }],
});

/** Compact success envelope: `{ ok: true, ...data }`. */
export const toolOk = (
	data: Record<string, unknown> = {}
): IToolTextResult => toolJson({ ok: true, ...data });

/** Compact, uniform error envelope with an actionable hint. */
export const toolError = (
	reason: string,
	nextAction?: string
): IToolTextResult => ({
	content: [
		{
			type: 'text',
			text: JSON.stringify({
				ok: false,
				error: {
					reason,
					...(nextAction !== undefined ? { nextAction } : {}),
				},
			}),
		},
	],
	isError: true,
});
