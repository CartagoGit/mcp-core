import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
	runAgentNames,
	type IAgentNamesToolOptions,
} from '@cartago-git/mcp-proposals/lib/tools/agent-names.tool';

const parse = (result: { content: Array<{ text: string }> }): unknown =>
	JSON.parse(result.content[0]?.text ?? '{}');

describe('agent_names (covers the orchestrator, not only subagents)', () => {
	let root = '';
	let options: IAgentNamesToolOptions;

	beforeEach(() => {
		root = mkdtempSync(join(tmpdir(), 'agent-names-'));
		options = {
			namespacePrefix: 'proposals',
			registryPathAbs: join(root, 'registry.json'),
			lockPathAbs: join(root, 'agents.lock.json'),
			queuePathAbs: join(root, 'queue.json'),
			closedTasksPathAbs: join(root, 'closed.json'),
		};
	});

	afterEach(() => rmSync(root, { recursive: true, force: true }));

	it('assigns a name to the root orchestrator (depth 0, no parent)', async () => {
		const result = await runAgentNames(
			{ action: 'assign', task_id: 'root', agent_slot: 'orchestrator' },
			options
		);
		const assignment = parse(result) as {
			agent_name: string;
			depth: number;
			agent_slot: string;
		};
		expect(assignment.depth).toBe(0);
		expect(assignment.agent_slot).toBe('orchestrator');
		expect(assignment.agent_name.length).toBeGreaterThan(0);
	});

	it('assigns a distinct name to a child subagent and lists both', async () => {
		await runAgentNames(
			{ action: 'assign', task_id: 'root', agent_slot: 'orchestrator' },
			options
		);
		await runAgentNames(
			{
				action: 'assign',
				task_id: 'child',
				agent_slot: 'implementation_runner',
				parent_task_id: 'root',
			},
			options
		);
		const list = parse(
			await runAgentNames({ action: 'list' }, options)
		) as { summary: { active: number } };
		expect(list.summary.active).toBe(2);
	});

	it('honours a custom name pool from options', async () => {
		const result = await runAgentNames(
			{ action: 'assign', task_id: 'root', agent_slot: 'orchestrator' },
			{ ...options, pool: ['solo'] }
		);
		expect((parse(result) as { agent_name: string }).agent_name).toBe('solo');
	});
});
