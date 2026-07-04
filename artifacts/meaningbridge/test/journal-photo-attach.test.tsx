import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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
  deletePhoto: vi.fn(),
  photos: [] as { id: number; objectPath: string }[],
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
  useListJournalPhotos: () => ({ data: mocks.photos }),
  useAddJournalPhoto: () => ({ mutateAsync: mocks.addPhoto }),
  useDeleteJournalPhoto: () => ({ mutateAsync: mocks.deletePhoto }),
  getListJournalPhotosQueryKey: () => ["journal-photos"],
  getListJournalEntriesQueryKey: () => ["journal-entries"],
  getGetJournalEntryQueryKey: () => ["journal-entry"],
}));

const { default: JournalEditor } = await import("../src/pages/journal/editor");

function renderEditor() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={client}>
      <JournalEditor />
    </QueryClientProvider>,
  );
  return { ...view, client };
}

function imageFile(name: string): File {
  return new File(["x"], name, { type: "image/png" });
}

const PENDING_ALT = "A photograph to add to this entry";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.params = {}; // no id -> brand-new entry
  mocks.photos = [];
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

/**
 * Guards the already-saved-entry photo path (Task #65) — the common flow where a
 * user opens a saved entry and adds a memory. Unlike the new-entry path there is
 * a real entry id to bind to, so a chosen photo uploads + attaches immediately.
 * These pin the three durable guarantees for that branch:
 *   1. choosing a photo uploads it and attaches it to the EXISTING entry id, then
 *      refreshes the photo list (no pending strip involved),
 *   2. a non-image file or an over-10 MB image is rejected before any upload,
 *      surfacing the calm size/type message,
 *   3. removing a saved photo calls the delete mutation, and on failure shows the
 *      calm "could not be removed" message instead of leaving a broken tile.
 */
describe("JournalEditor saved-entry photo attach, guards, and delete", () => {
  it("uploads and attaches a chosen photo to the existing entry id and refreshes the list", async () => {
    mocks.params = { id: "5" }; // existing entry -> not new
    const user = userEvent.setup();
    mocks.uploadFile.mockResolvedValueOnce({ objectPath: "/objects/z" });
    mocks.addPhoto.mockResolvedValue({});

    const { container, client } = renderEditor();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    await user.upload(fileInput, [imageFile("z.png")]);

    await waitFor(() => expect(mocks.uploadFile).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.addPhoto).toHaveBeenCalledTimes(1));
    // Attaches to the real entry id, not the "new" sentinel path.
    expect(mocks.addPhoto).toHaveBeenCalledWith({
      entryId: 5,
      data: { objectPath: "/objects/z" },
    });
    // The photo list is refreshed so the new tile appears.
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["journal-photos"] }),
    );
    // A saved entry uploads immediately; no local pending strip is used.
    expect(screen.queryAllByAltText(PENDING_ALT)).toHaveLength(0);
    expect(mocks.createEntry).not.toHaveBeenCalled();
  });

  it("rejects a non-image file and an oversized image before any upload, with a calm message", async () => {
    mocks.params = { id: "5" };

    const { container } = renderEditor();
    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    // fireEvent.change bypasses the input's accept="image/*" filter so the
    // component's own type/size guards are what do the rejecting.
    const pdf = new File(["x"], "notes.pdf", { type: "application/pdf" });
    fireEvent.change(fileInput, { target: { files: [pdf] } });
    await waitFor(() =>
      expect(screen.getByText(/that file is not an image/i)).toBeInTheDocument(),
    );
    expect(mocks.uploadFile).not.toHaveBeenCalled();
    expect(mocks.addPhoto).not.toHaveBeenCalled();

    // Over 10 MB image: rejected with the size message, still no upload.
    const big = new File([new Uint8Array(11 * 1024 * 1024)], "big.png", {
      type: "image/png",
    });
    fireEvent.change(fileInput, { target: { files: [big] } });
    await waitFor(() =>
      expect(screen.getByText(/larger than 10 MB/i)).toBeInTheDocument(),
    );
    expect(mocks.uploadFile).not.toHaveBeenCalled();
    expect(mocks.addPhoto).not.toHaveBeenCalled();
  });

  it("deletes a saved photo via the delete mutation and shows a calm message on failure", async () => {
    mocks.params = { id: "5" };
    mocks.photos = [{ id: 10, objectPath: "/objects/x" }];
    mocks.deletePhoto.mockRejectedValueOnce(new Error("delete failed"));
    const user = userEvent.setup();

    renderEditor();

    // The saved tile is present before the failed delete.
    expect(
      screen.getByAltText("A photograph in this entry"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /remove photo/i }));

    await waitFor(() =>
      expect(mocks.deletePhoto).toHaveBeenCalledWith({ photoId: 10 }),
    );
    await waitFor(() =>
      expect(
        screen.getByText(/that image could not be removed/i),
      ).toBeInTheDocument(),
    );
    // The tile is not torn down on failure — no broken/empty state left behind.
    expect(
      screen.getByAltText("A photograph in this entry"),
    ).toBeInTheDocument();
  });
});
