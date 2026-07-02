import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Guards the appointment-confirm trust contract: the outcome shown must be the
 * server's actual status, never the button the patient clicked. A token can be
 * resolved out from under the patient (e.g. the care team cancelled, or a
 * duplicate link already declined it), so the POST echoes the true state and the
 * page must render *that*, not an optimistic "you're confirmed".
 */

const respondMock = vi.hoisted(() => vi.fn());

vi.mock("wouter", () => ({
  useRoute: () => [true, { token: "test-token" }],
}));

vi.mock("@workspace/api-client-react", () => ({
  useGetAppointmentByToken: () => ({
    data: {
      title: "MeaningBridge session",
      startsAt: "2026-07-10T15:00:00.000Z",
      endsAt: "2026-07-10T15:30:00.000Z",
      status: "proposed",
      providerName: "Dr. Neimeyer",
      location: null,
    },
    isLoading: false,
    isError: false,
  }),
  useRespondToAppointment: () => ({ mutateAsync: respondMock, isPending: false }),
  getGetAppointmentByTokenQueryKey: () => ["appointment", "test-token"],
}));

const { default: AppointmentConfirm } = await import(
  "../src/pages/appointment-confirm"
);

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AppointmentConfirm />
    </QueryClientProvider>,
  );
}

describe("AppointmentConfirm renders the server's status, not the clicked button", () => {
  beforeEach(() => {
    respondMock.mockReset();
  });

  it("shows the decline outcome when the server reports declined despite a confirm click", async () => {
    // The token was already resolved to "declined" elsewhere; the server echoes
    // that truth even though the patient pressed "Yes, confirm".
    respondMock.mockResolvedValue({ status: "declined" });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /yes, confirm/i }));

    expect(
      await screen.findByText(/you have let your care team know/i),
    ).toBeInTheDocument();
    // It must NOT show the confirmed message that the clicked button implied.
    expect(screen.queryByText(/you are confirmed/i)).not.toBeInTheDocument();
  });

  it("shows the confirmed outcome when the server actually confirms", async () => {
    respondMock.mockResolvedValue({ status: "confirmed" });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /yes, confirm/i }));

    expect(await screen.findByText(/you are confirmed/i)).toBeInTheDocument();
  });
});
