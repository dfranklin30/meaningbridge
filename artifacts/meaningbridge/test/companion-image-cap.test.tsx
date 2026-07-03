import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Guards the companion image-attachment cap: a user can select any number of
 * images, but at most four ride along with a chat turn (the vision payload is
 * kept small and ephemeral). A regression that dropped the slice would balloon
 * the request; one that mis-counted would silently discard the user's images.
 */

vi.mock("wouter", () => ({
  useParams: () => ({ sessionId: "1" }),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

vi.mock("../src/components/voice-input", () => ({
  VoiceInput: () => <div data-testid="voice-input" />,
}));

vi.mock("@workspace/api-client-react", () => ({
  useGetChatSession: () => ({
    data: {
      id: 1,
      mode: "continuing-bonds",
      conversationType: null,
      deceasedId: 0,
      messages: [],
    },
  }),
  useListDeceasedPhotos: () => ({ data: [] }),
  getGetChatSessionQueryKey: () => ["chat-session", 1],
  getListDeceasedPhotosQueryKey: () => ["deceased-photos", 0],
}));

// jsdom does not implement scrollIntoView, which the session calls on new turns.
Element.prototype.scrollIntoView = vi.fn();

const { default: CompanionSession } = await import(
  "../src/pages/companion/session"
);

function renderSession() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <CompanionSession />
    </QueryClientProvider>,
  );
}

function imageFile(name: string): File {
  return new File(["x"], name, { type: "image/png" });
}

describe("CompanionSession image attachment cap", () => {
  it("keeps at most four attachments even when more are selected", async () => {
    const user = userEvent.setup();
    const { container } = renderSession();

    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(input).not.toBeNull();

    await user.upload(input, [
      imageFile("a.png"),
      imageFile("b.png"),
      imageFile("c.png"),
      imageFile("d.png"),
      imageFile("e.png"),
      imageFile("f.png"),
    ]);

    await waitFor(() => {
      expect(screen.getAllByAltText("Attached preview")).toHaveLength(4);
    });
  });
});
