#!/usr/bin/env python3
"""
Capacities PKM Integration for Claude Code
Supports both REST API and x-callback-urls
"""

import argparse
import json
import os
import subprocess
import sys
import urllib.parse
import requests
from typing import Optional


API_BASE = "https://api.capacities.io"
API_TOKEN = ""  # Set your token here
SPACE_ID = ""  # Set your default space ID here


class CapacitiesAPI:
    """REST API client for Capacities"""

    def __init__(self, token: Optional[str] = None):
        self.token = token or API_TOKEN or os.environ.get("CAPACITIES_API_TOKEN")
        if not self.token:
            raise ValueError(
                "API token required. Set CAPACITIES_API_TOKEN environment variable "
                "or pass token to constructor."
            )
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }

    def _get(self, endpoint: str, params: Optional[dict] = None) -> dict:
        """Make GET request to API"""
        url = f"{API_BASE}{endpoint}"
        response = requests.get(url, headers=self.headers, params=params)
        response.raise_for_status()
        return response.json()

    def _post(self, endpoint: str, data: dict) -> dict:
        """Make POST request to API"""
        url = f"{API_BASE}{endpoint}"
        response = requests.post(url, headers=self.headers, json=data)
        response.raise_for_status()
        return response.json() if response.text else {}

    def get_spaces(self) -> dict:
        """Get all user spaces"""
        return self._get("/spaces")

    def get_space_info(self, space_id: str) -> dict:
        """Get structures and collections for a space"""
        return self._get("/space-info", params={"spaceid": space_id})

    def search(
        self,
        search_term: str,
        space_ids: list[str],
        mode: str = "title",
        filter_structure_ids: Optional[list[str]] = None
    ) -> dict:
        """Search for content across spaces"""
        data = {
            "searchTerm": search_term,
            "spaceIds": space_ids,
            "mode": mode
        }
        if filter_structure_ids:
            data["filterStructureIds"] = filter_structure_ids
        return self._post("/search", data)

    def save_weblink(
        self,
        space_id: str,
        url: str,
        title: Optional[str] = None,
        description: Optional[str] = None,
        tags: Optional[list[str]] = None,
        md_text: Optional[str] = None
    ) -> dict:
        """Save a weblink to a space"""
        data = {"spaceId": space_id, "url": url}
        if title:
            data["titleOverwrite"] = title
        if description:
            data["descriptionOverwrite"] = description
        if tags:
            data["tags"] = tags
        if md_text:
            data["mdText"] = md_text
        return self._post("/save-weblink", data)

    def save_to_daily_note(
        self,
        space_id: str,
        md_text: str,
        no_timestamp: bool = False
    ) -> dict:
        """Save text to today's daily note"""
        data = {
            "spaceId": space_id,
            "mdText": md_text,
            "noTimeStamp": no_timestamp
        }
        return self._post("/save-to-daily-note", data)


