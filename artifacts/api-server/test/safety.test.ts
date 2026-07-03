import { describe, expect, it } from "vitest";
import { classifyTopic } from "../src/lib/safety";

/**
 * The deterministic topic backstop. It must catch clearly out-of-scope utility
 * requests while NEVER tripping on grief, loss, or emotional-support language.
 * The primary topic policy lives in the system prompt; this heuristic only
 * exists to redirect the unambiguous cases without spending a model call, so a
 * false positive on grief content would be the real harm.
 */
describe("classifyTopic", () => {
  it("flags unambiguous out-of-scope utility requests", () => {
    const offTopic = [
      "can you write me some code for a login page",
      "debug this python function please",
      "write me an essay about the french revolution",
      "give me a stock tip for tomorrow",
      "what's the weather today",
      "solve this equation for x",
      "translate the following into spanish",
    ];
    for (const msg of offTopic) {
      expect(classifyTopic(msg), `should be off_topic: "${msg}"`).toBe(
        "off_topic",
      );
    }
  });

  it("never flags grief, loss, or emotional-support language", () => {
    const inScope = [
      "I miss my mother so much it physically hurts",
      "I feel lost and empty since he died",
      "how do I write a letter to my late husband",
      "I keep thinking about our last conversation",
      "the grief comes in waves and I cannot calculate why",
      "help me find the words for how much I loved her",
      "I don't know how to carry this weight",
      "some days I can barely get out of bed",
    ];
    for (const msg of inScope) {
      expect(classifyTopic(msg), `should be in_scope: "${msg}"`).toBe(
        "in_scope",
      );
    }
  });

  it("treats empty or whitespace input as in_scope", () => {
    expect(classifyTopic("")).toBe("in_scope");
    expect(classifyTopic("   ")).toBe("in_scope");
  });
});
