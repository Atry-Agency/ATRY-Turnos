# Sidebar and notification controls — 2026-11-16

## Scope
Frontend only. Includes settings hierarchy, contextual field examples and lavender hover accent from 1c2d4f2 and 6c7ef3a. No changes to RPC, roles, tools, subscriptions, prices or notification preferences.

The native React sidebar now uses one interruptible selected surface, matching each panel's actual main background. Admin geometry uses its 16px gutter rather than the business panel's 18px gutter; this removes a measured 2px overhang. Desktop navigation retains sidebar scroll/focus. Mobile drawers retain their existing navigation and use no desktop corner wings. Dirty-form guards approve navigation before animation. Reduced motion bypasses travel and arrival animations. No navigation waits for an animation.

Notification switches use #4754E6 when checked, neutral #8691A6 when unchecked, a white thumb, visible keyboard focus and a distinct disabled opacity. Existing controlled values, labels, save handlers and payloads remain unchanged. This fixes an undefined legacy --theme-action variable losing to generic themed input styles.

## Verification
- TypeScript and production compilation passed.
- Complete React suite passed, including existing IAtry, role/plan, operation confirmation and administrative tests. All writes in that suite are fictitious local fixtures.
- Sidebar browser regression: Chrome/WebKit, business/admin, widths 390/900/1100/1440 (16 combinations), rapid retargeting, clean lifecycle, exact surface geometry, keyboard focus, mobile drawer behavior, reduced motion and unsaved-form guard. Zero UI writes.
- Notification controls: Chrome/WebKit at 390/1440, checked/off appearance, thumb position, label touch area, focus visibility, disabled semantics, no overflow. No saves or deliveries. WebKit's macOS tab preference skips checkboxes; its focus-visible check explicitly focuses the next checkbox after a keyboard event.
- Packaged release check passed; same existing 17 tools (10 writes, 7 reads), unchanged project and production gates. No remote database requests.
- Screenshots inspected locally; local integration banner belongs only to the fixture.

## Release / recovery
Previous production: d736300c4e94913dcfdd6f82e04d3dea50a2b8f9.
Publish and verify annotated rollback tag rollback/pre-sidebar-polish-20261116 before pushing the candidate to main. Existing Pages workflow performs build, React, IAtry consolidation and artifact checks. Verify workflow also executes root tests and dependency audit. To recover, dispatch Pages with source_ref set to that tag; no database rollback is needed.
