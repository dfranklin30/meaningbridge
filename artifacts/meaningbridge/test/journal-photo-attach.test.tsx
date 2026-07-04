import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Guards the new-entry photo-attach flow (Task #61): a brand-new entry has no id
 * to bind photos to, so chosen images are held locally and uploaded the moment
 * the entry is first saved (the flush loop in `handleSave`). A regression here
 * would silently drop a grieving user's cherished photo without any error, so
 * these tests pin the three durable guarantees:
 *   1. choosing photos then saving uploads + attaches them to the new entry id,
 *   2. abandoning a new entry uploads nothing and revokes its local object URLs,
 *   3. a partial upload failure keeps the failed photo (with a calm message)
 *      rather than losing it.
 */

const mocks = vi.hoisted(() => ({
  params: {} as Record<string, string>,
  setLocation: vi.fn(),
  uploadFile: vi.fn(),
  createEntry: vi.fn(),
  addPhoto: vi.fn(),
  createObjectURL: vi.fn(),
  revokeObjectURL: vi.fn(),
}));

vi.mock("wouter", () => ({
  useParams: () => mocks.params,
  useLocation: () => ["/journal/new", mocks.setLocation],
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

vi.mock("@workspace/object-storage-web", () => ({
  useUpload: () => ({ uploadFile: mocks.uploadFile, isUploading: false }),
}));

vi.mock("../src/components/voice-input", () => ({
  VoiceInput: () => <div data-testid="voice-input" />,
}));

vi.mock("@workspace/api-client-react", () => ({
  useGetJournalEntry: () => ({ data: undefined }),
  useListJournalPrompts: () => ({ data: [] }),
  useCreateJournalEntry: () => ({ mutateAsync: mocks.createEntry }),
  useUpdateJournalEntry: () => ({ mutateAsync: vi.fn() }),
  useDeleteJournalEntry: () => ({ mutateAsync: vi.fn() }),
  useReflectOnJournalEntry: () => ({ mutateAsync: vi.fn() }),
  useListJournalPhotos: () => ({ data: [] }),
  useAddJournalPhoto: () => ({ mutateAsync: mocks.addPhoto }),
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

function imageFile(name: string): File {
  return new File(["x"], name, { type: "image/png" });
}

const PENDING_ALT = "A photograph to add to this entry";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.params = {}; // no id -> brand-new entry
  let n = 0;
  mocks.createObjectURL.mockImplementation(() => `blob:mock/${++n}`);
  // jsdom does not implement object-URL helpers; stub them so the component's
  // local preview + revoke-on-cleanup paths can run and be asserted.
  URL.createObjectURL = mocks.createObjectURL as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = mocks.revokeObjectURL as unknown as typeof URL.revokeObjectURL;
});

describe("JournalEditor new-entry photo flush on save", () => {
  it("uploads and attaches pending photos to the newly created entry id when saved", async () => {
    const user = userEvent.setup();
    mocks.uploadFile
      .mockResolvedValueOnce({ objectPath: "/objects/a" })
      .mockResolvedValueOnce({ objectPath: "/objects/b" });
    mocks.createEntry.mockResolvedValue({ id: 42 });
    mocks.addPhoto.mockResolvedValue({});

    const { container } = renderEditor();

    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    await user.upload(fileInput, [imageFile("a.png"), imageFile("b.png")]);

    // Held locally as previews; nothing is uploaded before save.
    await waitFor(() =>
      expect(screen.getAllByAltText(PENDING_ALT)).toHaveLength(2),
    );
    expect(mocks.uploadFile).not.toHaveBeenCalled();
    expect(mocks.addPhoto).not.toHaveBeenCalled();

    await user.type(screen.getByPlaceholderText("Entry Title"), "For you");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(mocks.createEntry).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.addPhoto).toHaveBeenCalledTimes(2));

    expect(mocks.uploadFile).toHaveBeenCalledTimes(2);
    // Every attach carries the id returned by createEntry, not the "new" sentinel.
    for (const call of mocks.addPhoto.mock.calls) {
      expect(call[0].entryId).toBe(42);
    }
    expect(mocks.addPhoto.mock.calls.map((c) => c[0].data.objectPath)).toEqual([
      "/objects/a",
      "/objects/b",
    ]);
    // Navigates to the created entry once saved.
    await waitFor(() =>
      expect(mocks.setLocation).toHaveBeenCalledWith("/journal/42", {
        replace: true,
      }),
    );
  });

  it("uploads nothing and revokes local object URLs when a new entry is abandoned", async () => {
    const user = userEvent.setup();
    const { container, unmount } = renderEditor();

    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    await user.upload(fileInput, [imageFile("a.png"), imageFile("b.png")]);

    await waitFor(() =>
      expect(screen.getAllByAltText(PENDING_ALT)).toHaveLength(2),
    );
    expect(mocks.createObjectURL).toHaveBeenCalledTimes(2);

    // Leaving without saving: no upload, no attach, and the local URLs are freed.
    unmount();

    expect(mocks.uploadFile).not.toHaveBeenCalled();
    expect(mocks.addPhoto).not.toHaveBeenCalled();
    expect(mocks.createEntry).not.toHaveBeenCalled();
    expect(mocks.revokeObjectURL).toHaveBeenCalledTimes(2);
    expect(mocks.revokeObjectURL.mock.calls.map((c) => c[0]).sort()).toEqual([
      "blob:mock/1",
      "blob:mock/2",
    ]);
  });

  it("keeps a photo that fails to upload in the pending strip with a calm message", async () => {
    const user = userEvent.setup();
    // First photo uploads fine; second returns null -> uploadAndAttach throws.
    mocks.uploadFile
      .mockResolvedValueOnce({ objectPath: "/objects/a" })
      .mockResolvedValueOnce(null);
    mocks.createEntry.mockResolvedValue({ id: 7 });
    mocks.addPhoto.mockResolvedValue({});

    const { container } = renderEditor();

    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    await user.upload(fileInput, [imageFile("ok.png"), imageFile("bad.png")]);

    await waitFor(() =>
      expect(screen.getAllByAltText(PENDING_ALT)).toHaveLength(2),
    );

    await user.type(screen.getByPlaceholderText("Entry Title"), "Remember");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    // Only the successful photo is attached; the failed one is retained.
    await waitFor(() => expect(mocks.addPhoto).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getAllByAltText(PENDING_ALT)).toHaveLength(1),
    );
    expect(
      screen.getByText(/some photos could not be attached/i),
    ).toBeInTheDocument();
    // The retained photo's URL is not revoked (still in the strip for retry).
    expect(mocks.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(mocks.revokeObjectURL).toHaveBeenCalledWith("blob:mock/1");
  });
});
