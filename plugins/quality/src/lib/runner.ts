import { execSync } from 'node:child_process';

export interface ICommandResult {
	readonly command: string;
	readonly ok: boolean;
	readonly code: number;
	/** Last lines of combined output (kept short for low tokens). */
	readonly tail: string;
}

export interface IScopeResult {
	readonly scope: string;
	readonly ok: boolean;
	readonly results: readonly ICommandResult[];
}

/** Runs a shell command in `cwd`, never throws. Injectable for tests. */
export type ICommandRunner = (
	command: string,
	cwd: string
) => { code: number; output: string };

export const createCommandRunner =
	(timeoutMs = 600_000): ICommandRunner =>
	(command, cwd) => {
		try {
			const output = execSync(command, {
				cwd,
				encoding: 'utf8',
				stdio: ['ignore', 'pipe', 'pipe'],
				timeout: timeoutMs,
			});
			return { code: 0, output };
		} catch (error) {
			const err = error as {
				status?: number;
				stdout?: string;
				stderr?: string;
			};
			return {
				code: err.status ?? 1,
				output: `${err.stdout ?? ''}${err.stderr ?? ''}`,
			};
		}
	};

const tailOf = (text: string, lines = 20): string =>
	text.split('\n').filter((l) => l.length > 0).slice(-lines).join('\n');

export interface IScopeCommand {
	readonly command: string;
	readonly expect?: string;
}

/** Run every command of a scope; ok only if all succeed. */
export const runScope = (
	scope: string,
	commands: readonly IScopeCommand[],
	cwd: string,
	run: ICommandRunner
): IScopeResult => {
	const results: ICommandResult[] = commands.map((entry) => {
		const r = run(entry.command, cwd);
		return {
			command: entry.command,
			ok: r.code === 0,
			code: r.code,
			tail: tailOf(r.output),
		};
	});
	return { scope, ok: results.every((r) => r.ok), results };
};
