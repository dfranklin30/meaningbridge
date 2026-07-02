import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Guards the companion task slug -> id contract. Companion tasks carry a
 * practice *slug*, but the practice player route is keyed by numeric id. The
 * panel must resolve the slug against the loaded practices before deep-linking,
 * and must hide the link when no practice matches (so it never opens nothing).
 */

const fixtures = vi.hoisted(() => ({
  tasks: [
    {
      id: 1,
      title: "A breathing practice",
      body: null,
      practiceSlug: "box-breathing",
      status: "active",
      source: "companion",
      dueAt: null,
      completedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: 2,
      title: "A task pointing at a missing practice",
      body: null,
      practiceSlug: "no-such-practice",
      status: "active",
      source: "companion",
      dueAt: null,
      completedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  practices: [
    {
      id: 42,
      slug: "box-breathing",
      title: "Box breathing",
      category: "breathwork",
      durationMinutes: 5,
      summary: "",
      steps: [],
      breathPattern: null,
    },
  ],
}));

vi.mock("@workspace/api-client-react", () => ({
  useListCompanionMemory: () => ({ data: [] }),
  useAddCompanionMemory: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteCompanionMemory: () => ({ mutateAsync: vi.fn() }),
  getListCompanionMemoryQueryKey: () => ["companion-memory"],
  useListCompanionTasks: () => ({ data: fixtures.tasks }),
  useCreateCompanionTask: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateCompanionTask: () => ({ mutateAsync: vi.fn() }),
  getListCompanionTasksQueryKey: () => ["companion-tasks"],
  useListPractices: () => ({ data: fixtures.practices }),
  getListPracticesQueryKey: () => ["practices"],
}));

const { CompanionPanels } = await import("../src/components/companion-panels");

function renderPanels() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <CompanionPanels />
    </QueryClientProvider>,
  );
}

describe("CompanionPanels practice slug -> id linking", () => {
  it("links a task's practice slug to the numeric practice id", () => {
    renderPanels();
    const links = screen.getAllByRole("link", { name: /open this practice/i });
    // Only the task whose slug matches a loaded practice gets a link.
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/practices/42");
  });

  it("hides the link when the slug matches no loaded practice", () => {
    renderPanels();
    // The second task references an unknown slug; its title renders but no link.
    expect(
      screen.getByText("A task pointing at a missing practice"),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /open this practice/i })).toHaveLength(1);
  });
});
