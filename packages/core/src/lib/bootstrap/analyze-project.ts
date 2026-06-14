/**
 * Read-only, injectable view of the target project. The default
 * implementation (in `bootstrap-tool.ts`) reads from disk relative to
 * the workspace root; tests pass an in-memory reader. Keeping I/O
 * behind this seam is what makes the analyzer pure and agnostic.
 */
export interface IFileReader {
	/** Returns file contents, or undefined if it does not exist. */
	readFile(relativePath: string): string | undefined;
	exists(relativePath: string): boolean;
	/** Top-level entries of a directory (names only), or []. */
	listDir(relativePath: string): readonly string[];
}

export type IProjectType =
	| 'library'
	| 'cli'
	| 'webapp'
	| 'game'
	| 'monorepo'
	| 'generic';

export interface IProjectAnalysis {
	readonly hasPackageJson: boolean;
	readonly name: string | undefined;
	readonly projectType: IProjectType;
	readonly language: 'typescript' | 'javascript' | 'unknown';
	readonly packageManager: 'bun' | 'pnpm' | 'yarn' | 'npm' | 'unknown';
	readonly framework: string | undefined;
	readonly testRunner: 'vitest' | 'jest' | 'bun' | 'node' | 'unknown';
	/** True if the project already ships (or depends on) an MCP server. */
	readonly hasMcpServer: boolean;
	/** Evidence behind `hasMcpServer`. */
	readonly mcpEvidence: readonly string[];
	/** Recognised quality-gate scripts, by role. */
	readonly scripts: Readonly<Record<string, string>>;
	/** Free-form notes the recommender and the agent can use. */
	readonly signals: readonly string[];
}

interface IPackageJson {
	name?: string;
	bin?: unknown;
	main?: string;
	module?: string;
	exports?: unknown;
	workspaces?: unknown;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	scripts?: Record<string, string>;
}

const safeJson = (raw: string | undefined): IPackageJson | undefined => {
	if (raw === undefined) return undefined;
	try {
		return JSON.parse(raw) as IPackageJson;
	} catch {
		return undefined;
	}
};

const allDeps = (pkg: IPackageJson | undefined): Record<string, string> => ({
	...(pkg?.dependencies ?? {}),
	...(pkg?.devDependencies ?? {}),
});

const detectFramework = (deps: Record<string, string>): string | undefined => {
	if ('@angular/core' in deps) return 'angular';
	if ('next' in deps) return 'next';
	if ('react' in deps) return 'react';
	if ('vue' in deps) return 'vue';
	if ('svelte' in deps) return 'svelte';
	if ('solid-js' in deps) return 'solid';
	return undefined;
};

const detectGame = (deps: Record<string, string>): boolean =>
	'phaser' in deps || 'three' in deps || 'pixi.js' in deps || 'babylonjs' in deps;

const detectPackageManager = (
	reader: IFileReader
): IProjectAnalysis['packageManager'] => {
	if (reader.exists('bun.lock') || reader.exists('bun.lockb')) return 'bun';
	if (reader.exists('pnpm-lock.yaml')) return 'pnpm';
	if (reader.exists('yarn.lock')) return 'yarn';
	if (reader.exists('package-lock.json')) return 'npm';
	return 'unknown';
};

const detectTestRunner = (
	deps: Record<string, string>,
	scripts: Record<string, string>
): IProjectAnalysis['testRunner'] => {
	if ('vitest' in deps) return 'vitest';
	if ('jest' in deps) return 'jest';
	const testScript = scripts['test'] ?? '';
	if (/\bvitest\b/.test(testScript)) return 'vitest';
	if (/\bjest\b/.test(testScript)) return 'jest';
	if (/\bbun test\b/.test(testScript)) return 'bun';
	if (/\bnode --test\b/.test(testScript)) return 'node';
	return 'unknown';
};

const QUALITY_ROLES = ['lint', 'test', 'build', 'typecheck'] as const;

const pickScripts = (
	scripts: Record<string, string>
): Record<string, string> => {
	const out: Record<string, string> = {};
	for (const role of QUALITY_ROLES) {
		if (scripts[role] !== undefined) out[role] = scripts[role] as string;
	}
	// common aliases
	if (out['typecheck'] === undefined && scripts['type-check'] !== undefined) {
		out['typecheck'] = scripts['type-check'] as string;
	}
	return out;
};

const detectProjectType = (
	pkg: IPackageJson | undefined,
	deps: Record<string, string>,
	framework: string | undefined
): IProjectType => {
	if (pkg?.workspaces !== undefined) return 'monorepo';
	if (detectGame(deps)) return 'game';
	if (framework !== undefined) return 'webapp';
	if (pkg?.bin !== undefined) return 'cli';
	if (pkg?.exports !== undefined || pkg?.main !== undefined) return 'library';
	return 'generic';
};

const detectMcp = (
	reader: IFileReader,
	deps: Record<string, string>
): { has: boolean; evidence: string[] } => {
	const evidence: string[] = [];
	if ('@modelcontextprotocol/sdk' in deps) {
		evidence.push('depends on @modelcontextprotocol/sdk');
	}
	for (const path of ['.vscode/mcp.json', 'mcp.json', '.cursor/mcp.json']) {
		if (reader.exists(path)) evidence.push(`found ${path}`);
	}
	for (const path of ['src/server.ts', 'src/mcp-server.ts', 'server.ts']) {
		if (reader.exists(path)) evidence.push(`found ${path}`);
	}
	return { has: evidence.length > 0, evidence };
};

/**
 * Inspect a project through a read-only reader and produce a structured
 * analysis. Never throws on malformed input — missing or invalid files
 * degrade to `unknown`/`generic` so the recommender always has data.
 */
export const analyzeProject = (reader: IFileReader): IProjectAnalysis => {
	const pkg = safeJson(reader.readFile('package.json'));
	const deps = allDeps(pkg);
	const scripts = pkg?.scripts ?? {};
	const framework = detectFramework(deps);
	const language =
		reader.exists('tsconfig.json') || reader.exists('tsconfig.base.json')
			? 'typescript'
			: pkg !== undefined
				? 'javascript'
				: 'unknown';
	const mcp = detectMcp(reader, deps);
	const projectType = detectProjectType(pkg, deps, framework);

	const signals: string[] = [];
	if (pkg === undefined) signals.push('no package.json — limited analysis');
	if (mcp.has) signals.push('an MCP server already exists; recommend augmenting, not replacing');
	else signals.push('no MCP server detected; a fresh one can be scaffolded');
	if (framework !== undefined) signals.push(`web framework: ${framework}`);

	return {
		hasPackageJson: pkg !== undefined,
		name: pkg?.name,
		projectType,
		language,
		packageManager: detectPackageManager(reader),
		framework,
		testRunner: detectTestRunner(deps, scripts),
		hasMcpServer: mcp.has,
		mcpEvidence: mcp.evidence,
		scripts: pickScripts(scripts),
		signals,
	};
};
