import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Dashboard from "./page";
import { supabase } from "@/lib/supabaseClient";

vi.mock("../../components/SideBar", () => ({
  default: ({ onSettingsClick }) => (
    <button type="button" onClick={onSettingsClick}>
      Sidebar
    </button>
  ),
}));

vi.mock("../../components/BottomNav", () => ({
  default: ({ onSettingsClick }) => (
    <button type="button" onClick={onSettingsClick}>
      BottomNav
    </button>
  ),
}));

vi.mock("../../components/Pagination", () => ({
  default: ({ currentPage, pageCount }) => (
    <div>{`Pagination ${currentPage}/${pageCount}`}</div>
  ),
}));

vi.mock("../../components/HorizontalSpiralHistory", () => ({
  default: ({ savedDrawings }) => (
    <div>{`Spiral count: ${savedDrawings.length}`}</div>
  ),
}));

vi.mock("../../components/SettingsPopup", () => ({
  default: ({ isOpen }) => (isOpen ? <div>Settings Open</div> : null),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("../../styles/Dashboard.module.css", () => ({
  default: new Proxy(
    {},
    {
      get: (_, prop) => String(prop),
    }
  ),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
    from: vi.fn(),
    storage: {
      from: vi.fn(),
    },
  },
}));

const createProfilesQuery = (profile = null) => ({
  select: vi.fn(() => ({
    eq: vi.fn(() => ({
      maybeSingle: vi.fn().mockResolvedValue({ data: profile, error: null }),
    })),
  })),
});

const createResultsQuery = (rows) => ({
  select: vi.fn(() => ({
    order: vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ data: rows, error: null }),
    })),
  })),
});

describe("Dashboard integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.innerWidth = 1024;

    supabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: "user-1",
            email: "alice.smith@example.com",
          },
        },
      },
      error: null,
    });

    supabase.storage.from.mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: "https://example.com/avatar.png" },
        error: null,
      }),
    });
  });

  it("loads dashboard data from Supabase, groups sessions, and expands past results", async () => {
    const rows = [
      {
        id: "r1",
        drawing_id: "drawing-1",
        session_id: "session-1",
        created_at: "2026-03-03T12:00:00.000Z",
        result_data: { DOS: "1.0" },
        user_id: "user-1",
        email: "alice.smith@example.com",
        drawings: { id: "d1", drawing_data: [{ x: 1, y: 2 }], hand_used: "dominant" },
      },
      {
        id: "r2",
        drawing_id: "drawing-2",
        session_id: "session-1",
        created_at: "2026-03-03T11:00:00.000Z",
        result_data: { DOS: "3.0" },
        user_id: "user-1",
        email: "alice.smith@example.com",
        drawings: { id: "d2", drawing_data: [{ x: 2, y: 3 }], hand_used: "dominant" },
      },
      {
        id: "r3",
        drawing_id: "drawing-3",
        session_id: "session-2",
        created_at: "2026-03-01T09:30:00.000Z",
        result_data: { DOS: "5.0" },
        user_id: "user-1",
        email: "alice.smith@example.com",
        drawings: { id: "d3", drawing_data: [{ x: 4, y: 5 }], hand_used: "non_dominant" },
      },
    ];

    supabase.from.mockImplementation((table) => {
      if (table === "profiles") {
        return createProfilesQuery({ avatar_path: "avatars/alice.png" });
      }

      if (table === "api_results") {
        return createResultsQuery(rows);
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    render(<Dashboard />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();

    await screen.findByText("Latest Result");

    expect(screen.getByText("Welcome back, Alice!")).toBeInTheDocument();
    expect(screen.getByText(/Average DOS Score/i)).toBeInTheDocument();
    expect(screen.getByText("2 Drawings")).toBeInTheDocument();
    expect(screen.getByText("Dominant Hand")).toBeInTheDocument();
    expect(screen.getByText("Spiral count: 2")).toBeInTheDocument();
    expect(screen.getByText("Past Results - Your Overall Average: 3.50")).toBeInTheDocument();
    expect(screen.getByText(/1\. Avg DOS:5\.0000/)).toBeInTheDocument();

    await userEvent.click(screen.getByText(/1\. Avg DOS:5\.0000/));

    await waitFor(() => {
      expect(screen.getAllByText("View Full Analysis")).toHaveLength(2);
    });

    expect(screen.getByText("Non-Dominant Hand")).toBeInTheDocument();
    expect(screen.getByText("Pagination 1/1")).toBeInTheDocument();
    expect(supabase.from).toHaveBeenCalledWith("profiles");
    expect(supabase.from).toHaveBeenCalledWith("api_results");
  });
});
