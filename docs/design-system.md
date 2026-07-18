# RepTrack Gym Floor design system

RepTrack uses one dark, graphite theme: calm neutral surfaces until a state earns color. The canonical tokens live in `src/index.css`; component styles must consume those tokens instead of introducing hard-coded colors.

## Color and state

- `bg-0` is the app canvas; `bg-1` is a card or row; `bg-2` is an elevated sheet or input; `bg-3` is pressed or selected neutral UI.
- `ink-hi`, `ink-mid`, and `ink-low` are the primary, secondary, and metadata hierarchy.
- `go` means action, completion, progress, or synchronized. `rest` means rest, offline, or attention. `danger` means regression, failure, or destruction. `record` is reserved for personal records.
- Filled signal controls use `ink-on-accent`; long-lived signal states use the corresponding dim fill and high-contrast text.

## Component inventory

- Primary button: 52px high, green fill, dark label. Secondary: 48px high, raised graphite with strong border. Danger: terracotta fill, only inside confirmation UI. Quiet: text treatment with a 44px target.
- Input: 48px high, raised graphite, 1.5px strong border, 16px minimum value text. Numeric values use tabular figures and the appropriate mobile input mode.
- Card: `bg-1`, 16px radius and one-pixel hairline. Navigating rows are at least 56px; active-workout rows are at least 64px.
- Sheet/modal: `bg-2`, 20px top radius, 92dvh/720px maximum height, scrim and safe-area padding. It exposes dialog semantics.
- Badge/chip: full radius, 11–13px label, dim semantic fill plus outline so state is not expressed by color alone.
- Timer: tabular numerals, rest outline, and a pulse no faster than 1Hz. Reduced-motion mode removes the pulse.

All interactive elements are at least 44×44px (48px for workout actions), show the global two-pixel `focus-visible` ring, retain layout when disabled, and use instant state changes under `prefers-reduced-motion`.

## Static PRD gate

`docs/contracts/prd-static-baseline.json` is intentionally empty. The PRD scanner must pass because source is clean, not because findings are allowlisted.

- Functional icons in JSX use local SVG components from `src/components/icons`, inherit `currentColor`, and are either labelled by surrounding text or hidden from assistive technology.
- Visual styling belongs in CSS classes and semantic tokens. Dynamic progress uses native `progress` elements instead of inline width styles.
- Legacy hex colors and gradients are limited to the canonical token declarations in `src/index.css`; component CSS consumes `--bg-*`, `--ink-*`, `--go`, `--rest`, `--danger`, `--record`, and `--focus`.
