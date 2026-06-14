/**
 * Per-plugin configuration loaded from `mcp-core.config.json`. This is
 * the structured way to pass values to plugins: each plugin gets a
 * typed `options` object (any JSON — nested objects, arrays…) plus an
 * optional tool-namespace `prefix`. CLI flags override these roots; the
 * file is the place for anything beyond a quick override.
 *
 * ```jsonc
 * {
 *   "cacheDir": ".cache/mcp-core",
 *   "docsDir": "docs/mcp-core",
 *   "plugins": {
 *     "proposals": { "prefix": "work", "options": { "docsDir": "docs/x" } }
 *   }
 * }
 * ```
 */
export interface IMcpCorePluginConfig {
	readonly prefix?: string;
	readonly options?: Readonly<Record<string, unknown>>;
}

export interface IMcpCoreConfigFile {
	readonly cacheDir?: string;
	readonly docsDir?: string;
	readonly plugins?: Readonly<Record<string, IMcpCorePluginConfig>>;
}

/** Default config file name looked up at the workspace root. */
export const DEFAULT_CONFIG_FILENAME = 'mcp-core.config.json';

/**
 * Parse a config file's raw contents. Pure and forgiving: missing
 * (`undefined`) or invalid JSON yields an empty config, so a typo in
 * the file never crashes the server — it just contributes nothing.
 */
export const parseConfigFile = (raw: string | undefined): IMcpCoreConfigFile => {
	if (raw === undefined) return {};
	try {
		const value = JSON.parse(raw) as unknown;
		if (value && typeof value === 'object' && !Array.isArray(value)) {
			return value as IMcpCoreConfigFile;
		}
		return {};
	} catch {
		return {};
	}
};

/** Resolve the per-plugin entry, never undefined. */
export const pluginConfigFor = (
	config: IMcpCoreConfigFile,
	pluginName: string
): IMcpCorePluginConfig => config.plugins?.[pluginName] ?? {};
