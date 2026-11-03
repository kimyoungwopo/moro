# Third-party notices

Moro source code and the five original starter/showcase animations are MIT licensed (see LICENSE).

- lottie-web 5.13.0 — MIT, Airbnb contributors. The browser and generated React examples use the expression-free SVG light build. License: node_modules/lottie-web/LICENSE.md.
- React / React DOM 19.3.1 — MIT, Meta Platforms, Inc. and affiliates. Licenses accompany the npm packages.
- IBM Plex Sans and IBM Plex Mono, distributed by @fontsource 5.3.0 — SIL Open Font License 1.1, IBM Corp. Self-hosted Latin subsets. Full license texts are copied to dist/licenses and the standalone skill.
- Build, test and lint dependencies retain their upstream licenses in node_modules. They are not shipped as browser runtime services.

No third-party Lottie gallery assets or LottieFiles branding are bundled. The earlier v0.2 local prototype used svgpath; it is preserved separately in .local-backups and is not part of this build.

## Harness² algorithm adaptation

The optional native Moro harness adapts the k=1 Propose–Probe–Compose algorithm from Google Research contributors' `google-research/harness2`, pinned to `1cfe254e8d25b15f37048c3730134686abe60335`, under Apache License 2.0. The exact upstream root license is included in `licenses/Harness2-Apache-2.0.txt`.

This is a modified Rust adaptation with sequential branches, fixed provider permissions, strict JSON guidance, bounded source snapshots and explicit operator review. It is not an integration or execution of the original Python runtime. No third-party benchmark assets are bundled. Google and the upstream contributors do not endorse Moro; passing protocol or schema checks is not an artistic-quality endorsement.

## Reviewed motion-design guidance

The optional native v2/Design Director planners embed locally reviewed adaptations of LottieFiles' `motion-design-skill`, pinned to `f9a8a041b85185ee4881b3471d3415e939aac772` (MIT; Copyright (c) 2025 LottieFiles). The complete upstream license is preserved in `docs/ai/guidance/LICENSE-LottieFiles-motion-design-skill.txt`; provenance and deliberately excluded rules are in `docs/ai/guidance/ATTRIBUTION.md`. Duolingo and IBM Carbon are attributed conceptual references, not bundled artwork, brand identities or endorsements. No external skill is installed or executed.
