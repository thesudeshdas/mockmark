# Mockmark visual-brand research

Research date: **2026-08-22**
Scope: repository evidence, current product UI, visual-feedback competitors, adjacent review tools, current AI-product aesthetics, and public brand/design-system documentation.

## Executive conclusion

Mockmark should not look like an AI platform or a generic feedback SaaS. Its strongest defensible visual territory is **Review Signal**: a cool, tool-like working surface with precise marks laid over real work and a visible handoff from human language to repository context.

The category overwhelmingly uses blue or purple accents, rounded SaaS cards, pill navigation, screenshot montages, and speed claims. AI products add two more convergent clusters: gradient/glow futurism and warm beige/orange “human AI.” Mockmark's previous proof-sheet proposal missed the second cluster. The deeper audit is documented in [Avoiding the generic AI-product aesthetic](ai-slop-design-research.md).

Mockmark's real difference is narrower and more credible: repository-scoped HTML mocks, explicit access boundaries, immutable hosted builds, visual conversations, and agent-readable feedback without prescribing an agent workflow.

## Repository evidence

### Product truth

| Evidence | Implication for identity |
|---|---|
| [README](../README.md): “Repo-scoped annotation and conversation for HTML mocks.” | Lead with the relationship between a mock, a mark, and its repository—not generic collaboration imagery. |
| [README](../README.md): `C` creates point/region comments; `L` lists conversations; `H` hides markers. | Annotation corners, numbered marks, and keyboard-label typography are meaningful brand material. |
| [CONTEXT](../CONTEXT.md): workspace membership does not grant project data; project access is explicit and deny-by-default. | Visual tone must feel precise, trustworthy, and bounded. Avoid playful ambiguity around permissions. |
| [SaaS plan](saas-build-plan.md): humans annotate; existing agents read structured feedback; Mockmark does not design, recommend, modify code, or prescribe workflow. | Show a clean handoff, not autonomous “AI magic.” Use code/mono cues sparingly and literally. |
| [Mock lifecycle](mock-lifecycle-status-approach.md): Mocking → Ready to review → In review → Reviewed → Archived. | Status system needs ordered, readable semantics independent of thread resolution. |
| Current dashboard: warm paper, coral accent, Inter, white rounded cards. | Replace the full cluster. It now reads as Claude/Cursor-adjacent AI styling, not merely generic SaaS styling. |
| Current deployment browser: file tree, live preview, feedback rail. | Three-pane review layout is a signature product composition; brand examples should feature it. |
| CLI supports safe initialization, hosted immutable builds, and structured comment output. | Technical diagrams should use paths, builds, hashes, and brackets—not abstract clouds or robots. |

### Audience

Primary audiences supported by repository behavior:

1. Developers who keep HTML mock work inside repositories and want a thin install.
2. Designers/product collaborators who need point or region feedback on live mocks.
3. Project admins who control explicit membership, deployments, and lifecycle state.
4. AI coding agents that consume structured human feedback through terminal access.

This is not evidenced as a broad survey, roadmap, project-management, or autonomous code-fixing product.

### Current UI baseline

Live local inspection at `http://127.0.0.1:4173/` on 2026-08-22:

- Canvas `#F6F4EF`; text `#24221F`; action coral `#EE5B35`.
- Inter/system sans; display heading 76.8px at 1280px viewport.
- Cards use 18px radius and a soft 8×30px shadow; controls use 10px radius.
- Login message already contains strong product truth: “Feedback lives beside the mock.”
- Weakness: styling resembles many warm-neutral SaaS products and lacks a repeatable graphic signature.

## Comparable-product research

### Access method and limits

Direct browser inspection covered **eight accessible competitor sites** plus several attempted sites. Public landing pages, pricing, help, feature pages, and product tours were inspected where exposed. No account was created and no product was claimed as hands-on unless an unauthenticated interactive surface was available.

