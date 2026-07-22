"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/authProvider";
import LoginModal from "@/components/LoginModal";
import { useState, useEffect, useRef } from "react";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    setIsClient(true);
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
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

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    router.push("/");
  };

  const navLinks = [
    ...(!researcherMode ? [{ label: "Learn More", href: "/instruction" }] : []),
    { label: "About Us", href: "/info" },
  ];

  const initial = profileUsername ? profileUsername[0].toUpperCase() : "?";

  return (
    <div>
      <header
        className="heading fixed top-0 left-0 w-full z-50"
        style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderBottom: "1px solid #E4E9EE" }}
      >
        <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 24px", width: "100%", height: "100%", display: "flex", alignItems: "center" }}>

          {/* Left: brand */}
          <div style={{ flex: 1 }}>
          <Link href="/home" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "10px" }}>
            <svg width="24" height="24" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M50 50 Q54 34 66 32 Q82 30 84 50 Q86 72 64 78 Q38 84 28 60 Q16 32 42 18 Q72 4 90 28" stroke="#1E40AF" strokeWidth="9" strokeLinecap="round" fill="none"/>
            </svg>
            <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: "17px", fontWeight: 700, color: "#0B1B2B", letterSpacing: "-0.01em" }}>
              Spiral Analysis
            </span>
          </Link>
          </div>

          {/* Center: nav links */}
          {isClient && !isMobile && (
            <nav style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              {navLinks.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link key={item.href} href={item.href} style={{ textDecoration: "none" }}>
                    <span
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: "14px",
                        fontWeight: isActive ? 600 : 500,
                        color: isActive ? "#1E40AF" : "#37485A",
                        background: isActive ? "#EFF6FF" : "transparent",
                        borderRadius: "8px",
                        padding: "7px 14px",
                        display: "inline-block",
                        transition: "color 0.15s ease, background 0.15s ease",
                      }}
                      onMouseEnter={e => { if (!isActive) { e.currentTarget.style.color = "#0B1B2B"; e.currentTarget.style.background = "#F7F9FB"; } }}
                      onMouseLeave={e => { if (!isActive) { e.currentTarget.style.color = "#37485A"; e.currentTarget.style.background = "transparent"; } }}
                    >{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          )}

          {/* Right: account + CTA */}
          {isClient && !isMobile && (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "16px" }}>
              {user ? (
                <div ref={menuRef} style={{ position: "relative" }}>
                  <div
                    onClick={() => setMenuOpen(!menuOpen)}
                    style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
                  >
                    <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: "12px", color: "#1E40AF", flexShrink: 0 }}>
                      {initial}
                    </div>
                    <span style={{ fontSize: "13.5px", fontWeight: 500, color: "#37485A" }}>{profileUsername}</span>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transition: "transform 0.15s", transform: menuOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                      <path d="M2 4l4 4 4-4" stroke="#37485A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>

                  {menuOpen && (
                    <div style={{ position: "absolute", top: "calc(100% + 10px)", right: 0, minWidth: "180px", background: "#fff", border: "1px solid #E4E9EE", borderRadius: "12px", boxShadow: "0 18px 40px -16px rgba(11,27,43,0.28)", padding: "6px", zIndex: 40 }}>
                      <Link href="/dashBoard" onClick={() => setMenuOpen(false)} style={{ textDecoration: "none", display: "block", fontSize: "13.5px", fontWeight: 500, color: "#0B1B2B", padding: "9px 12px", borderRadius: "8px" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#F7F9FB"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      >My Results</Link>
                      <Link href="/setting" onClick={() => setMenuOpen(false)} style={{ textDecoration: "none", display: "block", fontSize: "13.5px", fontWeight: 500, color: "#0B1B2B", padding: "9px 12px", borderRadius: "8px" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#F7F9FB"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      >Account Settings</Link>
                      <div style={{ height: "1px", background: "#E4E9EE", margin: "6px 4px" }} />
                      <button
                        onClick={handleLogout}
                        style={{ display: "block", width: "100%", textAlign: "left", fontSize: "13.5px", fontWeight: 600, color: "#C0392B", padding: "9px 12px", borderRadius: "8px", background: "transparent", border: "none", cursor: "pointer" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#FBEDEA"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      >Log out</button>
                    </div>
                  )}
                </div>
              ) : (
                <span
                  onClick={() => { setLoginMessage(""); setLoginOpen(true); }}
                  style={{ fontSize: "13.5px", fontWeight: 500, color: "#37485A", cursor: "pointer", transition: "color 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.color = "#0B1B2B"}
                  onMouseLeave={e => e.currentTarget.style.color = "#37485A"}
                >Sign in</span>
              )}

              <div style={{ width: "1px", height: "22px", background: "#E4E9EE" }} />

              <Link href="/machine" style={{ textDecoration: "none" }}>
                <button
                  style={{ background: "#1E40AF", border: "none", borderRadius: "9px", padding: "9px 20px", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "13.5px", fontWeight: 600, color: "#fff", boxShadow: "0 4px 14px -4px rgba(30,64,175,0.5)", transition: "background 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#1634A0"; e.currentTarget.style.boxShadow = "0 8px 20px -6px rgba(30,64,175,0.7)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "#1E40AF"; e.currentTarget.style.boxShadow = "0 4px 14px -4px rgba(30,64,175,0.5)"; e.currentTarget.style.transform = "translateY(0)"; }}
                >Start Test</button>
              </Link>
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
                  <div className="mobile-nav-item">Log out</div>
                </button>
              </>
            ) : (
              <button onClick={() => { setLoginMessage(""); setLoginOpen(true); setDropdownOpen(false); }} className="w-full text-left">
                <div className="mobile-nav-item">Sign in</div>
              </button>
            )}
          </nav>
        </div>
      )}

      <LoginModal isOpen={isLoginOpen} closeModal={() => setLoginOpen(false)} initialMessage={loginMessage} />
    </div>
  );
}
