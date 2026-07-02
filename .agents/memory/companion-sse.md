---
name: Companion SSE contract
description: How the companion chat stream frames events and the client state the UI must reset.
---

The companion chat endpoint streams `data: {json}` SSE frames with `type` of
`delta | crisis | done | error`. The stream can close *cleanly* after emitting an
`error` frame (the server catches, sends `{type:"error"}`, then `res.end()`), so the
reader loop ends normally rather than throwing.

**Rule:** the client must handle the `error` frame explicitly — reset streaming,
thinking, pending buffer, and doneRef, and surface a calm retry message. Relying only
on `done` (which triggers finalize) or on the fetch `catch` block leaves the UI stuck
in the thinking/streaming state when the server reports a mid-stream error.

**Why:** a mid-stream Anthropic failure emits `error` and closes cleanly; without an
`error` branch the thinking dots never clear and the input stays disabled.

**How to apply:** any change to the chat SSE reveal/finalize pipeline must keep the
`error` branch (and the `catch`) resetting the same state that `finalize` does.
