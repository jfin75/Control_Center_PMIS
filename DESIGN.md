---
name: Control Center
description: An Owner's capital control room: white panels on a pale blue-white canvas, cobalt data ink, every figure traceable to the A–K budget chain.
colors:
  canvas: "#f6f9fd"
  surface: "#ffffff"
  surface-2: "#f9fbfe"
  surface-sunk: "#f1f5fa"
  ink: "#121a2c"
  ink-2: "#566077"
  ink-3: "#5f6980"
  ink-4: "#848ea2"
  line-strong: "#d5dde8"
  line: "#e6ecf3"
  line-soft: "#eff3f8"
  cobalt: "#3681e6"
  accent: "#2468cc"
  accent-hover: "#184a94"
  accent-ink: "#1f5bb3"
  accent-tint: "#e3effc"
  accent-wash: "#eef5fe"
  cobalt-200: "#c6dcf8"
  navy: "#334293"
  sky: "#4dbaf6"
  sky-tint: "#e2f3fd"
  teal: "#00c6a2"
  teal-ink: "#03735e"
  teal-tint: "#dcf6f0"
  coral: "#ff6666"
  coral-ink: "#c2303a"
  coral-tint: "#ffe9e8"
  amber: "#ffcf7a"
  amber-ink: "#8a5700"
  amber-tint: "#fff3dc"
  orange: "#ffa35f"
  pink: "#f55488"
  slate: "#899bb3"
  purple: "#9a6fd0"
typography:
  figure:
    fontFamily: "Figtree, Segoe UI, system-ui, sans-serif"
    fontSize: "1.625rem"
    fontWeight: 600
    lineHeight: "2.25rem"
    letterSpacing: "-0.02em"
    fontFeature: "\"tnum\" 1"
  headline:
    fontFamily: "Figtree, Segoe UI, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: "1.95rem"
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Figtree, Segoe UI, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 600
    lineHeight: "1.5rem"
    letterSpacing: "-0.01em"
  narrative:
    fontFamily: "Figtree, Segoe UI, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: "2rem"
  panel-title:
    fontFamily: "Figtree, Segoe UI, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: "1.35rem"
    letterSpacing: "-0.005em"
  body:
    fontFamily: "Figtree, Segoe UI, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: "1.2rem"
  label:
    fontFamily: "Figtree, Segoe UI, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: "1.05rem"
  micro:
    fontFamily: "Figtree, Segoe UI, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: "1rem"
  segment:
    fontFamily: "Figtree, Segoe UI, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 700
    lineHeight: "1rem"
    letterSpacing: "0.06em"
rounded:
  xs: "3px"
  sm: "5px"
  md: "7px"
  lg: "10px"
  xl: "14px"
  full: "9999px"
spacing:
  hair: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "32px"
components:
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "16px 20px 20px"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "32px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "32px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-2}"
  button-ghost:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "32px"
  button-ghost-hover:
    backgroundColor: "{colors.surface-sunk}"
    textColor: "{colors.ink}"
  button-tint:
    backgroundColor: "{colors.accent-tint}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.md}"
    height: "32px"
  button-tint-hover:
    backgroundColor: "{colors.cobalt-200}"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "32px"
  segmented-track:
    backgroundColor: "{colors.surface-sunk}"
    rounded: "{rounded.md}"
    padding: "3px"
  segmented-option:
    textColor: "{colors.ink-3}"
    typography: "{typography.segment}"
    rounded: "{rounded.sm}"
    padding: "0 14px"
    height: "28px"
  segmented-option-active:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.accent-ink}"
  nav-item:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "40px"
  nav-item-active:
    backgroundColor: "{colors.accent-tint}"
    textColor: "{colors.accent-ink}"
  badge-pos:
    backgroundColor: "{colors.teal-tint}"
    textColor: "{colors.teal-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 8px"
    height: "22px"
  badge-neg:
    backgroundColor: "{colors.coral-tint}"
    textColor: "{colors.coral-ink}"
    rounded: "{rounded.sm}"
    height: "22px"
  badge-warn:
    backgroundColor: "{colors.amber-tint}"
    textColor: "{colors.amber-ink}"
    rounded: "{rounded.sm}"
    height: "22px"
  chip:
    typography: "{typography.micro}"
    rounded: "{rounded.xs}"
    padding: "1px 6px"
  kpi-cell:
    backgroundColor: "{colors.surface}"
    typography: "{typography.figure}"
    padding: "16px 20px"
  tooltip:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "6px 10px"
