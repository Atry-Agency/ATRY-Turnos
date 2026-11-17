# Mobile dialog layout follow-up

Local candidate after published 6db9627. No publication, remote writes, schema or permission changes.

## Corrections

- Shared React dialog headers reserve a fixed 44 px close control and allow titles to wrap without overlapping it. Sticky headers use top:0 rather than negative offsets.
- Mobile React overlays respect all four safe-area insets and the existing visualViewport height, including keyboard changes. The background remains dimmed; backdrop blur is removed on these mobile overlays to avoid compositing the panel with the background. This is a web-side mitigation, not certification of native iOS standalone rendering.
- Shared dialog checkbox visuals are bounded to 21 px while labels remain at least 44 px tall. Native semantics and keyboard behavior are retained.
- Staff service labels use an explicit wrapping span, so long names remain visible without pushing the checkbox out of alignment. Field values, service IDs and submission behavior are unchanged.
- Weekly intervals reserve the full shared button width on desktop. On mobile the two time fields occupy their own equal columns and removal occupies a separate row. This accommodates native 12-hour controls without overlap; no locale/timezone or saved hours are changed.
- Add/copy controls have readable compact labels and comfortable hit areas. The save footer remains visible inside the dialog.

## Verification

Production build and React suite passed. The release artifact retains exactly 17 IAtry tools (10 writes,7 reads), existing project and no Supabase requests.

`scripts/react/dialog-layout-browser.cjs`: Chrome/WebKit at 320,390,430,1440; native en-US 12-hour input rendering, title/close and interval non-overlap, 44 px controls, bounded checkboxes, long service names, light/dark system tokens, scrolling, add/copy state, keyboard viewport and visible save footer. Local disposable PostgreSQL only; zero write requests and no external traffic.

`scripts/react/premium-ux-browser.cjs`: existing ten-screen responsive/form regression, including UY/PA request payloads, validations and confirmations, with intercepted disposable local submissions only. No production records are used.

Screenshots are local test artifacts under /tmp/atry-{staff,week}-dialog-*.png. Native iPhone Home Screen rendering still needs the owner's device check; desktop WebKit is not a physical iPhone.

## Release validation follow-up
The remote full suite crossed UTC midnight onto 17 November: its demo visit fixture selected Sunday 22 November, a closed day, and then read a missing option. The existing test now advances Sunday to Monday; availability behavior is unchanged. Verified the demo offers zero options Sunday22 and32 options Monday23. No application or server business logic was changed.
