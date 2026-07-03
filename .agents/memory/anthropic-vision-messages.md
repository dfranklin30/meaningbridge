---
name: Anthropic vision message blocks
description: Constraints when sending base64 image blocks to the Anthropic SDK in chat.
---

When attaching images to an Anthropic `messages.stream` call, the base64 `source.media_type`
is a strict string-literal union (`"image/gif" | "image/jpeg" | "image/png" | "image/webp"`),
not `string`. Parse the data URL, then narrow/validate against that allow-list before building
the block or `tsc` rejects it (TS2322 on `MessageParam`).

**Why:** the SDK's `Base64ImageSource` type is a literal union; a plain `string` from a regex
capture group is not assignable.

**How to apply:** define an `ALLOWED_MEDIA_TYPES` const tuple, skip any data URL whose media
type is not in it, and cast the matched group to that union type. Inject image blocks only into
the final user turn.

## Ephemeral companion attachments
Companion chat images are intentionally NOT persisted (companion is ephemeral). They are sent
as base64 only for the single request. To show them in the user's bubble, the client keeps a
transient "inflight" copy (message text + data URLs) rendered during streaming, then clears it
in `finalize()` when the query invalidates and the persisted (text-only) message reappears.
