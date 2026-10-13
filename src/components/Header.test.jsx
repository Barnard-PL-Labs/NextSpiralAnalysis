import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Header from "./Header";

// Hoisted so the next/navigation factory below can close over them: vi.mock
// calls are lifted above ordinary const declarations.
const { pushMock, replaceMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  replaceMock: vi.fn(),
}));

// Header calls useRouter/usePathname. Without this the App Router throws
// "invariant expected app router to be mounted".
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
  usePathname: () => "/",
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/authProvider", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/lib/researcherModeContext", () => ({
  useResearcherMode: vi.fn(),
}));

vi.mock("@/components/LoginModal", () => ({
  default: ({ isOpen }) => (isOpen ? <div>Login Modal</div> : null),
}));

vi.mock("@fortawesome/react-fontawesome", () => ({
  FontAwesomeIcon: () => <span>menu</span>,
}));

vi.mock("@fortawesome/free-solid-svg-icons", () => ({
  faBars: {},
  faTimes: {},
}));

import { useAuth } from "@/lib/authProvider";
import { useResearcherMode } from "@/lib/researcherModeContext";

const logoutMock = vi.fn();

describe("Header logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    logoutMock.mockResolvedValue(undefined);
    useAuth.mockReturnValue({
      user: { email: "alice.smith@example.com" },
      username: "alice",
      logout: logoutMock,
    });
    useResearcherMode.mockReturnValue({ researcherMode: false });
    // Header decides it is mobile below 1024px, which is what reveals the
    // hamburger menu this test drives.
    window.innerWidth = 500;
  });

  it("signs the user out from the mobile menu and returns home", async () => {
    const user = userEvent.setup();

    render(<Header />);

    await user.click(screen.getByRole("button", { name: /menu/i }));
    await user.click(screen.getByText("Log out"));

    // Logout goes through the auth provider, which owns the Supabase call;
    // Header's job is to invoke it and navigate away.
    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith("/");
  });

  it("offers sign in instead when nobody is logged in", async () => {
    const user = userEvent.setup();
    useAuth.mockReturnValue({ user: null, username: null, logout: logoutMock });

    render(<Header />);

    await user.click(screen.getByRole("button", { name: /menu/i }));

    expect(screen.getByText("Sign in")).toBeInTheDocument();
    expect(screen.queryByText("Log out")).not.toBeInTheDocument();
  });
});
