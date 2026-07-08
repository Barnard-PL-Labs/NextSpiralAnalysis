"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/authProvider";
import LoginModal from "@/components/LoginModal";
import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars, faTimes } from "@fortawesome/free-solid-svg-icons";
import { useResearcherMode } from "@/lib/researcherModeContext";

export default function Header() {
  const { user, username: profileUsername, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { researcherMode } = useResearcherMode();
  const [isLoginOpen, setLoginOpen] = useState(false);
  const [loginMessage, setLoginMessage] = useState("");
  const [isClient, setIsClient] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsClient(true);

    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || user) return;

    const currentUrl = new URL(window.location.href);
    if (currentUrl.searchParams.get("confirmed") !== "true") return;

    setLoginMessage("Email confirmed. Log in to continue.");
    setLoginOpen(true);

    currentUrl.searchParams.delete("confirmed");
    router.replace(`${currentUrl.pathname}${currentUrl.search}`, { scroll: false });
  }, [router, user]);

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };
//hi
  const navLinks = [
    { label: "Home", href: "/" },
    { label: "Spiral Analysis", href: "/machine" },
    ...(!researcherMode ? [{ label: "Learn More", href: "/instruction" }] : []),
    { label: "About Us", href: "/info" }
  ];

  return (
    <div>
      <header className="heading fixed top-0 left-0 w-full z-50">
        <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 24px", width: "100%", display: "flex", alignItems: "center" }}>
          {/* Left: brand */}
          <div style={{ flex: 1 }}>
            <Link href="/" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "7px" }}>
              <svg width="20" height="20" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M50 50 Q54 34 66 32 Q82 30 84 50 Q86 72 64 78 Q38 84 28 60 Q16 32 42 18 Q72 4 90 28" stroke="#1E40AF" strokeWidth="7" strokeLinecap="round" fill="none"/>
              </svg>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "15px", fontWeight: 600, color: "var(--color-text-primary)", letterSpacing: "-0.01em" }}>
                Spiral Analysis
              </span>
            </Link>
          </div>

          {/* Center: nav links */}
          {isClient && !isMobile && (
            <nav style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              {navLinks.filter(item => item.label !== "Home").map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link key={item.href} href={item.href} style={{ textDecoration: "none" }}>
                    <span style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "14px",
                      fontWeight: isActive ? 500 : 400,
                      color: isActive ? "#3730a3" : "var(--color-text-secondary)",
                      background: isActive ? "#EEF2FF" : "transparent",
                      borderRadius: "6px",
                      padding: "5px 12px",
                      display: "inline-block",
                      transition: "color 0.15s ease, background 0.15s ease",
                    }}
                      onMouseEnter={e => { if (!isActive) { e.currentTarget.style.color = "#1E40AF"; e.currentTarget.style.background = "#F5F7FF"; } }}
                      onMouseLeave={e => { if (!isActive) { e.currentTarget.style.color = "var(--color-text-secondary)"; e.currentTarget.style.background = "transparent"; } }}
                    >{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          )}

          {/* Right: user / sign in */}
          {isClient && !isMobile && (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "12px" }}>
              {user ? (
                <>
                  <Link href="/dashBoard" style={{ textDecoration: "none" }}>
                    <span style={{ fontFamily: "var(--font-sans)", fontSize: "14px", fontWeight: 400, color: "var(--color-text-secondary)", transition: "color 0.2s ease" }}
                      onMouseEnter={e => e.currentTarget.style.color = "#1E40AF"}
                      onMouseLeave={e => e.currentTarget.style.color = "var(--color-text-secondary)"}
                    >{profileUsername}</span>
                  </Link>
                  <button onClick={handleLogout}
                    style={{ background: "transparent", border: "1px solid #e2e8f0", borderRadius: "7px", padding: "5px 14px", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 500, color: "var(--color-text-secondary)", transition: "border-color 0.15s ease, color 0.15s ease" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "#93c5fd"; e.currentTarget.style.color = "#1E40AF"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.color = "var(--color-text-secondary)"; }}
                  >
                    Logout
                  </button>
                </>
              ) : (
                <button
                  onClick={() => { setLoginMessage(""); setLoginOpen(true); }}
                  style={{ background: "#1E40AF", border: "none", borderRadius: "7px", padding: "5px 16px", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 600, color: "white", transition: "background 0.15s ease, opacity 0.15s ease" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#1634A0"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "#1E40AF"; }}
                >
                  Sign In
                </button>
              )}
            </div>
          )}

          {/* Mobile hamburger */}
          {isMobile && (
            <button onClick={() => setDropdownOpen(!dropdownOpen)} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px" }}>
              <FontAwesomeIcon icon={dropdownOpen ? faTimes : faBars} style={{ fontSize: "18px", color: "var(--color-text-primary)" }} />
            </button>
          )}
        </div>
      </header>

      {isMobile && dropdownOpen && (
        <div className="mobile-dropdown">
          <nav className="flex flex-col w-full py-4">
            {navLinks.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setDropdownOpen(false)}>
                <div className="mobile-nav-item">{item.label}</div>
              </Link>
            ))}
            {user ? (
              <>
                <Link href="/dashBoard" onClick={() => setDropdownOpen(false)}>
                  <div className="mobile-nav-item">{profileUsername}</div>
                </Link>
                <button onClick={() => { handleLogout(); setDropdownOpen(false); }} className="w-full text-left">
                  <div className="mobile-nav-item">Logout</div>
                </button>
              </>
            ) : (
              <button onClick={() => { setLoginMessage(""); setLoginOpen(true); setDropdownOpen(false); }} className="w-full text-left">
                <div className="mobile-nav-item">Login</div>
              </button>
            )}
          </nav>
        </div>
      )}

      <LoginModal isOpen={isLoginOpen} closeModal={() => setLoginOpen(false)} initialMessage={loginMessage} />
    </div>
  );
}
