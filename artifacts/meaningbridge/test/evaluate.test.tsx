import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Guards the /evaluate save contract: sliders left untouched must NOT be sent as
 * a rating (the "untouched = skipped/null" behavior), and only the dimensions
 * the visitor actually moved are persisted. Since submission is fire-and-forget
 * on the email side, a regression that silently rated every slider (or dropped
 * touched ones) would go unnoticed without this coverage.
 */

const mutateAsyncMock = vi.hoisted(() => vi.fn());

vi.mock("@workspace/api-client-react", () => ({
  useCreateSandboxFeedback: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
  }),
}));

const { default: EvaluatePage } = await import("../src/pages/evaluate");

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <EvaluatePage />
    </QueryClientProvider>,
  );
}

describe("EvaluatePage only submits the ratings the visitor actually touched", () => {
  beforeEach(() => {
    mutateAsyncMock.mockReset();
    mutateAsyncMock.mockResolvedValue({ ok: true });
  });

  it("sends only moved sliders as ratings, omits untouched ones, and includes consentToShare", async () => {
    const user = userEvent.setup();
    renderPage();

    // Move two sliders; range inputs are set via fireEvent.change. The aria-label
    // starts as "<label>, not yet rated" before the slider is touched.
    const navSlider = screen.getByRole("slider", {
      name: /Ease of navigation, not yet rated/i,
    });
    const aestheticsSlider = screen.getByRole("slider", {
      name: /^Aesthetics, not yet rated/i,
    });

    fireEvent.change(navSlider, { target: { value: "8" } });
    fireEvent.change(aestheticsSlider, { target: { value: "3" } });

    // Consent to share as a testimonial.
    await user.click(screen.getByRole("checkbox"));

    await user.click(
      screen.getByRole("button", { name: /share my reflection/i }),
    );

    expect(mutateAsyncMock).toHaveBeenCalledTimes(1);
    const payload = mutateAsyncMock.mock.calls[0][0].data;

    // Only the two touched dimensions are present; every untouched slider is absent.
    expect(payload.ratings).toEqual({ navigation: 8, aesthetics: 3 });
    expect(Object.keys(payload.ratings)).toHaveLength(2);
    expect(payload.ratings.tone).toBeUndefined();
    expect(payload.ratings.trust).toBeUndefined();
    expect(payload.ratings.recommend).toBeUndefined();

    // No comments were opened, so comments collapses to null.
    expect(payload.comments).toBeNull();
    expect(payload.consentToShare).toBe(true);
    expect(payload.source).toBe("site-eval");
    // Untouched free-text fields are null, not empty strings.
    expect(payload.additionalSuggestions).toBeNull();
    expect(payload.name).toBeNull();
    expect(payload.role).toBeNull();
  });

  it("blocks submission and never calls the mutation when nothing is rated", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(
      screen.getByRole("button", { name: /share my reflection/i }),
    );

    expect(mutateAsyncMock).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/please rate at least one dimension/i),
    ).toBeInTheDocument();
  });
});

/**
 * Guards the per-dimension "Add a comment" flow: a written comment on a rated
 * dimension is the most valuable qualitative signal in the form, so it must
 * never be silently dropped from the mutation payload. Conversely, a comment box
 * opened but left empty, and a comment typed on a dimension the visitor never
 * rated, must NOT be sent (there is no rating for them to annotate).
 */
describe("EvaluatePage never drops a written comment attached to a rating", () => {
  beforeEach(() => {
    mutateAsyncMock.mockReset();
    mutateAsyncMock.mockResolvedValue({ ok: true });
  });

  // Range inputs are set via fireEvent.change (userEvent does not drive sliders).
  function rateSlider(label: string, value: number) {
    const slider = screen.getByRole("slider", {
      name: new RegExp("^" + label),
    });
    fireEvent.change(slider, { target: { value: String(value) } });
  }

  // The row root carries the `py-5` class; scoping to it lets us find that
  // dimension's own "Add a comment" button and textarea unambiguously.
  function rowFor(label: string): HTMLElement {
    const slider = screen.getByRole("slider", {
      name: new RegExp("^" + label),
    });
    const row = slider.closest("div.py-5");
    if (!(row instanceof HTMLElement)) {
      throw new Error(`Could not find row for "${label}"`);
    }
    return row;
  }

  async function openComment(
    user: ReturnType<typeof userEvent.setup>,
    label: string,
    text: string,
  ) {
    const row = rowFor(label);
    await user.click(
      within(row).getByRole("button", { name: /add a comment/i }),
    );
    const textarea = within(row).getByRole("textbox");
    if (text) await user.type(textarea, text);
  }

  it("sends a comment typed on a rated dimension, keyed to that dimension", async () => {
    const user = userEvent.setup();
    renderPage();

    rateSlider("Ease of navigation", 7);
    await openComment(user, "Ease of navigation", "The bridge metaphor moved me.");

    await user.click(
      screen.getByRole("button", { name: /share my reflection/i }),
    );

    expect(mutateAsyncMock).toHaveBeenCalledTimes(1);
    const payload = mutateAsyncMock.mock.calls[0][0].data;

    expect(payload.ratings).toEqual({ navigation: 7 });
    expect(payload.comments).toEqual({
      navigation: "The bridge metaphor moved me.",
    });
  });

  it("omits a comment left empty and a comment typed on an unrated dimension", async () => {
    const user = userEvent.setup();
    renderPage();

    // Rate two dimensions so submission is allowed.
    rateSlider("Ease of navigation", 6);
    rateSlider("Aesthetics", 9);

    // Open a comment on the rated navigation row but leave it empty.
    await openComment(user, "Ease of navigation", "");

    // Type a comment on "Tone", which the visitor never rated.
    await openComment(user, "Tone of language for grievers", "Felt gentle.");

    await user.click(
      screen.getByRole("button", { name: /share my reflection/i }),
    );

    const payload = mutateAsyncMock.mock.calls[0][0].data;

    // Empty comment and the unrated-dimension comment are both dropped, so the
    // comments map collapses to null. Ratings are untouched.
    expect(payload.comments).toBeNull();
    expect(payload.ratings).toEqual({ navigation: 6, aesthetics: 9 });
  });

  it("persists an optional dimension (fidelity) rating and its comment", async () => {
    const user = userEvent.setup();
    renderPage();

    rateSlider("Fidelity to the voice of the deceased", 10);
    await openComment(
      user,
      "Fidelity to the voice of the deceased",
      "It sounded like my mother.",
    );

    await user.click(
      screen.getByRole("button", { name: /share my reflection/i }),
    );

    const payload = mutateAsyncMock.mock.calls[0][0].data;

    expect(payload.ratings).toEqual({ fidelity: 10 });
    expect(payload.comments).toEqual({
      fidelity: "It sounded like my mother.",
    });
  });
});
