# opencode-ambient

**Your room glows with your agents** — Hue + Govee pulse as opencode plans, builds, fixes, ships. Now with **Cursor + Meta** provider colors so you see which model is driving.

```
idle        🟢 green calm
planning    🔵 blue thinking
building    🟠 orange writing code
tool        🔵 cyan tool calls
fixing      🟠 orange repair
waiting     🟣 purple needs input
cursor      🟡 yellow amber — Cursor (claude-opus, composer)
meta        🔵 deep blue — Meta AI (muse-spark)
done        ⚪ white flash complete
error       🔴 red error
```

> ~300 LOC unified — 1 function does both Hue (CIE xy) + Govee (LAN UDP) from ~180 bytes JSON.

## Why?

`claude-hue` showed green→red for Claude Code limits. Opencode has 4 agents running in parallel — you want to *feel* which phase you're in, not read logs.

From `claude-hue v2` lessons:
- OAuth-only (fixed 429 #31021 with 5m + jitter, Retry-After backoff)
- No HTTP server for extension (v1 had :7684), no file watcher, no `usage.log`
- Unified: this repo does **both Hue + Govee in one ~200 LOC driver** instead of 2 repos

## Install

```bash
npm i -g opencode-ambient
opencode-ambient setup     # Hue bridge + pick light + Govee scan (3 Qs)
opencode-ambient start     # tiny HTTP :7686 POST /glow {state}
opencode-ambient demo      # cycle all colors
```

Add to `opencode.json`:

```json
{
  "plugin": ["opencode-ambient/plugin"]
}
```

That's it. No daemon polling — opencode pushes state, ambient glows. Falls back to `curl http://127.0.0.1:7686/glow` if you prefer zero-dep hooks:

```json
{
  "hooks": {
    "tool.execute.before": "curl -s http://127.0.0.1:7686/glow -d '{\"state\":\"tool\"}' -H 'Content-Type: application/json'",
    "tool.execute.after": "curl -s http://127.0.0.1:7686/glow -d '{\"state\":\"building\"}' -H 'Content-Type: application/json'"
  }
}
```

## How it works

```
opencode build agent -> plugin "tool.execute.before" -> fetch 127.0.0.1:7686/glow {building}
                                    \
                                     -> daemon glow() -> Hue: PUT /api/<user>/lights/<id>/state {xy,bri,tt}
                                                        Govee: UDP 4003 {cmd:"colorwc", data:{color:{r,g,b}}}
                          30s after last glow -> idle green
```

Core is `ambient/index.ts` glow():
- Hue: same as claude-hue v2 — undici Agent `rejectUnauthorized:false` for self-signed bridge, 8s timeout
- Govee: LAN API discovered via `239.255.255.250:4001` scan → `4002` response → `4003` unicast `colorwc` + `brightness` + `turn`. Fire-and-forget, no ack required

Driver: 80 lines. Plugin: 60 lines. CLI + daemon: 120 lines. Setup: 80 lines.

## Config

`~/.opencode-ambient/config.json`:

```json
{
  "hue": { "enabled": true, "ip": "10.0.0.10", "username": "...", "lightId": 1, "lightName": "Office" },
  "govee": { "enabled": true, "ip": "10.0.0.11", "device": "...", "sku": "H60B0" },
  "daemon": { "port": 7686, "transitionMs": 400, "idleReturnMs": 30000 }
}
```

Examples use `10.0.0.x` — replace with your LAN IPs. No `192.168.4/5/6.x` or secrets in repo.

## CLI

- `setup` — discover bridges + lights
- `start` — daemon on 127.0.0.1:7686 POST /glow
- `stop` — stop daemon
- `status` — pid + hue/govee + current state
- `glow <state>` — manual `idle|planning|building|tool|fixing|waiting|cursor|meta|done|error`
- `demo` — cycle all

## How real-time provider glow works

Your home setup: `meta/muse-spark-1.1` build primary + `cursor/*` for council critic/creative (opencode-autonomy). Ambient's plugin hooks:

- `chat.params` — opencode tells plugin `{model: "cursor/claude-opus-4-6", provider: "cursor"}` right before the LLM thinks. Ambient pushes `cursor` yellow instantly
- same for `meta/muse-spark-1.1` → `meta` deep blue

You see:
```
meta blue → orange building → cyan tool → yellow cursor (council kicking in) → orange fixing → white done → green idle
```

So you *feel* model routing live on your office lights without looking at logs.

## opencode-autonomy tie-in

Works with `vocino/opencode-autonomy` — 4 agents (build 300 meta, fixer 150 openrouter, explore 80 qwen, plan 100 + council cursor). When build agent writes files: orange. Tool uses: cyan. Waiting for permission: purple. Council (cursor) active: yellow flash. Meta primary: blue flash. Done: white flash → idle green.

## Versioning

Follows [Semantic Versioning 2.0.0](https://semver.org) — `MAJOR.MINOR.PATCH`

- **MAJOR** — breaking API
- **MINOR** — new feature, backwards-compatible
- **PATCH** — bugfix, backwards-compatible

`0.y.z` = initial dev, MINOR can be breaking-ish. Conventional commits: `fix:` → PATCH, `feat:` → MINOR, `feat!:` → MAJOR.

Tag `vX.Y.Z` = release, auto-published to npm when we add CI.

## License

MIT — Vocino
