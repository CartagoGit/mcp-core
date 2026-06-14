import { describe, expect, it } from 'vitest';

import { parseCliArgs } from '@cartago-git/mcp-core/lib/plugins/parse-cli-args';

describe('parseCliArgs', () => {
	it('applies defaults when nothing is passed', () => {
		const args = parseCliArgs([], '/cwd');
		expect(args.plugins).toEqual([]);
		expect(args.cacheDir).toBe('.cache/mcp-core');
		expect(args.docsDir).toBe('docs/mcp-core');
		expect(args.workspace).toBe('/cwd');
	});

	it('parses --plugins as a comma list and overrides dirs', () => {
		const args = parseCliArgs(
			['--plugins=proposals,pepegrillo', '--cacheDir=.x', '--docsDir=d'],
			'/cwd'
		);
		expect(args.plugins).toEqual(['proposals', 'pepegrillo']);
		expect(args.cacheDir).toBe('.x');
		expect(args.docsDir).toBe('d');
	});

	it('supports --key value form and forwards unknown flags to extra', () => {
		const args = parseCliArgs(
			['--workspace', '/ws', '--proposalsDir', 'docs/p'],
			'/cwd'
		);
		expect(args.workspace).toBe('/ws');
		expect(args.extra['proposalsDir']).toBe('docs/p');
	});
});