class XCallbackURL:
    """X-Callback-URL handler for Capacities desktop app"""

    BASE = "capacities://x-callback-url"

    @staticmethod
    def _build_url(action: str, params: dict) -> str:
        """Build x-callback-url with encoded parameters"""
        # Filter out None values
        params = {k: v for k, v in params.items() if v is not None}
        query = urllib.parse.urlencode(params)
        return f"{XCallbackURL.BASE}/{action}?{query}" if query else f"{XCallbackURL.BASE}/{action}"

    @staticmethod
    def _open_url(url: str) -> None:
        """Open URL using system default handler"""
        if sys.platform == "win32":
            os.startfile(url)
        elif sys.platform == "darwin":
            subprocess.run(["open", url], check=True)
        else:
            subprocess.run(["xdg-open", url], check=True)

    @classmethod
    def _call_with_response(cls, action: str, params: dict, timeout: int = 10) -> dict:
        """Call x-callback-url and wait for response via local HTTP server"""
        import http.server

        result = {"response": None, "error": None}

        class CallbackHandler(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                # Parse the callback response
                parsed = urllib.parse.urlparse(self.path)
                query_params = urllib.parse.parse_qs(parsed.query)
                # Flatten single-value lists
                result["response"] = {k: v[0] if len(v) == 1 else v for k, v in query_params.items()}
                self.send_response(200)
                self.send_header("Content-type", "text/html")
                self.end_headers()
                # Auto-close the browser tab
                self.wfile.write(b"<html><body><script>window.close()</script>OK</body></html>")

            def log_message(self, format, *args):
                pass  # Suppress logging

        # Start local server
        server = http.server.HTTPServer(("127.0.0.1", 0), CallbackHandler)
        port = server.server_address[1]
        callback_url = f"http://127.0.0.1:{port}/callback"

        # Add callback URLs to params
        params["x-success"] = callback_url
        params["x-error"] = callback_url

        # Build and open URL
        url = cls._build_url(action, params)
        cls._open_url(url)

        # Wait for callback with timeout
        server.timeout = timeout
        server.handle_request()
        server.server_close()

        return result["response"] or {}

    @classmethod
    def create_object(
        cls,
        title: Optional[str] = None,
        content: Optional[str] = None,
        object_type: Optional[str] = None,
        space_id: Optional[str] = None
    ) -> None:
        """Create a new object in Capacities (opens app)"""
        params = {
            "title": title,
            "content": content,
            "type": object_type,
            "spaceId": space_id
        }
        url = cls._build_url("createNewObject", params)
        cls._open_url(url)

    @classmethod
    def append_to_daily_note(
        cls,
        content: str,
        space_id: Optional[str] = None
    ) -> None:
        """Append content to today's daily note (opens app)"""
        params = {
            "content": content,
            "spaceId": space_id
        }
        url = cls._build_url("appendToDailyNote", params)
        cls._open_url(url)

    @classmethod
    def get_current_object(cls) -> dict:
        """Get info about currently open object (opens app, waits for response)"""
        response = cls._call_with_response("getCurrentObject", {})
        return response


def main():
    parser = argparse.ArgumentParser(
        description="Capacities PKM Integration CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # spaces command
    subparsers.add_parser("spaces", help="List all spaces")

    # space-info command
    space_info_parser = subparsers.add_parser("space-info", help="Get space structures")
    space_info_parser.add_argument("--space-id", default=SPACE_ID, help="Space UUID (uses default if not set)")

    # search command
    search_parser = subparsers.add_parser("search", help="Search content")
    search_parser.add_argument("query", help="Search term")
    search_parser.add_argument("--space-id", default=SPACE_ID, help="Space UUID (uses default if not set)")
    search_parser.add_argument("--mode", choices=["title", "fullText"], default="title")

    # daily-note command (API)
    daily_parser = subparsers.add_parser("daily-note", help="Save to daily note (API)")
    daily_parser.add_argument("content", nargs="?", default="-", help="Markdown content (use - or omit for stdin)")
    daily_parser.add_argument("--space-id", default=SPACE_ID, help="Space UUID (uses default if not set)")
    daily_parser.add_argument("--no-timestamp", action="store_true")

    # weblink command
    weblink_parser = subparsers.add_parser("weblink", help="Save a weblink")
    weblink_parser.add_argument("url", help="URL to save")
    weblink_parser.add_argument("--space-id", default=SPACE_ID, help="Space UUID (uses default if not set)")
    weblink_parser.add_argument("--title", help="Override title")
    weblink_parser.add_argument("--description", help="Override description")
    weblink_parser.add_argument("--tags", help="Comma-separated tags")
    weblink_parser.add_argument("--notes", help="Markdown notes")

    # create command (x-callback)
    create_parser = subparsers.add_parser("create", help="Create object (opens app)")
    create_parser.add_argument("--title", help="Object title")
    create_parser.add_argument("--content", default=None, help="Markdown content (use - for stdin)")
    create_parser.add_argument("--type", dest="object_type", help="Object type name")
    create_parser.add_argument("--space-id", default=SPACE_ID, help="Space UUID (uses default if not set)")

    # current command (x-callback)
    current_parser = subparsers.add_parser("current", help="Get current object (opens app)")
    current_parser.add_argument("--space-id", default=SPACE_ID, help="Space UUID (for content search)")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    try:
        if args.command == "spaces":
            api = CapacitiesAPI()
            result = api.get_spaces()
            print(json.dumps(result, indent=2))

        elif args.command == "space-info":
            api = CapacitiesAPI()
            result = api.get_space_info(args.space_id)
            structures = result.get("structures", [])

            # Compact format with all info
            print("STRUCTURES (Object Types):\n")
            for s in structures:
                # Get property names (skip empty names, show non-empty ones)
                props = [p.get("name") or p.get("id") for p in s.get("propertyDefinitions", [])]
                props_str = ", ".join(props) if props else "none"

                # Get collection names
                colls = [c.get("title") for c in s.get("collections", [])]
                colls_str = ", ".join(colls) if colls else "none"

                print(f"{s['title']} (id: {s['id']})")
                print(f"  Properties: {props_str}")
                print(f"  Collections: {colls_str}")
                print()

        elif args.command == "search":
            api = CapacitiesAPI()
            result = api.search(args.query, [args.space_id], mode=args.mode)
            print(json.dumps(result, indent=2))

        elif args.command == "daily-note":
            content = sys.stdin.read() if args.content == "-" else args.content
            api = CapacitiesAPI()
            result = api.save_to_daily_note(
                args.space_id,
                content,
                no_timestamp=args.no_timestamp
            )
            print("Saved to daily note successfully")
            if result:
                print(json.dumps(result, indent=2))

        elif args.command == "weblink":
            api = CapacitiesAPI()
            tags = [t.strip() for t in args.tags.split(",")] if args.tags else None
            result = api.save_weblink(
                args.space_id,
                args.url,
                title=args.title,
                description=args.description,
                tags=tags,
                md_text=args.notes
            )
            print("Weblink saved successfully")
            print(json.dumps(result, indent=2))

        elif args.command == "create":
            content = sys.stdin.read() if args.content == "-" else args.content
            XCallbackURL.create_object(
                title=args.title,
                content=content,
                object_type=args.object_type,
                space_id=args.space_id
            )

        elif args.command == "current":
            result = XCallbackURL.get_current_object()
            if result:
                title = result.get('title', result.get('name', ''))
                url = result.get('url', '')
                print(f"Title: {title}")
                print(f"URL: {url}")

                # Auto-search for content if we have a title
                if title:
                    print(f"\n--- Content (via search) ---\n")
                    api = CapacitiesAPI()
                    search_result = api.search(title, [args.space_id], mode="fullText")
                    results = search_result.get("results", [])
                    if results:
                        for r in results:
                            if r.get("title") == title:
                                print(f"Type: {r.get('structureId', 'Unknown')}")
                                for h in r.get("highlights", []):
                                    for snippet in h.get("snippets", []):
                                        # Clean up HTML bold tags
                                        clean = snippet.replace("<b>", "").replace("</b>", "")
                                        print(f"  {clean}")
                                break
                    else:
                        print("(No content found)")
            else:
                print("No response received (timeout or no object open)")

    except requests.exceptions.HTTPError as e:
        print(f"API Error: {e}", file=sys.stderr)
        sys.exit(1)
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
