import { describe, expect, it } from 'vitest';

import {
	parseConfigFile,
	pluginConfigFor,
} from '@cartago-git/mcp-core/lib/plugins/load-config-file';
import { assembleCliConfig } from '@cartago-git/mcp-core/lib/cli/assemble';
import { parseCliArgs } from '@cartago-git/mcp-core/lib/plugins/parse-cli-args';

describe('parseConfigFile', () => {
	it('returns {} for missing or invalid JSON', () => {
		expect(parseConfigFile(undefined)).toEqual({});
		expect(parseConfigFile('not json')).toEqual({});
		expect(parseConfigFile('[1,2]')).toEqual({});
	});

	it('reads per-plugin options and prefix', () => {
		const config = parseConfigFile(
			JSON.stringify({
				docsDir: 'docs/x',
				plugins: { proposals: { prefix: 'work', options: { a: 1 } } },
			})
		);
		expect(config.docsDir).toBe('docs/x');
		expect(pluginConfigFor(config, 'proposals')).toEqual({
			prefix: 'work',
			options: { a: 1 },
		});
		expect(pluginConfigFor(config, 'missing')).toEqual({});
	});
});

describe('assembleCliConfig + config file', () => {
	const fakePlugin = {
		name: 'demo',
		register: (ctx: { namespacePrefix: string; options: unknown }) => ({
			tools: [],
			knowledge: [
				{
					id: 'seen',
					title: ctx.namespacePrefix,
					body: JSON.stringify(ctx.options),
				},
			],
		}),
	};

	it('passes prefix + options from the config file to the plugin', async () => {
		const args = parseCliArgs(['--plugins=demo', '--workspace=/ws'], '/cwd');
		const { config } = await assembleCliConfig(args, {
			import: async () => ({ default: fakePlugin }),
			readFile: () =>
				JSON.stringify({
					plugins: { demo: { prefix: 'dd', options: { k: 'v' } } },
				}),
		});
		const known = config.knowledge?.find((entry) => entry.id === 'seen');
		expect(known?.title).toBe('dd');
		expect(known?.body).toBe(JSON.stringify({ k: 'v' }));
	});

	it('lets an explicit CLI flag win over the config file', async () => {
		const args = parseCliArgs(
			['--plugins=demo', '--cacheDir=.cli', '--workspace=/ws'],
			'/cwd'
		);
		const { config } = await assembleCliConfig(args, {
			import: async () => ({ default: fakePlugin }),
			readFile: () => JSON.stringify({ cacheDir: '.fromfile' }),
		});
		expect(config.corePaths?.cacheDir).toBe('.cli');
	});

	it('falls back to the config file when the CLI omits the flag', async () => {
		const args = parseCliArgs(['--plugins=demo', '--workspace=/ws'], '/cwd');
		const { config } = await assembleCliConfig(args, {
			import: async () => ({ default: fakePlugin }),
			readFile: () => JSON.stringify({ cacheDir: '.fromfile' }),
		});
		expect(config.corePaths?.cacheDir).toBe('.fromfile');
	});
});
