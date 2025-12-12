# Claude Onboarding

This is a Capacities PKM integration for Claude. It lets Claude interact with the user's Capacities knowledge base.

## Project Structure

```
.claude/skills/capacities/
├── SKILL.md         # Instructions for Claude Code (YOU read this when skill activates)
└── capacities.py    # Python CLI that calls Capacities API

mcp/
├── index.js         # MCP server for Claude Desktop app
└── package.json

docs/
├── api-1.json       # Capacities API spec
└── x-callback-urls.md  # x-callback-url docs
```

## How It Works

**Two integration paths:**

1. **Claude Code** — Uses the skill in `.claude/skills/capacities/`. When activated, read `SKILL.md` for instructions.

2. **Claude Desktop** — Uses standalone MCP server in `mcp/`. No Python dependency required.

## Key Files

- **mcp/index.js** — Standalone MCP server. Contains full API client and x-callback-url handling.
- **capacities.py** — Python CLI (alternative to MCP). Calls Capacities REST API + x-callback-urls.
- **SKILL.md** — Instructions for Claude on how/when to use each command. Keep this concise.

## Capacities Concepts

- **Space** — User's workspace (most have one)
- **Structure** — Object type schema (e.g., "Book", "Note", "Task")
- **Object** — User content, belongs to a structure
- **Property** — Field in a structure (e.g., "Author", "Rating")

## Commands

| Command | API/Local | What it does |
|---------|-----------|--------------|
| `space-info` | API | List all structures with properties |
| `search` | API | Find objects by title/content |
| `daily-note` | API | Append to today's daily note |
| `weblink` | API | Save a URL |
| `create` | Local | Create object (opens Capacities app) |
| `current` | Local | Get current object + content |

**Local commands** require Capacities desktop app installed.

## Configuration

**MCP Server** — Set environment variables:
```
CAPACITIES_API_TOKEN=your_token
CAPACITIES_SPACE_ID=your_space_id
```

**Python CLI** — In `capacities.py`, lines 23-25:
```python
API_TOKEN = ""   # User's API token
SPACE_ID = ""    # User's space ID
```

## When Editing

- **SKILL.md** — Keep concise. It's for Claude, not humans. Explain *when* to use commands.
- **mcp/index.js** — Standalone. Has own API client. Update tool schemas and handlers here.
- **capacities.py** — Python CLI alternative. Use stdin for long content (heredoc).
- **README.md** — Human docs. Update if adding features.
