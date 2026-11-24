# Frontend design and interaction contract

The implemented interface uses a light editorial system: white surfaces, near-black text, restrained warm orange accents, square corners, and thin borders. This document describes the current implementation; the older installed design skill describes a dark theme that this application does not implement.

## Tokens and typography

- Colors live in `src/app/globals.css` and are exposed through `tailwind.config.ts`.
- `accent` is the accessible dark orange used for small text and links. `accent-art` preserves the lighter decorative orange. `warning`, `success`, and `danger` communicate decision states alongside text labels.
- Inter is the neutral body typeface; Playfair Display is used for editorial headings. Prefer rem sizes and the `caption`, `body`, and `title` utilities for new components.
- Borders remain thin; field boundaries use the stronger `input` token so controls remain identifiable.
- Corners remain square or 1–2px. Round shapes are reserved for small status dots and avatars.

## Shared primitives

- `ui/Button`: primary, secondary, and ghost variants; default, compact, and icon sizes; native props, ref forwarding, disabled and loading behavior. Default/icon targets are 2.75rem. Labels can wrap and increase button height.
- `ui/Alert`: error alerts and informational/success status messages. Keep announcements short.
- `ui/Dialog`: native modal dialog with an accessible name, background inertness, focus entry/containment/restoration, Escape handling, and scroll locking. Use its drawer variant for mobile navigation. Supply trigger and close refs where possible.
- `ui/DateTime`: semantic dates with exact UTC details and optional relative display. Distinguish source, upload, interaction, and generation dates.
- `.field-control`, `.field-label`, and `.text-link` provide consistent native-field and link presentation.

Every interactive element needs a visible keyboard focus indicator. Use persistent labels and connect errors/helper text to fields. Announce task state transitions and focus the result heading after replacing an input form.

## Layout and overflow

- The desktop sidebar is 256px wide, sticky, viewport-height, and independently scrollable when needed. The page itself uses one document scroller.
- Mobile/tablet navigation uses the modal drawer, with a 44px menu/close control and internal scrolling.
- Main content is capped at 1,200px. The dashboard illustration must appear only when there is sufficient content width for both columns.
- User-derived names, filenames, URLs, and generated text must wrap. Shrinking flex/grid children need `min-width: 0`.
- Named layer tokens are `--layer-sticky` and `--layer-modal`; native modal dialogs use the browser top layer.

## Task states and trust

- Inputs must identify exactly which source is being processed. Cancel or invalidate superseded requests.
- Retain the previous successful result during regeneration and clearly identify failure or cancellation.
- Confidential content is not saved to persistent browser storage automatically. Remembering a brief in session storage requires an explicit choice and includes a clear-copy action.
- Describe actual workspace sharing and persistence. Do not claim privacy, isolation, or sample-only data unless enforced.
- Retrieval similarity describes related text; it is not an investment-confidence score or a probability.

## Printing and motion

Normal printing preserves page content and hides application chrome. Brief-specific print rules activate only while a brief is open and reset its layout to a static, multipage document. Respect reduced-motion preferences and keep content visible before JavaScript runs.