| Product | Direct URLs | What was actually accessed | Limitation |
|---|---|---|---|
| MarkUp.io | [Home](https://www.markup.io/), [Pricing](https://www.markup.io/pricing/) | Landing page, visible UI screenshot, pricing link structure | App requires sign-up; no authenticated trial. |
| Pastel | [Home](https://usepastel.com/), [Features](https://usepastel.com/features), [Plans](https://usepastel.com/plans) | Landing page and public product claims/demo entry points | Interactive use requires account. |
| BugHerd | [Home](https://bugherd.com/), [Pricing](https://bugherd.com/pricing), [MCP feature](https://bugherd.com/feature/mcp), [Help](https://support.bugherd.com/) | Landing, pricing, MCP positioning, visible UI/product media; “Interactive demo” entry inspected | Entry resolved to pricing page; full product requires sign-up. |
| Filestage | [Home](https://filestage.io/), [Pricing](https://filestage.io/pricing/), [Help](https://help.filestage.io/en) | Landing, navigation, workflow and review-agent positioning | Product and booked demo require account/contact. |
| zipBoard | [Home](https://zipboard.co/), [Features](https://zipboard.co/features/), [Pricing](https://zipboard.co/pricing/) | Landing and public workflow description | App requires sign-up. |
| Frame.io | [Home](https://frame.io/), [Pricing](https://frame.io/pricing), [Help](https://help.frame.io/en/) | Landing, product-tour entry, pricing/help structure | Tour is external; authenticated workspace not accessed. |
| Userback | [Home](https://userback.io/), [Pricing](https://userback.io/pricing/), [Docs](https://docs.userback.io/docs/welcome) | Landing, visual language, product categories, MCP banner | Full product requires sign-up; attempted MCP docs route returned 404. |
| Webvizio | [Home](https://webvizio.com/), [Pricing](https://webvizio.com/pricing/), [MCP help](https://webvizio.com/help-center/mcp-server/) | Landing, AI-coding positioning, public help entry | Full product requires registration. |
| Figma comments | [Official prototype-comment guide](https://help.figma.com/hc/en-us/articles/360039824594-Comment-on-prototypes) | Official documentation via web retrieval | Direct browser navigation failed; no file was supplied for hands-on commenting. |
| Marker.io | [Home](https://marker.io/) | Direct navigation attempted | Browser returned blank; not counted as visually inspected. |
| Usersnap | [Home](https://usersnap.com/) | Direct navigation attempted | Browser returned blank; not counted as visually inspected. |
| Ruttl | [Home](https://ruttl.com/) | Direct navigation attempted | Browser returned blank; not counted as visually inspected. |
| Ziflow | [Home](https://www.ziflow.com/) | Direct navigation attempted | Browser returned blank; not counted as visually inspected. |
| Atarim | [Home](https://atarim.io/) | Direct navigation attempted | Browser returned blank; not counted as visually inspected. |

All URLs above accessed or attempted on **2026-08-22**.

### Visual comparison matrix

Values are observed from public web surfaces, not inferred product internals.

| Product | Palette | Typography | Density / radius | Layout | Imagery / icons | Motion | Tone | Strength | Weakness / cliché |
|---|---|---|---|---|---|---|---|---|---|
| MarkUp.io | White, black, electric blue; small multicolor logo | Avenir body, Object Sans display | Airy; repeated 24px cards, 8px controls | Centered hero + large product screenshot | Clean UI captures, simple line icons | Conventional section reveals | “Simple collaboration” | Immediate comprehension and clear screenshots | Generic centered SaaS hero; blue CTA territory is crowded. |
| Pastel | Warm gray, black, saturated blue | Figtree; small Inter use | Medium; mostly 8–15px radii | Proof-led hero, repeated client approval claims | Product thumbnails and testimonials | Restrained marketing transitions | Agency-friendly, outcome-first | Strong specificity around client approval | Still converges on blue CTA + rounded surfaces. |
| BugHerd | White, near-black, light blue, cobalt; supporting illustration color | Inter; occasional Courier Prime/mono | Mixed; 2px utility edges plus 12–50px marketing radii | Dense feature story, signup controls, proof numbers | Product imagery, pins, custom illustrations | Marketing reveals and carousel-like media | Direct, humorous, agency operational | Clear point-click-comment story; rich proof | AI/MCP page adopts category “agent joins team” narrative Mockmark should reject. |
| Filestage | White, navy/blue, pale lilac/cyan | Lato + Domine serif | Medium; 5px utility, large pill CTAs | Enterprise proofing flow with 3-step sequence | File previews, customer logos, soft color zones | Restrained | Enterprise, compliance-aware | Review stages and approval framing are clear | Broad file-review positioning; soft pastel AI surfaces feel interchangeable. |
| zipBoard | White, bright green, blue-gray | Open Sans + Poppins | Medium-dense; small 3–6px controls | Many industry/use-case blocks | Asset-type illustrations and screenshots | Conventional | Broad, functional, enterprise | Coverage of websites, PDFs, courses, video is explicit | Visual hierarchy and type pairing feel dated; green dominates without ownable grammar. |
| Frame.io | Near-black, white, violet/blue | Frame Gothic + Neue Machina Inktrap | Airy marketing, denser media product; 10–24px surfaces | Cinematic full-bleed sections | High-quality photography/video/product frames | Cinematic transitions | Premium creative production | Most distinctive typography and imagery in set | Premium media language does not fit lightweight repo mocks; purple/dark is overused. |
| Userback | Near-black, white, saturated violet; gradient announcement strip | Geist | Airy; many pills, 8–12px surfaces, 999px labels | Centered claim + integration map/product blocks | Minimal line/product diagrams | Smooth SaaS reveals | Product-feedback platform + AI integration | Strong visual consistency and modern token use | Purple, gradient banner, Geist, pill nav, and “AI tools” signal canonical AI-SaaS. |
| Webvizio | White, ink navy, standard blue | Inter with Figtree accents | Medium; 8–24px surfaces, 50px buttons | Feature stack, integration proof, AI section | Screenshots, integration logos | Conventional | Bug reporting + AI prompt generation | Makes developer handoff explicit | “Ultimate”, “supercharge”, blue UI, rounded cards, and AI promise are exactly the slop standard to avoid. |

### Interaction-pattern findings

- Point pins and region selection are category conventions worth keeping because they match the task, not fashion.
- Comment mode separated from browse mode is common and reduces accidental annotation. Mockmark's `C` shortcut is aligned with Figma and existing product behavior.
- Right-side conversation panels and numbered pins are established. Differentiation should come from their visual grammar, not moving them to a surprising place.
- Screenshot capture, technical metadata, task-board conversion, and integrations are common competitor promises. Mockmark should not imply them unless implemented.
- Lifecycle state and thread-resolution state should remain visibly separate; many competitor sites blur feedback, task, and approval status.

## Public brand and design-system research

This set intentionally mixes **brand identity guidance** and **product design systems**. Brand guidance explains recognition and expression; a component library alone cannot define Mockmark's look.

| Reference | Type | Direct URL | What makes it effective | Applicable lesson |
|---|---|---|---|---|
| GitHub Brand Toolkit | Full brand system | [brand.github.com](https://brand.github.com/) | Separates identity, voice, foundations, graphic elements, UI, textures, motion, and brand-in-action. Mona Sans + Mona/Octocat assets create recognition beyond product components. | Give Mockmark a graphic grammar and examples, not token tables alone. |
| Atlassian Design | Brand-informed product system | [atlassian.design](https://atlassian.design/) | Connects color, typography, iconography, grid, AI patterns, accessibility, and tokens; shows live product scenarios. | Map every expressive primitive to a functional role and token. |
| IBM Carbon | Product design system rooted in IBM language | [carbondesignsystem.com](https://carbondesignsystem.com/) | Clear separation of foundations, elements, components, patterns, data visualization, code, and migration. Minimal radii support seriousness. | Document migration/application rules and do not turn every surface into a card. |
| GOV.UK Design System | Public-service product system | [design-system.service.gov.uk](https://design-system.service.gov.uk/) | Research-led components, accessibility-first patterns, blunt language, near-zero decorative styling. | Trust can come from hierarchy and evidence, not polish effects. |
| Material Design 3 | Cross-platform design language | [m3.material.io](https://m3.material.io/) | Documents style, components, adaptive behavior, expressive shape, and motion as one system. | Motion and shape need explicit purpose and reduced-motion rules. Avoid importing its pill/expressive-shape fashion. |
| Shopify Polaris | Product reference system | [polaris.shopify.com](https://polaris.shopify.com/) | Ties UI guidance to specific platform surfaces and developer implementation references. | Mockmark examples must distinguish dashboard, embedded reviewer, docs, and CLI. |
| Adobe Spectrum | Product design system | [spectrum.adobe.com](https://spectrum.adobe.com/) | Pairs principles, downloadable resources, implementation libraries, and detailed usage guidance. | Pair canonical rules with downloadable assets and machine tokens. |
| Microsoft Fluent 2 | Multi-platform product system | [fluent2.microsoft.design](https://fluent2.microsoft.design/) | Separates design language from platform frameworks; accessibility tools are first-class resources. | Core language should survive React, static HTML, terminal, and social contexts. |
| Slack Media Kit / Brand Center | Collaboration brand guidance | [slack.com/media-kit](https://slack.com/media-kit) | Direct logo rules, trademark boundaries, downloadable product screenshots, and a bridge to deeper brand guidance. | Define asset permissions, screenshot treatment, and final-logo approval needs explicitly. |

All references accessed on **2026-08-22**. Dropbox Brand and Mailchimp Brand Assets were also attempted; a cookie interstitial and blank browser response prevented useful direct inspection, so they are not counted in the nine-reference study.

### What strong systems document consistently

1. **Roles, not swatches.** Color guidance names surfaces, text, interaction, status, focus, and data use.
2. **Recognition beyond logos.** Typography, composition, illustration, textures, and repeated graphic devices carry identity.
3. **Application context.** Examples show rules in product, marketing, content, and motion—not isolated specimens.
4. **Boundaries.** Logo misuse, accessibility failures, unsupported combinations, and prohibited motion are explicit.
5. **Implementation bridge.** Tokens, source files, component references, and licensing let teams execute without guessing.

## Category clichés

### Overused territory

- Electric blue or violet as the only signifier of “modern.”
- Purple-blue gradients, glowing announcement bars, blurred blobs, and dark “AI” sections.
- Beige/cream foundations with coral, terracotta, orange, or vermilion accents.
- Editorial serif + soft photography used to manufacture “human AI” warmth.
- Geist/Inter plus heavy negative tracking and oversized vague headlines.
- Centered prompt composers with suggestion-chip rows.
- Pill navigation, pill buttons, pill filters, and pill labels everywhere.
- White rounded cards on a pale-gray canvas; 16–24px radius as default.
- Floating integration logos and bento grids standing in for product explanation.
- Screenshot montages with no realistic task, page, status, or feedback content.
- “Supercharge,” “ultimate,” “AI-powered,” “faster,” and “one platform” without precise mechanics.
- Friendly robot/sparkle/orb imagery for agent features.

### Conventions to keep

- Numbered point markers and region outlines: direct mapping to annotation.
- A dedicated comments rail: efficient scanning and proven review convention.
- Clear browse/comment mode separation and keyboard shortcuts.
- Blue focus indication: familiar and accessible when not used as the entire brand.
- Semantic green/amber/red states, always paired with labels/icons.
- Product screenshots: only when they show a real Mockmark workflow with realistic data.

### Conventions to transform

- Replace generic rounded cards with **review zones**: rules, rails, open corners, and selective 0–6px radii.
- Replace AI gradients with a literal human→repository handoff diagram.
- Replace floating blobs with annotated page fragments, path labels, build hashes, and review marks.
- Replace warm neutrals with a cool gray canvas and true-white mock surface.
- Use signal yellow as a controlled selection color, never as default body text or decorative wash.

## Opportunity territory

| Opportunity | Why it belongs to Mockmark | Guardrail |
|---|---|---|
| Review corners | Region selection and “mark” are core product actions | Use only to frame selected/important content, not every rectangle. |
| Numbered mark tags | Existing annotations are ordered conversation anchors | Keep numbers legible; never rely on color alone. |
| Proportional-to-mono typography | Human conversation becomes agent-readable repository context | Mono is reserved for paths, builds, shortcuts, tokens, and code. |
| Cool canvas + white surface | Keeps app structure distinct from reviewed mock content without paper simulation | Do not drift toward blue-tinted enterprise chrome. |
| Signal yellow mark | Direct highlight/attention behavior without Claude orange or category purple | Pair with corners, numbers, or labels; never rely on yellow alone. |
| Review rail composition | Mirrors the three-pane deployment browser | Marketing may abstract the rail, but must retain clear hierarchy. |

## Research conclusion

Mockmark can own a visual identity that says **“this work is under precise human review and remains connected to its repository.”** The system should feel like a review instrument, not an AI assistant or dashboard theme. Recognition must come from open annotation corners, numbered marks, ruled composition, cool surface separation, signal yellow, and Recursive's controlled shift from proportional sans to mono—even when the logo and illustrations disappear.
