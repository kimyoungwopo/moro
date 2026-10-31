---
name: Moro
description: A quiet framed sheet for making Lottie palettes yours.
colors:
  ground: "#f2f7f7"
  surface: "#ffffff"
  raised: "#f4f6f8"
  preview: "#f8fafb"
  selected: "#e5edef"
  sample-hover: "#e9eff0"
  text: "#131416"
  muted: "#5d5f60"
  border: "#e8eaec"
  control: "#cdced1"
  accent: "#1b6c80"
  primary-hover: "#33373a"
  preview-dark: "#20262b"
  warning: "#92400e"
  warning-surface: "#fffbeb"
  error: "#c4242a"
  error-surface: "#ffedea"
typography:
  display:
    fontFamily: "IBM Plex Sans, -apple-system, BlinkMacSystemFont, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: "36px"
    fontWeight: 500
    lineHeight: "44px"
    letterSpacing: "-1px"
  headline:
    fontFamily: "IBM Plex Sans, -apple-system, BlinkMacSystemFont, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: "22px"
    fontWeight: 500
    lineHeight: "28px"
    letterSpacing: "-0.4px"
  title:
    fontFamily: "IBM Plex Sans, -apple-system, BlinkMacSystemFont, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: "24px"
  body:
    fontFamily: "IBM Plex Sans, -apple-system, BlinkMacSystemFont, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4286
  label:
    fontFamily: "IBM Plex Sans, -apple-system, BlinkMacSystemFont, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: "12px"
  hex:
    fontFamily: "IBM Plex Mono, monospace"
    fontSize: "12px"
    lineHeight: "18px"
rounded:
  sheet: "16px"
  dialog: "12px"
  group: "8px"
  control: "6px"
  badge: "4px"
spacing:
  compact: "4px"
  control-gap: "8px"
  row-gap: "12px"
  group: "16px"
  tablet: "20px"
  section: "24px"
components:
  button-primary:
    backgroundColor: "{colors.text}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "6px 11px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.surface}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "6px 11px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    size: "32px"
  hex-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.hex}"
    rounded: "{rounded.control}"
    padding: "6px 7px"
    width: "94px"
  sample-selected:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.text}"
    rounded: "{rounded.group}"
    padding: "9px 8px"
  sheet:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.sheet}"
    padding: "24px"
---

# Design System: Moro

## Overview

**Creative North Star: "Framed sheet"**

A quiet, slightly teal frame holds a white working sheet. Animation and the user's palette provide the visual energy; chrome stays restrained, readable and direct. The recurring loop mark and original-to-replacement color rows give the tool its identity.

This is a scan of the implemented Moro workbench and Read documentation surface, based on `apps/web/src/main.tsx` and `apps/web/src/style.css`. It replaces the earlier Lottie Studio v0.2 design system under the user's approved identity replacement. The approved authority is `brief/PRODUCT-UI-SPEC.ko.md`, its layout SVGs and `brief/design-tokens.json`; the latter still labels itself proposed, so the tokens above capture actual source values rather than silently treating the proposal as implementation. This was code-led from the exact brief; no raster comp or QUALITY BAR card was selected.

**Key Characteristics:**
- A pale L-shaped frame around one white working sheet.
- A large preview with precise, compact color mappings beside it.
- Self-hosted IBM Plex typography and restrained teal focus cues.
- Responsive composition that puts mobile controls in normal page flow.

## Colors

The palette is cool and quiet; vivid colors belong to the animation and editable swatches.

### Primary

- **Workbench teal** (`accent`): focus outlines, native control accent, the enabled compare switch and selected mobile comparison text.
- **Near-black ink** (`text`): ordinary text and the Export action, with white text on primary buttons. Its hover counterpart is `primary-hover`.

### Neutral

