---
name: Memory-image generation
description: How the companion's user-initiated "calming image" feature is built and kept safe; plus the openai-server image-module gotcha.
---

# Memory-image ("calming image") generation

User-initiated gentle imagery in the companion. Endpoint: `POST /api/imagery/memory`
(auth-gated), UI is a confirm-before-generate composer in the companion session.

## Safety model (the "never faces / never the deceased" guarantee)

The guarantee is structural, not just a prompt request:

- **Text-only.** The endpoint accepts ONLY a text prompt + orientation. It NEVER
  receives the uploaded deceased photos. With no reference image, the image model
  cannot reproduce a real person's likeness. Do NOT add photo/image input to this
  endpoint — that would break the guarantee.
- Prompt is run through OpenAI moderation (`moderate()`, which **fails open**).
- A narrow deterministic likeness deny-list (`LIKENESS_PATTERN`: face/portrait/
  selfie/headshot/likeness/"what he/she looked like") rejects explicit likeness
  requests with 422. Kept narrow on likeness *terms*, NOT relationship nouns, so
  gentle scene prompts like "the garden my mother loved" are still allowed.
- The prompt is wrapped in a calming style prefix + a hard safety suffix forbidding
  faces/figures/portraits/people/text before hitting `gpt-image-1`.

**Why:** a full post-generation face classifier is disproportionate for abstract
calming imagery; the text-only design + framing + deny-list already make a rendered
likeness structurally implausible.

**How to apply:** keep this endpoint text-only; if adding new "generate an image"
surfaces, reuse the same layered guard (moderation + likeness deny-list + style/
safety framing) and never pass user-uploaded photos to the image model.

## Client scoping

Generated images are ephemeral component state (`memoryImages`) rendered as
assistant-side cards — not persisted. Reset them (and the composer) on `sessionId`
change or they bleed across conversations (the page does not remount per session).

## openai-server `./image` module gotcha

`@workspace/integrations-openai-ai-server` declares a `./image` export in its
package.json, but the source file (`src/image/index.ts`) may be **missing** — only
client/audio/batch were copied in. If `generateImageBuffer` import errors, create
`src/image/index.ts` (mirror `client.ts` init; `openai.images.generate({model:
"gpt-image-1", size, n:1})`, response is always base64) and run
`pnpm run typecheck:libs` (composite lib) BEFORE the api-server can import it.
gpt-image-1 sizes: 1024x1024, 1536x1024, 1024x1536; no `response_format`.
