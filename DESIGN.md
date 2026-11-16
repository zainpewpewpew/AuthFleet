---
version: 1
world: y2k-frutiger-aero-authfleet
mode: operate
code_led: true
seed: a3b266831bdfad3e
sanctioned:
  fonts:
    - "Bricolage Grotesque (display, via next/font/google)"
    - "Nunito (body/UI, via next/font/google)"
    - "JetBrains Mono (data/code, via next/font/google)"
    - "system-ui + ui-sans-serif (fallback)"
  colors_hex:
    - "#A8D8FF · #C8E6FF · #EAF4FF · #F6FAFE  (sky atmospheric gradient)"
    - "#002451 · #37486B · #6B7B9A  (ocean ink + dim + mute)"
    - "#FDFEFF · #EBF2F9 · #CFDBEA · #8FA7C4  (chrome panel + edge)"
    - "#00C9D4 · #006770  (active teal)"
    - "#FF4FAA · #8E0E52  (signal pink — state only)"
    - "#00A676 · #00563D  (bottle green — connected)"
    - "#FFB020 · #7A4C00  (amber — degraded)"
rules:
  - name: "No-Yellow-Decorative"
    reason: "Amber is reserved for degraded/warning state; never decoration"
  - name: "One-Hero-Colour"
    reason: "Teal carries selection + focus + CTA primary; pink reserved for NEW/destructive; green for connected; amber for degraded. Decorative use of any state colour is a floor violation."
  - name: "Chrome-On-Sky"
    reason: "Every elevated surface is a chrome panel on the sky field — never a flat card. The specular highlight + bevel pair carries the world."
  - name: "No-Gradient-Text"
    reason: "Craft floor ban; emphasis via weight or size. OTP display uses solid ocean ink + text-shadow depth."
  - name: "No-Kicker"
    reason: "No eyebrow label above any heading, ever."
  - name: "Mono-For-Measurement"
    reason: "JetBrains Mono used only for API keys, OTP codes, tabular numbers, timestamps — never as costume for 'technical' feel."
---

# Design

AuthFleet's visual world is a **Y2K Frutiger Aero** tool surface: sky aqua
atmosphere, glossy chrome panels, humanist warm UI typography, iridescent
teal CTAs, and signal pink reserved for NEW/destructive. The world lends
four things — type, palette, density, and one signature move — to a working
dashboard the operator can read cold. The world never supplies the layout,
the navigation model, or the controls; those are web-standard forms the
operator already knows how to use.

## World

**Thesis**: AuthFleet reads first as a working OAuth-key manager the operator
knows cold, then (and only then) as a Y2K Frutiger Aero tool. The chrome
panels + aqua sky ground refuse the category default of near-black SaaS with
one muted accent — not for ornament, but because that default is every
dev-tool shipped in 2024 and the operator sees it all day already.

**Palette** — tokens on `:root` in [src/app/globals.css](src/app/globals.css):

| Role | Token | Hex |
|---|---|---|
| Sky atmosphere | `--af-sky-1..4` | `#A8D8FF · #C8E6FF · #EAF4FF · #F6FAFE` |
| Ocean ink | `--af-ink` | `#002451` |
| Ink dim | `--af-ink-dim` | `#37486B` |
| Ink mute | `--af-ink-mute` | `#6B7B9A` |
| Chrome panel | `--af-chrome-1..3` | `#FDFEFF · #EBF2F9 · #CFDBEA` |
| Chrome edge | `--af-chrome-edge` | `#8FA7C4` |
| Active teal | `--af-teal · --af-teal-ink` | `#00C9D4 · #006770` |
| Signal pink | `--af-pink · --af-pink-ink` | `#FF4FAA · #8E0E52` |
| Success green | `--af-green · --af-green-ink` | `#00A676 · #00563D` |
| Degraded amber | `--af-amber · --af-amber-ink` | `#FFB020 · #7A4C00` |

Dark mode: not shipped v1. The physical scene is operator working at their
laptop during the day; light sky field is correct for that scene.

**Material**:

- Every elevated surface is a **chrome panel** (`.af-panel`) with a
  top-to-bottom light-to-mid gradient fill, a 1px specular top bevel, a
  1px ocean-blue bottom bevel, 1px chrome side bevels, and a soft offset
  shadow. The `.af-panel--shine` modifier adds an additional screen-blended
  specular highlight layer along the top edge via `::before`.
- Buttons mirror the same chrome treatment: `.af-btn--primary` uses the
  teal chrome gradient; `.af-btn--ghost` uses white chrome; `.af-btn--danger`
  uses pink chrome.
- The page ground is a **radial + linear composite** gradient
  (`--af-sky-field`) — soft sun on the top-left, cool aqua on the top-right,
  fading to near-white at the bottom. It's `background-attachment: fixed`
  so the atmosphere stays steady as content scrolls past.
- No glass/blur as decoration; `backdrop-filter` is reserved for the modal
  scrim (where it serves protected focus).

**Signature move** — the folder stepped tab-rail in the sidebar: each
folder band's height is proportional to its Gmail count, rendered as a
chrome lozenge with a tone-matched vertical cap on its left edge. This
lives in `.af-folderband` ([src/app/(app)/app-shell.css:98-130](src/app/(app)/app-shell.css)).
At a glance the operator reads folder weight (how dense is this project?)
without opening any menu. The sidebar is the navigator and the inventory
at once.

