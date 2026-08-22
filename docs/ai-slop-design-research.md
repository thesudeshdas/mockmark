# Avoiding the generic AI-product aesthetic

Research date: **2026-08-22**
Scope: public first-party AI-product pages, commercial AI/SaaS templates, Mockmark's existing competitor study, accessibility guidance, and evidence on distinctive brand assets.

## Executive conclusion

“AI slop” is not one color. It is convergence: the same palette, page skeleton, component shapes, type, effects, imagery, and claims appearing together until the interface looks generated before it looks product-specific.

Mockmark's previous warm paper + vermilion direction fails this test. It avoids purple gradients, but overlaps a second AI cluster led by Claude and Cursor: warm off-white foundations, earthy accenting, restrained editorial tone, soft product frames, and “human” positioning. Replacing vermilion while retaining beige would not solve the problem.

The revised recommendation is **Review Signal**:

- cool gray canvas and true-white working surfaces;
- graphite typography and actions;
- flat signal yellow for selections and annotations;
- square, ruled, tool-like composition;
- real mocks, paths, build IDs, comment ordinals, and lifecycle labels;
- no gradients, glow, glass, decorative blobs, floating prompt bars, generic bento storytelling, serif-humanism theater, or AI mascots.

Color is supporting evidence, not the primary differentiator. Product-specific shape and composition must do more recognition work than hue.

## What “AI slop design” means here

This is a working design diagnosis, not a claim that every use of these devices is bad. A pattern becomes slop when it is used by default, lacks product meaning, and appears in a familiar cluster.

### Cluster 1 — generated futurism

- purple/blue/pink gradient mesh or aurora;
- blurred blobs, radial glows, glass panels, star fields;
- gradient text and multicolor sparkle/brain/wand marks;
- dark canvas with neon edge light;
- floating product screenshot with glow and shadow;
- copy such as “supercharge,” “reimagine,” “magic,” or “build anything.”

### Cluster 2 — soft human AI

- cream, beige, ivory, or warm gray canvas;
- terracotta, coral, orange, or muted earth accent;
- editorial serif headline paired with neutral sans;
- soft photography, paper/desk metaphors, gentle shadows;
- 10–24px rounded controls and friendly cards;
- claims about a thinking partner, humanity, calm, or creativity.

### Cluster 3 — prompt-product monoculture

- centered oversized headline above a large prompt composer;
- suggestion pills directly below it;
- black/white or nearly colorless Geist/system-sans UI;
- generic template gallery, three-step workflow, or bento feature grid;
- the input box becomes the brand even when the actual product is not primarily chat.

### Repeated implementation tells

- Inter, Geist, Plus Jakarta Sans, or another default geometric sans without custom behavior;
- `999px` radius used for navigation, tags, filters, CTAs, and status simultaneously;
- cards nested inside cards, each with faint border and soft shadow;
- icon-in-tinted-rounded-square repeated for every feature;
- reveal-on-scroll motion, hover lift, cursor spotlight, and gradient sweep with no task meaning;
- placeholder dashboards instead of real product evidence;
- invented social proof, metrics, integrations, or customer marks.

## Direct market audit

Public pages were inspected directly in a rendered browser on **2026-08-22**. Values describe the observed first viewport and may change as those sites evolve.

