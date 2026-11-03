# Moro

## Current product direction — supersedes palette-only planning

The user clarified that people must be able to **create Lottie animations**, not merely recolor existing files. The target is a no-login, local-first creator: new canvas → shapes/layers → property keyframes → preview → actual Lottie JSON export, plus editable project save/reopen. `docs/CREATOR-DIRECTION.ko.md` defines this next scope and its acceptance gates. The first shape-only creator slice is now implemented at `/create` and independently exercised; see `docs/creator/VALIDATION.ko.md` for exact evidence and unsupported features. The historical v0.1 timeline/keyframe exclusion below describes the shipped palette workbench only and must not prohibit the newly requested creator work.

Preserve the verified palette workbench as the existing import/recolor mode; do not discard it or relabel it as a complete creator. New creator acceptance must be tested independently.

## Implementation languages

The user selected **Rust instead of Python for new supporting implementations**: native/backend utilities, filesystem processing, validation helpers and batch tools. Keep the browser UI and existing TypeScript animation core in TypeScript; this is not a frontend rewrite or a requirement to duplicate working Node tooling in Rust. Do not add new Python project tooling. Hermes's existing external CPU resource guard is an operational safety dependency, not Moro product code; replacing or disabling it is outside this project change.

## Implemented baseline

Moro currently implements a local-first Lottie palette workbench for frontend developers and designers. Make motion yours: open a sample or JSON, replace static shape colors, compare the result and export JSON plus a React component.

## Approved direction

The user approved `brief/PRODUCT-UI-SPEC.ko.md` and `brief/design-tokens.json` for local implementation. These supersede the earlier Lottie Studio v0.2 editor direction. Legacy code and the prior skill are preserved in `.local-backups/lottie-studio-v0.2.0.zip`.

- Platform: responsive web, React + TypeScript + Vite, locally served at 127.0.0.1:4173.
- Surfaces: `/` Operate workbench, `/docs` Read documentation.
- Framed sheet: quiet teal-gray L-shaped frame, white workspace, generous preview, precise color mappings.
- English by default, Korean selectable; language preference alone is stored locally.
- Account-free, no upload service, no analytics, fonts/player self-hosted. Edits remain in browser memory until export.
- Two original showcase samples: Parcel dispatch and Payment approved; three essential samples remain available: Orbit loader, Success check, Reaction burst.
- Lagoon, Ember and Ink presets remap source tones deterministically in one undo transaction; individual colors remain editable.
- Preserve original bytes and unknown JSON fields. Only exact-grouped static fill/stroke RGB properties change. Alpha, opacity, gradients and animated colors remain untouched.
- Compare uses one shared frame clock. Playback options are wrapper behavior, separate from JSON edits.
- Expression-free lottie-web SVG light player 5.13.0. External assets and expressions block preview and edited export; original download remains available.
- MIT is the user-selected first-party license. IBM Plex font notices use SIL OFL.

## Scope boundaries

No timeline or keyframe editing, SVG editing, AI generation, native 3D, dotLottie, cloud storage, account system, video export or npm component publication in v0.1. The bundled `lottie-studio` skill now routes palette work through Moro.

The app runs locally. The user explicitly requested GitHub publication; source is at https://github.com/kimyoungwopo/moro. Moro is a working name; name/domain/trademark availability is not checked. A hosted demo and promotion require a separate explicit user request. Never fabricate GitHub URLs or star counts.

## Verification

Run `npm ci`, `npm run check`, and `npm audit`. Browser acceptance evidence and physical-device limits are recorded in `docs/VALIDATION.md`. The React example has its own lockfile and clean-install build. Build artifacts and local backup archives are excluded from version control.
