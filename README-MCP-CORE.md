# @cartago-git/mcp-core

A **project-agnostic core for building MCP servers**, plus a CLI that loads
**plugins** on demand. The core ships only generic utilities; everything
domain-specific (proposals, swarms, your own tools…) lives in plugins.

Two ideas:

1. **Drop it into any project** and it can analyze the repo, tell you what an
   optimal MCP server would need, and generate it — without you spelling it out
   (the *hybrid bootstrap*: the server recommends and generates content, the
   agent writes the files).
2. **Compose capability with plugins**: register `mcp-core` once in your editor
   and turn features on with `--plugins=...`. The core knows how to create new
   plugins too (see [PLUGINS-MCP-CORE.md](./PLUGINS-MCP-CORE.md)).

It is designed to work the same under **any agent or model** (Claude, GPT,
local…): MCP is model-agnostic, tools use strict zod schemas and return
structured JSON, and every operation is deterministic and idempotent.

---

## Install / register

Register the core once in your MCP client (VS Code, Cursor, Claude…):

```jsonc
// .vscode/mcp.json
{
	"servers": {
		"mcp-core": {
			"command": "bunx",
			"args": ["@cartago-git/mcp-core", "--plugins=proposals"]
		}
	}
}
```

No plugins? Drop `--plugins`. The core still gives you the bootstrap and
scaffolding tools.

## CLI arguments

| Argument | Default | Purpose |
|---|---|---|
| `--plugins=a,b,c` | _(none)_ | Plugins to load. Resolved as `@cartago-git/mcp-<name>`, then `mcp-<name>`, then the bare name; a `./path` or `@scope/pkg` is used verbatim. A bad plugin is reported on stderr and skipped — the rest still load. |
| `--cacheDir=DIR` | `.cache/mcp-core` | Scratch/state root. Each plugin gets `<cacheDir>/<plugin>`. |
| `--docsDir=DIR` | `docs/mcp-core` | Human-edited document root (e.g. proposals). |
| `--workspace=DIR` | current dir | Workspace root all paths resolve against. |
| `--name=NAME` | `mcp-core` | Server name advertised over MCP. |
| `--prefix=NS` | `mcpcore` | Namespace for the core's own tools (`<NS>_analyze_project`, …). |
| `--config=FILE` | `mcp-core.config.json` | Config file with per-plugin values (see below). |
| `--<anything>=value` | — | Forwarded to every plugin via `ctx.args`. |

## Passing values to plugins — `mcp-core.config.json`

For anything beyond the global roots, put a config file at the workspace root
(or point at one with `--config`). Each plugin gets a typed `options` object
(any JSON — nested objects, arrays…) and an optional tool-namespace `prefix`:

```jsonc
{
	"cacheDir": ".cache/mcp-core",
	"docsDir": "docs/mcp-core",
	"plugins": {
		"proposals": { "prefix": "work", "options": { "docsDir": "docs/x" } }
	}
}
```

Precedence for the shared roots is **explicit CLI flag > config file > default**.
A plugin reads its entry as `ctx.options` (and its namespace as
`ctx.namespacePrefix`). A missing or malformed file contributes nothing — it
never crashes the server.

## Built-in tools (always available)

- **`<prefix>_analyze_project`** — read-only. Inspects the project and returns a
  structured analysis **plus a recommended server plan** (project type, tools,
  plugins, validation commands, and a ready-to-paste `mcp.json`). Run it first.
- **`<prefix>_create_server`** — turns a plan into the files for a
  project-specific server (or a new plugin). Returns the files **for the agent
  to write**; it never touches disk.
- **`<prefix>_scaffold`** — generates a single tool / prompt / skill / agent /
  host project / **plugin** from templates. Dry-run by default; never
  overwrites.

### The bootstrap flow

```
analyze_project   →   review/edit the plan   →   create_server   →   you write the files   →   register in mcp.json
```

## Programmatic use

```ts
import { createMcpServer, createWorkspacePathProvider } from '@cartago-git/mcp-core/public';

const assembled = await createMcpServer({
	metadata: { name: 'mcp-server-acme', version: '0.1.0' },
	namespacePrefix: 'acme',
	workspace: createWorkspacePathProvider(process.cwd()),
	extraTools: [/* your IToolRegistration[] */],
});
await assembled.start(); // stdio
```

## Packages in this repo

- `packages/core` → **`@cartago-git/mcp-core`** (this package).
- `plugins/proposals` → **`@cartago-git/mcp-proposals`** (proposal store +
  agent locks + task queue; the multi-agent "swarm" coordination layer).

## Design principles (model/agent-agnostic, low-token)

- Strict **zod** input schemas; **structured JSON** outputs (no prose to
  re-interpret per model).
- **Deterministic** tool registration order; **idempotent** operations.
- The core never imports a host package and never calls `process.cwd()` outside
  the CLI entry — plugins receive everything resolved in their context.
- Knowledge is loaded **per plugin**, so an agent only pays for what it uses.

## License

MIT © Cartago
