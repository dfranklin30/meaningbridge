---
name: OpenRouter (Replit AI Integrations) constraints
description: What the Replit-managed OpenRouter integration can and cannot do, and how the AI provider seam routes around it.
---

# OpenRouter via Replit AI Integrations — real constraints

The `@workspace/integrations-openrouter-ai` client (OpenAI SDK pointed at the
Replit proxy, env `AI_INTEGRATIONS_OPENROUTER_BASE_URL` / `_API_KEY`) works, but
the managed account imposes hard limits discovered by live probing:

## `:free` models are BLOCKED
Any `...:free` model returns HTTP 404 `"No endpoints available matching your
guardrail restrictions and data policy"`. This is the account's privacy/data
policy (free tiers require prompt-logging opt-in we don't control). **Only paid
models are usable.** Do not pick a `:free` model expecting it to work — verify
with a live call first.

**Verify a model live** (secrets are NOT readable in the code_execution sandbox —
they come back as presence flags `true` — but the bash shell has the real env):
`curl -s -X POST "$AI_INTEGRATIONS_OPENROUTER_BASE_URL/chat/completions" -H "Authorization: Bearer $AI_INTEGRATIONS_OPENROUTER_API_KEY" -H "Content-Type: application/json" -d '{...}'`

## No paid vision Nemotron
The only vision-capable Nemotron (`nvidia/nemotron-nano-12b-v2-vl`) is free-only,
so it's blocked. The paid Nemotron chat models are **text-only**. Consequence in
the seam: companion turns carrying an image route straight to Anthropic (the only
vision provider available); text-only turns use Nemotron primary → Anthropic
fallback.

## Nemotron reasoning leak
NVIDIA Nemotron models leak their scratchpad ("The user says...") into
user-facing prose unless reasoning is turned off. Prepend `detailed thinking off`
to the system message (done via `nemotronSystem()` in `aiProvider.ts`).

## Chat-completions only
No audio transcription, no image generation via this integration. STT stays on
the OpenAI integration; image-gen must use another path if ever added.

## Testing implication
Any test that imports a route which pulls in `aiProvider.ts` must mock BOTH
`@workspace/integrations-openrouter-ai` and `@workspace/integrations-anthropic-ai`
or it makes real 404-ing network calls. The seam routes by whether a VALID image
survives validation, so image-drop test cases land on OpenRouter (text) while
valid-image cases land on Anthropic — assert on the matching provider's captured
args. Anthropic `messages.stream` is awaited in the seam, so an `async () =>`
mock works.
