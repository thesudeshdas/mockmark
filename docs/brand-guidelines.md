# Mockmark brand guidelines

Canonical system: **Review Signal 2.0**
Issued: **2026-08-22**
Research: [brand-research.md](brand-research.md)
AI-aesthetic audit: [ai-slop-design-research.md](ai-slop-design-research.md)
Direction decision: [brand-directions.md](brand-directions.md)
Visual reference: [brand-guidelines.html](brand-guidelines.html)
Tokens: [tokens.css](brand-assets/tokens.css) · [tokens.json](brand-assets/tokens.json)

## 1. Brand idea

**Feedback, held in context.**

Mockmark lets people mark a live HTML mock, discuss that exact point or region, and carry the same human feedback into repository-aware agent work. The identity treats Mockmark as a review instrument: neutral working surface, precise signal, clear context, visible resolution.

### Why this is specifically Mockmark

- **Open corners** come from selecting a region on a live mock.
- **Numbered marks** come from ordered conversation anchors.
- **Ruled zones and review rail** come from feedback living beside the mock.
- **Proportional→mono type** expresses human language becoming paths, builds, and structured terminal context.
- **White, cool gray, graphite, signal yellow** separate working surface, structure, action, and review attention.
- **No AI spectacle** reflects product truth: Mockmark exposes feedback; it does not prescribe or perform the agent's work.

### Recognition without the logo

A composition should still read as Mockmark when it combines at least three of these:

1. cool gray canvas + white surface + graphite ink;
2. signal-yellow review mark;
3. open-corner selection;
4. numbered square/circle annotation;
5. ruled review rail;
6. Recursive Sans paired with Recursive Mono metadata.

## 2. Visual principles

### Mark the work, not the interface

Accent appears where attention, selection, or change exists. It is not a decorative wash.

### Context is visible

Show page path, status, build, author, and time when they help someone act. Do not turn technical context into fake code decoration.

### Neutral surface, exact hierarchy

Clarity comes from neutral surfaces. Precision comes from rules, alignment, explicit labels, and restrained shapes.

### Human first, agent legible

Human conversation uses proportional type. Repository identifiers and code use mono. Never depict agents as magical characters, glowing entities, or autonomous coworkers.

### Restraint earns trust

One signal color, few radii, quiet elevation, purposeful motion. If an element has no review or hierarchy role, remove it.

## 3. Personality translated into rules

| Trait | Visual rule | Avoid |
|---|---|---|
| Precise | Align to 8px rhythm; expose paths/status; use 1px rules | Random offsets, faux-technical noise |
| Calm | Cool canvas, generous reading space, low shadow | Glows, pulsing surfaces, parallax |
| Candid | Literal headings and real UI examples | “Supercharge,” “ultimate,” vague claims |
| Human | Conversational body copy, visible authors, concrete comments | Beige “human AI” theater, robot/AI mascots |
| Technical | Mono for actual metadata and code | Mono everywhere or fake terminal strings |
| Bounded | Clear frames, explicit states, visible permissions | Ambiguous sharing/security metaphors |

## 4. Logo system

Assets:

- [Primary mark](brand-assets/mockmark-mark.svg)
- [Monochrome mark](brand-assets/mockmark-mark-monochrome.svg)
- [Horizontal lockup](brand-assets/mockmark-lockup.svg)
- [Favicon/app icon direction](brand-assets/favicon.svg)

### Construction

The mark combines:

- an `M` drawn as one continuous review path;
- opposing open corners for region selection;
- one signal-yellow anchor dot where the central paths meet.

The mark is a direction for production, not a registered trademark. Complete collision/trademark and small-size optical review before broad launch.

### Primary use

- Use full-color lockup on `surface`, `canvas`, or white.
- Use monochrome mark where printing, embossing, or partner constraints allow one color only.
- On dark surfaces, use dark-theme text `#F5F7FA` and mark `#FFE05C`; do not invert the full asset with a CSS filter.

### Clear space

Let **x** equal the diameter of the anchor dot.

- Mark alone: minimum clear space `2x` on every side.
- Horizontal lockup: `2x` top/bottom, `3x` left/right.
- No border, copy, image edge, or annotation marker may enter clear space.

