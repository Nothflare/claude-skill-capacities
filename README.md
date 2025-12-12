# Capacities Skill for Claude

A Claude skill that integrates with [Capacities](https://capacities.io), a graph-based personal knowledge management (PKM) app.

## What is this?

This skill allows Claude to interact with your Capacities workspace — searching your notes, saving insights to your daily note, bookmarking links, and creating new objects.

Works with:
- **Claude Code** — via the skill in `.claude/skills/capacities/`
- **Claude Desktop App** — via MCP server in `mcp/`

## Setup

### 1. Get your Capacities API token

1. Open Capacities
2. Go to Settings → API
3. Generate a new token

### 2. Configure the skill

Edit `.claude/skills/capacities/capacities.py` and set your credentials:

```python
API_TOKEN = "your-api-token-here"
SPACE_ID = "your-space-id-here"  # Run `spaces` command to find this
```

## Commands

| Command | Description |
|---------|-------------|
| `space-info` | List all object types (structures) in your space |
| `search "query"` | Search for content in your knowledge base |
| `daily-note` | Save text to today's daily note |
| `weblink "url"` | Save a URL to your space |
| `create` | Create a new object (local only, opens Capacities app) |
| `spaces` | List all your spaces |
| `current` | Get the currently open object (local only, opens Capacities app) |

### Examples

```bash
# See what object types exist in your space
python .claude/skills/capacities/capacities.py space-info

# Search for something
python .claude/skills/capacities/capacities.py search "project ideas"
python .claude/skills/capacities/capacities.py search "meeting" --mode fullText

# Save to daily note (use heredoc for long content)
python .claude/skills/capacities/capacities.py daily-note << 'EOF'
## Meeting Notes
- Discussed project timeline
- Action items: review docs, send update
EOF

# Save a link
python .claude/skills/capacities/capacities.py weblink "https://example.com" --tags "reference,docs"

# Create a new object
python .claude/skills/capacities/capacities.py create --title "New Project" --type "Project" --content - << 'EOF'
## Overview
Project description here...
EOF
```

## How Claude Uses This

When you mention Capacities, PKM, knowledge base, or daily notes, Claude will automatically use this skill to:

1. **Understand your space** — runs `space-info` to see what object types you have
2. **Search before creating** — checks if content already exists
3. **Save insights** — captures useful information from your conversation to your daily note
4. **Bookmark links** — saves URLs you discuss with relevant tags

## Capacities Concepts

- **Space** — Your workspace (most users have one)
- **Structure** — An object type like "Book", "Note", "Task", "Person"
- **Object** — Content you create, belongs to a structure type
- **Property** — Fields an object can have (e.g., Author, Rating, Due Date)
- **Collection** — A grouping of objects within a structure type

## Claude Desktop (MCP Server)

To use with Claude Desktop app, add the MCP server to your config:

### 1. Install dependencies

```bash
cd mcp && npm install
```

### 2. Add to Claude Desktop config

Edit `%APPDATA%\Claude\claude_desktop_config.json` (Windows) or `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac):

```json
{
  "mcpServers": {
    "capacities": {
      "command": "node",
      "args": ["<path-to>/claude-skill-capacities/mcp/index.js"],
      "env": {
        "CAPACITIES_API_TOKEN": "your_capacities_api_token",
        "CAPACITIES_SPACE_ID": "your_capacities_space_id"
      }
    }
  }
}
```

### 3. Restart Claude Desktop

The tools `space_info`, `search`, `daily_note`, `weblink`, `create`, and `current` will be available.

## File Structure

```
.claude/skills/capacities/
├── SKILL.md         # Instructions for Claude Code
└── capacities.py    # CLI tool

mcp/
├── index.js         # MCP server for Claude Desktop
└── package.json
```

## License

MIT
