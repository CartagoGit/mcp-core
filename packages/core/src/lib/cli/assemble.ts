import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildBootstrapToolRegistrations } from '../bootstrap/index';
import { DEFAULT_CORE_PATHS } from '../contracts/interfaces/core-paths.interface';
import type { IKnowledgeEntry } from '../contracts/interfaces/knowledge.interface';
import type { IMcpCoreHostConfig } from '../contracts/interfaces/host-config.interface';
import type {
	IPromptRegistration,
	IResourceRegistration,
	IToolRegistration,
} from '../contracts/interfaces/tool-registration.interface';
import {
	DEFAULT_CONFIG_FILENAME,
	parseConfigFile,
	pluginConfigFor,
} from '../plugins/load-config-file';
import { loadPlugins } from '../plugins/load-plugins';
import type { IPluginLoadResult } from '../plugins/load-plugins';
import type { IMcpPluginContext } from '../plugins/plugin-contract';
import { parseCliArgs } from '../plugins/parse-cli-args';
import type { IMcpCoreCliArgs } from '../plugins/parse-cli-args';
import { buildScaffoldToolRegistration } from '../scaffold/scaffold-tool';
import { createMcpServer } from '../server/create-mcp-server';
import { createWorkspacePathProvider } from '../workspace/create-workspace-path-provider';

const joinRel = (base: string, child: string): string =>
	base.length === 0 ? child : `${base.replace(/\/+$/, '')}/${child}`;

export interface IAssembledCliConfig {
	readonly config: IMcpCoreHostConfig;
	readonly loadResult: IPluginLoadResult;
}

export interface IAssembleCliDeps {
	/** Injectable plugin importer (default: dynamic `import`). */
	import?: (specifier: string) => Promise<unknown>;
	/** Injectable config-file reader (default: node fs). */
	readFile?: (absolutePath: string) => string | undefined;
}

/**
 * Build the full host config from parsed CLI args: resolve the
 * workspace and core paths (CLI flag > config file > default), load
 * every `--plugins` entry passing each its `mcp-core.config.json`
 * options, merge the registrations, and always expose the core
 * meta-tools (scaffold + the hybrid analyze/create_server bootstrap).
 * Pure except for the injectable importer/reader, so it is fully
 * testable.
 */
export const assembleCliConfig = async (
	args: IMcpCoreCliArgs,
	deps: IAssembleCliDeps = {}
): Promise<IAssembledCliConfig> => {
	const workspace = createWorkspacePathProvider(args.workspace);
	const readFile =
		deps.readFile ??
		((absolutePath: string) =>
			existsSync(absolutePath)
				? readFileSync(absolutePath, 'utf8')
				: undefined);

	// Config file: --config, else `mcp-core.config.json` at the workspace.
	const configPath =
		args.configPath ?? join(args.workspace, DEFAULT_CONFIG_FILENAME);
	const fileConfig = parseConfigFile(readFile(configPath));

	// Precedence for roots: explicit CLI flag > config file > default.
	const cacheDir =
		args.tokens['cacheDir'] ??
		fileConfig.cacheDir ??
		DEFAULT_CORE_PATHS.cacheDir;
	const docsDir =
		args.tokens['docsDir'] ?? fileConfig.docsDir ?? DEFAULT_CORE_PATHS.docsDir;
	const corePaths = { cacheDir, docsDir };
	const corePrefix = args.namespacePrefix ?? 'mcpcore';

	const buildContext = (pluginName: string): IMcpPluginContext => {
		const pluginConfig = pluginConfigFor(fileConfig, pluginName);
		return {
			workspace,
			corePaths,
			cacheDir: corePaths.cacheDir,
			docsDir: corePaths.docsDir,
			pluginCacheDir: joinRel(corePaths.cacheDir, pluginName),
			pluginDocsDir: joinRel(corePaths.docsDir, pluginName),
			namespacePrefix: pluginConfig.prefix ?? pluginName,
			options: pluginConfig.options ?? {},
			args: args.extra,
		};
	};

	const loadResult = await loadPlugins({
		specifiers: args.plugins,
		buildContext,
		...(deps.import ? { import: deps.import } : {}),
	});

	const tools: IToolRegistration[] = [
		...buildBootstrapToolRegistrations({
			workspace,
			namespacePrefix: corePrefix,
		}),
		buildScaffoldToolRegistration({
			namespacePrefix: corePrefix,
			workspace,
			projectName: args.serverName,
			serverPackageName: '@cartago-git/mcp-core',
		}),
	];
	const prompts: IPromptRegistration[] = [];
	const resources: IResourceRegistration[] = [];
	const knowledge: IKnowledgeEntry[] = [];

	for (const { registrations } of loadResult.loaded) {
		if (registrations.tools) tools.push(...registrations.tools);
		if (registrations.prompts) prompts.push(...registrations.prompts);
		if (registrations.resources) resources.push(...registrations.resources);
		if (registrations.knowledge) knowledge.push(...registrations.knowledge);
	}

	const config: IMcpCoreHostConfig = {
		metadata: {
			name: args.serverName,
			version: args.serverVersion,
			description: 'mcp-core server (CLI plugin loader).',
		},
		namespacePrefix: corePrefix,
		workspace,
		corePaths,
		knowledge,
		extraTools: tools,
		extraPrompts: prompts,
		extraResources: resources,
	};

	return { config, loadResult };
};

/** Entry point for the `mcp-core` bin. */
export const runCli = async (
	argv: readonly string[],
	cwd: string
): Promise<void> => {
	const args = parseCliArgs(argv, cwd);
	const { config, loadResult } = await assembleCliConfig(args);
	for (const error of loadResult.errors) {
		// stderr only: stdout is the MCP stdio transport.
		process.stderr.write(`[mcp-core] plugin error: ${error.message}\n`);
	}
	const assembled = await createMcpServer(config);
	await assembled.start();
};
