"""Render a narrowly scoped Caddy JSON change; never load/restart a service here."""
import copy
import ipaddress
import json
import os
from pathlib import Path
import sys

VARIABLE = "{http.vars.vozen_client_ip}"
MARKER = "vozen_client_ip"


def prefix(ranges):
    return [
        {"handler": "vars", MARKER: "{http.request.remote.host}"},
        {"handler": "subroute", "routes": [{
            "match": [{"remote_ip": {"ranges": ranges},
                       "header": {"Cf-Connecting-Ip": ["*"]}}],
            "handle": [{"handler": "vars", MARKER:
                        "{http.request.header.CF-Connecting-IP}"}],
        }]},
    ]


def patch_proxies(node):
    count = 0
    if isinstance(node, dict):
        if node.get("handler") == "reverse_proxy":
            request = node.setdefault("headers", {}).setdefault("request", {})
            setters = request.setdefault("set", {})
            for header in ("X-Forwarded-For", "X-Real-Ip", "Cf-Connecting-Ip"):
                setters[header] = [VARIABLE]
            deleted = request.setdefault("delete", [])
            if "Forwarded" not in deleted:
                deleted.append("Forwarded")
            count += 1
        for value in node.values():
            count += patch_proxies(value)
    elif isinstance(node, list):
        for value in node:
            count += patch_proxies(value)
    return count


def render(config, ranges):
    if not ranges:
        raise ValueError("Use the complete, reviewed Cloudflare IPv4/IPv6 lists")
    for value in ranges:
        network = ipaddress.ip_network(value)
        if not network.network_address.is_global or network.prefixlen < (8 if network.version == 4 else 16):
            raise ValueError("Refusing private or excessively broad proxy trust")
    result = copy.deepcopy(config)
    patched = 0
    for server in result.get("apps", {}).get("http", {}).get("servers", {}).values():
        for route in server.get("routes", []):
            matchers = route.get("match", [])
            if not any("api.vozen.org" in match.get("host", []) for match in matchers):
                continue
            if not all(match.get("host") == ["api.vozen.org"] for match in matchers):
                raise ValueError("Refusing to change a route shared with other hosts")
            handlers = route.get("handle", [])
            count = patch_proxies(handlers)
            if not count:
                continue
            if handlers and handlers[0].get("handler") == "vars" and MARKER in handlers[0]:
                if len(handlers) < 2 or handlers[1].get("handler") != "subroute":
                    raise ValueError("Unexpected existing IP-normalization layout")
                handlers = handlers[2:]
            route["handle"] = prefix(list(ranges)) + handlers
            patched += count
    if not patched:
        raise ValueError("No API reverse proxies found; review the live configuration")
    return result


if __name__ == "__main__":
    if len(sys.argv) != 4:
        raise SystemExit("Usage: api_proxy.py LIVE.json CF-RANGES.json CANDIDATE.json")
    live, ranges, output = map(Path, sys.argv[1:])
    candidate = render(json.loads(live.read_text()), json.loads(ranges.read_text()))
    # Do not overwrite a live config or an existing candidate accidentally.
    fd = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as stream:
        json.dump(candidate, stream, indent=2)
        stream.write("\n")