### Minimum size

- Primary mark: 20px digital, 7mm print.
- Full lockup: 112px wide digital, 32mm print.
- Below 20px, use [favicon.svg](brand-assets/favicon.svg), which simplifies the frame and uses a dark tile.
- Do not use the horizontal lockup below 112px; the wordmark loses character.

### Placement

- Default top-left, aligned to content grid.
- Center only on splash/loading or legal lockups.
- Do not float the mark at arbitrary angles or use it as an annotation pin.
- Maintain a single logo per viewport unless a footer repeat is necessary.

### Monochrome

- Preferred one-color values: ink `#15181D`, dark text `#F5F7FA`, or 100% black/white when required.
- The anchor dot becomes the same color; do not retain signal yellow in a nominally monochrome application.

### Incorrect use

Do not:

- fill the open corners to make a generic rounded-square app icon;
- recolor corners with a gradient or rainbow;
- remove the anchor dot;
- round the `M` terminals;
- stretch, skew, rotate, outline, or add shadow;
- place full-color art on low-contrast photography;
- substitute another typeface in the wordmark;
- use the symbol as an arbitrary bullet or status indicator.

### Favicon/app icon

The icon uses a 4px-radius graphite tile, simplified white `M`, signal-yellow corners, and anchor. Required exports after logo approval: SVG, 16/32/48px PNG, 180px Apple touch icon, 192/512px PWA icons.

## 5. Color

### Primitive palette

HEX is fallback; OKLCH is the canonical perceptual definition. Values were computed from the listed sRGB colors.

| Token | Role | HEX | OKLCH |
|---|---|---|---|
| `surface` | Primary working surface | `#FFFFFF` | `oklch(1.0000 0 0)` |
| `canvas` | App canvas | `#F2F4F6` | `oklch(0.9662 0.0034 247.86)` |
| `surface-subtle` | Structural grouping | `#E6E9ED` | `oklch(0.9329 0.0063 255.48)` |
| `ink` | Primary text/action | `#15181D` | `oklch(0.2081 0.0110 260.67)` |
| `ink-muted` | Secondary text | `#5D6672` | `oklch(0.5068 0.0221 255.62)` |
| `rule` | Borders/rules | `#C7CDD4` | `oklch(0.8457 0.0118 252.10)` |
| `mark` | Selection/accent | `#FFD84D` | `oklch(0.8916 0.1569 92.99)` |
| `mark-strong` | Accent text | `#6B5200` | `oklch(0.4520 0.0924 88.21)` |
| `mark-soft` | Selected subtle surface | `#FFF6CC` | `oklch(0.9697 0.0551 97.26)` |
| `blue` | Focus/info/link | `#0A65FF` | `oklch(0.5624 0.2412 261.37)` |
| `blue-soft` | Info surface | `#DCE9FF` | `oklch(0.9310 0.0330 261.03)` |
| `green` | Success | `#176B4A` | `oklch(0.4705 0.0946 161.75)` |
| `amber` | Warning | `#8B5A00` | `oklch(0.5091 0.1086 72.67)` |
| `red` | Error/destructive | `#B42318` | `oklch(0.5003 0.1821 29.51)` |

### Light theme mappings

| Semantic role | Token |
|---|---|
| Canvas | `canvas` |
| Surface | `surface` |
| Surface subtle | `surface-subtle` |
| Text | `ink` |
| Muted text | `ink-muted` |
| Border | `rule` |
| Primary action | `ink` with `surface` text |
| Selection/accent | `mark` with `ink` text |
| Accent text/link | `mark-strong` |
| Focus/info/link | `blue` |
| Success/warning/danger | `green` / `amber` / `red` |

### Dark theme mappings

