# stevenlyd-tools plugins

One marketplace for the agent workflow tools in [stevenlyd-tools](https://github.com/stevenlyd-tools):

| Plugin | What it does | Pinned release |
| --- | --- | --- |
| [Duet](https://github.com/stevenlyd-tools/duet) | A workflow for two roles working through coding agents: one prototypes ideas, the other engineers the chosen ones for production | see [`catalog.json`](catalog.json) |
| [Suo](https://github.com/stevenlyd-tools/suo) | Product definitions as versioned Units: one decision at a time, into form | see [`catalog.json`](catalog.json) |

Each plugin is independent; install either or both. Duet recommends Suo but does not require it.

## Install

| Host | Add the marketplace | Install | Update |
| --- | --- | --- | --- |
| Claude Code | `claude plugin marketplace add stevenlyd-tools/plugins` | `claude plugin install duet@stevenlyd-tools` | `claude plugin marketplace update stevenlyd-tools`, then `claude plugin update duet@stevenlyd-tools` |
| Codex | `codex plugin marketplace add stevenlyd-tools/plugins` | `codex plugin add duet@stevenlyd-tools` | `codex plugin marketplace upgrade stevenlyd-tools` |
| GitHub Copilot CLI | `copilot plugin marketplace add stevenlyd-tools/plugins` | `copilot plugin install duet@stevenlyd-tools` | `copilot plugin update duet` |

Use `suo` in place of `duet` for Suo. Start a new agent session after installing or updating. Copilot CLI reads the same `.claude-plugin/marketplace.json` as Claude Code but has not been verified against this catalog yet.

Gemini CLI, Pi and Hermes install from each plugin's own repository; see that plugin's README.

## How releases reach users

[`catalog.json`](catalog.json) is the only file to edit. It pins every plugin to a release tag of its repository; `npm run write` generates the Claude Code/Copilot manifest (`.claude-plugin/marketplace.json`) and the Codex manifest (`.agents/plugins/marketplace.json`) from it.

A plugin release is offered to users when its tag here moves, in a reviewed pull request. CI checks that the manifests match the catalog and that each pinned tag exists and carries the plugin at that version. Pinning lets a plugin and a project's own runtime pin move together: Suo, for example, stays on the version that projects install as their Suo runtime until they move.

```sh
npm run check    # manifests match the catalog; unit tests
npm run verify   # also checks every pinned tag on GitHub
```

## License

[MIT](LICENSE)
