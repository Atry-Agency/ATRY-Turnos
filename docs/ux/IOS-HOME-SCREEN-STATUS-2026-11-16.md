# Home Screen status area — local follow-up

Published UI update: e3944560cf82a9f84fceab94bd48dcb4e41a597b. Both GitHub workflows succeeded and production HTML/15 assets matched. Chrome/WebKit at 390/1440 verified distinct settings icons; no writes.

The reported screenshot shows a soft system-like fade across the top of toolbar controls. No filter or backdrop blur is applied to the business toolbar in the inspected CSS. Both entry HTML templates request the legacy `apple-mobile-web-app-status-bar-style=black-translucent` mode.

Local change: remove that one deprecated meta element from both native React and legacy entry templates, retaining web-app capability, viewport-fit=cover, manifest/standalone, all safe-area padding, toolbar layout and installation identity. No status-bar color hardcoding, fake notch padding, scroll/viewport hacks or changes to the actual application icon.

Sources checked 2026-11-16:
- https://bugs.webkit.org/show_bug.cgi?id=317153#c2 — WebKit recommends removing the deprecated black-translucent key and allowing automatic status color.
- https://bugs.webkit.org/show_bug.cgi?id=301994 — related Home Screen status/viewport regressions, including system frosted overlay reports. These reports do not establish the exact iOS version or cause on the owner's phone.
- https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariHTMLRef/Articles/MetaTags.html — archived distinction between default and translucent status areas.

The absence of the legacy meta is verifiable locally. Desktop Playwright WebKit does not render the actual iPhone Home Screen system chrome, so it cannot certify removal of the reported blur. Device verification remains necessary, and an existing installed shortcut may cache installation-time appearance. Do not clear account data or delete a user's installed app automatically. This follow-up is local and not part of the published e394456 release.

Local verification: compilation and packaged release check passed. Chrome/WebKit at widths 320/390/430 retained capability/viewport declarations, no deprecated status meta, toolbar without a CSS filter, >=44px visible toolbar targets, working drawer close and no horizontal overflow. External requests were blocked. Preview: http://127.0.0.1:3360/?demo=1&plan=2#/app/inicio (HTTP 200). These six browser checks do not emulate native iOS system blur.