| Role | HEX | OKLCH |
|---|---|---|
| Canvas | `#101318` | `oklch(0.1858 0.0113 260.65)` |
| Surface | `#191D23` | `oklch(0.2293 0.0131 258.37)` |
| Raised surface | `#222831` | `oklch(0.2749 0.0188 258.37)` |
| Text | `#F5F7FA` | `oklch(0.9755 0.0045 258.32)` |
| Muted text | `#AAB2BE` | `oklch(0.7610 0.0194 258.36)` |
| Border | `#39414C` | `oklch(0.3724 0.0217 256.38)` |
| Mark | `#FFE05C` | `oklch(0.9087 0.1518 95.97)` |
| Focus/info | `#7CB0FF` | `oklch(0.7532 0.1273 258.52)` |
| Success | `#5BD39B` | `oklch(0.7835 0.1359 160.49)` |
| Warning | `#F1B84B` | `oklch(0.8155 0.1394 80.55)` |
| Danger | `#FF8A7B` | `oklch(0.7584 0.1446 28.54)` |

Dark mode is appropriate for docs/code, late review, and product preference. Marketing defaults light. Do not make dark mode the sole identity.

### Measured WCAG contrast

Programmatically checked against WCAG relative luminance:

| Foreground / background | Ratio | Use |
|---|---:|---|
| `ink` / `surface` | 17.79:1 | All text (AAA) |
| `ink` / `canvas` | 16.14:1 | All text (AAA) |
| `ink-muted` / `canvas` | 5.28:1 | Body/labels (AA) |
| `mark-strong` / `canvas` | 6.73:1 | Accent text (AA) |
| `ink` / `mark` | 12.86:1 | Regular text on mark (AAA) |
| white / `mark-strong` | 7.42:1 | Regular text (AAA) |
| `blue` / `surface` | 4.86:1 | Links/focus indicators (AA) |
| `green` / `surface` | 6.48:1 | Success text (AA) |
| `amber` / `surface` | 5.90:1 | Warning text (AA) |
| `red` / `surface` | 6.57:1 | Error text (AA) |
| dark text / dark canvas | 17.34:1 | All text (AAA) |
| dark muted / dark canvas | 8.70:1 | All text (AAA) |
| dark canvas / dark mark | 14.24:1 | Text on mark (AAA) |
| dark focus / dark canvas | 8.43:1 | Focus/info (AAA) |

Rules:

- Never set white text on `mark`; use ink. `mark-strong` is for text, not the default solid CTA.
- Borders do not carry meaning alone. Status always includes text and preferably icon/shape.
- Focus ring is 3px blue outside a 2px surface separator.
- Recheck contrast after opacity, blend mode, imagery, or disabled-state changes.

### Data visualization

Order: mark `#FFD84D`, blue `#0A65FF`, teal `#16877B`, gold `#B77900`, plum `#8246AF`, green `#217A4B`, red `#C13F35`, gray `#77746D`.

- Use direct labels or legend + distinct line/dash/shape.
- `mark` may highlight selected series; it does not automatically mean error.
- Red is reserved for negative/error meaning when semantics apply.
- Maximum six simultaneous chromatic series; group or filter beyond six.
- Use 2px lines and 8px minimum points. Do not use gradients in charts.

## 6. Typography

### Family

