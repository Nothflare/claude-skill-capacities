#!/usr/bin/env node
/**
 * Capacities MCP Server - Standalone
 * Integrates with Capacities PKM via REST API and x-callback-urls
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createServer } from "http";
import { exec } from "child_process";

// Configuration - set these or use environment variables
const API_BASE = "https://api.capacities.io";
const API_TOKEN = process.env.CAPACITIES_API_TOKEN || "";
const SPACE_ID = process.env.CAPACITIES_SPACE_ID || "";

// ============================================================================
// Capacities REST API Client
// ============================================================================

class CapacitiesAPI {
  constructor(token = API_TOKEN) {
    this.token = token;
    if (!this.token) {
      throw new Error(
        "API token required. Set CAPACITIES_API_TOKEN environment variable."
      );
    }
  }

  async _request(method, endpoint, body = null, params = null) {
    let url = `${API_BASE}${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }

    const options = {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`API Error ${response.status}: ${text}`);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : {};
  }

  async getSpaces() {
    return this._request("GET", "/spaces");
  }

  async getSpaceInfo(spaceId) {
    return this._request("GET", "/space-info", null, { spaceid: spaceId });
  }

  async search(searchTerm, spaceIds, mode = "title", filterStructureIds = null) {
    const data = {
      searchTerm,
      spaceIds,
      mode,
    };
    if (filterStructureIds) {
      data.filterStructureIds = filterStructureIds;
    }
    return this._request("POST", "/search", data);
  }

  async saveWeblink(spaceId, url, options = {}) {
    const data = { spaceId, url };
    if (options.title) data.titleOverwrite = options.title;
    if (options.description) data.descriptionOverwrite = options.description;
    if (options.tags) data.tags = options.tags;
    if (options.mdText) data.mdText = options.mdText;
    return this._request("POST", "/save-weblink", data);
  }

  async saveToDailyNote(spaceId, mdText, noTimestamp = false) {
    return this._request("POST", "/save-to-daily-note", {
      spaceId,
      mdText,
      noTimeStamp: noTimestamp,
    });
  }
}

// ============================================================================
// X-Callback-URL Handler (for Capacities desktop app)
// ============================================================================

const XCALLBACK_BASE = "capacities://x-callback-url";

function buildXCallbackUrl(action, params) {
  // Filter out null/undefined values
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([_, v]) => v != null)
  );
  const query = new URLSearchParams(filtered).toString();
  return query ? `${XCALLBACK_BASE}/${action}?${query}` : `${XCALLBACK_BASE}/${action}`;
}

function openUrl(url) {
  return new Promise((resolve, reject) => {
    let cmd;
    if (process.platform === "win32") {
      // Windows: use start command, escape shell metacharacters
      // & ^ % need escaping in cmd.exe
      const escaped = url.replace(/[&^%]/g, "^$&");
      cmd = `start "" "${escaped}"`;
    } else if (process.platform === "darwin") {
      cmd = `open "${url}"`;
    } else {
      cmd = `xdg-open "${url}"`;
    }

    exec(cmd, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function callWithResponse(action, params, timeout = 10000) {
  return new Promise((resolve, reject) => {
    let result = null;
    let server = null;
    let timeoutId = null;
    let resolved = false;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (server) server.close();
    };

    // Create local HTTP server to receive callback
    server = createServer((req, res) => {
      // Parse query params using URL API
      const url = new URL(req.url, "http://localhost");
      result = Object.fromEntries(url.searchParams);

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<html><body><script>window.close()</script>OK</body></html>");

      // Resolve immediately on response
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve(result);
      }
    });

    server.listen(0, "127.0.0.1", async () => {
      const port = server.address().port;
      const callbackUrl = `http://127.0.0.1:${port}/callback`;

      // Add callback URLs to params
      params["x-success"] = callbackUrl;
      params["x-error"] = callbackUrl;

      const url = buildXCallbackUrl(action, params);

      try {
        await openUrl(url);
      } catch (err) {
        cleanup();
        reject(err);
        return;
      }

      // Timeout handling
      timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(result || {});
        }
      }, timeout);
    });

    server.on("error", (err) => {
      cleanup();
      reject(err);
    });
  });
}

function createObject(options = {}) {
  const params = {
    title: options.title,
    content: options.content,
    type: options.objectType,
    spaceId: options.spaceId,
  };
  const url = buildXCallbackUrl("createNewObject", params);
  return openUrl(url);
}

async function getCurrentObject() {
  return callWithResponse("getCurrentObject", {});
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatSpaceInfo(result) {
  const structures = result.structures || [];
  let output = "STRUCTURES (Object Types):\n\n";

  for (const s of structures) {
    const props = (s.propertyDefinitions || [])
      .map((p) => p.name || p.id)
      .filter(Boolean);
    const propsStr = props.length ? props.join(", ") : "none";

    const colls = (s.collections || []).map((c) => c.title).filter(Boolean);
    const collsStr = colls.length ? colls.join(", ") : "none";

    output += `${s.title} (id: ${s.id})\n`;
    output += `  Properties: ${propsStr}\n`;
    output += `  Collections: ${collsStr}\n\n`;
  }

  return output;
}

// ============================================================================
// MCP Server Setup
// ============================================================================

const server = new Server(
  { name: "capacities", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "spaces",
      description: "List all Capacities spaces the user has access to",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "space_info",
      description:
        "List all object types (structures) in a space with their properties. Run this FIRST to understand what types exist before creating objects.",
      inputSchema: {
        type: "object",
        properties: {
          space_id: {
            type: "string",
            description: "Space UUID (uses default if not provided)",
          },
        },
      },
    },
    {
      name: "search",
      description:
        "Search for content in Capacities. Use BEFORE creating objects to avoid duplicates.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          mode: {
            type: "string",
            enum: ["title", "fullText"],
            default: "title",
            description: "title = faster, fullText = searches content too",
          },
          space_id: {
            type: "string",
            description: "Space UUID (uses default if not provided)",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "daily_note",
      description:
        "Append to today's daily note. Use for quick capture: insights, reminders, 'save this', 'remember this'.",
      inputSchema: {
        type: "object",
        properties: {
          content: { type: "string", description: "Markdown content to append" },
          no_timestamp: {
            type: "boolean",
            default: false,
            description: "If true, don't add timestamp to the entry",
          },
          space_id: {
            type: "string",
            description: "Space UUID (uses default if not provided)",
          },
        },
        required: ["content"],
      },
    },
    {
      name: "weblink",
      description:
        "Save a URL to Capacities. Use when user shares a link they want to save.",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL to save" },
          title: { type: "string", description: "Override the auto-fetched title" },
          description: { type: "string", description: "Override the auto-fetched description" },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "Tags to apply to the weblink",
          },
          notes: { type: "string", description: "Markdown notes to attach" },
          space_id: {
            type: "string",
            description: "Space UUID (uses default if not provided)",
          },
        },
        required: ["url"],
      },
    },
    {
      name: "create",
      description:
        "Create a new object (opens desktop app). Use for structured content with a specific type. Requires Capacities desktop app.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Object title" },
          content: { type: "string", description: "Markdown content" },
          type: {
            type: "string",
            description: "Object type from space_info (e.g., Note, Book, Task)",
          },
          space_id: {
            type: "string",
            description: "Space UUID (uses default if not provided)",
          },
        },
      },
    },
    {
      name: "current",
      description:
        "Get the currently open object in Capacities desktop app. Returns title, URL, and content. Requires desktop app.",
      inputSchema: {
        type: "object",
        properties: {
          space_id: {
            type: "string",
            description: "Space UUID (needed for content search, uses default if not provided)",
          },
        },
      },
    },
  ],
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const spaceId = args?.space_id || SPACE_ID;

    // Tools that only use x-callback-url (no API needed)
    if (name === "create") {
      await createObject({
        title: args?.title,
        content: args?.content,
        objectType: args?.type,
        spaceId: spaceId || undefined,
      });
      return {
        content: [
          {
            type: "text",
            text: `Creating object in Capacities app${args?.title ? `: "${args.title}"` : ""}`,
          },
        ],
      };
    }

    if (name === "current") {
      const obj = await getCurrentObject();
      if (!obj || Object.keys(obj).length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No response received (timeout or no object open in Capacities)",
            },
          ],
        };
      }

      const title = obj.title || obj.name || "";
      const url = obj.url || "";
      let output = `Title: ${title}\nURL: ${url}`;

      // Try to get content via search (needs API token and space ID)
      if (title && spaceId && API_TOKEN) {
        try {
          const api = new CapacitiesAPI();
          const searchResult = await api.search(title, [spaceId], "fullText");
          const results = searchResult.results || [];
          const match = results.find((r) => r.title === title);
          if (match) {
            output += `\n\n--- Content (via search) ---\n`;
            output += `Type: ${match.structureId || "Unknown"}\n`;
            for (const h of match.highlights || []) {
              for (const snippet of h.snippets || []) {
                const clean = snippet.replace(/<\/?b>/g, "");
                output += `  ${clean}\n`;
              }
            }
          }
        } catch (e) {
          // Search failed (e.g., no API token), return basic info only
        }
      }

      return { content: [{ type: "text", text: output }] };
    }

    // API-based tools require token
    const api = new CapacitiesAPI();

    // Check space ID for tools that need it
    if (!spaceId && name !== "spaces") {
      throw new Error(
        "Space ID required. Set CAPACITIES_SPACE_ID environment variable or provide space_id parameter."
      );
    }

    let result;

    switch (name) {
      case "spaces": {
        result = await api.getSpaces();
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "space_info": {
        const info = await api.getSpaceInfo(spaceId);
        result = formatSpaceInfo(info);
        return { content: [{ type: "text", text: result }] };
      }

      case "search": {
        result = await api.search(args.query, [spaceId], args.mode || "title");
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "daily_note": {
        await api.saveToDailyNote(spaceId, args.content, args.no_timestamp || false);
        return {
          content: [{ type: "text", text: "Saved to daily note successfully" }],
        };
      }

      case "weblink": {
        result = await api.saveWeblink(spaceId, args.url, {
          title: args.title,
          description: args.description,
          tags: args.tags,
          mdText: args.notes,
        });
        return {
          content: [
            {
              type: "text",
              text: `Weblink saved successfully\n${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
