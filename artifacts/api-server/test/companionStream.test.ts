import { describe, it, expect, vi, beforeEach } from "vitest";

// Controllable mock hooks shared with the mocked provider modules. `orCreate` is
// swapped per test to simulate OpenRouter behavior; `anthCalls` counts fallback.
const hooks = vi.hoisted(() => ({
  orCreate: null as null | ((args: unknown) => unknown),
  orCalls: 0,
  anthCalls: 0,
}));

vi.mock("@workspace/integrations-openrouter-ai", () => ({
  openrouter: {
    chat: {
      completions: {
        create: (args: unknown) => {
          hooks.orCalls += 1;
          return hooks.orCreate!(args);
        },
      },
    },
  },
}));

vi.mock("@workspace/integrations-anthropic-ai", () => ({
  anthropic: {
    messages: {
      stream: () => {
        hooks.anthCalls += 1;
        return (async function* () {
          yield {
            type: "content_block_delta",
            delta: { type: "text_delta", text: "[fallback]" },
          };
        })();
      },
    },
  },
}));

import { companionStream } from "../src/lib/aiProvider";

// Build an OpenRouter-style chat completion stream from text deltas. `throwAfter`
// simulates a mid-stream failure (after some tokens already emitted).
function orStream(texts: string[], opts: { throwAfter?: boolean } = {}) {
  return (async function* () {
    for (const t of texts) {
      yield { choices: [{ delta: { content: t } }] };
    }
    if (opts.throwAfter) throw new Error("mid-stream failure");
  })();
}

async function collect(gen: AsyncGenerator<string>): Promise<string> {
  let out = "";
  for await (const chunk of gen) out += chunk;
  return out;
}

const baseInput = {
  system: "you are a calm companion",
  history: [{ role: "user" as const, content: "hello" }],
};

describe("companionStream provider seam", () => {
  beforeEach(() => {
    hooks.orCreate = null;
    hooks.orCalls = 0;
    hooks.anthCalls = 0;
  });

  it("falls back to Anthropic when OpenRouter fails on every attempt", async () => {
    hooks.orCreate = () => {
      throw new Error("openrouter down");
    };
    const out = await collect(companionStream(baseInput));
    // Primary + retry both fail, then Anthropic fallback produces the reply.
    expect(hooks.orCalls).toBe(2);
    expect(hooks.anthCalls).toBe(1);
    expect(out).toBe("[fallback]");
  });

  it("does not retry or fall back once OpenRouter has emitted tokens", async () => {
    hooks.orCreate = () => orStream(["a", "b"]);
    const out = await collect(companionStream(baseInput));
    expect(out).toBe("ab");
    expect(hooks.orCalls).toBe(1);
    expect(hooks.anthCalls).toBe(0);
  });

  it("propagates a mid-stream error without falling back (would duplicate text)", async () => {
    hooks.orCreate = () => orStream(["a"], { throwAfter: true });
    let out = "";
    let err: unknown;
    try {
      for await (const chunk of companionStream(baseInput)) out += chunk;
    } catch (e) {
      err = e;
    }
    expect(out).toBe("a");
    expect(err).toBeInstanceOf(Error);
    expect(hooks.orCalls).toBe(1);
    expect(hooks.anthCalls).toBe(0);
  });

  it("treats an empty stream as a failed attempt and falls back", async () => {
    hooks.orCreate = () => orStream([]);
    const out = await collect(companionStream(baseInput));
    // Both OpenRouter attempts emit nothing, so Anthropic fallback runs.
    expect(hooks.orCalls).toBe(2);
    expect(hooks.anthCalls).toBe(1);
    expect(out).toBe("[fallback]");
  });
});
