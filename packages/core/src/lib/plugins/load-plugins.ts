import type {
	IMcpPlugin,
	IMcpPluginContext,
	IMcpPluginRegistrations,
} from './plugin-contract';

export interface ILoadedPlugin {
	/** The specifier the user passed (`--plugins=<this>`). */
	readonly specifier: string;
	/** The module specifier that actually resolved. */
	readonly resolved: string;
	readonly plugin: IMcpPlugin;
	readonly registrations: IMcpPluginRegistrations;
}

export interface IPluginLoadResult {
	readonly loaded: readonly ILoadedPlugin[];
	readonly errors: ReadonlyArray<{
		readonly specifier: string;
		readonly message: string;
	}>;
}

export interface ILoadPluginsOptions {
	readonly specifiers: readonly string[];
	/** Build the per-plugin context once the plugin's name is known. */
	readonly buildContext: (pluginName: string) => IMcpPluginContext;
	/** Injectable importer (default: dynamic `import`). For tests. */
	readonly import?: (specifier: string) => Promise<unknown>;
}

/**
 * Turn a short plugin name into the module specifiers to try, in
 * order. A relative/absolute path or an explicit package path is used
 * verbatim; a bare short name (`proposals`) expands to the scoped
 * convention first (`@cartago-git/mcp-proposals`), then the bare name.
 */
export const resolvePluginSpecifier = (specifier: string): string[] => {
	if (
		specifier.startsWith('.') ||
		specifier.startsWith('/') ||
		specifier.startsWith('file:')
	) {
		return [specifier];
	}
	if (specifier.includes('/')) return [specifier];
	return [`@cartago-git/mcp-${specifier}`, `mcp-${specifier}`, specifier];
};

const asPlugin = (mod: unknown): IMcpPlugin | undefined => {
	const candidate =
		mod && typeof mod === 'object' && 'default' in mod
			? (mod as { default: unknown }).default
			: mod;
	const value =
		typeof candidate === 'function'
			? (candidate as () => unknown)()
			: candidate;
	if (
		value &&
		typeof value === 'object' &&
		typeof (value as IMcpPlugin).name === 'string' &&
		typeof (value as IMcpPlugin).register === 'function'
	) {
		return value as IMcpPlugin;
	}
	return undefined;
};

/**
 * Resolve, import and register each requested plugin. One bad plugin
 * never aborts the rest: failures are collected in `errors` and the
 * server still boots with whatever loaded. Deterministic: plugins are
 * processed in the order requested.
 */
export const loadPlugins = async (
	options: ILoadPluginsOptions
): Promise<IPluginLoadResult> => {
	const importer =
		options.import ?? ((specifier: string) => import(specifier));
	const loaded: ILoadedPlugin[] = [];
	const errors: Array<{ specifier: string; message: string }> = [];

	for (const specifier of options.specifiers) {
		const candidates = resolvePluginSpecifier(specifier);
		let plugin: IMcpPlugin | undefined;
		let resolved = '';
		const attemptErrors: string[] = [];
		for (const candidate of candidates) {
			try {
				const mod = await importer(candidate);
				const found = asPlugin(mod);
				if (found) {
					plugin = found;
					resolved = candidate;
					break;
				}
				attemptErrors.push(`${candidate}: no default IMcpPlugin export`);
			} catch (error) {
				attemptErrors.push(
					`${candidate}: ${error instanceof Error ? error.message : String(error)}`
				);
			}
		}
		if (!plugin) {
			errors.push({
				specifier,
				message: `could not load plugin "${specifier}" (tried ${candidates.join(', ')}). ${attemptErrors.join('; ')}`,
			});
			continue;
		}
		try {
			const registrations = await plugin.register(
				options.buildContext(plugin.name)
			);
			loaded.push({ specifier, resolved, plugin, registrations });
		} catch (error) {
			errors.push({
				specifier,
				message: `plugin "${plugin.name}" register() failed: ${error instanceof Error ? error.message : String(error)}`,
			});
		}
	}

	return { loaded, errors };
};
