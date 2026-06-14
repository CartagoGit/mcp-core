/**
 * Resolve a workspace-relative path to an absolute path, even when the
 * caller is running from a sub-package directory. Walks up from the
 * current working directory until it finds a `package.json` whose
 * `workspaces` field is set, or a `.git` directory; otherwise falls
 * back to the cwd.
 *
 * Extracted from the original inline helper in
 * `affairs-agent-lock.tool.ts` so the new tool and the CLI script can
 * share the same logic.
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';

const isWorkspaceRoot = (dir: string): boolean => {
	const pkgPath = join(dir, 'package.json');
	if (existsSync(pkgPath)) {
		try {
			const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
				workspaces?: unknown;
			};
			if (Array.isArray(pkg.workspaces)) return true;
		} catch {
			// ignore
		}
	}
	if (existsSync(join(dir, '.git'))) return true;
	return false;
};

export const resolveWorkspacePath = (relativePath: string): string => {
	let dir = process.cwd();
	const root = parse(dir).root;
	while (dir !== root) {
		if (isWorkspaceRoot(dir)) return join(dir, relativePath);
		dir = dirname(dir);
	}
	void statSync;
	return join(process.cwd(), relativePath);
};
