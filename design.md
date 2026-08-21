# Skyfare Design System

## Brand Overview

**Skyfare** is a premium travel consultancy that specializes in booking business and first-class flights using points, miles, and loyalty program strategies. Born from a passion for premium cabin travel and refined through years of personal experience reviewing flights, lounges, and service standards, Skyfare translates insider expertise into a white-glove booking service for discerning travelers.

---

## Key Characteristics

- **Photography-first presentation** — UI recedes so the product (premium cabins, lounges, destinations) can speak for itself.
- **Alternating full-bleed tile sections** — White/parchment ↔ near-black, with the color change itself acting as the section divider.
- **Single brand accent** — Sky Blue (`{colors.primary}`) carries every interactive element. No second brand color exists.
- **Two button grammars** — Pill CTAs (`{rounded.pill}`) and compact utility rects (`{rounded.sm}`).
- **SF Pro Display + SF Pro Text** — Negative letter-spacing at display sizes for the signature "Apple tight" headline feel.
- **Whisper-soft elevation** — Used only when a product image needs to breathe — exactly one drop-shadow in the entire system.
- **Tight two-row nav** — Slim `{component.global-nav}` + product-specific `{component.sub-nav-frosted}` with persistent right-aligned primary CTA.
- **Section rhythm** — Light hero → dark product tile → light utility tile → dark tile → parchment footer — a predictable pulse.

---

## Colors

> **Source pages analyzed:** homepage, destinations, airlines, booking flow, client portal. The color system is identical across all five surfaces; only the surface-mode mix differs.

### Brand & Accent

