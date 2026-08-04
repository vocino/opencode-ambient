# opencode-ambient

**See the light and know where your tokens and money are going.** Dark room, Hue + Govee shift as your agents work — provider shows as color, cost shows as life.

> One function does both Hue (CIE xy) + Govee (LAN UDP). No dashboard to check, just feel the room.

## The Room

You're coding in the dark. The lights do things as work happens:

- calm blue-green when idle
- bright when fresh
- dim when tank drains
- fast flicker when stuck fixing

No numbers, no dashboard. Glance at the room.

## Principles (the contract)

Full spec: [`docs/PRINCIPLES.md`](docs/PRINCIPLES.md) — this is the source of truth. If a feature doesn't fit these, we change the feature.

**1. Provider-indexed, not model-indexed.** Short list of 7 beats 40 models. Where you pay is what glows:

| provider | color | hex | when it glows |
|---|---|---|---|
| `meta` | deep blue | `#0064d1` | Meta AI, your 1M base |
| `cursor` | yellow | `#facc15` | Cursor proxy / council |
| `anthropic` | clay orange | `#d97757` | Claude direct |
| `openai` | teal | `#10a37f` | GPT direct |
| `openrouter` | violet | `#8b5cf6` | router spend |
| `google` | light blue | `#4285f4` | Gemini |
| `local` | slate | `#9ca3af` | ollama / local llm |

If Claude comes via OpenRouter → violet. Where money goes = what glows.

**2. Token tank = money.** One pressure value `0..1`:

- `0%` fresh, 100% bright, calm
- `40%` hint of amber, still fine
- `70%` amber warning, think about `/compact`
- `85%` orange hot, expensive zone
- `95%+` red drained, 35% dim — finish or reset

Brightness IS life. Warmth IS cost.

**3. Fix-loop = urgency, not color.** Same orange, faster + brighter:

- 2 fixes in 45s = +6% bright
- 3 fixes = 60% faster flicker
- 4+ = 80ms pulse, you feel stuck

**4. One light carries two signals.** Base = provider. Warm shift + dim = pressure. Yellow at 90% still feels yellow, just hotter and dimmer.

**5. Multi-light future-proof.** Your 3-light office? desk = provider, plays = pressure echo. Single-light stays compatible via `lightIds[]`.

## Install

```bash
npm i -g opencode-ambient
opencode-ambient setup     # Hue bridge + pick light + Govee scan
opencode-ambient start     # tiny daemon 127.0.0.1:7686 POST /glow {state}
opencode-ambient demo      # cycle all 15 states
```

Add to `opencode.json`:

```json
{
  "plugin": ["opencode-ambient/plugin"]
}
```

No daemon polling — opencode pushes, ambient glows.

## How it works

```
opencode 4 agents → chat.params (model/provider) → plugin glow(provider color)
                  → tool.execute.before → plugin glow(building|tool + pressure)
                  → daemon POST /glow {state, pressure, fixStreak}
                                 → hue: PUT /api/<user>/lights/<id>/state {xy,bri,tt}
                                   govee: UDP 4003 {color:{r,g,b}}
                  30s after last glow → idle green fade
```

Core files:

- `src/ambient/color.ts` — all palette + blending (provider base → pressure warm → fix urgency) — *single source of truth*
- `src/ambient/index.ts` — `glow()` fans to `lightIds[]` or `lightId`, calls Hue + Govee
- `src/plugin.ts` — provider detection + token estimate, no color logic
- `src/daemon/daemon.ts` — validates, forwards `pressure, fixStreak, brightness` to `glow()`

Adding a new provider = one hex in `color.ts`, no code change otherwise.

## Real-time provider glow

Home setup: `meta/muse-spark-1.1` build primary + `cursor/*` council (opencode-autonomy). You see:

```
meta blue → orange building → cyan tool → yellow cursor (council) → orange fixing → white done → green idle
```

Same for anthropic/openai/openrouter/google/local — each has its own glow.

Token pressure: plugin estimates from `chat.params` + `tool` + `message` chars (~3.5 chars per token). When opencode sends real usage via `message.updated`, we snap to it. Max context inferred: 1M if meta/spark, 200k if claude/cursor/anthropic, 128k default, 32k local.

Compaction or `session.created` = tank refills, room clears.

## Config

`~/.opencode-ambient/config.json`:

```json
{
  "hue": {
    "enabled": true,
    "ip": "10.0.0.10",
    "username": "...",
    "lightId": 1,
    "lightIds": [1, 2, 3],
    "lightName": "Office"
  },
  "govee": { "enabled": false },
  "daemon": { "port": 7686, "transitionMs": 400, "idleReturnMs": 30000 }
}
```

`lightIds` optional — if set, desk + plays all get same glow. Room group coming.

## CLI

- `setup` — discover Hue bridge + Govee
- `start` / `stop` / `status` — daemon
- `glow <state>` — manual `idle|planning|building|tool|fixing|waiting|done|error|cursor|meta|anthropic|openai|openrouter|google|local`
- `demo` — cycle all 15

## Ecosystem — opencode suite

Part of a small suite for opencode that actually ships:

- **opencode-autonomy** — zero-babysitting config, 5 models, 5 families, long tasks just ship — [vocino/opencode-autonomy](https://github.com/vocino/opencode-autonomy)
- **opencode-ambient** — you are here, see tokens and money in your room — [vocino/opencode-ambient](https://github.com/vocino/opencode-ambient) — `npm i -g opencode-ambient`

They work great together: autonomy drives, ambient glows. Install both:

```bash
opencode plugin opencode-autonomy --global
npm i -g opencode-ambient
opencode-ambient setup && opencode-ambient start
```

More coming in the same lane — one-binary, explicit, no bloat.

## Versioning

Strict [semver](https://semver.org) — `MAJOR.MINOR.PATCH`, `0.y.z` same rules. `fix:` → PATCH, `feat:` → MINOR, `feat!:` → MAJOR.

## License

MIT — Vocino
