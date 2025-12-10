# ODIN UI Design Rules

This document captures the decisions from our home screen and workspace reviews so engineers and designers can align when iterating on the real product. Follow these rules unless we explicitly revise them in future briefs.

---

## 0. Visual System (applies everywhere)
- Light mode only. Backgrounds stay white or very light gray; no dark theme variant is planned for MVP.
- Brand accents use a family of reds (primary, hover/darker, soft/red-tint backgrounds). Supporting neutrals are gray scales for text, dividers, borders.
- Purples, blues, or gradient fills are disallowed. All fills use solid colors with subtle opacity (e.g., rgba reds for badges) when needed.
- Focus rings, buttons, chips, and toasts share the red accent palette so both home screen and workspace feel unified.

---

## 1. Home Screen (`UI TEST/home screen.html`)

### 1.1 Layout & Structure
- Maintain the calm hero first, recent projects second, marketing info last order; the main CTA and project grid must stay above the fold on desktop.
- Header remains sticky with a subtle divider line and contains only three elements: ODIN logo (linked home), `View all history`, and user/avatar menu.
- Overall max-width stays around 1200px; responsive breakpoints preserve a single column on tablets/mobile but retain generous spacing to keep the premium feel.
- Primary button, hover states, and pill links use solid reds with darker-red hover; secondary links rely on gray text with red-only accents (no gradients).

### 1.2 Primary Actions
- Only one hero CTA is presented: `+ New from screenshot` (or `Start new project`). Remove `New from text only` unless we ship a separate flow—never show two buttons that land in the same place.
- Secondary entry points (e.g., `Try sample project`, `Watch tutorial`) can exist as text links or pills but must not compete visually with the main CTA.

### 1.3 Recent Projects
- Cards show thumbnail, project name, last edited time, and total visuals generated. Ensure the entire card is clickable; do not hide the Continue button behind hover-only interactions.
- All cards share aligned heights; empty states and skeleton loaders mirror the spec already in the mockup.

### 1.4 Supporting Sections
- Benefits, How It Works, testimonials, FAQ, etc. remain optional marketing blocks. Keep them modular so we can trim them for a lean MVP landing if timeline requires.
- Any iconography or illustrations follow the white/red/gray palette; legacy purple assets must be recolored before use.

### 1.5 Accessibility & Responsiveness
- Buttons and links require visible focus states, and all icon-only controls include accessible labels.
- When collapsing for mobile, stack hero content vertically and ensure action buttons expand to full width.

---

## 2. Workspace (`UI TEST/workspace.html`)

### 2.1 Global Layout
- Fixed header spans full width with subtle separator line; scrolling the workspace must never move it. Header shows back button, project info, autosave indicator, and essential action buttons (share, download, rename, delete).
- Two-column body layout with equal visual weight: **left column = Control Panel**, **right column = Slide Preview + Generated Results**.
- Each column scrolls independently. Left column height matches viewport and contains its own scrollbar for long prompts; right column also scrolls separately so the slide preview and results remain accessible without pushing controls off-screen.
- Avoid card-like gaps: panels sit on a unified background with thin separators (1px dividers) to mimic polished desktop workspaces (VS Code, Figma, Leonardo). Rounded-corner cards or heavy drop-shadows are removed from the primary panels.

### 2.2 Control Panel (Left Column)
- Sections are ordered as: Upload/Project info → Draw tools → Prompt/Text input → Generation settings & CTA → Optional extras (tips, advanced ratios, history). The Generate button must always be visible with minimal scrolling on desktop.
- Collapse secondary info (quick tips, advanced aspect ratio settings, help text) behind accordions. Default view focuses on the linear flow: upload → draw → describe → generate.
- Color detection runs silently; no chips or swatches are shown to the user unless an error is relevant.
- Control panel visuals: solid white background, 24px internal padding, 1px light-gray dividers between sections, red accent text for section labels or warnings. Inputs use gray borders with red focus rings; the Generate CTA is a solid red block button with matching hover/darker states.
- Upload box, draw tool buttons, and prompt textarea stay full-width; helper text uses subtle gray to reduce noise.

### 2.3 Slide Preview (Right Column, upper half)
- Canvas container enforces a strict 16:9 area. Placeholder slides or uploads must respect the ratio; use `object-fit: contain` and clamp padding so the slide always reads as landscape.
- Drawing overlay shows current selection, pixel dims, and snapping badge. Keep badges light and anchored to corners so they don’t obscure slide content.
- Panel background matches workspace, separated via a single line divider to maintain the “panel seam” rule.

### 2.4 Generated Results (Right Column, below preview)
- Generated visuals sit directly below the slide preview, spanning the same width. Each result card is large enough to evaluate (min width ~300px) and shares the aspect ratio of the user’s selection (square or 16:9). No tiny thumbnails.
- Actions (Copy, Download, Refresh) stay visible or appear on focus/hover but are large and touch-friendly. Provide immediate toast feedback for Copy operations.
- Results load with a 3-card grid or horizontal strip, mirroring Leonardo’s “gallery” experience rather than stacking inside the control panel.

### 2.5 History Panel (Right edge / optional)
- History becomes a slim rail listing past generations with small thumbnails and metadata (project, timestamp). It must look distinct from the current results to prevent confusion.
- Each entry supports quick Copy/Download, but no full action grid is needed; keep it lightweight.

### 2.6 Interactions & States
- Header and columns use `position: sticky` to keep critical controls on-screen. Selection rectangle uses clear handles, and tooltips explain snapping when triggered.
- Error states and loaders mimic the existing mockup (progress bars, retry actions) but should not push the Generate button off-screen.
- Keyboard navigation: ensure all focusable elements have visible outlines, and result cards expose ARIA radio roles when selecting among options.

### 2.7 Responsive Behavior
- On smaller screens, stack columns (controls on top, preview/results below) but preserve the same order: controls first so the user can act immediately, results after preview. Maintain separate scroll regions when space allows.

---

These rules serve as the baseline spec for implementation. Any future mock changes should update this document so the engineering team can reference a single source of truth when building ODIN’s UI.
