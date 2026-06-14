#!/usr/bin/env bun
import { buildBootstrapToolRegistrations } from './lib/bootstrap/index';
import type { IKnowledgeEntry } from './lib/contracts/interfaces/knowledge.interface';
import type { IMcpCoreHostConfig } from './lib/contracts/interfaces/host-config.interface';
import type {
	IPromptRegistration,
	IResourceRegistration,
	IToolRegistration,
} from './lib/contracts/interfaces/tool-registration.interface';
import { loadPlugins } from './lib/plugins/load-plugins';
import type { IPluginLoadResult } from './lib/plugins/load-plugins';
import type { IMcpPluginContext } from './lib/plugins/plugin-contract';
import { parseCliArgs } from './lib/plugins/parse-cli-args';
import type { IMcpCoreCliArgs } from './lib/plugins/parse-cli-args';
import { buildScaffoldToolRegistration } from './lib/scaffold/scaffold-tool';
import { createMcpServer } from './lib/server/create-mcp-server';
import { createWorkspacePathProvider } from './lib/workspace/create-workspace-path-provider';

const joinRel = (base: string, child: string): string =>
	base.length === 0 ? child : `${base.replace(/\/+$/, '')}/${child}`;

export interface IAssembledCliConfig {
	readonly config: IMcpCoreHostConfig;
	readonly loadResult: IPluginLoadResult;
}

/**
 * Build the full host config from parsed CLI args: resolve the
 * workspace and core paths, load every `--plugins` entry, merge its
 * registrations, and always expose the core meta-tools (scaffold +
 * the hybrid analyze/create_server bootstrap). Pure except for the
 * injectable plugin importer, so it is fully testable.
 */
export const assembleCliConfig = async (
	args: IMcpCoreCliArgs,
	deps: { import?: (specifier: string) => Promise<unknown> } = {}
): Promise<IAssembledCliConfig> => {
	const workspace = createWorkspacePathProvider(args.workspace);
	const corePaths = { cacheDir: args.cacheDir, docsDir: args.docsDir };
	const corePrefix = args.namespacePrefix ?? 'mcpcore';

	const buildContext = (pluginName: string): IMcpPluginContext => ({
		workspace,
		corePaths,
		cacheDir: corePaths.cacheDir,
		docsDir: corePaths.docsDir,
		pluginCacheDir: joinRel(corePaths.cacheDir, pluginName),
		pluginDocsDir: joinRel(corePaths.docsDir, pluginName),
		namespacePrefix: args.extra[`prefix-${pluginName}`] ?? pluginName,
		args: args.extra,
	});

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

if (import.meta.main) {
	void runCli(process.argv.slice(2), process.cwd());
}
