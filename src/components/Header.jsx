"use client";

import Link from "next/link";
import { useAuth } from "@/lib/authProvider";
import { supabase } from "@/lib/supabaseClient";
import LoginModal from "@/components/LoginModal";
import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars, faTimes } from "@fortawesome/free-solid-svg-icons";
import { useResearcherMode } from "@/lib/researcherModeContext";

export default function Header() {
  const { user } = useAuth();
  const { researcherMode } = useResearcherMode();
  const [isLoginOpen, setLoginOpen] = useState(false);
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const getFirstName = (email) => {
    if (!email) return '';
    const emailPart = email.split('@')[0];
    return emailPart.split('.')[0].charAt(0).toUpperCase() + emailPart.split('.')[0].slice(1);
  };

  const navLinks = [
    { label: "Home", href: "/" },
    { label: "Take the Test", href: "/machine" },
    { label: "Results", href: "/result" },
    ...(!researcherMode ? [{ label: "Learn More", href: "/instruction" }] : []),
    { label: "About Us", href: "/info" }
  ];

  return (
    <div>
      <header className="heading fixed top-0 left-0 w-full z-50">
        <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 24px", width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* Left: brand + nav links */}
          <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
            <Link href="/" style={{ textDecoration: "none" }}>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "15px", fontWeight: 600, color: "var(--color-text-primary)", letterSpacing: "-0.01em" }}>
                Spiral Analysis
              </span>
            </Link>

            {isClient && !isMobile && (
              <nav style={{ display: "flex", alignItems: "center", gap: "24px" }}>
                {navLinks.filter(item => item.label !== "Home").map((item) => (
                  <Link key={item.href} href={item.href} style={{ textDecoration: "none" }}>
                    <span style={{ fontFamily: "var(--font-sans)", fontSize: "14px", fontWeight: 400, color: "var(--color-text-secondary)", transition: "color 0.2s ease" }}
                      onMouseEnter={e => e.currentTarget.style.color = "#4f46e5"}
                      onMouseLeave={e => e.currentTarget.style.color = "var(--color-text-secondary)"}
                    >{item.label}</span>
                  </Link>
                ))}
              </nav>
            )}
          </div>

          {/* Right: user / sign in */}
          {isClient && !isMobile && (
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {user ? (
                <>
                  <Link href="/dashBoard" style={{ textDecoration: "none" }}>
                    <span style={{ fontFamily: "var(--font-sans)", fontSize: "14px", fontWeight: 400, color: "var(--color-text-secondary)", transition: "color 0.2s ease" }}
                      onMouseEnter={e => e.currentTarget.style.color = "#4f46e5"}
                      onMouseLeave={e => e.currentTarget.style.color = "var(--color-text-secondary)"}
                    >{getFirstName(profiles.username)}</span>
                  </Link>
                  <button onClick={handleLogout}
                    style={{ background: "transparent", border: "1.5px solid #e2e8f0", borderRadius: "8px", padding: "6px 16px", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "14px", fontWeight: 500, color: "var(--color-text-secondary)", transition: "all 0.2s ease" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "#c7d2fe"; e.currentTarget.style.color = "#4f46e5"; e.currentTarget.style.background = "#eef2ff"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.color = "var(--color-text-secondary)"; e.currentTarget.style.background = "transparent"; }}
                  >
                    Logout
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setLoginOpen(true)}
                  style={{ background: "transparent", border: "1.5px solid #e2e8f0", borderRadius: "8px", padding: "6px 16px", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "14px", fontWeight: 500, color: "var(--color-text-secondary)", transition: "all 0.2s ease" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#c7d2fe"; e.currentTarget.style.color = "#4f46e5"; e.currentTarget.style.background = "#eef2ff"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.color = "var(--color-text-secondary)"; e.currentTarget.style.background = "transparent"; }}
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
                  <div className="mobile-nav-item">{getFirstName(user.email)}</div>
                </Link>
                <button onClick={() => { handleLogout(); setDropdownOpen(false); }} className="w-full text-left">
                  <div className="mobile-nav-item">Logout</div>
                </button>
              </>
            ) : (
              <button onClick={() => { setLoginOpen(true); setDropdownOpen(false); }} className="w-full text-left">
                <div className="mobile-nav-item">Login</div>
              </button>
            )}
          </nav>
        </div>
      )}

      <LoginModal isOpen={isLoginOpen} closeModal={() => setLoginOpen(false)} />
    </div>
  );
}
