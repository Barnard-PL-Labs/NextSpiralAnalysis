import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Header from "./Header";
import { supabase } from "@/lib/supabaseClient";

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

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      signOut: vi.fn(),
    },
  },
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

describe("Header logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({
      user: {
        email: "alice.smith@example.com",
      },
    });
    useResearcherMode.mockReturnValue({
      researcherMode: false,
    });
    supabase.auth.signOut.mockResolvedValue({ error: null });
    window.innerWidth = 500;
  });

  it("signs the user out from the mobile menu", async () => {
    const user = userEvent.setup();

    render(<Header />);

    await user.click(screen.getByRole("button", { name: /menu/i }));
    await user.click(screen.getByText("Logout"));

    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
  });
});
