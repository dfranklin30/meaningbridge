import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Guards the journal photo-attach precondition: a photo can only be attached to
 * a *saved* entry (the server route keys photos off a real entry id). For a
 * brand-new, unsaved entry the attach button must be disabled so a user can
 * never fire an upload that has no entry to attach to. A regression here would
 * silently orphan an uploaded blob.
 */

const routeState = vi.hoisted(() => ({ params: {} as Record<string, string> }));

vi.mock("wouter", () => ({
  useParams: () => routeState.params,
  useLocation: () => ["/journal/new", vi.fn()],
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

vi.mock("@workspace/object-storage-web", () => ({
  useUpload: () => ({ uploadFile: vi.fn(), isUploading: false }),
}));

vi.mock("../src/components/voice-input", () => ({
  VoiceInput: () => <div data-testid="voice-input" />,
}));

vi.mock("@workspace/api-client-react", () => ({
  useGetJournalEntry: () => ({ data: undefined }),
  useListJournalPrompts: () => ({ data: [] }),
  useCreateJournalEntry: () => ({ mutateAsync: vi.fn() }),
  useUpdateJournalEntry: () => ({ mutateAsync: vi.fn() }),
  useDeleteJournalEntry: () => ({ mutateAsync: vi.fn() }),
  useReflectOnJournalEntry: () => ({ mutateAsync: vi.fn() }),
  useListJournalPhotos: () => ({ data: [] }),
  useAddJournalPhoto: () => ({ mutateAsync: vi.fn() }),
  useDeleteJournalPhoto: () => ({ mutateAsync: vi.fn() }),
  getListJournalPhotosQueryKey: () => ["journal-photos"],
  getListJournalEntriesQueryKey: () => ["journal-entries"],
  getGetJournalEntryQueryKey: () => ["journal-entry"],
}));

const { default: JournalEditor } = await import("../src/pages/journal/editor");

function renderEditor() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <JournalEditor />
    </QueryClientProvider>,
  );
}

describe("JournalEditor photo attach gating", () => {
  it("disables the attach-photo button for a new (unsaved) entry", () => {
    routeState.params = {}; // no id -> new entry
    renderEditor();
    const attach = screen.getByRole("button", { name: /attach a photo/i });
    expect(attach).toBeDisabled();
  });

  it("enables the attach-photo button once the entry has been saved", () => {
    routeState.params = { id: "7" }; // existing entry
    renderEditor();
    const attach = screen.getByRole("button", { name: /attach a photo/i });
    expect(attach).not.toBeDisabled();
  });
});
