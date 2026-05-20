# Path 1 — iOS Native Scanner Enabled (2026-05-18)

> **Correction (2026-05-18 later in session):** I overstated the iOS upside. Removing `capture="environment"` does NOT directly surface "Scan Documents" in Safari's file-picker action sheet. The sheet shows Photo Library / Take Photo or Video / Choose Files. "Scan Documents" lives inside the iOS Files app, reached via Choose Files → ⋯ menu in the top-right → Scan Documents. That's 3 taps deep behind an icon most tenants will never find. Real-world impact of this change is therefore **smaller than originally described** — it removes the forced-camera behavior (tenants can now pick a previously-taken photo from Photo Library), but does not meaningfully expose Apple's scanner. The change is still net-positive and worth keeping, but the discoverability story for Apple's scanner is poor enough that PRD-45 now covers iOS too rather than deferring to Apple.

**One-line summary:** Dropped `capture="environment"` on iOS so the file-picker action sheet shows Photo Library + Take Photo + Choose Files instead of jumping straight to the camera. Android behavior unchanged.

## Why

Tenants take photos at angles → docs are illegible. iOS 16+ ships a free, native, live-preview document scanner (same engine as Apple Notes / VisionKit) that surfaces in any web file input — but only when the `capture` attribute is **absent**. The existing code forced `capture="environment"` on every "Take Photo" tap, which suppressed the scanner option entirely.

## Change

`components/DocumentScanner/DocumentScanner.tsx`

1. New helper `isIOSDevice()` (lines 62–73). Sniffs UA + iPadOS-as-Mac via `maxTouchPoints`.
2. `<input>` `capture` attribute (lines 412–423) is now conditional: `undefined` on iOS, `'environment'` on Android when the user explicitly tapped "Take Photo."

## Expected behavior

| Device | "Take Photo" button | "Choose File" button |
|---|---|---|
| iPhone / iPad (iOS 16+) | Action sheet → Photo Library / Take Photo / Choose File / **Scan Documents** | Same action sheet (today) |
| iPhone / iPad (iOS 15 or older) | Action sheet without Scan Documents | Same |
| Android | Camera opens directly (today's behavior) | File picker (today's behavior) |
| Desktop | File picker | File picker |

## What this fixes

- iPhone tenants who pick "Scan Documents" get live edge detection, auto-capture, perspective correction, multi-page bundling, and clean PDF output — for free, native, no SDK fee.
- Angled photos → dewarped automatically by Apple's pipeline.

## What this does NOT fix

- Android tenants. Stock Android file picker has no scanner option. Path 2 (custom jscanify live preview) or a commercial SDK still needed for Android parity.
- iPhone tenants who tap "Take Photo" from the action sheet instead of "Scan Documents" — they get the old raw-photo behavior. Could be addressed with copy update on the entry buttons in a follow-up ("Scan or take photo →").

## Risk

Low. UA sniffing is the only fragile bit; iPadOS-as-Mac is handled. If `isIOSDevice()` misfires, worst case = Android user gets action sheet instead of direct camera (one extra tap).

## Follow-ups (not done in this change)

- Update primary button copy from "Take Photo" → something like "Capture document" so tenants understand they may see a scanner option.
- Consider widening `accept` to include `application/pdf` so multi-page iOS scans return as a single PDF (current image-only accept forces per-page JPEGs). Needs investigation: confirm the jscanify pipeline gracefully no-ops on already-clean Apple-scanned JPEGs (it should, since it just runs `extractPaper` on whatever image arrives).
- Verify on a real iPhone before declaring shipped.

## Files touched

- `components/DocumentScanner/DocumentScanner.tsx` (+12 / -1 lines)
