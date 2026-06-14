// p97 — host scaffolding kit: "tools to create tools". A project that
// imports mcp-core calls these generators (directly or through the
// `<prefix>_scaffold` MCP tool) to create its OWN MCP server,
// orchestrator and subagent adapters, instructions file, tools,
// prompts and skills — all templated so every agent DELEGATES to the
// project's own MCP server (`<prefix>_check_project_state` first),
// never to a hardcoded host.

export interface IScaffoldedFile {
	readonly path: string;
	readonly content: string;
}

export interface IScaffoldHostOptions {
	/** Project display name, e.g. `Acme Quest`. */
	readonly projectName: string;
	/** Tool namespace, e.g. `acme` → `acme_*` tools. */
	readonly namespacePrefix: string;
	/** Package that will hold the host server, e.g. `@acme/mcp-server`. */
	readonly serverPackageName: string;
	/** Default agent model id. */
	readonly defaultModel?: string;
}

const SUBAGENT_SLOTS = [
	'proposal_guardian',
	'implementation_runner',
	'delivery_verifier',
	'technical_investigator',
] as const;

export type IScaffoldAgentSlot =
	| 'orchestrator'
	| (typeof SUBAGENT_SLOTS)[number];

const kebab = (value: string): string =>
	value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');

const pascal = (value: string): string =>
	kebab(value)
		.split('-')
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join('');

// ---------------------------------------------------------------------------
// Single-artefact generators
// ---------------------------------------------------------------------------

export const scaffoldToolFile = (
	prefix: string,
	name: string,
	description: string
): IScaffoldedFile => {
	const id = kebab(name);
	const fn = pascal(name);
	const toolName = `${prefix}_${id.replace(/-/g, '_')}`;
	return {
		path: `libs/mcp-server/src/lib/tools/${prefix}-${id}.tool.ts`,
		content: `import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export const ${toolName.toUpperCase()}_TOOL = {
	name: '${toolName}',
	description: '${description.replace(/'/g, '')}',
} as const;

export const ${toolName.toUpperCase()}_INPUT_SCHEMA = z.object({});

export type I${fn}Args = z.infer<typeof ${toolName.toUpperCase()}_INPUT_SCHEMA>;

export function build${fn}Response(_args: I${fn}Args): {
	content: Array<{ type: 'text'; text: string }>;
} {
	return {
		content: [
			{
				type: 'text',
				text: JSON.stringify({ tool: '${toolName}', todo: true }, null, '\\t'),
			},
		],
	};
}

export async function register${fn}Tool(server: McpServer): Promise<void> {
	server.registerTool(
		${toolName.toUpperCase()}_TOOL.name,
		{
			description: ${toolName.toUpperCase()}_TOOL.description,
			inputSchema: ${toolName.toUpperCase()}_INPUT_SCHEMA,
		},
		async (args: I${fn}Args) => build${fn}Response(args)
	);
}
`,
	};
};

export const scaffoldPromptFile = (
	prefix: string,
	name: string,
	description: string
): IScaffoldedFile => {
	const id = kebab(name);
	const fn = pascal(name);
	const promptName = `${prefix}-${id}`;
	return {
		path: `libs/mcp-server/src/lib/prompts/${prefix}-${id}.prompt.ts`,
		content: `import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export const ${prefix.toUpperCase()}_${id.replace(/-/g, '_').toUpperCase()}_PROMPT = {
	name: '${promptName}',
	description: '${description.replace(/'/g, '')}',
} as const;

export async function register${fn}Prompt(server: McpServer): Promise<void> {
	server.registerPrompt(
		'${promptName}',
		{ description: '${description.replace(/'/g, '')}' },
		async () => ({
			messages: [
				{
					role: 'user' as const,
					content: {
						type: 'text' as const,
						text: 'Wrapper: call the ${prefix} MCP tools; the server is the source of truth.',
					},
				},
			],
		})
	);
}
`,
	};
};

export const scaffoldSkillFile = (
	prefix: string,
	name: string,
	description: string,
	whenToUse: readonly string[] = []
): IScaffoldedFile => {
	const id = kebab(name);
	const bullets =
		whenToUse.length > 0
			? whenToUse.map((entry) => `- ${entry}`).join('\n')
			: '- TODO: describe when an agent should read this skill.';
	return {
		path: `libs/mcp-server/src/lib/skills/${prefix}-${id}.md`,
		content: `---
id: ${prefix}-${id}
name: ${name}
description: '${description.replace(/'/g, '')}'
---

# ${prefix}-${id}

## When to use this skill

${bullets}

## Quick reference

1. Call \`${prefix}_check_project_state\` first; the MCP payload is the source of truth.
2. TODO: the skill body.

## Checklist

- [ ] TODO
`,
	};
};

