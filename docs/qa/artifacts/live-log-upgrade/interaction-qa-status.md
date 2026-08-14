# Live-log interaction QA status

| Scenario | 320×568 | 390×844 | 430×932 | Evidence/status |
|---|---|---|---|---|
| First open / set 1 incomplete | Pending | Pending | Pending | Automated positioning tests pass; direct app browser unavailable. |
| Reopen after completed rows | Pending | Pending | Pending | Automated row-3 anchor/context test passes. |
| All primary rows complete | Pending | Pending | Pending | Automated all-done fallback test passes. |
| Add/remove/Undo with live counts/colors | Pending | Pending | Pending | Modal and parent integration tests pass. |
| Best exact record | Pending | Pending | Pending | Production component/selector tests pass. |
| No record / blank reps | Pending | Pending | Pending | Production component tests pass. |
| Warm-up / dropset | Pending | Pending | Pending | Unit/component eligibility and numbering tests pass. |
| Overview → Log roundtrip | Pending | Pending | Pending | Component tests cover tab state and helper preservation. |
| Keyboard/focus | Pending | Pending | Pending | Focus non-theft test passes; real soft keyboard was not available. |
| Reduced motion | Pending | Pending | Pending | `matchMedia` reduced-motion positioning and CSS contracts pass. |

The three `mobile-structural-*.png` files are fresh headless-Chromium structural-fixture captures. They were inspected for sticky/footer overlap, clipping, overflow, contrast, and target sizing. They are not substituted for the pending direct-app interaction states above.

Electa QA pending. NOT MERGED. NOT DEPLOYED.