---

# Design System: Control Center

## Overview

**Creative North Star: "The Capital Control Room, in Daylight"**

Control Center is an Owner-side instrument for following a capital dollar, and the visual system exists to make one number unmistakable inside a dense screen. The world was pinned by the user's reference captures, not invented: a light, airy analytics dashboard with white panels floating on a pale blue-white canvas, cobalt as the primary data ink, and a small categorical family (navy, sky, teal, amber, coral) that carries the data. Every token was pixel-sampled from those captures. Where a sampled value has to carry text, it was darkened only as far as WCAG 2.2 AA requires, and the data fills keep the sampled hue.

The density is high but calm. Hierarchy comes from weight, size, and cobalt figures, not from boxes, rules, or saturated chrome. The chrome stays neutral and cool so the data colors are the only saturated thing on screen. Panels are borderless white planes with a whisper of shadow. Inside a panel, structure comes from titles and hairlines, never from another bordered box. The signature device is the narrative sentence: plain language that states the exposure, with the figures set in bold cobalt, coral, or teal, so an executive can read the status before touching a chart.

The system is light-only because of where it is used (desk reviews on large monitors, laptops in the field). Accessibility is part of the token layer, not an afterthought: high contrast and text scale are `<html>` data attributes that rewrite the semantic tokens before first paint, and status is never carried by color alone. It rejects the contractor-side PM tool look: RFI/submittal-first layouts and gray enterprise grids.

**Key Characteristics:**
- White borderless panels (10px radius, two-layer whisper shadow) on a pale blue-white canvas.
- Cobalt as data ink; a darker cobalt for anything interactive or text-bearing.
- Figtree at every level, with tabular figures on every number.
- The narrative sentence with bold colored figures is the signature.
- Uppercase text appears only in segmented toggles.
- Tailwind's default palette is cleared, so project tokens are the only colors that exist.

## Colors

A cool, near-white neutral field with one saturated voice (cobalt) and a categorical data family sampled from the reference. Every text-bearing role has a darker sibling measured to AA.

