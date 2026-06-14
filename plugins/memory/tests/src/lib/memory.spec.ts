import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
	readStore,
	recall,
	removeNote,
	saveNote,
} from '@cartago-git/mcp-memory/lib/store';
import plugin from '@cartago-git/mcp-memory';
import type { IMcpPluginContext } from '@cartago-git/mcp-core/public';

describe('memory store', () => {
	let dir = '';
	let store = '';
	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), 'mem-'));
		store = join(dir, 'notes.json');
	});
	afterEach(() => rmSync(dir, { recursive: true, force: true }));

	it('upserts by title and recalls by query/tags', () => {
		saveNote(store, { title: 'DB choice', body: 'we use mysql', tags: ['db'] });
		saveNote(store, { title: 'DB choice', body: 'we use mysql2', tags: ['db'] });
		expect(readStore(store)).toHaveLength(1); // upsert, not duplicate
		expect(recall(store, { query: 'mysql2' })[0]?.title).toBe('DB choice');
		expect(recall(store, { tags: ['db'] })).toHaveLength(1);
		expect(recall(store, { tags: ['missing'] })).toHaveLength(0);
	});

	it('forgets by id', () => {
		const note = saveNote(store, { title: 'Temp', body: 'x' });
		expect(removeNote(store, note.id)).toBe(true);
		expect(readStore(store)).toHaveLength(0);
	});
});

describe('memory plugin', () => {
	it('registers the four memory tools + knowledge', async () => {
		const ctx = {
			workspace: { root: '/ws', resolve: (p: string) => `/ws/${p}` },
			corePaths: { cacheDir: '.cache/mcp-core', docsDir: 'docs/mcp-core' },
			cacheDir: '.cache/mcp-core',
			docsDir: 'docs/mcp-core',
			pluginCacheDir: '.cache/mcp-core/memory',
			pluginDocsDir: 'docs/mcp-core/memory',
			namespacePrefix: 'memory',
			options: {},
			args: {},
		} satisfies IMcpPluginContext;
		const reg = await plugin.register(ctx);
		expect(reg.tools?.map((t) => t.id)).toEqual([
			'memory_save',
			'memory_recall',
			'memory_list',
			'memory_forget',
		]);
		expect(reg.knowledge?.[0]?.id).toBe('memory-usage');
	});
});
