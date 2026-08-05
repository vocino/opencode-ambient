# opencode-ambient

See where your tokens and money go — in your room.

## Problem

You run opencode with 5 models across 7 providers. You pay in 3 places but your room stays the same color. Dashboard numbers don't give you a feel for it.

## How to install

```bash
npm i -g opencode-ambient
opencode-ambient setup
```

Or one prompt:

```
Install the opencode-ambient plugin from https://github.com/vocino/opencode-ambient
```

Also works with `npx`:

```bash
npx opencode-ambient@latest setup
```

Then add to `opencode.json`:

```json
{ "plugin": ["opencode-ambient/plugin"] }
```

## How to use

```bash
opencode-ambient start      # daemon on :7686, idle -> green
opencode-ambient glow meta  # test your light
opencode-ambient demo       # cycles all 15 states
```

In opencode it just works:

```
meta blue -> building orange -> tool cyan -> cursor yellow -> done white -> idle green
```

Dim means tank draining. Fast flicker means stuck fixing.

## What it catches

Provider = color. Pressure = brightness. Fix streak = tempo.

- `meta` `#0064d1` deep blue — Meta AI base, 1M
- `cursor` `#facc15` yellow — Cursor proxy / council
- `anthropic` `#d97757` clay — Claude direct
- `openai` `#10a37f` teal — GPT direct
- `openrouter` `#8b5cf6` violet — router spend
- `google` `#4285f4` light blue — Gemini
- `local` `#9ca3af` slate — ollama / local

Tank 0% bright calm → 40% amber hint → 70% amber → 85% orange → 95%+ red 35% dim.

Router first: if it came via OpenRouter, it glows violet. Where money goes = what glows.

Full contract: `docs/PRINCIPLES.md` — pressure table, fix pulse math, multi-light.

## What's inside

- `docs/PRINCIPLES.md` — all rules, single source of truth
- `src/ambient/color.ts` — 7 providers + pressure blend + fix urgency
- `src/ambient/index.ts` — fans to `lightIds[]` or single `lightId`
- `src/plugin.ts` — detects provider from `chat.params`, estimates tokens
- `src/daemon/` — tiny http → Hue xy + Govee UDP

One function glows both Hue and Govee. No extra deps.

## Config

`~/.opencode-ambient/config.json`

```json
{
  "hue": { "ip": "10.0.0.10", "username": "...", "lightId": 1, "lightIds": [1,2,3] },
  "daemon": { "port": 7686, "idleReturnMs": 30000 }
}
```

## Ecosystem

- [opencode-autonomy](https://github.com/vocino/opencode-autonomy) — same thesis, autonomy that ships
- `npm i -g opencode-ambient && opencode-ambient setup && opencode-ambient start`

Using opencode on Arch Linux. Pair them: autonomy drives, ambient glows.

## License

MIT
