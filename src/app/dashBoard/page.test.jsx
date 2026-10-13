import { render, screen, waitFor } from "@testing-library/react";
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
  default: new Proxy({}, { get: (_, prop) => String(prop) }),
}));

// Dashboard reads the signed-in user from the auth provider and asks the server
// whether they are a superuser. Both are stubbed so this exercises the
// dashboard rather than those dependencies.
vi.mock("@/lib/authProvider", () => ({ useAuth: vi.fn() }));
vi.mock("@/lib/useSuperuser", () => ({ useSuperuser: vi.fn() }));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: { getSession: vi.fn() },
    from: vi.fn(),
    storage: { from: vi.fn() },
  },
}));

import { useAuth } from "@/lib/authProvider";
import { useSuperuser } from "@/lib/useSuperuser";

const USER = { id: "user-1", email: "alice.smith@example.com" };

// Three results across two sessions; the newest session has two drawings.
const ROWS = [
  {
    id: "r1", drawing_id: "drawing-1", session_id: "session-1",
    created_at: "2026-03-03T12:00:00.000Z", result_data: { DOS: "1.0" },
    user_id: USER.id, email: USER.email,
    drawings: { id: "d1", drawing_data: [{ x: 1, y: 2 }], hand_side: "R" },
  },
  {
    id: "r2", drawing_id: "drawing-2", session_id: "session-1",
    created_at: "2026-03-03T11:00:00.000Z", result_data: { DOS: "3.0" },
    user_id: USER.id, email: USER.email,
    drawings: { id: "d2", drawing_data: [{ x: 2, y: 3 }], hand_side: "R" },
  },
  {
    id: "r3", drawing_id: "drawing-3", session_id: "session-2",
    created_at: "2026-03-01T09:30:00.000Z", result_data: { DOS: "5.0" },
    user_id: USER.id, email: USER.email,
    drawings: { id: "d3", drawing_data: [{ x: 4, y: 5 }], hand_side: "L" },
  },
];

// Captures the .eq() arguments so the test can assert the query is scoped to
// the signed-in user rather than fetching everyone's rows.
let resultsEq;

const stubSupabase = (rows) => {
  resultsEq = vi.fn().mockResolvedValue({ data: rows, error: null });
  supabase.from.mockImplementation((table) => {
    if (table === "profiles") {
      return {
        select: () => ({
          eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
        }),
      };
    }
    if (table === "api_results") {
      return { select: () => ({ order: () => ({ eq: resultsEq }) }) };
    }
    throw new Error(`Unexpected table: ${table}`);
  });
};

describe("Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.innerWidth = 1024;
    useAuth.mockReturnValue({ user: USER });
    useSuperuser.mockReturnValue({ isSuperuser: false, loading: false });
    supabase.storage.from.mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
  });

  it("loads results, scopes them to the signed-in user, and groups them by session", async () => {
    stubSupabase(ROWS);

    render(<Dashboard />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument()
    );

    expect(supabase.from).toHaveBeenCalledWith("profiles");
    expect(supabase.from).toHaveBeenCalledWith("api_results");

    // A non-superuser must only ever see their own rows.
    expect(resultsEq).toHaveBeenCalledWith("user_id", USER.id);

    // Three results collapse into two sessions; the newest holds two drawings.
    expect(screen.getByText(/Latest Result/)).toBeInTheDocument();
    expect(screen.getByText(/2 drawings/)).toBeInTheDocument();
    expect(screen.getByText(/Past Results/)).toBeInTheDocument();
  });

  it("waits for the superuser check before querying", () => {
    stubSupabase(ROWS);
    useSuperuser.mockReturnValue({ isSuperuser: false, loading: true });

    render(<Dashboard />);

    // Still resolving who the user is, so no query should have gone out yet --
    // otherwise it would run once unscoped and again scoped.
    expect(supabase.from).not.toHaveBeenCalled();
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders an empty state when there are no results", async () => {
    stubSupabase([]);

    render(<Dashboard />);

    await waitFor(() =>
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument()
    );

    expect(screen.queryByText(/Latest Result/)).not.toBeInTheDocument();
  });
});
