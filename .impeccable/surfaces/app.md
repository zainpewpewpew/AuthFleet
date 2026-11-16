---
version: 1
slug: "app"
primary_target: "app"
related_targets: []
---

# App shell surface

## Scope

AuthFleet's whole authenticated app: login, dashboard home, folders list, folder detail (Gmails + API keys), activity feed, settings. One direction contract carries all authenticated routes; `/login` shares the world and its signature move. Code-led build on an Operate surface.

## Visitor mode

Operate. The operator opens AuthFleet to register OAuth projects (folders), connect Gmails inside them, and rotate API keys. The Y2K Frutiger Aero world lends type, palette, density, and one signature move; navigation, controls, and layout stay the dashboard standards the operator already knows.

## Audience, job, action, proof, constraints

- **Audience**: single operator, Sociofy owner, Gen-Z internet native who ran bulk IG signup flows before AuthFleet existed. Bilingual (ID primary, EN secondary).
- **Job**: minimize the friction between "I need an OTP for this signup" and "the OTP is in Sociofy Agent." Folder-shaped mental model reduces cross-batch confusion.
- **Action**: register OAuth client → create folder → connect N Gmails → generate API key → paste key into Sociofy Agent's env.
- **Proof**: the operator used `RisetAutoCheckOTP_Email` before and it worked. AuthFleet proves its worth by (1) folder-shaped grouping and (2) per-folder API-key rotation.
- **Constraints**: WCAG AA contrast on every text, keyboard navigation everywhere, Indonesian default copy. Local-first (localhost dev; no CDN reach for third-party fonts allowed at runtime — self-host or variable from Google Fonts bundled at build).

## Direction contract

**THESIS**: AuthFleet's app surface reads first as a Y2K Frutiger Aero tool — glossy aqua sky, iridescent chrome tabs, warm humanist UI type — then as a working dashboard the operator knows cold. It refuses the category default of near-black SaaS with one muted accent, because that is every dev-tool shipped in 2024 and the operator sees it all day already.

**OWN-WORLD**: Sky aqua gradient grounds (#A8D8FF → #C8E6FF → #EAF4FF, soft top-to-bottom), chrome-silver panel surfaces (#C4CFD9 base with specular highlight gradient), deep ocean ink (#002451) for all text. State colours: signal pink (#FF4FAA) reserved for NEW/DESTRUCTIVE only; active teal (#00C9D4) for selection + focus rings; bottle green (#00A676) for success/connected; amber (#FFB020) for degraded/warning. Type: Nunito (humanist warm sans) for UI body/labels; Space Grotesk for display headlines; JetBrains Mono for data, IDs, API keys. Material: card radius 20-28px, glossy specular highlight gradient on top edge of every elevated surface, 1px inner chrome bevel (white top + ocean bottom) on panels, 24-32px gutters, 8px micro-grain.

**STORY**: Operator lands on `/login`, enters password, opens dashboard. First viewport shows a chrome-panel "Fleet Overview" card (3 stat tiles: folders · connected Gmails · API calls 7d), a glossy sidebar with folder list (stepped tab-rail: each folder band height reflects Gmail count), and a live activity feed card that reranks when a new OTP arrives. The world tells the operator: "this tool is personal, it belongs to my era, and it is in my corner." The dashboard reads first as a dashboard.

**FIRST VIEWPORT** (1440x900 authenticated dashboard):
- **Sidebar** (240px, left, full-height chrome panel with sky-aqua gradient): logo "AuthFleet" top-left as Space Grotesk 24px display + chrome aqua lozenge. Nav items in Nunito 14px: Dashboard · Folders · API Keys · Activity · Settings. Folder submenu under "Folders" rendered as stepped tab-rail (3 folder bands, each 36-56px tall, height = f(Gmail count)). Bottom: operator badge + logout.
- **Topbar** (72px, white chrome gradient panel with 1px inner bevel): breadcrumb "Dashboard" Space Grotesk 20px + right-side quick actions (Connect Gmail · New Folder) as iridescent buttons.
- **Main content** (fluid, right of sidebar, pad 32px):
  - Row 1: 3 stat tiles (Fleet Overview) — each a chrome-glossy card, 320x160, specular top edge, big JetBrains Mono tabular number 48px in ocean ink + small Nunito caption below. Numbers: "4 FOLDERS", "17 GMAILS", "2,341 API CALLS · 7D".
  - Row 2: 2 panels side by side:
    - **Left panel (60%)**: "Folders" grid, 2-col poster-tile cards with cover-art gradient per folder + folder name Space Grotesk 18px + 3 metadata rows in mono.
    - **Right panel (40%)**: "Live Activity" feed, 8 recent rows showing API-key hits with timestamp, folder, email, outcome. Row that just changed pulses signal pink for 2 seconds + persistent NEW chip until acknowledged.
- Primary action: Connect Gmail in topbar as the iridescent CTA (lens-flare reveal on hover).

**FORM**: Y2K Frutiger Aero direction, candidate 2 of my ordered list (Y2K Frutiger Aero ranked 2nd; dice assigned #7 Brat Green Chartreuse; user picked IMPECCABLE'S PICK which was this one). seed:a3b266831bdfad3e

**FINISH**: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved decisions

- Login page composition: full-screen glossy aqua gradient with centered chrome panel, or split-screen (left world/brand, right form)? **Default: centered chrome panel**, revisit at polish.
- OAuth callback return page: minimal confirmation or full-chrome card. **Default: minimal + single CTA to return to folder.**
- Empty states copy: playful Indonesian or formal Indonesian. **Default: playful but not meme.**