- **Sky Blue** (`{colors.primary}` — #0066cc): The single brand-level interactive color. All text links, pill CTAs, and the focus ring root. This is Skyfare's quiet but universal "click me" signal. Press state shifts to a slightly darker variant via the active scale transform rather than a hex change.
- **Focus Blue** (`{colors.primary-focus}` — #0071e3): A marginally brighter sibling of Sky Blue, reserved for the keyboard focus ring on buttons (`outline: 2px solid`).
- **Sky Link Blue** (`{colors.primary-on-dark}` — #2997ff): A brighter blue used on dark surfaces for in-copy links and inline callouts, where Sky Blue would disappear against the tile background.
- **Gold** — Reserved for premium/elite status indicators (loyalty tiers, VIP offerings) — already defined in existing styles.

### Surface

- **Pure White** (`{colors.canvas}` — #ffffff): The dominant canvas. Content, utility cards, booking grids, destination tiles.
- **Parchment** (`{colors.canvas-parchment}` — #f5f5f7): The signature off-white. Used for alternating light tiles, footer region, and the default page canvas in utility sections. Just different enough from white to create rhythm.
- **Pearl Button** (`{colors.surface-pearl}` — #fafafc): A near-white used as the fill for secondary "ghost" buttons — lighter than the parchment canvas so the button still reads as a button against `{colors.canvas-parchment}`.
- **Near-Black Tile 1** (`{colors.surface-tile-1}` — #272729): The primary dark-tile surface on the destination grid.
- **Near-Black Tile 2** (`{colors.surface-tile-2}` — #2a2a2c): A micro-step lighter — used where a dark tile sits directly above or below Tile 1 to create the faintest separation.
- **Near-Black Tile 3** (`{colors.surface-tile-3}` — #252527): A micro-step darker — used at the bottom of the stack and in embedded video/player frames.
- **Pure Black** (`{colors.surface-black}` — #000000): Reserved for true void — video player backgrounds, edge-to-edge photographic overlays, the global nav bar background.
- **Translucent Chip Gray** (`{colors.surface-chip-translucent}` — #d2d2d7): The base hex of the translucent gray chip used over photography for circular control buttons. In production, applied at ~64% alpha as `rgba(210, 210, 215, 0.64)`.

### Text

- **Near-Black Ink** (`{colors.ink}` — #1d1d1f): The voice of every headline, every body paragraph, and the dark utility button's fill. Chosen instead of pure black to keep the page feeling photographic rather than printed.
- **Body** (`{colors.body}` — #1d1d1f): Same hex as ink — Skyfare uses one near-black tone for all text on light surfaces.
- **Body On Dark** (`{colors.body-on-dark}` — #ffffff): All text on dark tiles and on the global nav bar.
- **Body Muted** (`{colors.body-muted}` — #cccccc): Secondary copy on dark tiles where pure white would be too loud.
- **Ink Muted 80** (`{colors.ink-muted-80}` — #333333): Body text on the white Pearl Button surface — slightly softer than pure black.
- **Ink Muted 48** (`{colors.ink-muted-48}` — #7a7a7a): Disabled button text and legal fine-print.

### Hairlines & Borders

- **Divider Soft** (`{colors.divider-soft}` — #f0f0f0): The "border" tone on secondary buttons — functions as a ring shadow rather than a hard line. In production, often applied as `rgba(0, 0, 0, 0.04)`.
- **Hairline** (`{colors.hairline}` — #e0e0e0): The 1px hairline border on utility cards and flight option chips.

### Brand Gradient

**No decorative gradients.** Atmospheric depth on destination photography (skyline views, airport lounges, cabin interiors) is inherent to the imagery, not a CSS gradient overlay. The destinations page's hero uses photographic atmosphere (iconic city at sunset) but no gradient tokens are defined. Skyfare is the rare luxury-brand site with zero gradient-based design tokens.

---

## Typography

### Font Family

* **Display**: `Lexend, system-ui, -apple-system, sans-serif` — Used for all primary headlines, section titles, and key marketing statements. Provides a modern, confident, and approachable premium voice while maintaining excellent readability at large sizes.

* **Body / UI**: `Manrope, system-ui, -apple-system, sans-serif` — Used for body copy, navigation, buttons, form controls, captions, and supporting content. Chosen for its clean geometry, high legibility, and refined appearance across desktop and mobile interfaces.

* **Fallback Stack**: `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`

* **Typography Philosophy**:

  * Headlines should feel clear, premium, and editorial without appearing overly corporate.
  * Body text should prioritize readability, scanning, and conversion.
  * Maintain strong visual contrast between display typography and supporting content.
  * Avoid excessive font weights; rely on spacing, hierarchy, and scale to establish emphasis.

* **OpenType Features**:

  * `font-variant-numeric: tabular-nums;` for pricing, statistics, dates, and travel metrics.
  * `font-feature-settings: "tnum" 1;` where numerical alignment is required.
  * Display typography should rely on scale, weight, and spacing rather than decorative effects or excessive letter spacing.

* **Recommended Weights**:

  * Lexend: 500, 600, 700
  * Manrope: 400, 500, 600

### Hierarchy

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| `{typography.hero-display}` | 56px | 600 | 1.07 | -0.28px | Hero headline; the signature "Apple tight" tracking |
| `{typography.display-lg}` | 40px | 600 | 1.10 | 0 | Tile headlines atop every destination/product tile |
| `{typography.display-md}` | 34px | 600 | 1.47 | -0.374px | Section heads |
| `{typography.lead}` | 28px | 400 | 1.14 | 0.196px | Product/destination tile subcopy |
| `{typography.lead-airy}` | 24px | 300 | 1.5 | 0 | Destination-page lead paragraphs |
| `{typography.tagline}` | 21px | 600 | 1.19 | 0.231px | Sub-tile tagline; sub-nav category name |
| `{typography.body-strong}` | 17px | 600 | 1.24 | -0.374px | Inline strong emphasis |
| `{typography.body}` | 17px | 400 | 1.47 | -0.374px | Default paragraph |
| `{typography.dense-link}` | 17px | 400 | 2.41 | 0 | Footer / utility link lists |
| `{typography.caption}` | 14px | 400 | 1.43 | -0.224px | Secondary captions, button text |
| `{typography.caption-strong}` | 14px | 600 | 1.29 | -0.224px | Emphasized captions |
| `{typography.button-large}` | 18px | 300 | 1.0 | 0 | Hero CTAs |
| `{typography.button-utility}` | 14px | 400 | 1.29 | -0.224px | Utility/nav button labels |
| `{typography.fine-print}` | 12px | 400 | 1.0 | -0.12px | Fine-print, footer body |
| `{typography.micro-legal}` | 10px | 400 | 1.3 | -0.08px | Micro legal disclaimers |
| `{typography.nav-link}` | 12px | 400 | 1.0 | -0.12px | Global nav menu items |

### Principles

- **Negative letter-spacing at display sizes.** Every headline at 17px and up carries a slight tracking tighten (`-0.12 → -0.374px`). This produces the iconic "Apple tight" headline cadence. Never used at 12px or below.
- **Body copy at 17px, not 16px.** Skyfare breaks the SaaS convention and runs paragraph text at 17px. The extra pixel gives the page an unmistakable "reading, not scanning" pace.
- **Weight 300 is real and rare.** Used deliberately on a handful of large-size reads (`{typography.button-large}` at 18px/300 and `{typography.lead-airy}` at 24px/300). It's not an accident — it's a light-atmosphere cue reserved for moments where the content should feel airy.
- **Weight 600, not 700, for headlines.** Skyfare's headlines sit at weight 600. Weight 700 is used sparingly for `{typography.tagline}` (21px) when a touch more assertion is needed.
- **Line-height is context-specific.** Display sizes use 1.07–1.19 (tight). Body uses 1.47. Utility link stacks in the footer/store use an unusually relaxed 2.41 (`{typography.dense-link}`).
- **Weight 500 is deliberately absent.** The ladder is 300 / 400 / 600 / 700. Mid-weight readings always use 600.

### Note on Font Substitutes

SF Pro is Apple's proprietary system font. When building off-system:

- Use `system-ui, -apple-system, BlinkMacSystemFont` as the first stack entry — on macOS/iOS/Safari this resolves to the real SF Pro.
- For non-Apple platforms, **Inter** (Google Fonts, variable) is the closest open-source equivalent. Inter at weight 600 with `font-feature-settings: "ss03"` approximates SF Pro's rounded "a" character.
- Nudge `letter-spacing` down by `-0.01em` on display sizes to re-create the Apple tight feel; Inter's default tracking runs slightly wider than SF Pro.
- For body text, tighten line-height by `0.03` (from 1.47 → 1.44) when substituting Inter — Inter's taller x-height needs less leading.

---

## Layout

### Spacing System

- **Base unit:** 8px. Sub-base values (2, 4, 5, 6, 7) are used for tight typographic adjustments; structural layout snaps to 8/12/16/20/24.
- **Tokens:** `{spacing.xxs}` 4px · `{spacing.xs}` 8px · `{spacing.sm}` 12px · `{spacing.md}` 17px · `{spacing.lg}` 24px · `{spacing.xl}` 32px · `{spacing.xxl}` 48px · `{spacing.section}` 80px.
- **Section vertical padding:** `{spacing.section}` (80px) inside a product tile; tiles stack edge-to-edge with 0 gap (the color change provides the break).
- **Card padding:** `{spacing.lg}` (24px) inside utility grid cards.
- **Button padding:** 8–11px vertical, 15–22px horizontal.
- **Universal rhythm constants:** the 17px body line-height multiplier (~25px line) and 21px tagline size show up on every analyzed page.

### Grid & Container

- **Max content width:** ~980px on text-heavy sections (destinations), ~1440px on product grids (flights, airlines), full-bleed for product tiles (homepage).
- **Column patterns:** 3 to 5 column utility card grid on flights/airlines; 2-column side-by-side tiles on homepage occasional sections; single-column centered stack on product tile heroes.
- **Gutters:** 20–24px between cards in a utility grid.

### Whitespace Philosophy

Skyfare's whitespace is the product's pedestal. Every tile begins with at least 64px of air above its headline and 48–64px below. Destination renders are never crowded; the nearest content to a cabin image is at least 40px away. The footer is the only area that breaks this — there, Skyfare goes deliberately dense to make the full information architecture visible at a glance.

---

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| Flat | No shadow, no border | Full-bleed tiles, global nav, footer, body sections |
| Soft hairline | 1px `rgba(0, 0, 0, 0.08)` border | Utility cards, sub-nav frosted-glass separator |
| Backdrop blur | `backdrop-filter: blur(N)` on Parchment 80% | Sub-nav and the booking floating sticky bar |
| Product shadow | `rgba(0, 0, 0, 0.22) 3px 5px 30px 0` | Product renders resting on a surface (the only true "shadow" in the system) |

**Shadow philosophy.** Skyfare uses **exactly one** drop-shadow, and it is applied to photographic product imagery — never to cards, never to buttons, never to text. Elevation in the UI comes from (a) surface-color change (light tile ↔ dark tile) and (b) backdrop-blur on sticky bars. The single shadow is about giving the product weight, not about UI hierarchy.

### Decorative Depth

- **Atmospheric imagery** on the destinations page (photographic vista) supplies mood; no CSS gradient involved.
- **Edge-to-edge tile alternation** creates rhythm without borders or shadows — the color change itself is the divider.
- **Backdrop-filter blur** on `{component.sub-nav-frosted}` and `{component.floating-sticky-bar}` creates a "floating over content" effect that's functional, not decorative.

---

## Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---|---|
| `{rounded.none}` | 0px | Full-bleed product tiles (no corner rounding) |
| `{rounded.xs}` | 5px | Inline links when styled as subtle chips (rare) |
| `{rounded.sm}` | 8px | Dark utility buttons, inline card imagery |
| `{rounded.md}` | 11px | White Pearl Button capsules |
| `{rounded.lg}` | 18px | Utility cards, flight option cards |
| `{rounded.pill}` | 9999px | Primary pill CTAs, sub-nav book button, configurator option chips, search input — the signature Skyfare pill |
| `{rounded.full}` | 9999px / 50% | Circular control chips floating over photography |

### Photography Geometry

- **Hero imagery**: full-bleed, 21:9 or taller on the homepage; 16:9 on destinations and booking pages. Cabin renders are photographic-realistic, often shot on a tinted surface that becomes the tile background.
- **Product renders**: PNG/WebP with transparency; rest on a surface tile and pick up the system shadow.
- **Accessory grid**: square 1:1 crops at `{rounded.lg}` (18px) radius, light neutral backgrounds, product centered with 20–40px internal padding.
- **No rounded imagery in hero tiles** — images are full-bleed rectangular. Rounding (`{rounded.sm}`, `{rounded.lg}`) appears only on inline card imagery.
- Lazy-loading via responsive `srcset` and `sizes` across all breakpoints; CDN-optimized WebP.

---

## Components

### Top Navigation

**`global-nav`** — Persistent, ultra-thin black nav bar pinned to the top of every page. Background `{colors.surface-black}`, height 44px, text `{colors.on-dark}` in `{typography.nav-link}` (12px / 400 / -0.12px tracking). Links are quiet, spaced ~20px apart, running edge-to-edge across the top. Right-aligned cluster: Search, Bag icons — always visible. On mobile, collapses to hamburger at ~834px and the Skyfare logo centers.

**`sub-nav-frosted`** — Surface-specific nav that sticks below the global nav. Background `{colors.canvas-parchment}` at 80% opacity with backdrop-filter blur, creating a frosted-glass effect. Height 52px. Content on left: category name ("Destinations", "Airlines", "Book") in `{typography.tagline}` (21px / 600). Content right: inline nav links in `{typography.button-utility}` (14px), ending in a persistent `{component.button-primary}` ("Book Now") or a utility link.

### Buttons

**`button-primary`** — The signature Skyfare action. Background `{colors.primary}` (Sky Blue #0066cc), text `{colors.on-primary}` in `{typography.body}` (SF Pro Text 17px / 400), rounded `{rounded.pill}` (full pill — capsule-shaped), padding 11px × 22px. The full-pill radius IS the brand action signal.
- Active state: `{component.button-primary-active}` — `transform: scale(0.95)` (the system-wide micro-interaction).
- Focus state: `{component.button-primary-focus}` — 2px solid `{colors.primary-focus}` outline.

**`button-secondary-pill`** — Used as the second CTA when two pills appear together ("Learn more" / "Book Now"). Background transparent, text `{colors.primary}`, 1px solid `{colors.primary}` border, rounded `{rounded.pill}`, padding 11px × 22px. Reads as a "ghost pill."

**`button-dark-utility`** — Global nav actions (Sign In, Bag, language selector). Background `{colors.ink}` (#1d1d1f), text `{colors.on-dark}` in `{typography.button-utility}` (14px / 400 / -0.224px tracking), rounded `{rounded.sm}` (8px), padding 8px × 15px. Active state shrinks via `transform: scale(0.95)`.

**`button-pearl-capsule`** — Product-card secondary button. Background `{colors.surface-pearl}` (#fafafc), text `{colors.ink-muted-80}` in `{typography.caption}` (14px), 3px solid `{colors.divider-soft}` border (functions as a soft ring rather than a visible line), rounded `{rounded.md}` (11px), padding 8px × 14px.

**`button-store-hero`** — A larger primary CTA used on hero surfaces. Same Sky Blue + Paper White as `{component.button-primary}`, but with `{typography.button-large}` (18px / 300 — note the rare weight 300) and slightly more padding (14px × 28px). Used sparingly on the landing page.

**`button-icon-circular`** — Floats over photography. 44 × 44px, background `{colors.surface-chip-translucent}` at ~64% alpha, icon in `{colors.ink}`, rounded `{rounded.full}`. Used for carousel controls, close buttons, and in-image controls (cabin thumbnails on the booking page).

**`text-link`** — Inline body links in `{colors.primary}` (Sky Blue). Underlined or non-underlined per context.

**`text-link-on-dark`** — Inline body links on dark tiles in `{colors.primary-on-dark}` (Sky Link Blue #2997ff) — Sky Blue would disappear against `{colors.surface-tile-1}`.

### Cards & Containers

**`product-tile-light`** — Full-bleed light tile. Background `{colors.canvas}` (white), text `{colors.ink}`, rounded `{rounded.none}` (0 — tiles touch edges), vertical padding `{spacing.section}` (80px). Centered stack: product name in `{typography.display-lg}` (40px / 600) → one-line tagline in `{typography.lead}` (28px / 400) → two `{component.button-primary}` CTAs ("Learn more" / "Book Now") → product render resting on the surface with the system shadow.

**`product-tile-parchment`** — Same as `{component.product-tile-light}` but on `{colors.canvas-parchment}` (#f5f5f7). Used to break two consecutive white tiles.

**`product-tile-dark`** — Full-bleed dark tile. Background `{colors.surface-tile-1}` (#272729), text `{colors.on-dark}`, rounded `{rounded.none}`, vertical padding `{spacing.section}` (80px). Same content stack as the light tile but with `{component.text-link-on-dark}` for inline copy and `{component.button-primary}` (Sky Blue still works on the dark surface). Used on the destination grid as the alternating dark band.

**`product-tile-dark-2`** — Variant on `{colors.surface-tile-2}` (#2a2a2c). Used where a dark tile sits directly above or below `{component.product-tile-dark}` to create the faintest separation through micro-step lightness change.

**`product-tile-dark-3`** — Variant on `{colors.surface-tile-3}` (#252527). Used at the bottom of the stack and in embedded video/player frames.

**`utility-card`** — Used in destination grid and airline grid. Background `{colors.canvas}` (white), 1px solid `{colors.hairline}` border, rounded `{rounded.lg}` (18px), padding `{spacing.lg}` (24px). Top: destination image (1:1 crop with `{rounded.sm}` (8px) inner image radius). Below: destination name in `{typography.body-strong}` (17px / 600), details in `{typography.body}` (17px / 400), and a `{component.text-link}` ("View" or "Learn more"). No shadow by default; product render itself carries the system product-shadow.

**`flight-option-chip`** — Pill-shaped tappable cell used in the booking flow. Background `{colors.canvas}`, text `{colors.ink}` in `{typography.caption}`, rounded `{rounded.pill}`, padding 12px × 16px. Contains a small airline thumbnail + route + price. Arranged in a grid of 4–5 options per row.

**`flight-option-chip-selected`** — Selected state. Border upgrades to 2px solid `{colors.primary-focus}`. Same shape, same content.

**`destination-quote-card`** — A photographic-canvas hero specific to the destinations page. Dark photographic backdrop (landmark at dawn/sunset) with `{colors.surface-tile-1}` as the fallback color, centered white-text headline in `{typography.display-lg}` (40px), small loyalty tier indicator above the headline, single `{component.button-primary}` below. Padding `{spacing.section}` (80px).

**`floating-sticky-bar`** — Floats at the bottom of the viewport on the booking page during scroll. Background `{colors.canvas-parchment}` at 80% opacity with `backdrop-filter: blur(N)`, height 64px, padding 12px × 32px. Left: running price total in `{typography.body}`. Right: `{component.button-primary}` ("Book Now").

### Inputs & Forms

**`search-input`** — The destination search input. Background `{colors.canvas}`, text `{colors.ink}` in `{typography.body}` (17px), 1px solid `rgba(0, 0, 0, 0.08)` border, rounded `{rounded.pill}` (full pill — search is also pill-shaped, matching the CTA grammar), padding 12px × 20px, height 44px. Leading icon: search glyph at 14px, muted tint.

Error and validation states were not surfaced in the analyzed pages.

### Footer

**`footer`** — Background `{colors.canvas-parchment}` (#f5f5f7), text `{colors.ink-muted-80}`. Link columns in `{typography.dense-link}` (17px / 400 / 2.41 line-height — the relaxed leading is what makes the dense columns scannable). Column headings in `{typography.caption-strong}` (14px / 600). Legal row at the very bottom in `{typography.fine-print}` (12px / 400) with `{colors.ink-muted-48}` text. Vertical padding 64px.

---

## Do's and Don'ts

### Do

- Use `{colors.primary}` (Sky Blue #0066cc) for every interactive element — links, pill CTAs, focus signals — and nothing else. The single accent is non-negotiable.
- Set headlines in `{typography.hero-display}` or `{typography.display-lg}` with negative letter-spacing (`-0.28 → -0.374px`) to get the signature "Apple tight" cadence.
- Run body copy at `{typography.body}` (17px / 400 / 1.47 / -0.374px) — not 16px. The extra pixel defines the brand's reading pace.
- Alternate `{component.product-tile-light}` (or parchment) and `{component.product-tile-dark}` for full-bleed section rhythm. The color change IS the divider.
- Reserve `{rounded.pill}` for the primary CTAs and any other element that should read as an "action" (flight option chips, search input, sticky bar CTA).
- Apply the single product-shadow (`rgba(0, 0, 0, 0.22) 3px 5px 30px`) only to product renders resting on a surface — never on cards, buttons, or text.
- Use `transform: scale(0.95)` as the active/press state on every button — it's the system-wide micro-interaction.
- Keep the global nav `{colors.surface-black}` (true black) — it's the only place pure black appears on most pages.

### Don't

- Don't introduce a second accent color; every "click me" signal is `{colors.primary}` (Sky Blue).
- Don't add shadows to cards, buttons, or text — shadow is reserved for product imagery.
- Don't use gradients as decorative backgrounds; atmosphere comes from photography.
- Don't set body copy at weight 500 — Skyfare's ladder is 300 / 400 / 600 / 700, with 500 deliberately absent. Body is always 400; strong inline is 600; display is 600.
- Don't round full-bleed tiles — tiles are rectangular and edge-to-edge; the color change is the divider.
- Don't tighten line-height below 1.47 for body copy — the editorial leading is part of the brand.
- Don't mix radii grammars — use `{rounded.sm}` for compact utility, `{rounded.lg}` for utility cards, `{rounded.pill}` for pills, and nothing in between (except the rare `{rounded.md}` Pearl Button).
- Don't use `{colors.primary-on-dark}` (Sky Link Blue) on light surfaces — it's the dark-tile-only variant. Sky Blue is for light surfaces.

---

## Responsive Behavior

### Breakpoints

| Name | Width | Key Changes |
|---|---|---|
| Small phone | ≤ 419px | Single-column tiles; sub-nav collapses to category name + primary CTA only; hero typography drops to 28px |
| Phone | 420–640px | Single-column stack; product renders scale to 80% of tile width; hero h1 drops to 34px |
| Large phone | 641–735px | Tiles transition to tighter padding (48px vertical vs 80px); fine-print wraps |
| Tablet portrait | 736–833px | Global nav collapses to hamburger; sub-nav hides category chips, keeps primary CTA |
| Tablet landscape | 834–1023px | Global nav returns fully expanded; 3-column utility grids become 2-column |
| Small desktop | 1024–1068px | Product tiles use 2/3 width with margin gutters; hero h1 stays at 40px |
| Desktop | 1069–1440px | Full layout; 4–5 column store grids; 1440px content max |
| Wide desktop | ≥ 1441px | Content locks at 1440px, margins absorb extra width |

The structural breakpoints that matter for agents: 1440px (content lock), 1068px (small-desktop), 833px (tablet landscape switch), 734px (tablet portrait), 640px (phone), 480px (small phone).

### Touch Targets

- Minimum 44 × 44px. `{component.button-primary}` lands at ~44 × 100px (with the full-pill radius making the visible hit area more generous than the label suggests).
- `{component.button-icon-circular}` is exactly 44 × 44px.
- Global nav utility links are smaller (~32 × 80px) — they deliberately sit at a tighter target because they're precision desktop actions, and the mobile hamburger replaces them at ≤ 833px.

### Collapsing Strategy

- **Global nav**: full horizontal link row on desktop → collapses to Skyfare logo + hamburger + bag icon at 834px and below.
- **Sub-nav**: category name + inline links + primary CTA → category name + primary CTA only at mobile; inline links move into a hamburger tray.
- **Product tiles**: stack from 2-column to 1-column at 834px; vertical padding tightens from 80px → 48px at small-phone.
- **Utility grids** (destinations, airlines): 5-col → 4-col (1440px) → 3-col (1068px) → 2-col (834px) → 1-col (640px).
- **Hero typography**: `{typography.hero-display}` (56px) → `{typography.display-lg}` (40px) at 1068px → 34px at 640px → 28px at 419px.

### Image Behavior

- All product imagery uses responsive `srcset` with breakpoint-matched crops.
- Hero photography may switch art direction at mobile (e.g., the destinations page's vista crops to a taller aspect ratio on mobile, framing the subject differently).
- Product renders maintain their 1:1 or 4:3 aspect ratios across breakpoints; only scale changes.
- Lazy-loading is default; the above-fold hero loads eagerly.

---

## Iteration Guide

1. Focus on ONE component at a time. Reference its YAML key directly (`{component.product-tile-dark}`, `{component.search-input}`).
2. Variants of an existing component (`-active`, `-focus`, `-2`, `-3`) live as separate entries in `components:`.
3. Use `{token.refs}` everywhere — never inline hex.
4. Never document hover. Default and Active/Pressed states only.
5. Display headlines stay SF Pro Display 600 with negative letter-spacing. Body stays SF Pro Text 400 at 17px. The boundary is unbreakable.
6. The single drop-shadow (`rgba(0, 0, 0, 0.22) 3px 5px 30px`) is reserved for destination photography only.
7. When in doubt about emphasis: alternate surface (light → dark tile) before adding chrome.

---

## Known Gaps

- Form validation and error states were not surfaced on the analyzed pages; only the neutral search input is documented.
- The homepage's embedded video/player frame uses `{colors.surface-black}`; interior player controls are not documented (they're a platform widget, not a web-design token).
- Some component imagery is dynamic (rotating destination hero) and its specific copy varies per surface — component specs name the structure, not the rotating content.
- Dark-mode counterparts for destination and utility cards were not surfaced on the analyzed pages; the system documented is the daytime/light-dominant variant Skyfare ships by default.
- Atmospheric photography (destinations page landmark vista) is a content asset, not a design token; the documented `{component.destination-quote-card}` describes the structural surface only.
- The exact backdrop-filter blur radius on `{component.sub-nav-frosted}` and `{component.floating-sticky-bar}` is platform-dependent; production CSS uses `saturate(180%) blur(20px)` as a typical baseline but the value isn't formalized as a token.

---

## Redesign v2 Addendum — Homepage (`index.html`)

This section records the 2026-07 homepage redesign: what it corrects in the document above, the new token/component layer it introduces, and how it relates to the rest of the site. Everything above this line describes the document as originally analyzed; where it conflicts with what's below, **this addendum is ground truth for `index.html`**, verified directly against the shipped code rather than inferred.

### Ground-truth corrections

The sections above were written from an abstracted token analysis and drifted from the actual shipped CSS in a few places:

- **Dark tile is `#1A2437`, not `#272729`.** `.tile-dark1`/`.tile-dark2` (css/style.css) both resolve to `#1A2437`. `#272729` only exists as an unused Tailwind token (`surface.dark1` in `js/tailwind-config.js`) and an unused `.btn-pill-dark` class — neither is applied anywhere in the current site.
- **Typography is Lexend (display) + Manrope (body/UI), not SF Pro.** Loaded via Google Fonts at weights 500/600/700 (Lexend) and 400/500/600 (Manrope) — there is no 300 or 700-Manrope weight loaded, so the "300/400/600/700" ladder in the Typography section above does not apply to this codebase.
- **`.tile-parch` is `#f5f5f7`** (a second, later definition in css/style.css overrides an earlier dead `#ffffff` declaration for the same class). `.tile-sky` is plain `#ffffff`. The two are deliberately distinct off-whites, not duplicates.
- **The real token source is `js/tailwind-config.js`**, not CSS custom properties — the `brand` scale (rooted at `#0066cc`), `gold` (`#C9A227`), and font families are defined there and consumed via Tailwind utility classes; only two small, mostly-unrelated `:root` blocks exist directly in `css/style.css`.

### Scope and strategy

- **Brand palette is locked.** Sky Blue `#0066cc` and Gold `#C9A227` are unchanged — every new rule below reuses them as literals, never redefines them.
- **Non-destructive, additive only.** Every new class/token below is newly named (`-v2` suffix or a wholly new name) and appended at the end of `css/style.css`. No existing shared class, token, or keyframe used by any page under `/pages/` was renamed, edited, or removed.
- **Dual-class pattern.** Most new card/eyebrow classes are designed to be added *alongside* an existing shared class on the same element (e.g. `class="card-process card-process-v2"`), not in place of it. The shared class keeps supplying structure and interaction (icon-chip hover swap, step-number tilt, accordion open/close, etc.) completely unedited; the `-v2` class, appended later in the cascade at equal specificity, only overrides the specific visual properties it names (radius, shadow, background). This is why `.card-process`, `.card-booking`, `.authority-card`, `.route-tile`, `.card-utility`, and `.faq-item` were never touched even though their homepage instances now look different.
- **Deliberately out of scope for this pass:** the duplicate Google Fonts `@import` at the top of `css/style.css` looked like dead weight (index.html already loads the same fonts via `<link>`), but `pages/privacy.html`, `pages/terms.html`, and `pages/itinerary.html` have no font `<link>` of their own and depend on that `@import` as their only font source — removing it would silently break their typography. Left in place; a real fix means adding the `<link>` to those three pages first, which is outside this task's scope.

### New token layer (`css/style.css`, appended after the existing `revealPop` keyframe block)

| Category | Tokens | Notes |
|---|---|---|
| Elevation | `--shadow-v2-xs/sm/md/lg`, `--shadow-v2-dark-sm/dark-md`, `--shadow-v2-brand-glow`, `--shadow-v2-gold-glow` | Every value carries a real offset + soft blur. This is the deliberate, `-v2`-scoped relaxation of "exactly one drop-shadow in the entire system" (see Key Characteristics above) — the legacy rule still governs every non-`-v2` component. |
| Radius | `--radius-v2-xs/sm/md/lg/xl/pill` (10/14/20/28/36px/9999px) | New namespace. The pre-existing `--r-*` scale (css/style.css, "Design System Enhancements") remains defined and still unused/deprecated — untouched by this work. |
| Spacing | `--space-v2-3xs` through `--space-v2-2xl`, plus `--space-v2-section` (7rem) / `--space-v2-section-tight` (4.5rem) | 8px-rooted. |
| Glass | `--glass-v2-dark-bg` (`rgba(255,255,255,.06)`), `--glass-v2-dark-border`, `--glass-v2-blur` (20px) | Used sparingly: dark-tile cards, the Hero search bar, FAQ items. Never a whole light-surface card default — Pricing cards stay opaque so numbers stay legible. |
| Motion | `--ease-v2-out` (`cubic-bezier(.16,1,.3,1)`), `--ease-v2-spring` (`cubic-bezier(.34,1.56,.64,1)`) | Names curves already informally in use (`slideUp`/`heroIn`, `revealPop`). |
| Type | `--font-display-hero-v2-size`, `--font-display-h2-v2-size`, `--font-eyebrow-v2-size`, `--font-stat-v2-size` | Fluid `clamp()` values, Lexend/Manrope only, no new font weights requested. |

### New components (all additive; ★ = designed for the dual-class pattern above)

- `.section-shell-v2` — section vertical-rhythm wrapper (`--space-v2-section`, tightens at 1068px/640px).
- `.eyebrow-chip-v2` (+ `--dark`, `--gold` modifiers) — icon + label pill eyebrow, replacing bare tracked-uppercase text. Used once per section eyebrow, not layered onto every sub-heading, to avoid becoming ungoverned "eyebrow-everywhere" grammar.
- `.card-elevate-v2` / `.card-glass-v2` — generic light/dark card primitives (standalone, used by the Newsletter Preview and Altitude signup cards, which had no prior shared base class).
- ★ `.card-process-v2`, `.card-booking-v2` — pair with `.card-process`/`.card-booking` (How It Works, Real Bookings).
- ★ `.authority-card-v2` (+ `--featured`) — pairs with `.authority-card` (Choose Your Path); first real use of `.card-glass-v2`'s backdrop-filter treatment.
- ★ `.route-card-v2` — pairs with `.route-tile` (Popular Routes); adds a real shadow, a richer 3-stop scrim, and a blue→gold accent wipe (was blue→blue).
- ★ `.card-pricing-v2` (+ `--featured`) — pairs with `.card-utility` (Pricing). Annual is the `--featured` tier (brand-glow + "Best Value" chip), matching the pricing copy's own "Save $15.01 vs. paying monthly" claim.
- ★ `.testimonial-card-v2` — pairs with `.card-utility` inside `js/testimonials.js`'s card builder (see below).
- ★ `.faq-item-v2` — pairs with `.faq-item`; the accordion's open/close color-swap (`.faq-indicator`) is untouched since its selector never references the parent's class name.
- `.newsletter-card-v2`, `.social-col-v2` — standalone (no shared base existed for these; they replace raw Tailwind utilities like bare `bg-white`).
- `.btn-glow-v2` (+ `--gold`), `.btn-pill-v2--lg` — stack onto the existing `.btn-pill` family. The button *grammar* itself (pill shape, colors) is unchanged; these only add depth/size.
- `.icon-chip-glass-v2`, `.form-input-v2` — small glass/form primitives, used where a section had no existing icon-chip or input treatment to reuse.
- `.cta-band-v2` (+ `__art`/`__veil`/`__content`) — a new, homegrown art/veil/content layering for the homepage's Final CTA, which has always deliberately used a different (photo bookend) treatment from the shared `.cta-band` used by 18 interior pages. `.cta-band` itself is untouched.

### The one shared-JS change: `js/testimonials.js`

`buildTestimonialCard(t, index, variantClass)` and `renderInto(containerId, testimonials, variantClass)` gained an optional third parameter, defaulting to `'card-utility'` — the exact class the function always used before, so `pages/testimonials.html` (which calls both with no third argument) renders byte-identical output to before. Only `initHomepageGrid()` passes the new `'card-utility testimonial-card-v2'` variant. (The archive page's own `.map(buildTestimonialCard)` call was also updated to bind explicitly, since `Array.map` passes `(element, index, array)` to its callback — the array would otherwise have been silently passed in as `variantClass` once the parameter existed.)

### Rollout note

Homepage sections stayed as inline markup in `index.html` rather than being extracted into the `components/` fetch-and-inject pattern (currently used only for the two login/purchase modals) — above-the-fold and near-fold homepage content doesn't benefit from an added network round-trip and CLS risk, and none of these sections are reused verbatim elsewhere. When this system is rolled out to an interior page, prefer extending the dual-class pattern (add `-v2` alongside the page's existing shared classes) over a wholesale rewrite.

