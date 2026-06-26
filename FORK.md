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

- Version scheme: **`<upstream-base>-core-one.N`** (in `package.json`) — currently
  **`2.18.0-core-one.N`**. Base = the upstream minor we last merged (bump it on each upstream
  merge, reset N to 1); label `core-one`; increment **N** per release between merges. Moonraker's web updater resolves the
  newest release via GitHub's **`latest` pointer** (NOT semver max) — confirmed live — so the
  `latest` flag is what matters: always `gh release ... --latest`, never `--prerelease`. The build
  stamps `release_info.json.version = "v" + package.json version`, which **must equal** the git tag.
  (History: releases `v2.17.0-softabort.1..7` predate the label rename; `core-one` going forward.)
- Cut a release:
  ```
  # edit package.json version -> 2.17.0-core-one.<N>
  npm ci && npm run build                      # -> dist/mainsail.zip (+ release_info.json)
  git commit -am "..." && git tag v2.18.0-core-one.<N> && git push origin <branch> --tags
  gh release create v2.18.0-core-one.<N> --repo packerlschupfer/mainsail --latest \
      --title "v2.18.0-core-one.<N>" --notes "<description here>" dist/mainsail.zip
  ```
  - asset MUST be named `mainsail.zip`.
  - **Release title/name MUST equal the tag** (`v2.18.0-core-one.<N>`) — Moonraker's web updater
    reads the GitHub release **name** as `remote_version` and compares it byte-for-byte to the
    deployed `release_info.json` version. A descriptive title (e.g. `"… — merge upstream"`) makes
    them unequal → Mainsail's Update Manager shows **UNKNOWN** (benign but wrong). Put any
    description in `--notes` (the body), never the title.

## Deploy (Moonraker update_manager → the fork)

`[update_manager mainsail]` is configured for `repo: packerlschupfer/mainsail`, `channel: stable`,
type `web` (Host chat owns moonraker.conf). To deploy a new release:
```
curl -X POST ".../machine/update/refresh?name=mainsail"   # pick up the new release
curl -X POST ".../machine/update/client?name=mainsail"     # download+extract mainsail.zip
```
or click **Update** in Mainsail's Update Manager. Moonraker **refuses updates while printing**
(503 "Klippy is printing") — deploy when idle. `rollback_version` is tracked (reversible).

## Maintenance

- **Rebase on `upstream/develop` periodically** — drifts fast (was 26 commits behind within a week).
  Expected conflicts are limited to `package.json` (version), `src/locales/en.json`, `vite.config.ts`.
  Our added panels are separate files and don't conflict.
- After a rebase: rebuild, bump version, cut a new release, redeploy, re-verify (browser sweep:
  Soft Abort, Build Sheet, Fans max/min, ASA preset, viewer/heightmap).
- Node engine: `^20.19.0 || >=22.12.0`.
