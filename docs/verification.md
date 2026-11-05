# Verification — revision 5.1

Date: 2026-11-05. This document supersedes the revision 5.0 verification report.

## What was actually tested

The exact new page markup, stylesheet and JavaScript were assembled into a
self-contained HTML reproduction. Playwright drove local Chromium against this
reproduction. It does **not** include the existing Astro layout, desk effects,
analytics, or production fonts. Therefore these are component/page tests, not a
full deployed-site acceptance result.

- Viewports: 320, 390, 768, 1024 and 1440 CSS px.
- No horizontal overflow in the document or visible page descendants.
- No uncaught JavaScript exceptions.
- 34 UI/content/contrast assertions passed: single h1; 12 visible source records;
  all four capability selectors; all four evidence views; keyboard arrows and
  End; decision logging; repeated decision prevention; returning a hypothesis;
  JSON export (source, computed counts 8/3/1, demo label, two user events);
  reset; light/dark themes; reduced motion; non-JavaScript content and native
  details; disabled controls without JavaScript; six text/background contrast
  combinations above 4.5:1.
- `node --check public/ai-workbench.js` passed.
- Desktop hero, mobile hero, evidence inspector and governance schematic were
  visually inspected.

## Not established by these checks

`npm run check` / `npm run build` were not rerun locally: this environment could
not resolve external package or Git hosts and did not contain the existing
Astro installation. A full-site build must be evaluated from the new commit's
Vercel / GitHub checks. Do not carry forward the previous commit's green checks.

The complete desk/perspective integration, production font rendering, Safari,
physical iOS/Android devices and screen-reader interaction are not verified by
this local run. No claim of enterprise authorization or audit implementation is
made: the explanatory demo has no backend, model, SQL server or external writes.

## Reproduce on a full checkout

1. Install the repository dependencies and run `npm run check` and `npm run build`.
2. Serve the generated site and check the five viewport widths above.
3. Verify the retained paper/desk experience and theme initialization.
4. Test the four mode buttons, keyboard evidence tabs, source link, approval,
   return, duplicate prevention, reset and JSON download.
5. Confirm export totals equal the 12 rendered records, with counts 8/3/1.
6. Reload with JavaScript disabled; all evidence sections must remain readable.
7. Verify focus indication, reduced motion, mobile tapping and absence of
   overlap/clipping with both themes.

The screenshots in `docs/previews/` belong to **revision 5.0** and are retained
only as historical references. They are not proof for the new design.