export const scaffoldAgentFile = (
	options: IScaffoldHostOptions,
	slot: IScaffoldAgentSlot
): IScaffoldedFile => {
	const prefix = options.namespacePrefix;
	const model = options.defaultModel ?? 'MiniMax-M3 (customendpoint)';
	const isRoot = slot === 'orchestrator';
	const tools = isRoot
		? `[read, search, edit, execute, todo, agent, mcp-server-${prefix}/*]`
		: `[read, search, edit, execute, todo, mcp-server-${prefix}/*]`;
	return {
		path: `.github/agents/${slot}.agent.md`,
		content: `---
name: ${slot}
display-name: ${pascal(slot)} (${options.projectName})
icon: $(tools)
model: ${model}
description: |
    ${isRoot ? 'Root orchestrator' : 'Bounded subagent'} for ${options.projectName}. The real contract lives in the ${prefix} MCP server.
tools: ${tools}
user-invocable: ${isRoot ? 'true' : 'false'}
---

# ${slot}

This file is only the Copilot adapter; the agent contract lives in \`mcp-server-${prefix}\`.

## Compact lane

1. First call \`${prefix}_check_project_state\` once per turn (tool: \`mcp-server-${prefix}/${prefix}_check_project_state\`) and follow \`agentContracts.${slot}\`.
2. One atomic slice per turn; minimal validation; trust the MCP payload over local re-derivation.
3. Claim files before writing with \`${prefix}_agent_lock\`; report \`lock-conflict\` instead of retrying.
4. A broken global gate outside your ownership is \`external-gate-blocker\`: record evidence and continue with owned work.
`,
	};
};

export const scaffoldInstructionsFile = (
	options: IScaffoldHostOptions
): IScaffoldedFile => {
	const prefix = options.namespacePrefix;
	return {
		path: '.github/copilot-instructions.md',
		content: `# Copilot Instructions - ${options.projectName}

## Source of truth

The MCP server \`mcp-server-${prefix}\` rules. Do NOT re-derive workflow from docs:

- State + contracts: \`${prefix}_check_project_state\` (ALWAYS the first call).
- Next slice: \`${prefix}_continue_proposal\`. Quality gates: \`${prefix}_get_validation_matrix\`.

## Lane

- Default model: \`${options.defaultModel ?? 'MiniMax-M3 (customendpoint)'}\`.
- MCP payload first, one atomic slice, minimal validation, serial continuity.
- Every final message ends with ONE close marker line (see the close-markers constant of this host).
`,
	};
};

export const scaffoldHostConfigFile = (
	options: IScaffoldHostOptions
): IScaffoldedFile => {
	const prefix = options.namespacePrefix;
	return {
		path: 'libs/mcp-server/src/lib/shared/host-config.ts',
		content: `import {
	DEFAULT_PATH_LAYOUT,
	buildScaffoldToolRegistration,
	createWorkspacePathProvider,
} from '@cartago-git/mcp-core/public';
import type { IMcpCoreHostConfig } from '@cartago-git/mcp-core/public';

export const buildHostConfig = (): IMcpCoreHostConfig => {
	const workspace = createWorkspacePathProvider(process.cwd());
	return {
		metadata: {
			name: 'mcp-server-${prefix}',
			version: '0.0.1',
			description: '${options.projectName} workspace MCP server (built on mcp-core).',
		},
		namespacePrefix: '${prefix}',
		workspace,
		pathLayout: DEFAULT_PATH_LAYOUT,
		proposalStore: {
			families: [
				{ prefix: 'f', description: 'fixes (highest priority)' },
				{ prefix: 'p', description: 'proposals' },
			],
			familyCascade: ['f', 'p'],
			folders: { historical: 'historical', fixes: 'fixes' },
		},
		closeMarkers: {
			markers: [
				{ kind: 'done', marker: '🟩 [DONE]', requiresReason: false },
				{ kind: 'cap', marker: '🟨 [CAP]', requiresReason: true },
				{ kind: 'blocked', marker: '🟥 [BLOCKED]', requiresReason: true },
			],
			maxLineLength: 120,
		},
		modelRouting: {
			defaultModel: '${options.defaultModel ?? 'MiniMax-M3 (customendpoint)'}',
			routes: [],
		},
		validationMatrix: { scopes: {} },
		extraTools: [
			// Your project tools register here. The scaffold tool lets
			// agents generate more of them.
			buildScaffoldToolRegistration({
				namespacePrefix: '${prefix}',
				workspace,
				projectName: '${options.projectName}',
				serverPackageName: '${options.serverPackageName}',
			}),
		],
	};
};
`,
	};
};

export const scaffoldServerEntryFiles = (
	options: IScaffoldHostOptions
): readonly IScaffoldedFile[] => [
	{
		path: 'libs/mcp-server/src/server.ts',
		content: `import { createMcpServer } from '@cartago-git/mcp-core/public';

import { buildHostConfig } from './lib/shared/host-config';

export async function startServer(): Promise<void> {
	const assembled = await createMcpServer(buildHostConfig());
	await assembled.start();
}
`,
	},
	{
		path: 'libs/mcp-server/src/index.ts',
		content: `import { startServer } from './server';

void startServer();
`,
	},
	{
		path: '.vscode/mcp.json',
		content: `${JSON.stringify(
			{
				servers: {
					[`mcp-server-${options.namespacePrefix}`]: {
						command: 'bun',
						args: ['--watch', 'run', 'src/index.ts'],
						cwd: '${workspaceFolder}/libs/mcp-server',
					},
				},
			},
			null,
			'\t'
		)}
`,
	},
];

/**
 * Everything a brand-new project needs: server entry + host config +
 * editor registration + orchestrator + 4 subagents + instructions +
 * a starter skill.
 */
export const scaffoldHostProject = (
	options: IScaffoldHostOptions
): readonly IScaffoldedFile[] => [
	scaffoldHostConfigFile(options),
	...scaffoldServerEntryFiles(options),
	scaffoldAgentFile(options, 'orchestrator'),
	...SUBAGENT_SLOTS.map((slot) => scaffoldAgentFile(options, slot)),
	scaffoldInstructionsFile(options),
	scaffoldSkillFile(
		options.namespacePrefix,
		'project-standards',
		`Closed stack and conventions of ${options.projectName}.`
	),
];
