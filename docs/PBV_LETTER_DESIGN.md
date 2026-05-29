# PBV Intro Letter — Design Reference

**Source of truth:** `components/PbvLetter.tsx`
**Rendered output:** `docs/2026_PBV_Intro-Letter_en.pdf`
**Globals:** `app/globals.css` (Libre Baskerville + Inter, `--primary: #1a2744` — note: PbvLetter overrides primary with a lighter navy `#2B2D6E`)

Use this when building new tenant-facing flyers/letters that should match the PBV intro letter's look.

---

## Color tokens (as used in PbvLetter)

| Role | Hex | Used for |
|---|---|---|
| Navy (primary) | `#2B2D6E` | H1, H2, language bar, name lockup, navy step circles, navy date pill text |
| Coral (accent) | `#E8734A` | H2 underline rule, urgent step circle, CTA banner, coral date pill text |
| Green (success) | `#27AE60` (circle), `#1B7340` (text) | Final step ("Assistance Begins"), green callout text |
| Amber (caution) | `#E8B44A` (left bar), `#7A5C1F` (text) | Eligibility / qualification callout |
| Ink (body) | `#333344` body, `#1A1A2E` step titles | All body copy |
| Muted | `#6B6B80` | Step descriptions, sub-labels, footer |
| Divider | `#D8D8E0` | Timeline rail, section breaks |
| Pill bg coral | `#FFF0EB` | Date pill background — urgent |
| Pill bg navy | `#EEF2F9` | Date pill background — normal |
| Pill bg green | `#E6F5EC` | Date pill background — complete; also green callout bg |
| Callout bg amber | `#FFF8ED` | Amber callout background |

**Semantic rule for step circles + date pills:**

- **Coral** = urgent / action needed (e.g. Pre-Application)
- **Navy** = normal in-progress step
- **Green** = completion / success state

---

## Typography

- **Serif:** Libre Baskerville (400, 700) — H1, H2 only
- **Sans:** Inter (400, 500, 600) — body, labels, UI

| Element | Family | Size | Weight | Line-height | Color |
|---|---|---|---|---|---|
| H1 | serif | 22px | 700 | 1.25 | navy `#2B2D6E` |
| H2 (section) | serif | 19px | 700 | — | navy `#2B2D6E` |
| Greeting / paragraphs | sans | 16px | 400 (greeting 600) | 1.55 | `#333344` |
| Step title | sans | 16px | 700 | — | `#1A1A2E` |
| Step description | sans | 14px | 400 | 1.5 | `#6B6B80` |
| Date pill | sans | 12px | 700 | — | (matches semantic) |
| Footer | sans | 14px | 400 | — | `#6B6B80` |

H2 sits above a **180×3px** rounded coral rule (`#E8734A`, 2px radius) — that's the "section anchor" pattern.

---

## Callout boxes

All callouts: `border-radius: 8px`, `padding: 16px 18px`, `margin: 18px 0`, `font-weight: 600`, `font-size: 16px`, `line-height: 1.5`.

| Type | Background | Text | Extra |
|---|---|---|---|
| Green (key benefit) | `#E6F5EC` | `#1B7340` | `text-align: center` |
| Amber (qualification) | `#FFF8ED` | `#7A5C1F` | `border-left: 4px solid #E8B44A` |
| Coral (CTA) | `#E8734A` | `#FFFFFF` | none — solid fill |

Order in the letter: green → amber → (timeline) → coral CTA. Each one earns its place; don't add a fourth color callout without a reason.

---

## Timeline component

Vertical rail of numbered steps with title + date pill on the right.

- Rail: `2px` wide, `#D8D8E0`, positioned at `left: 13px`, runs top-to-bottom
- Container: `padding-left: 36px`, so circle centers align with the rail
- Step circle: `26×26px`, `border-radius: 50%`, white bold number (12px / 700), positioned at `left: -36px`
- Step spacing: `padding-bottom: 24px` between items
- Title row: `display: flex; justify-content: space-between` — title left, date pill right, wraps on narrow screens
- Date pill: `3px 10px` padding, `10px` border-radius, `whiteSpace: nowrap`

---

## Layout

- **Max width:** `520px`, centered (`margin: 0 auto`), `padding: 0 20px`
- **Logo header:** centered, white background, max-width `200px`, padding `20px 20px 12px`
- **Sticky language bar:** navy background `#2B2D6E`, three equal-flex buttons, `min-height: 44px` (touch target), active button gets white bg + navy text + 6px radius
- **Pre-form divider:** `2px solid #D8D8E0` rule with `32px` top margin, followed by centered muted "↓ Pre-Application Form Below ↓" cue
- **Page background:** white (`#fff`)

The 520px max-width keeps lines readable on phones and forces a centered column when printed on Letter — same component renders for both web and PDF.

---

## What to keep when designing a new flyer in this family

1. **Same color semantics.** Coral = act now. Green = good news / done. Amber = read this carefully. Navy = normal/structural. Don't reassign.
2. **Two-typeface rule.** Serif for headings only. Everything else Inter.
3. **Callouts earn their spot.** One green (benefit), one amber (caveat), one coral (CTA) is the maximum density. Stacking four+ kills the hierarchy.
4. **Timeline is the workhorse.** When you have an ordered process, use this exact pattern (rail + colored circle + title + date pill). Don't reinvent.
5. **Trilingual built in.** Content keyed by `Language` ('en' | 'es' | 'pt'). New tenant-facing artifacts should ship all three from day one — see PbvLetter's `content` map for the pattern.

---

## What's NOT in this design (and why)

- **No drop shadows.** Flat blocks only.
- **No gradients.** Solid fills only — they print and photocopy cleanly.
- **No icons in the timeline.** Numbers carry the meaning; icons add noise.
- **No background images / textures.** Cream/textured backgrounds were tried for the pest flyer and rejected for B&W laser printing — see "Pest program tool review" Cowork session transcript for context.

---

_Last updated: 2026-05-28. If you change `PbvLetter.tsx`, update this file._