- **Teal mist** (`ground`): the outer frame and topbar.
- **White sheet** (`surface`): the workspace, dialogs and input surfaces.
- **Cool raised gray** (`raised`): control groups, transport and code blocks.
- **Preview fog** (`preview`): the light preview surface; it is distinct from raised chrome.
- **Selected mist** (`selected`) and **hover mist** (`sample-hover`): sample selection and hover.
- **Quiet gray** (`muted`): secondary copy; `border` separates regions and `control` outlines fields.
- **Dark preview** (`preview-dark`): a preview-only background, not an app theme.

Warning and error pairs carry readable diagnostic copy as well as color. They are semantic feedback, not extra brand accents. Transparency uses a functional checkerboard.

**The Artwork Color Rule.** Keep chrome neutral and teal; allow the loaded animation and user-selected palette to be multicolored.

Observed differences from the proposal: sample selection uses `selected`, not proposed active (`#EBEDEE`), and the actual loop logo inherits near-black `currentColor` rather than teal. These are documented source facts, not unimplemented corrections.

## Typography

**UI font:** IBM Plex Sans, with Apple/system Korean sans fallbacks. Latin weights (400, 500, 600) are bundled through Fontsource. **Code font:** self-hosted IBM Plex Mono (400), then monospace. No remote font request is required.

Plex gives the workbench a practical, precise voice. Numeric file metadata and frame counts use tabular figures; hex values, filenames in export and code use mono.

- **Display:** Read page heading, using the frontmatter display role; mobile becomes (30px/38px).
- **Headline:** workbench filename; mobile becomes (20px/26px).
- **Title:** inspector headings; dialogs instead use (20px/28px), medium weight, slightly tightened tracking.
- **Body:** base UI; labels commonly use (12px). Panel notes use (12px/19px), changing to (12px/20px) on mobile.
- **Hex:** mono input; mobile and the picker use (16px), with mobile minimum field height (44px).
- **Supporting:** desktop sample descriptions, counts and some diagnostics use (11px). Mobile overrides key preview labels, frame count, caption, sample descriptions and diagnostics to (12px).

The brief's broad mobile body/input target (16px) is only partially implemented: default body remains (14px), many labels remain (12px), and the export code preview remains (11px). Do not describe the current app as uniformly 16px. Read paragraphs use (1.8) line height and a maximum measure (72ch).

## Layout

Desktop at (1100px) and above uses a fixed library (228px), a flexible working area and topbar (48px). The white sheet has right/bottom inset (8px), padding and column gap (24px), a flexible preview column and inspector track (288px). The inspector has a left divider and internal left padding (24px). Both main columns permit shrinkage. The desktop app uses viewport height with minimum height (620px); the library and inspector can scroll independently.

At (768–1099px), the library becomes a Samples dialog, the sheet gains left inset (8px), and sheet padding/gap plus inspector padding become (20px), while the inspector track stays (288px). Compare previews stack vertically. This is an actual density adjustment from the proposal's desktop spacing.

At (767px) and below, the topbar stays (48px) and sticky; only menu, brand and Export remain in it. The sheet flows vertically with preview, transport and inspector, using horizontal padding (16px), vertical padding (18px), gap (27px) and radius from the sheet token. The preview is (290px) high. Compare uses Original/Edited buttons at the same frame. Samples, file details, undo/redo and Open file move into the menu dialog. The color picker becomes a bottom sheet with safe-area padding. Buttons have a minimum target (44×44px), including the independently reviewed mobile control correction; checkbox labels provide larger target areas around smaller native checks.

Read (`/docs`) uses a centered container (1024px max), outer padding (32px), and a white text sheet with padding (48px 64px). Mobile uses outer padding (14px) and sheet padding (26px 20px). It remains English-only in current source; the workbench defaults to English and offers Korean, with some technical labels still English.

Existing acceptance captures: `.impeccable/review/desktop.png`, `mobile.png`, `tablet-1024.png`, `tablet-768.png`, `desktop-compare.png`, `desktop-export.png`, `mobile-picker.png` and `user-969.png`. This documentation pass verified their presence, not new browser behavior. Physical-device keyboard/viewport behavior is not verified.