| Surface | Observed visual language | Relevance to Mockmark |
|---|---|---|
| [Claude](https://claude.ai/) | `#FCFCFB` near-white body, terracotta sunburst, proprietary editorial serif headlines, outlined 10px controls, soft photographic panel | Confirms that warm neutral + orange + editorial humanity is Claude-coded, not available territory. |
| [Cursor](https://cursor.com/) | `#F7F7F4` warm off-white body, dark warm ink, custom grotesk, rounded CTAs, large product frame and art-directed imagery | Shows beige/editorial restraint is broader AI-coding territory, even without orange. |
| [Lovable](https://lovable.dev/) | `#FAFAFA` body, large blue/pink/orange gradient field, centered prompt composer, multicolor logo | Canonical gradient/prompt AI aesthetic. |
| [v0](https://v0.app/) | neutral `oklch(0.985 0 0)` body, Geist Sans, centered prompt composer, suggestion pills, template gallery | Canonical monochrome prompt-product aesthetic. |
| [OpenAI](https://openai.com/) | black/white foundation, centered “What can I help with?” composer, pill suggestions, soft bordered controls | Reinforces the prompt box + pills as a category code. |
| [Perplexity](https://www.perplexity.ai/hub) | cinematic dark photographic hero, large editorial headline, centered prompt field | Demonstrates the premium cinematic branch of AI branding. |

### Template-market confirmation

Commercial templates matter because generated sites frequently reproduce their recipes.

| Source | Explicitly marketed recipe |
|---|---|
| [AvaPlate AI/SaaS templates](https://avaplate.com/) | purple-to-cyan gradient mesh, modern cards, dark “cosmos” variant, dashboard mockups |
| [AuraAI UI kit](https://craftwork.design/product/auraai-saas-landing-page-ui-kit) | purple/indigo palette, bento ecosystem, pricing, testimonials, light/dark themes |
| [TheKitBase AI SaaS landing](https://thekitbase.app/templates/ai-saas-landing) | dark-first UI, bento grid, prompt-like product preview, pricing toggle, testimonials |
| [Envato AI SaaS platform kit](https://elements.envato.com/ai-saas-platform-website-design-WJ3WHS4) | blue gradient mesh, bento layout, glassmorphism, dark theme |
| [Aura dark SaaS template](https://akshrastudios.gumroad.com/l/aura-template) | glass navigation, animated blobs, gradient text, bento features, three-tier pricing |

The repetition is the evidence: these are not isolated stylistic choices. They are sold as a package.

## Where the previous Mockmark direction failed

| Previous decision | Original logic | Why it fails now |
|---|---|---|
| Warm paper canvas | Calm review sessions; proof-sheet metaphor | Too close to Claude/Cursor's warm-neutral AI world. “Paper” also pulls the system toward soft editorial theater. |
| Vermilion mark | Proofreader correction; lineage from existing coral | Claude association outweighs metaphor. Existing-color continuity created confirmation bias. |
| Casual Recursive display axis | Human warmth opposite mono metadata | “Humanized AI” is itself a category trope. Casual display should not carry identity. |
| Proof Sheet name | Direct review metaphor | Encouraged beige, paper, and editorial cues. Product behavior should remain; paper styling should not. |
| Anti-slop checklist focused on gradients | Correct but incomplete | It caught generated futurism while missing soft-human and monochrome-prompt clusters. |

## Revised territory — Review Signal

### Position

Mockmark is a review instrument attached to repository work. It is not an AI assistant, design generator, ideation canvas, or thinking partner.

### Palette hypothesis

| Role | Color | Reason |
|---|---|---|
| Canvas | Cool gray `#F2F4F6` | Clearly non-beige; separates app chrome from working surface. |
| Surface | White `#FFFFFF` | Neutral, accurate mock viewing; no paper simulation. |
| Subtle surface | Steel gray `#E6E9ED` | Structural grouping without cards or warmth. |
| Ink/action | Graphite `#15181D` | High contrast, tool-like, neutral. |
| Selection | Signal yellow `#FFD84D` | Human highlight/review association without Claude orange, AI purple, OpenAI green, or category blue. |
| Focus/info | Cobalt `#0A65FF` | Conventional interaction semantics; not signature identity. |

Signal yellow is not assumed to be ownable by itself. It works only with Mockmark's open-corner region shape, numbered marks, black rule system, and path/build labels.

### Composition rules

- Use a **working surface**, never a paper page.
- Prefer vertical rules, rails, dividers, and explicit regions over freestanding cards.
- Keep radii at 0–6px for product UI; round only true circular pins.
- Keep shadows rare and shallow. Use borders and layer contrast first.
- Align headings and UI to the same grid; no centered marketing hero by default.
- Show product state immediately: file tree, mock preview, annotation, real comment, path, build ID.
- Number annotations; pair signal color with shape and text.
- Use Recursive Linear proportional type for UI and Recursive Mono for repository context. Do not use Casual axis as brand decoration.

### Explicit exclusion list

Reject a design if it contains any unmotivated combination of:

- beige/cream/ivory foundations;
- coral, terracotta, orange, or vermilion signature colors;
- purple-blue-pink gradients or gradient text;
- glassmorphism, glow, blurred blobs, star fields, grain-as-premium decoration;
- large centered prompt composer or suggestion-chip row;
- default bento feature grid;
- pill navigation or pill status where a label/tab works;
- serif display used to manufacture “human” tone;
- sparkle, wand, brain, robot, orb, or agent-avatar motifs;
- fictional dashboards, customer logos, integrations, metrics, or AI capabilities;
- copy built from “magic,” “supercharge,” “reimagine,” “effortless,” or “build anything.”

## What should perform

No color choice can honestly be promised to outperform without testing. Performance hypothesis:

1. **Recognition:** product-specific region corners + numbered signal marks should identify Mockmark faster than color alone.
2. **Comprehension:** first viewport showing real review behavior should improve correct product understanding.
3. **Trust:** concrete paths, states, comments, and boundaries should outperform vague AI claims for technical buyers.
4. **Activation:** graphite primary actions keep CTA behavior familiar; yellow remains selection feedback, not conversion decoration.

Evidence supports this hierarchy:

- Ehrenberg-Bass describes uniqueness as essential for distinctive assets and recommends avoiding elements famous for competitors: [Brands of Distinction](https://ebims.emdev.au/brands-of-distinction/).
- A 2026 cross-industry study of 1,162 assets reports shape-based assets as strongest on average: [Shape-based assets are strongest](https://www.tandfonline.com/doi/full/10.1080/02650487.2026.2637295).
- Baymard's SaaS UX research shows real application screenshots help users understand the service: [7 SaaS Website UX Fixes](https://baymard.com/blog/g7aaEAkotMyquRdw).
- W3C requires meaning not be communicated by color alone and recommends choosing contrast during palette design: [Use of Color](https://www.w3.org/WAI/WCAG20/Understanding/use-of-color), [Colors with Good Contrast](https://www.w3.org/WAI/perspectives/contrast.html).

### Validation plan

Test complete concepts, not isolated button colors:

- five-second test: “What does this product do?”
- unprompted association test: Claude, AI assistant, design tool, review tool, developer tool;
- first-click test: add feedback, inspect feedback, open a mock;
- preference is secondary; measure comprehension, task success, signup→first-review activation;
- compare Review Signal against a deliberately plain control, not the rejected warm/orange direction;
- reject launch if “Claude” or “generic AI” appears as a material unprompted association.

## Decision

Retire **Proof Sheet**, warm paper tokens, vermilion, and casual-editorial framing. Preserve only behavior-derived assets: open selection corners, numbered marks, review rail, rules, and proportional→mono transition. Rebuild them in **Review Signal**.
