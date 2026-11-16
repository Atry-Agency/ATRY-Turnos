# Registration: sector touch feedback and lightweight entry navigation

Local follow-up to published 11d0932. No backend, subscription, role or business-data changes.

The old transparent radio covered the complete rectangular label, while the visible rounded card could lift on hover. Sector choices now use a clipped 1px native radio and the full rounded label as the touch target. Tap highlight is disabled only within these choices. Hover no longer moves the visible surface away from the hit area. Native group semantics, checked values, keyboard arrow navigation, validation and a visible keyboard focus outline remain. Colors are now neutral violet for unselected icons, soft lavender for the selected surface and ATRY violet/deeper violet for the selected icon/text. Reduced motion disables the small color transitions.

Login and registration are ephemeral entry forms: navigating away no longer opens an unsaved-changes dialog or native unload warning solely because someone explored a sector or typed into the form. A pending submit still blocks navigation/unload. Other auth modes keep their previous guard, and operational-panel save confirmations/guards are untouched.

Verification: production compilation and release artifact checks; Chrome/WebKit at390 and1440, pointer/touch choice, keyboard focus/selection, exact selected form value across registration steps, direct register→login and login→register navigation without dialogs, unchanged pending-request guard using one intercepted local request per case, and reduced motion. All requests stay in disposable local fixtures; no actual login, registration, email or Supabase write is performed. The source of an iOS-only native highlight cannot be fully certified without the owner's device, but its rectangular native hit overlay and tap-highlight paint are removed from the implementation.

Preview remains http://127.0.0.1:3360/#/registro. No publication for this follow-up.