## Typography

Three faces, all loaded via `next/font/google` (self-hosted at build; no
runtime CDN fetch):

| Role | Family | Weights |
|---|---|---|
| Display (headlines, folder names) | Bricolage Grotesque | 400 600 700 800 |
| UI body + labels | Nunito | 400 600 700 900 |
| Data (OTP codes, API keys, timestamps, IDs) | JetBrains Mono | 400 500 700 |

Craft floor sanctions Bricolage (not on the banned "AI display face" list)
and Nunito (humanist warm, Y2K-era recognizable). JetBrains Mono is
sanctioned for data / measurement / code only; not decoratively.

Utility classes in [globals.css](src/app/globals.css):
`.af-display`, `.af-h1`, `.af-h2`, `.af-h3`, `.af-body`, `.af-muted`,
`.af-mono`, `.af-mono-sm` (small-caps mono label), `.af-tabular`.

Tracking floor on display: `letter-spacing: -0.03em` (h1/h2),
`-0.02em` (h3). Body stays at the default.

## Composition rhythm

- **Sidebar** — 264px, always visible on desktop, collapses to a horizontal
  scroll-strip on `< 900px` with folder bands hidden.
- **Topbar** — 72px, chrome panel with breadcrumb title + fleet-online
  pulse chip + inline clock + 2 CTAs.
- **Content** — `padding: 24px clamp(24px, 3vw, 40px)` with 24px grid gap
  between sections. More space above a heading than below it (floor
  reflex): `.af-dash__section-head` has `padding: 0 4px 10px 4px` on
  bottom only.
- **Cards** stack with their own `.af-panel` chrome. No "same-size card
  grid of icon + heading + text" as the primary structural tool — the
  dashboard's first row is a single Live Inbox hero that carries the
  thesis (one specific OTP, right now), not a metric wall.

## Radii + spacing tokens

```
--af-r-xs: 10px
--af-r-sm: 14px
--af-r-md: 20px
--af-r-lg: 28px
--af-r-xl: 36px
--af-r-pill: 999px

--af-gutter: 32px
--af-pad: 24px
--af-pad-tight: 16px
```

## State colour contract

- **Active teal** (`--af-teal`) — focus ring, primary CTA background,
  chip accent for `tone="teal"`, sparkline bars.
- **Signal pink** (`--af-pink`) — NEW chip (just-arrived OTP), destructive
  danger button, chip accent for `tone="pink"`. Pink pulses in
  `.af-chip--pulse` (keyframes `af-chip-pulse`) only when the chip's
  dot animates.
- **Success green** (`--af-green`) — connected Gmail dot, chip
  `tone="green"`, "Semua terhubung" badges.
- **Degraded amber** (`--af-amber`) — "1 degraded" chip, Gmail status
  degraded dot. Never used decoratively.

Non-state colour (chrome, sky, ocean) carries the world; state colour
carries meaning. Mixing the two would dilute both.

## Motion

- `af-chip-pulse` — 1600ms pulse on live chips ("Fleet online", "Baru
  masuk", folder reauth alerts).
- `af-spin` — 820ms spinner on button loading.
- `af-fresh` — 2s fade-down on newly-arrived activity row (pink →
  near-transparent pink), one shot.
- `af-fade-in` / `af-pop-in` — modal mount, 220–240ms, cubic-bezier.
- `af-spark-grow` — 1200ms stagger-animated OTP-7d sparkline bars grow
  from 0 to full height, 40ms delay per bar.

All respect `prefers-reduced-motion: reduce` via the global override in
[globals.css](src/app/globals.css).

## Components

Built in [src/components/](src/components/):
- `Logo` — inline SVG glossy aqua paper plane inside a chrome capsule.
  Carries the Y2K Frutiger Aero signature in one asset.
- `Wordmark` — Bricolage Grotesque "Auth" + teal "Fleet".
- `Panel` — chrome plate wrapper with tone variants (`chrome` default,
  `aqua`, `ocean`) and optional shine.
- `Button` — pill, 44px default, primary + ghost + quiet + danger variants,
  SM/MD/LG sizes, loading spinner slot.
- `Chip` — rounded tag with dot, tone variants + pulse modifier.
- `Sidebar`, `Topbar` — the app shell, both client components for
  pathname-driven active state + live clock.

## Icons

Lucide React — one consistent stroke weight (2.2) across the app. Never
Unicode glyphs for icons (floor ban). The paper plane in `Logo` is
authored SVG with its own gradients and specular, not a Lucide icon.

## Browser surfaces (themed from palette)

- Text selection: teal rgba
- Caret: teal
- Scrollbar: chrome gradient thumb, aqua-tinted track
- Focus ring: teal 2px outline + aqua 3px halo
- `::-webkit-scrollbar` + `scrollbar-color` both set.

## Direction contract (source of truth)

See [.impeccable/surfaces/app.md](.impeccable/surfaces/app.md) for the
full THESIS / OWN-WORLD / STORY / FIRST VIEWPORT / FORM / FINISH blocks.
This file documents what the contract rendered to; the contract itself
is what later changes answer to.

## Detector

`impeccable detect` over `src/app` returns 0 findings as of first ship.
Rerun after any UI edit with:

```
.claude/skills/impeccable/scripts/impeccable detect --json src/app
```