**Recursive 1.085**, designed by ArrowType contributors, licensed under [SIL Open Font License 1.1](brand-assets/fonts/OFL-Recursive.txt). Source: [official repository](https://github.com/arrowtype/recursive).

Bundled Latin Basic variable webfont: [Recursive-VF-LatinBasic.woff2](brand-assets/fonts/Recursive-VF-LatinBasic.woff2). The fetch script verifies SHA-256: [scripts/fetch-brand-fonts.mjs](../scripts/fetch-brand-fonts.mjs).

Why Recursive:

- Designed for code and UI.
- `MONO` axis moves proportional text to fixed-width code.
- `CASL` exists but is not part of the canonical identity; default to Linear forms.
- Weight/slant changes preserve metrics, reducing interface reflow.
- More product-specific than Inter/Geist; lower cost than a three-family system.

Alternatives considered:

| Option | Strength | Why not canonical |
|---|---|---|
| Inter / Geist | Excellent UI coverage | Dominant competitor/AI-SaaS look; little recognition. |
| Source Serif 4 + Public Sans + IBM Plex Mono | Editorial range | Three-family load, weaker human→code bridge, and Claude-adjacent editorial tone. |
| Spline Sans + Azeret Mono | Technical character | Two-family system; stronger developer-tool cliché. |

### Presets

| Role | Axis settings | Weight | Notes |
|---|---|---:|---|
| Display | `MONO 0, CASL 0, CRSV 0` | 800–900 | Short headlines only; 32px+ |
| Heading | `MONO 0, CASL 0, CRSV 0` | 700–800 | Product/document hierarchy |
| Body/UI | `MONO 0, CASL 0, CRSV 0` | 450 | Use 500 on dark backgrounds if needed |
| Label | `MONO 0, CASL 0, CRSV 0` | 650 | Uppercase allowed at 11–12px with tracking |
| Metadata/code | `MONO 1, CASL 0, CRSV 0` | 450–600 | Paths, hashes, code, shortcuts |

Do not animate `CASL`, `MONO`, or `slnt` for novelty. Product text remains stable. Use visible content, not a casual axis, to communicate humanity.

### Scale

| Role | Desktop | Mobile | Line-height | Tracking |
|---|---:|---:|---:|---:|
| Display | clamp 64–120px | 48–64px | 0.94 | `-0.045em` |
| H1 | 52px | 40px | 1.02 | `-0.035em` |
| H2 | 36px | 30px | 1.08 | `-0.025em` |
| H3 | 24px | 22px | 1.15 | `-0.012em` |
| Lead | 20px | 18px | 1.5 | `0` |
| Body | 16px | 16px | 1.55 | `0` |
| Small | 14px | 14px | 1.45 | `0` |
| Label | 11–12px | 11–12px | 1.3 | `0.08em` uppercase |
| Code | 13–14px | 12–13px | 1.6 | `0` |

Body copy measure: 45–75 characters, target 62. Do not center paragraphs longer than two lines.

### Fallbacks and loading

```css
@font-face {
  font-family: "Recursive Mockmark";
  src: url("./brand-assets/fonts/Recursive-VF-LatinBasic.woff2") format("woff2-variations");
  font-weight: 300 1000;
  font-style: oblique 0deg 15deg;
  font-display: swap;
}

--mm-font-sans: "Recursive Mockmark", Arial, sans-serif;
--mm-font-mono: "Recursive Mockmark", "SFMono-Regular", Consolas, monospace;
```

- Preload the local WOFF2 on critical product/marketing entry pages.
- `font-display: swap` is required; layout must remain usable with fallback.
- Current bundle is Latin Basic. Add official Latin-1/Latin-ext/Vietnamese subsets with `unicode-range` before serving those languages.
- Never synthesize bold or italic; supported axes cover both.

## 7. Grid and composition

### Grid

- 12 columns desktop ≥1024px.
- 8 columns tablet 640–1023px.
- 4 columns mobile <640px.
- Gutter `clamp(16px, 2vw, 32px)`.
- Page max 1216px; wide visual max 1440px; text max 672px.
- Outer margin 16px mobile, 24px tablet, 32–64px desktop.

### Spacing

4px base; default rhythm 8px. Tokens: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128px.

- Control internal padding: 8/12 or 10/14.
- Related elements: 4–12px.
- Component groups: 16–32px.
- Section separation: 48–96px product, 64–128px marketing.
- Never create a one-off 5/7/13/19px gap to “look right”; fix alignment or select nearest token.

### Alignment

- Left edges carry hierarchy.
- Text baselines align across panes.
- The review rail may begin one grid unit above/below main content to signal commentary, but its internal content remains aligned.
- Open corners must sit exactly on selected bounds.
- Do not center whole pages except auth, empty states, or single-decision prompts.

### Signature composition

Use **work + rail** when a visual or artifact is being reviewed:

- Work area: 7–9 columns.
- Review rail: 3–4 columns.
- 1px rule between them.
- Rail ordinals align with marks in the work area when practical.

On mobile, rail becomes a bottom sheet or follows work in document order. Preserve a “Feedback” jump action; do not squeeze to side-by-side.

## 8. Shape, border, elevation, and focus

### Radius

- 4px controls and small interactive targets.
- 8px surfaces/cards.
- 12px dialogs and large overlays.
- 999px only for avatars, true status lozenges, and compact count badges.
- No 16–24px default cards; no pill buttons unless geometry requires it.

### Borders

- 1px `rule` default.
- 2px `ink` for selected structural containers.
- 2–3px `mark` for annotation bounds/corners.
- Use rules to group content before adding a new surface.

### Shadows

- Flat by default.
- Raised: subtle 1px contact edge + 8×20px 8% ink.
- Overlay/dialog: 16×40px 18% ink.
- Never combine glow, gradient, blur blob, and shadow.

### Focus

Every interactive element gets visible `:focus-visible`:

```css
outline: none;
box-shadow: 0 0 0 2px var(--mm-color-surface),
            0 0 0 5px var(--mm-color-focus);
```

Focus is blue, not signal yellow, so focus and annotation remain distinct.

## 9. Iconography

- 1.75px stroke at 20/24px; 1.5px at 16px.
- Square line caps for structural/path icons; round caps only for people/reaction icons.
- 2px corner radius maximum inside icon geometry.
- Default sizes: 16 inline, 20 control, 24 navigation, 32 empty state.
- Optical alignment: snap primary stems to pixel grid; center by perceived mass.
- Outline icons default. Filled variant only for current/selected state.
- Annotation icons may use open corners and numbered anchor dots.
- Never use sparkles for agent functionality, magic wands for automation, or robots for AI agents.
- Use an icon library only after adapting stroke/corner rules; do not mix libraries in one surface.

## 10. Imagery and graphic language

### Illustration

Use annotated fragments: browser windows, HTML blocks, file trees, paths, build labels, and conversation rails. Render with graphite lines, white/cool-gray fills, one signal accent, and occasional focus blue.

- Isometric/fake 3D: prohibited.
- Floating orbs/glowing blobs: prohibited.
- Generic geometric people: prohibited.
- Random sparkles: prohibited.
- Decorative marks must correspond to selection, alignment, sequence, or state.

### Diagrams

- Left-to-right flow by default.
- Nodes are ruled zones, not rounded bubbles.
- Label arrows with the event: `deploy`, `comment`, `read`.
- Use real object terms: repository, mock, build, page, thread, CLI.
- Human→Mockmark→agent diagram must show that agent action happens outside Mockmark.

### Screenshots

- Use real product UI with realistic non-sensitive content.
- Crop around one task; include enough browser/dashboard chrome for orientation.
- 1px ink/rule frame; 4–8px radius; no floating device mockups.
- Add callouts outside the screenshot or with open review corners; do not cover essential UI.
- Never fabricate shipped functionality or remove inconvenient state.

### Photography

Not a primary brand device. If needed for people/customer stories:

- candid review moments or real workspaces;
- neutral color, documentary crop;
- no staged pointing at screens, handshake, or generic office stock;
- no brand-color overlay. Use a small caption/rule to integrate it.

### Texture/background art

Allowed: very low-contrast 40px technical grid, registration ticks, path labels. Reference [review-signal-pattern.svg](brand-assets/review-signal-pattern.svg).

- Maximum 6% ink opacity behind text.
- Never simulate paper, grain, ink splatter, tape, or scrapbook effects.
- Remove texture entirely on dense product surfaces.

## 11. Product UI

### Navigation

- White surface with 1px bottom rule.
- Active item uses ink weight + short signal-yellow rule; not a filled pill.
- Workspace switcher may be a compact bordered control.
- Mobile uses one menu button and preserves current project/path in text.

### Buttons

| Type | Treatment |
|---|---|
| Primary | Ink background, white text, 4px radius |
| Secondary | Transparent/white, 1px ink/rule border |
| Accent action | Mark background, ink text; use for annotation-specific action only |
| Quiet | No fill; underlined/ruled hover |
| Destructive | White surface, red text/border; solid red only in confirmation |

Verbs are literal: `Create project`, `Copy link`, `Post comment`, `Mark reviewed`. Avoid `Continue` when the next action can be named.

### Inputs

- 40px minimum height; 4px radius; surface fill; 1px border.
- Labels remain visible above fields; placeholder is example, not label.
- Focus uses blue ring. Error uses red border + icon + text.
- Helper/error text sits 6–8px below field.

### Cards and surfaces

- Use a card only when content is independently selectable, movable, or elevated.
- Lists, settings, and data groups prefer ruled sections.
- Card max radius 8px; avoid multiple nested cards.
- Hover changes border/underline or translates ≤1px; no floating lift.

### Dialogs

- 12px radius, strong title, short explanation, actions aligned right.
- Destructive dialogs name the object and consequence.
- Modal width 480–640px; never full-screen desktop unless task requires immersion.

### Annotations and comments

- Point mark: 24px circle, ink/mark contrast, mono ordinal.
- Region mark: 3px signal-yellow open corners with a 1px ink keyline; use `mark-soft` only while selected.
- Resolved mark: ink outline + check; do not turn green without label.
- Comment panel uses author, timestamp, body, replies, reactions, resolution action in that order.
- Keep comment markers above host content but isolate style in Shadow DOM as current architecture requires.
- Keyboard labels use mono and visible `kbd` treatment.

### Status indicators

Lifecycle and thread state are distinct:

- Lifecycle: Mocking, Ready to review, In review, Reviewed, Archived.
- Thread: Open, Resolved.

Use text + icon/shape; status color is secondary. Only true status labels use pill geometry. Do not encode lifecycle using thread colors.

### Empty states

- 32px literal icon or review-corner diagram.
- Explain what is absent and one next action.
- Example: “No mocks deployed. Deploy the repository mock directory to publish its HTML pages.”
- Avoid confetti, mascots, vague optimism, or multiple CTAs.

### Error states

- Name what failed and what remains safe.
- Preserve user input.
- Show retry only when retry is valid.
- Technical details may expand in mono; never dump raw secrets/tokens.

### Code and terminal

- Dark ink surface or `surface-subtle`; no neon gradient.
- Recursive Mono, 13–14px, 1.6 line height.
- Include real commands, paths, and output; redact secrets with `TOKEN`, not fake realistic keys.
- Copy affordance is explicit; success reads `Copied` for 1.6s.
- Syntax color remains restrained: text, muted, mark, blue, green.

## 12. Marketing pages

### Hero

- One concrete headline, ≤12 words.
- One explanatory paragraph, ≤30 words.
- One primary CTA, optional secondary.
- Pair with a realistic review composite, not decorative art.
- Preferred headline territory: “Feedback lives beside the mock.”

### Feature sections

- Organize by actual flow: prepare repository → deploy mock → mark and discuss → read feedback in terminal.
- Alternate work area and review rail; use real object names.
- One visual and one proof point per section.

### Proof

- Customer quotes require source/name/role approval.
- Product proof may use documented limits, commands, security boundaries, and shipped behavior.
- Do not invent speed percentages, customer counts, or ROI.

### CTAs

- CTA bands use ink background, white text, and one signal-yellow corner/mark.
- No gradient CTA containers or floating glow.
- Use `Install Mockmark`, `View setup`, or `Open dashboard` only when destination matches.

### Pricing

- Not currently evidenced in product scope; do not fabricate tiers.
- When pricing exists, use ruled columns, consistent feature language, and one recommended plan marker—not oversized cards.

### Docs

- Dense but calm: sticky local navigation, 672px reading measure, code adjacent to explanation.
- Headings use proportional Linear; code/path uses Mono.
- Warnings use explicit title and semantic border, not giant tinted boxes.

### Footer

- Compact ruled footer with product, docs, legal, and source links.
- One small lockup. Avoid giant repeated CTA and decorative site map.

## 13. Social, launch, and documentation graphics

- Standard social canvas uses cool gray, one review-corner frame, one headline, one real UI crop, and a mono path/build caption.
- Keep safe area 64px at 1200×630.
- Use 3:2 or 1:1 crops; no collage beyond three fragments.
- Release notes use `version / date / path` metadata and one changed surface.
- Illustration series should reuse the same 40px grid and 2px ink line.

## 14. Motion

### Purpose

Motion explains state, origin, continuity, or completion. It never supplies personality by itself.

| Motion | Duration | Easing |
|---|---:|---|
| Press/hover feedback | 80–140ms | `cubic-bezier(.2,0,0,1)` |
| Panel/list transition | 220ms | `cubic-bezier(.2,0,0,1)` |
| Enter | 220ms | `cubic-bezier(0,0,0,1)` |
| Exit | 140ms | `cubic-bezier(.3,0,1,1)` |
| One-time emphasis | 360ms max | `cubic-bezier(.2,0,0,1)` |

Rules:

- Animate opacity and transform; avoid layout-affecting width/height when possible.
- Annotation placement may scale 0.92→1 and fade, 140ms.
- Review rail enters from its anchored edge ≤16px, 220ms.
- Status completion uses one check draw/fade, no bounce/confetti.
- Hover movement ≤1px product, ≤2px marketing.
- No endless orbit, shimmer, blob morph, 3D spin, parallax, or type-axis morph loop.

### Reduced motion

When `prefers-reduced-motion: reduce`:

- set transitions/animations to 0ms except essential progress indication;
- replace movement with instant state + opacity if needed;
- never autoplay video or animated background;
- retain focus, selection, and success visibility.

## 15. Voice and microcopy

Only guidance affecting visual experience:

- Short, literal labels.
- Sentence case; uppercase only 11–12px metadata labels.
- One idea per line in narrow rails.
- Use product nouns consistently: workspace, project, repository, deployment, mock, page, conversation, comment, build, token.
- Use `agent` only for the external coding agent that reads feedback.
- Do not say Mockmark “fixes,” “triages,” “designs,” or “ships” work.
- Status text is stable and never playful.

Examples:

| Do | Don't |
|---|---|
| `2 open conversations` | `You've got some feedback!` |
| `Deploy 3 HTML mocks` | `Ship your magic` |
| `Copy installation command` | `Get started` when copying is the action |
| `Agent-readable feedback` | `AI-powered collaboration` |
| `Access denied for this project` | `Something went wrong` |

## 16. Major do/don't rules

### Do

- Frame the selected work with open corners.
- Use signal yellow for marks and review attention.
- Put metadata in Recursive Mono.
- Prefer rules and whitespace to nested cards.
- Show realistic mock paths, comments, and lifecycle labels.
- Keep blue for focus/info and dark ink for primary actions.
- Design light first; verify dark mapping separately.

### Don't

- Use beige/cream foundations, coral/orange/vermilion accents, purple-blue gradients, glassmorphism, blobs, or orbs.
- Make every button/label a pill.
- Use bento grids without an information reason.
- Use Inter/Geist in Mockmark-branded surfaces.
- Turn agent access into robot or sparkle imagery.
- Use white on bright `mark` or color-only status.
- Apply review corners to every card.
- Fabricate product screenshots, claims, pricing, or testimonials.

## 17. Composite application

The canonical composite is rendered in [brand-guidelines.html](brand-guidelines.html):

1. Cool gray canvas, white work surface, compact graphite navigation.
2. Concrete headline: “Feedback lives beside the mock.”
3. Three-pane review specimen: file tree, live HTML preview, feedback rail.
4. Signal-yellow numbered region mark connected to a realistic comment.
5. Mono path/build metadata and lifecycle status separated from thread state.
6. Ink primary action, mark annotation action, blue focus example.
7. No gradient, decorative blob, floating card field, or invented feature.

This composite is the reference for future product UI, website, docs, launch, and social work. Adapt density by context; preserve the work + rail relationship and review-signal grammar.

## 18. Implementation sequence

These guidelines do **not** authorize production UI changes. When approved for implementation:

1. Add font assets and token layer.
2. Replace semantic colors, focus, type, spacing, radius, and elevation without changing behavior.
3. Migrate navigation, controls, lists, and states.
4. Apply review marks and rail composition to deployment browser/embed.
5. Build marketing/docs templates.
6. Add dark mode only after light surfaces pass full QA.

Never bulk-replace raw HEX values without mapping their semantic role.

## 19. Governance

- Canonical written source: this file.
- Canonical machine source: `brand-assets/tokens.css`; JSON mirrors platform-neutral primitives.
- Any new primitive needs a documented role, contrast check, light/dark mapping, and example.
- Additions that introduce a new radius, color, font, or motion curve require design review.
- Review system every 6 months or after major product-surface changes.
- Brand/logo legal approval remains a human decision.
