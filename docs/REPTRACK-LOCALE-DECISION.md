# RepTrack locale decision

- UI language: English (`<html lang="en">`).
- Dates, times, and numbers: device locale via `toLocaleDateString(undefined, …)` / `toLocaleString(undefined, …)`.
- Durations remain `M:SS` or `H:MM:SS` and are locale-independent.
- Relative labels use English UI copy until full localization is implemented.

This avoids the previous mixed state where English controls were announced as English while dates were forcibly formatted as Dutch.
