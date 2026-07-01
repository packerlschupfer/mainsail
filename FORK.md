# Mainsail — Prusa Core One (Klipper) fork

Custom build of Mainsail for a Prusa Core One running Klipper, maintained by
**packerlschupfer**. This file documents what diverges from upstream so the fork stays
maintainable.

- **upstream:** `mainsail-crew/mainsail` (base branch `develop`)
- **origin:** `packerlschupfer/mainsail`
- **working branch:** `core-one`

## What this fork adds / changes (vs upstream)

| Area | File(s) | What |
|------|---------|------|
| Soft Abort button | `src/components/TheTopbar.vue` | Topbar button (beside E-Stop, `warning`) emitting `machine.soft_abort` over the socket — out-of-band graceful abort (interrupts blocking PRINT_START heat/soak/mesh). Not a gcode macro. |
| Build Sheet panel | `src/components/panels/BuildSheetPanel.vue` | Data-driven panel for the FW `[sheets]` extra (`printer.sheets`): button per sheet → `SET_SHEET NAME=`, active highlighted w/ Z offset, `SHEET_SAVE_Z`. |
| Fans panel | `src/components/panels/FansPanel.vue` | All fans in one card (reuses `MiscellaneousSlider`); chamber `temperature_fan` gets Max/Min cap sliders driving `CHAMBER_FAN MAX=/MIN=` (reads `maxspeed`/`minspeed` vars). Min slider appears only once `minspeed` exists. Bounds enforce min≤max. |
| Print Mode panel | `src/components/panels/SafePrintPanel.vue` | Live ON/OFF switch for the FW `SAFE_PRINT_MODE` toggle (reads `save_variables.variables.safe_print_mode`, emits `SAFE_PRINT_MODE VALUE=1/0`). ON forces `PHASE_STEP=0 OFFBED=0` on every PRINT_START. Gated on the save_variable existing. |
| Misc panel de-dupe | `src/components/panels/MiscellaneousPanel.vue` | Filters fan types out of the Miscellaneous panel (fans now live in the Fans panel). |
| Panel registration | `src/store/variables.ts`, `src/pages/Dashboard.vue`, `src/components/mixins/dashboard.ts`, `src/store/gui/getters.ts`, `src/locales/en.json` | `build-sheet` + `fans` + `safe-print` registered in `allDashboardPanels`, mapped in Dashboard.vue, icons in dashboard mixin, gated in `getAllPossiblePanels`, i18n strings. |
| Fan input fix | `src/components/inputs/MiscellaneousSlider.vue` | Commit the fan/output % text-input on blur instead of discarding it (was leaving a fan stuck at its last `M106`). **Also submitted upstream** — PR #2554 / issue #2555. |
| PWA update mode | `vite.config.ts`, `src/components/TheServiceWorker.vue` | `registerType: 'prompt'` (was `autoUpdate`) so the old SW serves the full old app until the user clicks Update → clean reload (fixes stale-cache "viewer/heightmap won't open" after a deploy). +60s `registration.update()` poll. |
| Release identity | `src/plugins/build-release_info.ts` | `project_owner: 'packerlschupfer'` — **required**: Moonraker's web updater treats `release_info.json` owner as authoritative and overrides the configured `repo:`. Without it update_manager tracks upstream and would clobber this build. |

> Not in this repo: macro grouping/ordering, `hiddenMacros`, and the **ASA temperature preset**
> are Mainsail *runtime* config stored in the Moonraker `mainsail` DB namespace (not fork code).
> Backups live in `~/Documents/ai/mainsail/backups/`.

## Versioning & release

**Policy (2026-06-28, user directive): ROLLING `v2.18.0-core-one.1`.** Keep the version string
**fixed** at `2.18.0-core-one.1` and **force-move** the tag + release forward as work accumulates —
do NOT increment N per feature. Bump the string ONLY when the upstream base changes (next upstream
merge → `2.19.0-core-one.1`, etc.). Rationale: mirrors the FW firmware fork's single rolling
`core-one.1` label. Trade-off (accepted): the Moonraker web updater compares the deployed
`release_info.json` version string to the release **name** for *equality*, so a same-string
force-move is NOT auto-detected — it always reads UP-TO-DATE even when stale. **Therefore deploy is
MANUAL** (see below), not via the update button. The build still stamps
`release_info.json.version = "v" + package.json version`, and the release **title/name MUST equal the
tag** (`v2.18.0-core-one.1`) so that once manually deployed the badge reads UP-TO-DATE, not UNKNOWN.
(History: `v2.17.0-softabort.1..7` predate the rename; `v2.18.0-core-one.2` (Safe Print) was folded
back into the rolling `.1` and retired.)

- Cut/refresh the rolling release (force-move):
  ```
  # package.json version STAYS 2.18.0-core-one.1
  npm ci && npm run build                       # -> dist/mainsail.zip (+ release_info.json)
  git commit -am "..."
  git tag -f v2.18.0-core-one.1 && git push -f origin core-one --tags
  gh release edit v2.18.0-core-one.1 --repo packerlschupfer/mainsail --title "v2.18.0-core-one.1"
  gh release upload v2.18.0-core-one.1 --repo packerlschupfer/mainsail --clobber dist/mainsail.zip
  ```
  - asset MUST be named `mainsail.zip`; keep the release `--latest`, never `--prerelease`.
  - title == tag (see rationale above).

## Deploy (MANUAL — rolling-version consequence)

`[update_manager mainsail]` is `type: web`, `repo: packerlschupfer/mainsail`, `channel: stable`
(Host chat owns moonraker.conf). Because the rolling version string never changes, the web updater
will NOT offer the update (it reads deployed == remote → UP-TO-DATE). Deploy the new `mainsail.zip`
**manually** (operator / Host chat) — e.g. extract the release asset over the served mainsail path,
or force a re-pull. Moonraker still **refuses updates while printing** — deploy when idle.

## Maintenance

- **Rebase on `upstream/develop` periodically** — drifts fast (was 26 commits behind within a week).
  Expected conflicts are limited to `package.json` (version), `src/locales/en.json`, `vite.config.ts`.
  Our added panels are separate files and don't conflict.
- After a rebase: rebuild, bump version, cut a new release, redeploy, re-verify (browser sweep:
  Soft Abort, Build Sheet, Fans max/min, ASA preset, viewer/heightmap).
- Node engine: `^20.19.0 || >=22.12.0`.
