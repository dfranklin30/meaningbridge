import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