## Elevation & Depth

The app is flat at rest. Ground, white sheet, preview tone and fine dividers establish regions; the workspace has no shadow. Swatches use only an inset edge to remain visible on white. Dialogs use a single overlay shadow (`0 18px 60px #13141629`) and dark backdrop (`#13141652`). This lift signals an active interruption rather than decorating ordinary containers.

**The Flat Workbench Rule.** Reserve overlay lift for dialogs; use tone and a divider for the working regions.

## Shapes

The sheet is softly framed, groups and previews gently rounded, and controls tighter, as encoded above. Desktop dialogs use their own intermediate radius; the mobile picker rounds only its top corners (16px). Borders are fine (1px); the target swatch has a white inset border and control-colored outline. The logo is two tilted, outlined loops, not an image asset.

## Components

### Buttons

Direct, compact controls. Primary Export/download actions use near-black with white labels; secondary buttons use white with control borders. Open file and icon buttons are quiet ghosts. Generic desktop buttons have minimum height (34px); icon buttons are (32px), transport (36px). Mobile overrides button targets to at least (44px). Disabled controls use opacity (.4). Hover changes surface color without moving the button.

All focusable buttons, links, inputs, selects and summaries receive a teal outline (2px) with offset (3px). The compare switch alone transitions its knob (`transform .12s ease`); reduced motion removes transitions. There is no generic panel entrance motion.

### Navigation

The library has three sample rows with static (48px) thumbnails, name and short description. Selected rows use the selected mist surface. Colors/Playback and export format use understated text tabs with a near-black underline (2px), arrow/Home/End keyboard selection and a divider. Mobile comparison uses filled segment buttons. Docs/support and language sit below library metadata. No GitHub link is fabricated while a public repository is absent.

### Containers and feedback

Use the main sheet, preview, inspector divider, native dialog and diagnostic disclosure that exist in source. Do not invent a general card grid or chip library. The small Modified badge is an outlined status indicator, not a navigation chip. Warning diagnostics expand when blocked; error banners pair text with a dismiss control. A quiet status notice reports download requests without claiming confirmed disk saves.

### Inputs and color mapping

Original swatch → arrow → target swatch button → mono hex field → property count is the signature row. Original and target remain distinct. Desktop swatches are (30px); mobile originals (38px), target buttons (44px). Valid complete hex values commit live; invalid drafts receive an error border. The picker previews live and Apply groups changes into one undo step; Cancel restores committed values. Reset colors is disabled until modified.

### Preview, transport and export

Background selection changes the preview only. Compare shares one frame clock; its desktop pair becomes a tablet stack and a mobile version switch. The range control is a frame scrubber, with play/pause, count, speed and loop; it has no keyframe tracks. Reduced motion starts playback paused. The Colors and Playback inspector panels distinguish document colors from React wrapper behavior. Export uses a native modal with JSON/React tabs, real filenames, code blocks and local download actions. Native dialog behavior supplies modal focus containment and Escape dismissal; focus returns to the prior element on close.

## Do's and Don'ts

### Do:
- **Do** keep one quiet frame and white working sheet around the animation.
- **Do** preserve visible original-to-target color mappings and preview-only background labeling.
- **Do** use Plex Sans for UI, Plex Mono for hex/code, and Korean system fallbacks.
- **Do** retain the mobile minimum button target (44×44px) and normal page flow.
- **Do** distinguish observed source values from proposed brief values and unverified device behavior.

### Don't:
- **Don't** add decorative gradients, glass, glow, dot grids or routine panel entrance motion; the transparency checkerboard is functional.
- **Don't** turn the workbench into a promotional landing page or a grid of nested dashboard cards.
- **Don't** restore the superseded layer editor, timeline/keyframe lane or SVG editing controls.
- **Don't** imply cloud saving, accounts, remote AI generation or a public GitHub destination.
- **Don't** claim universal 16px mobile typography, complete Korean translation or verified physical-device keyboard behavior.
