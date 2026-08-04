# opencode suite — vocino

Two small tools, one thesis: fewest moving parts, explicit over clever, tools you can clone and curl today.

- **opencode-autonomy** — the driver. 5 models, 5 families, zero prompts, long tasks ship. One command to install, one config that actually holds.
- **opencode-ambient** — the lights. See where tokens and money go. Hue + Govee shift as your agents work, provider is color, cost is brightness.

They compose:

```bash
# autonomy first — makes opencode ship without babysitting
opencode plugin opencode-autonomy --global
npx opencode-autonomy@latest --clean   # optional, local markdown agents

# ambient — see it happen in your room
npm i -g opencode-ambient
opencode-ambient setup && opencode-ambient start
```

Now when you `/ship`, your room goes meta blue -> orange building -> cyan tool -> yellow cursor council -> white done -> green idle, with the tank dimming as context fills.

Why a suite? 
- same install shape (one line, no git clone needed)
- same ethos (delete code > add code, readable > abstracted)
- same topics for discovery (opencode, opencode-plugin)
- each repo links the other so GitHub surfaces both

Roadmap:
- autonomy: example repos, asciinema demo
- ambient: release.yml for trusted publish, multi-light room presets, npm auto-publish toggle
- shared: meta repo or vocino.com/opencode page that is just a list of one-liners

SEO notes (so we don't lose them):
- descriptions front-load keywords
- topics: opencode, opencode-plugin, autonomy, ambient, ai-agents, claude-code, cursor, etc
- README first 120 chars have the job to be done
- one-line install works without reading the rest

This file is just notes. Source of truth is each README + docs/PRINCIPLES.md in ambient.
