# Windsurf Prompt: PBV Landing Page

## Context

The `/pbv-preapp` route currently shows only the pre-application form. We need to add a letter/informational section ABOVE the form that explains the PBV program to tenants. This is the first thing they see when they click the SMS link.

These reference files are in the workspace. Read all three before starting:
- `./PBV_Landing_Page_PRD.md` — full product requirements
- `./VOICE_AND_VALUES.md` — tone and language principles  
- `./PBV_Landing_Content.html` — exact HTML content with inline styles for all three languages

## What to build

1. **Language toggle** — Three buttons (English | Español | Português) pinned at the top of the page or in a sticky mini-bar. Switching language swaps all letter content and form labels. Store selection in state (not localStorage). Default: English.

2. **Letter section** — Add a new component above the existing form that renders the informational content from `PBV_Landing_Content.html`. This is all the content between the language toggle and the form. It includes:
   - Title
   - Opening paragraphs
   - Green callout box (rent reduction)
   - Body paragraph ("not a waitlist")
   - Amber callout box ("apartment as a home" — this is the most important visual element)
   - "Application Process" section header with coral underline
   - 8-step vertical timeline with numbered circles, descriptions, and date pills
   - Coral CTA box pointing to the form below
   - Sign-off with contact info

3. **Keep the existing form** exactly as-is below the letter content. Just add a subtle divider or spacing between the letter and the form.

## Design specs

Mobile-first. Assume 375px viewport. All the visual styling is defined inline in `PBV_Landing_Content.html` — extract it into your component styles or Tailwind classes as appropriate for the codebase.

Key constraints:
- Body text minimum 16px (elderly users, prevents iOS zoom)
- Touch targets minimum 44px
- No images required — pure CSS design
- Color palette: navy #2B2D6E, coral #E8734A, green bg #E6F5EC / text #1B7340, amber bg #FFF8ED / border #E8B44A / text #7A5C1F, blue-light #EEF2F9, body #333344, light #6B6B80

## Timeline component

The timeline is the most complex visual element. Structure:
- Vertical gray line (#D8D8E0) connecting circles
- Numbered circles (10px radius): step 1 = coral, steps 2-7 = navy, step 8 = green (#27AE60)
- Step title (bold, 16px) on same baseline as date pill
- Date pill: rounded, small bold text. Step 1 = coral bg, step 8 = green bg, rest = light blue bg
- Description text below title in muted color, 14px

## Files to reference (all in workspace root)

- `./PBV_Landing_Page_PRD.md` — full product requirements
- `./PBV_Landing_Content.html` — exact HTML content with 