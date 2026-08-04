# opencode-ambient Principles — Provider Light System

> See the light and know where your tokens and money are going.

This is the source of truth for ambient. If a feature doesn't fit these principles, we change the feature.

---

## 0. Original Vision (non-negotiable)

You're coding in a dark room. Your Hue bars and Desk light are doing things as work happens. You never look at a dashboard — you *feel* the room shift.

The room is calm when idle, alive when building, warm when getting full, dim when almost out. Provider shows as color. Cost shows as life.

---

## 1. Provider-Indexed, Not Model-Indexed

**Shorter list, clearer signal.** Indexing on 6-8 providers beats 40+ models.

Providers = who you pay / whose limit you hit:

- `meta` — your own / local Llama, 1M context
- `cursor` — Cursor proxy (opus/sonnet inside)
- `anthropic` — direct Claude
- `openai` — direct GPT
- `openrouter` — router / mixed spend
- `google` — Gemini
- `local` — ollama / local llm

If you route Claude via OpenRouter, light = OpenRouter. Where the money goes is what glows.

### Palette: Distinct by Hue, Not Just Brand

- **meta** `#0064d1` — deep Meta blue (calm, foundation)
- **cursor** `#facc15` — Cursor yellow, you see council live
- **anthropic** `#d97757` — Claude clay orange, warm human
- **openai** `#10a37f` — OpenAI teal, distinct from idle green
- **openrouter** `#8b5cf6` — router violet
- **google** `#4285f4` — Gemini blue, lighter than Meta
- **local** `#9ca3af` — neutral slate, local stays subtle

Rules:
- No two providers share a hue family within 30°
- Must be readable at 35% brightness (dimmed tank)
- Must be distinct on both Hue CIE and Govee RGB

---

## 2. Token Tank / Money Are The Same Signal

Pressure `0..1` is "how full is your tank." Tank = context + spend.

- `0%` = fresh, full life, bright calm
- `40%` = hint of warm, still fine
- `70%` = amber warning, think about compact/new session
- `85%` = orange hot, expensive zone
- `95%+` = red drained, dim to 35%, needs action

Brightness is life. Color warmth is cost.

```
0%  [idle/planning blue/green] 100% bright
40% slight amber tint          94% bright
70% amber                      90% bright
85% orange                     75% bright
95% red                        55% bright + pulse
100% deep red                  35% bright
```

If real usage arrives from opencode (prompt + completion tokens), we snap to that. Otherwise we estimate from message/tool length. Accuracy > purity, but real > estimate.

Compaction or new session = tank refills, room clears.

---

## 3. Fix-Loop = Urgency, Not Another Color

No new color for fixes. Use speed + brightness bump.

- 1 fix = normal
- 2 fixes in 45s = +6% bright, 60% transition
- 3 fixes = +12% bright, flicker, 150ms
- 4+ fixes = +20% bright, 80ms pulse — you feel stuck

Decays after 20s idle/done. Caps at 8.

You shouldn't need to *see* fixing — you feel urgency.

---

## 4. Composition: Provider + Pressure Share One Light

One Hue can't be two colors. Blend:

- Base = provider color (who's driving)
- Pressure = warm shift + dim toward center

Cursor yellow at 90% pressure still feels yellow, but hotter, dimmer yellow-orange. You get both signals in one glance.

Multi-light room (future): desk = primary provider, plays = pressure echo / council. Single-light stays backwards compatible via `lightId` + `lightIds[]`.

---

## 5. Interpretation — How To Read The Room

- **Blue calm, bright** — idle, fresh, cheap
- **Yellow flicker, bright** — Cursor council actually working, you're watching tokens move live
- **Blue/yellow but warm tint** — same provider, getting pricey
- **Orange all over, 75% dim** — hot, 85%+ tank, consider `/compact` or new session
- **Dim red, pulsing slow** — tank drained, plan close, finish or reset
- **Rapid bright flicker** — fix loop, maybe intervene

No dashboard needed. Glance test passes.

---

## 6. Refactor Implications

If we lock these, the skill/app refactor is:

- `plugin.ts` stays provider detection + token estimate, no color logic
- `color.ts` owns all blending (provider base → pressure warm → fix urgency)
- `daemon.ts` only forwards `pressure, fixStreak` to `glow()`
- `config.json` gets `lightIds[]` optional, provider overrides optional
- No per-model colors ever, providers only (keeps list to ~7)

Any new provider = add one hex + CIE, no code change otherwise.

---

## 7. Money Clarity

OpenRouter and direct providers both show cost via dimming. Same pressure logic works because pressure = tokens / max AND tokens ≈ $. No separate money bar — life IS money.

---

## Next: Lock Palette In Code

1. Update `STATE_PRESETS` to include anthropic, openai, openrouter, google, local
2. Add provider detection for anthropic/openai/google/openrouter/local
3. Keep pressureBlend untouched — it already composes correctly
4. Add config UI to pick lightIds for your 3-light office

This doc is the contract. Build through it.
