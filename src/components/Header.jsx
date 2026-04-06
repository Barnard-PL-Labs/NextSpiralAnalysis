"use client";

import Link from "next/link";
import Image from "next/image";
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
    { label: "Spiral Analysis", href: "/machine" },
    ...(!researcherMode ? [{ label: "Learn More", href: "/instruction" }] : []),
    { label: "About Us", href: "/info" }
  ];

  return (
    <div>
      <header className="heading fixed top-0 left-0 w-full z-50">
        <Link href="/">
          <h1 id="projectName" className="flex items-center space-x-2 ml-6">
            <Image
              src="/Icons/generated-icon-removebg.png"
              width={45}
              height={45}
              className="w-12 h-12"
              alt="Logo"
              priority
            />
            <span className="text-2xl font-bold">Spiral Analysis</span>
          </h1>
        </Link>

        {isClient && !isMobile && (
          <ul className="navItems">
            {navLinks.map((item) => (
              <li key={item.href}>
                <Link href={item.href}><span>{item.label}</span></Link>
              </li>
            ))}
            {user ? (
              <>
                <li><Link href="/dashBoard"><span>{getFirstName(user.email)}</span></Link></li>
                <li>
                  <button onClick={handleLogout} className="logoutBtn">
                    <span>Logout</span>
                  </button>
                </li>
              </>
            ) : (
              <li>
                <button
                  onClick={() => setLoginOpen(true)}
                  style={{
                    background: "transparent",
                    border: "1.5px solid #cbd5e1",
                    borderRadius: "8px",
                    padding: "7px 18px",
                    cursor: "pointer",
                    fontFamily: "var(--font-sans)",
                    fontSize: "14px",
                    fontWeight: 500,
                    color: "var(--color-text-primary)",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--color-accent)"; e.currentTarget.style.color = "var(--color-accent)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#cbd5e1"; e.currentTarget.style.color = "var(--color-text-primary)"; }}
                >
                  Sign In
                </button>
              </li>
            )}
          </ul>
        )}

        {isMobile && (
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="absolute top-6 right-6 z-50"
          >
            <FontAwesomeIcon
              icon={dropdownOpen ? faTimes : faBars}
              className="text-2xl"
              style={{ color: "var(--color-text-primary)" }}
            />
          </button>
        )}
      </header>

      {isMobile && dropdownOpen && (
        <div className="mobile-dropdown">
          <nav className="flex flex-col w-full py-4">
            {navLinks.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setDropdownOpen(false)}>
                <div className="mobile-nav-item">
                  {item.label}
                </div>
              </Link>
            ))}
            {user ? (
              <>
                <Link href="/dashBoard" onClick={() => setDropdownOpen(false)}>
                  <div className="mobile-nav-item">
                    {getFirstName(user.email)}
                  </div>
                </Link>
                <button onClick={() => { handleLogout(); setDropdownOpen(false); }} className="w-full text-left">
                  <div className="mobile-nav-item">
                    Logout
                  </div>
                </button>
              </>
            ) : (
              <button onClick={() => { setLoginOpen(true); setDropdownOpen(false); }} className="w-full text-left">
                <div className="mobile-nav-item">
                  Login
                </div>
              </button>
            )}
          </nav>
        </div>
      )}

      <LoginModal isOpen={isLoginOpen} closeModal={() => setLoginOpen(false)} />
    </div>
  );
}