### Primary
- **Reference Cobalt** (#3681e6): the sampled brand hue, used as a data fill for bars, map pins, series 2, and progress. Never used for text or small interactive glyphs.
- **Working Cobalt** (#2468cc): the interactive accent for primary buttons, links, focus outlines, switch-on, and active tab underlines. White text on it measures 5.35:1.
- **Deep Cobalt** (#184a94): hover state for the accent.
- **Cobalt Ink** (#1f5bb3): text and icons that sit on a cobalt tint (active nav, selected segment, accent badges, narrative figures). Measures 5.4:1 on the tint.
- **Cobalt Tint** (#e3effc) / **Cobalt Wash** (#eef5fe): the active nav pill and selected list rows (tint), and hover or selected table rows (wash).
- **Cobalt Mist** (#c6dcf8): text selection and the tint-button hover.

### Secondary
- **Ledger Navy** (#334293): series 1, the strongest data ink. Used for "original budget" and "unpaid commitments," and as a solid avatar fill.
- **Forecast Sky** (#4dbaf6): series 3, which reads as forecast or projected. Also the info tone, with the sky tint (#e2f3fd) as its badge ground.

### Tertiary
- **Settled Teal** (#00c6a2): positive, won, paid, or complete. The text sibling is Teal Ink (#03735e, 4.7:1 on its tint), and the badge ground is Teal Tint (#dcf6f0).
- **Overrun Coral** (#ff6666): negative, lost, overrun, or at risk. The text sibling is Coral Ink (#c2303a, 4.9:1 on its tint), and the badge ground is Coral Tint (#ffe9e8).
- **Caution Amber** (#ffcf7a): target, caution, pending, or low occupancy. The text sibling is Amber Ink (#8a5700, 5.5:1 on its tint), and the badge ground is Amber Tint (#fff3dc).
- **Categorical extensions**: Land Orange (#ffa35f, series 6), Specialty Pink (#f55488, series 7, data centers), Other Slate (#899bb3, series 8, "other" and neutral dots, field hover border), and Reserve Purple (#9a6fd0, the ninth Level 1 classification, Owner's Reserve). The build's series order is navy, cobalt, sky, teal, amber, orange, pink, slate. Level 1 budget classifications map onto series 1–8 in that order, with purple as the ninth.

### Neutral
- **Daylight Canvas** (#f6f9fd): the page ground behind every panel.
- **Panel White** (#ffffff): panels, sidebar, top bar, drawers, dialogs.
- **Second Layer** (#f9fbfe): table heads, inset wells, the omnibox at rest, hover on light list rows.
- **Sunk Track** (#f1f5fa): segmented-control track, meter track, ghost-button hover, the neutral badge.
- **Ink** (#121a2c): titles and numbers (17:1).
- **Ink 2** (#566077): secondary text (6.1:1).
- **Ink 3** (#5f6980): metadata, column heads, KPI labels, placeholders (5.5:1 on white, 4.7:1 on the cobalt tint).
- **Ink 4** (#848ea2): disabled glyphs, zero-dashes, and separators only. It is non-essential at 3.3:1 and never used for text a user must read.
- **Hairlines**: Line Strong (#d5dde8) for field borders and table foot rules, Line (#e6ecf3) for header rules, drawer and dialog edges, and chart grids, and Line Soft (#eff3f8) for row rules and KPI cell dividers.

### Named Rules
**The Two Cobalts Rule.** Reference Cobalt fills data. Working Cobalt and Cobalt Ink carry text and interaction. A cobalt that a user has to read or click is never the sampled #3681e6.

**The Closed Palette Rule.** Tailwind's default palette is cleared (`--color-*: initial`). A color that is not a project token cannot be written. New hues enter through `tokens.css` or not at all.

**The Text Plus Color Rule.** Status is always a word plus a color: a badge with a dot and a label, "project at risk" beside a ringed pin, parenthesized negatives beside a coral bar. Color alone never carries meaning.

## Typography

**Display Font:** Figtree (with Segoe UI, system-ui fallback)
**Body Font:** Figtree
**Label/Mono Font:** Figtree. Numbers use the tabular-figure feature (`tnum`) rather than a mono face.

**Character:** A single friendly geometric sans with open apertures, set tight at the top and in semibold for structure. The tabular figures make columns of money line up like a ledger.

### Hierarchy
- **Figure** (600, 1.625rem/2.25rem, -0.02em, tabular): the KPI strip value and other single headline numbers. The largest type on most screens is a number, not a heading.
- **Headline** (600, 1.5rem/1.95rem, -0.015em): the page title (h1), one per page.
- **Title** (600, 1.0625rem/1.5rem, -0.01em): section titles between panel groups, and dialog titles.
- **Narrative** (400, 1.0625rem/2rem, max 68ch, pretty wrap): the signature sentence. Figures inside it are set in bold 700.
- **Panel Title** (600, 0.9375rem/1.35rem, -0.005em): every panel header, optionally followed by an info tip.
- **Body** (400, 0.8125rem/1.2rem): the document default, table cells, and list rows. Row names step up to 600.
- **Label** (400–600, 0.75rem/1.05rem): metadata lines, KPI labels, fact labels, and badge text.
- **Micro** (600–700, 0.6875rem/1rem): table column heads, legends, chips, in-bar figures, and kbd hints.
- **Segment** (700, 0.6875rem, 0.06em tracking, uppercase): segmented-control options only.

The scale is fixed in rem at a ratio of about 1.125–1.2. `<html>` font-size is `100% × --text-scale`, so the text-size control (90 / 100 / 112.5 / 125%) scales type and rem-based spacing together.

### Named Rules
**The Tabular Rule.** Every number that can sit beside another number uses tabular figures, whether in a table cell, KPI, chip, bar label, or narrative figure.

**The Metadata Below Rule.** Metadata sits under its heading as a smaller Ink 3 line ("14 properties across the Puget Sound region · as of Sep 14, 2026"), never above it. Nothing labels a heading from above.

**The One Uppercase Rule.** Uppercase with tracking is reserved for segmented-control options, as the reference shows ("N. OF DEAL | VALUE"). Headings, labels, and column heads stay in sentence case.

## Layout

The shell is a CSS grid with a fixed top bar (3.25rem, 52px) above a sidebar column and the main scroll area. The sidebar is 14.5rem (232px) expanded and collapses to a 4rem (64px) icon rail (Ctrl/Cmd+B). The width lives on `<html>` so the state is painted before hydration, and labels fade rather than reflow while the rail animates. From 640–767px the rail is forced. Below 640px the sidebar leaves the grid and opens as an overlay from the top-bar menu button.

Main content is centered at a max width of 110rem with 16 / 24 / 32px side padding (phone / tablet / desktop), 24px top, and 48px bottom. A page reads top to bottom: page header (title, metadata line, actions right-aligned), then a KPI strip or narrative panel, then panel grids.

The rhythm is 20px. That value sets the gaps between panels, the space after the page header and KPI strip, and the horizontal padding inside panels. Section titles open with 32px above and 12px below. Panel grids go from 1 column to 2 at `md` to 3 at `xl`, and asymmetric splits use fractional tracks (for example 7fr / 5fr). Table cells pad 10px by 12px, and compact tables drop to about 7px vertically.

The right drawer is 30rem (480px), clamped to the viewport. It is non-modal by default so the map or grid behind stays usable, and a modal variant exists for focused sheets.

**The Scroll Edge Rule.** Every horizontal scroller (tables, tab rows, route tabs) shows an edge shadow only while content hides past that edge. The shadow is built from local and scroll background layers, and the ground color is inherited from the container.

## Elevation & Depth

The system uses a hybrid of tonal layering and very soft shadow. The canvas is the lowest plane and panels float on it with a two-layer shadow you notice only as separation. Popovers, drawers, dialogs, and toasts use a deeper overlay shadow. Inside a panel there is no elevation at all, only hairlines and the sunk and second-layer neutrals. In high-contrast mode, panels also gain a visible 1px border.

### Shadow Vocabulary
- **Panel** (`box-shadow: 0 1px 2px rgb(18 32 64 / 0.04), 0 6px 20px -8px rgb(18 32 64 / 0.08)`): every panel and the KPI strip. Paired with a 1px Line Soft border that is invisible at standard contrast.
- **Raised** (`box-shadow: 0 2px 4px rgb(18 32 64 / 0.05), 0 12px 28px -10px rgb(18 32 64 / 0.16)`): tooltips, chart tooltips, map pin labels.
- **Overlay** (`box-shadow: 0 4px 10px rgb(18 32 64 / 0.06), 0 24px 60px -12px rgb(18 32 64 / 0.28)`): popovers, drawers, dialogs, toasts, the mobile nav sheet.
- **Thumb** (`box-shadow: 0 1px 2px rgb(18 32 64 / 0.1), 0 1px 1px rgb(18 32 64 / 0.04)`): the segmented thumb, switch knob, primary button, and map control group.

### Named Rules
**The Whisper Rule.** Shadows are tinted navy-black at low alpha and have negative spread. If a shadow reads as a shape of its own, it is too strong.

**The No Nested Boxes Rule.** A panel never contains another bordered or shadowed box. Subsections inside a panel use a small title plus a hairline (`border-t` Line), and panels are never nested.

## Shapes

The corners are softly rounded, and the radius grows with the size of the surface: bar ends at 3px, chips and segmented thumbs at 5px, controls, buttons, nav pills, and fields at 7px, panels at 10px, and drawers and dialogs at 14px. Dots, avatars, switches, and meters are fully round. Borders are 1px hairlines in the cool neutral family. They appear on fields, secondary buttons, and overlay edges, never on panels at standard contrast. Data bars are flat, saturated rectangles with 3px corners, and the figure is printed inside the bar when there is room.

## Components

### Buttons
Compact and quiet. Weight and color carry them, not size.
- **Shape:** gently rounded (7px), 32px tall (28px small), semibold body text, 6px icon gap.
- **Primary:** Working Cobalt fill, white text, thumb shadow. Hover goes to Deep Cobalt, and disabled goes to Ink 4.
- **Secondary (default):** white with a Line Strong border and Ink text. Hover shifts the border to slate and the ground to the second layer.
- **Ghost:** Ink 2 text, no ground. Hover sets the sunk ground and Ink text. Used for icon buttons in the top bar and panel headers.
- **Tint:** Cobalt Tint ground with Cobalt Ink text. Hover goes to Cobalt Mist. Used for low-emphasis actions such as export.
- **Danger:** white with Coral Ink text. Hover sets the coral tint.
- **Focus:** a 2px Working Cobalt outline, offset 2px. High contrast uses a 3px deep-navy outline.

### Segmented Control
The reference's toggle. Used for view switches (count or value, standard or high contrast).
- **Style:** a sunk track with 3px padding and a 7px radius. Options use Segment type (bold, uppercase, 0.06em tracking).
- **State:** the selected option sits on a white 5px thumb with the thumb shadow and Cobalt Ink text. Unselected options are Ink 3, and hover goes to Ink. Arrow keys, Home, and End move the selection (radio-group semantics).

### Chips and Badges
- **Badge:** 22px tall, 5px radius, 12px semibold text, a 6px tone dot, and a tone-tint ground with tone-ink text (pos, warn, neg, info, accent, neutral). The dot never stands in for the word.
- **Chip:** a tight 3px-radius delta marker (for example "+0.2%") in bold micro tabular type, using the same tint and ink pairs.

### Cards / Containers (Panel)
- **Corner Style:** 10px.
- **Background:** Panel White on the canvas.
- **Shadow Strategy:** the Panel shadow (see Elevation & Depth).
- **Border:** a 1px Line Soft border at standard contrast, which becomes visible in high-contrast mode.
- **Internal Padding:** a header with a 56px minimum height (16px top, 12px bottom, 20px sides) holds the Panel Title, an optional info tip, and actions on the right. The body pads 20px. Flush panels drop the body padding for tables and maps and use a Line Soft top rule instead.

### Inputs / Fields
- **Style:** 32px tall, white, a 1px Line Strong border, 7px radius, 10px horizontal padding, body text, and an Ink 3 placeholder. Selects use a custom chevron.
- **Focus:** the border turns Working Cobalt and gains a 3px Cobalt Tint halo. Hover shifts the border to slate.
- **Error:** a Coral Ink border with a 3px Coral Tint halo (`aria-invalid`).

### Navigation
- **Sidebar item:** 40px tall with a 7px radius, a semibold body label, and an 18px line icon. At rest it is Ink 2 with an Ink 3 icon, and hover sets the sunk ground. Active is the Cobalt Tint pill with Cobalt Ink text and a heavier icon stroke. Items outside the user's role stay visible at 45% opacity with a spoken reason. In the collapsed rail, labels fade and tooltips appear on the right.
- **Tabs (route and in-page):** 40px tall with semibold body text on a 1px Line base rule. The active tab is Cobalt Ink with a 3px Working Cobalt underline that has a rounded top.
- **Top bar:** 52px and white, with the org mark, an environment switcher (a small bordered pill with a status dot), a centered omnibox (max 34rem, second-layer ground, Ctrl/Cmd+K hint), and ghost icon buttons for accessibility, resources, and notifications, plus the account.

### KPI Strip (Signature)
One panel, not a row of cards. It has 2, 3, or 5 cells separated by Line Soft hairlines, each padded 16px by 20px. Every cell stacks a Label line in Ink 3 led by an 8px series dot, the Figure value, and an optional Label-size sub line in Ink 2.

### Narrative Sentence (Signature)
A plain-language sentence at Narrative size inside its own panel, directly under the KPI strip or page header. Figures are bold tabular text in Cobalt Ink (neutral quantities), Coral Ink (exposure, overruns, late), or Teal Ink (under budget, on track). It states the exposure first. It is not a caption and it is never decorative.

### Data Bar
A flat, saturated bar with 3px corners that grows from the left over 320ms (ease-out). When the bar is wider than about 28% of its track, the figure is printed inside it in bold micro type. Otherwise the figure sits beside the bar in Ink 2. Light fills (amber, sky, teal) take Ink figures. Every bar in a group shares one scale. Meters are 8px, fully round, stacked segments on the sunk track.

### Tooltips, Overlays, Toasts
Tooltips are Ink ground with white Label text, a 7px radius, and the raised shadow. They open after a 120ms delay, on hover or keyboard focus, into a portal. Popovers are white, 10px radius, with a Line border and the overlay shadow, and a pop-in (translate -4px, scale 0.985). Dialogs use native `<dialog>` with a 14px radius and a navy-black 28% backdrop. Toasts are an Ink pill in the bottom-right corner in one polite live region.

## Do's and Don'ts

### Do:
- **Do** build every surface as white 10px panels with the Panel shadow on the Daylight Canvas, spaced 20px apart.
- **Do** use Reference Cobalt (#3681e6) for data fills and Working Cobalt (#2468cc) or Cobalt Ink (#1f5bb3) for anything a user reads or clicks.
- **Do** put a text-bearing ink sibling on every tinted status ground (teal, coral, and amber inks on their tints). Keep every such pair at 4.5:1 or better.
- **Do** set every figure in tabular numerals, and make the most important number on a screen the largest type on it.
- **Do** lead exposure-driven pages with the narrative sentence, with bold figures in Cobalt, Coral, or Teal Ink.
- **Do** render KPI groups as one KPI strip panel with hairline-separated cells and an 8px series dot.
- **Do** put metadata beneath headings as a smaller Ink 3 line.
- **Do** pair every status color with a word, whether in a badge label, a "project at risk" note, or a parenthesized negative.
- **Do** give every horizontal scroller scroll-edge shadows.
- **Do** read every size and color from tokens, so the high-contrast and text-scale attributes on `<html>` keep working.

### Don't:
- **Don't** nest a bordered or shadowed box inside a panel. Use a small title and a hairline.
- **Don't** write a color outside `tokens.css`. The Tailwind default palette does not exist here.
- **Don't** set text in Reference Cobalt or in the raw series fills. Use the ink siblings.
- **Don't** print white figures inside a Reference Cobalt bar at micro size. White on #3681e6 measures about 3.9:1, below AA for 11–12px text. Put in-bar figures on Navy or Working Cobalt fills, or print them beside the bar.
- **Don't** use uppercase or letter-spaced labels anywhere except segmented options, and don't place a label line above a heading.
- **Don't** use Ink 4 for text a user must read. It is for disabled glyphs and zero-dashes.
- **Don't** add a dark theme. The system is light-only by design.
- **Don't** build the contractor-side PM look: RFI/submittal-first layouts, gray enterprise grids, dense bordered tables inside bordered cards.
