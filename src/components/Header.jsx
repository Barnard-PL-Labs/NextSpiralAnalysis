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
      setIsMobile(window.innerWidth < 1200);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // Extract first name from email (assuming format: firstname.lastname@domain.com or firstname@domain.com)
  const getFirstName = (email) => {
    if (!email) return '';
    const emailPart = email.split('@')[0];
    return emailPart.split('.')[0].charAt(0).toUpperCase() + emailPart.split('.')[0].slice(1);
  };

  return (
    <div >
      {/* HEADER */}
      <header className="heading fixed top-0 left-0 w-full z-50" style={isMobile ? { borderRadius: 0 } : {}}>
      <Link href="/">
          <h1 id="projectName" className="flex items-center space-x-2">
            <Image
              src="/Icons/generated-icon-removebg.png"
              width={45}
              height={45}
              className="w-12 h-12 align-middle"
              alt="Logo"
              priority
            />
          <span className="text-3xl leading-none font-bold">
          Spiral Analysis
          </span>

          </h1>
        </Link>

        {isClient && !isMobile && (
          <ul className="navItems">
            <li><Link href="/"><span>Home</span></Link></li>
            <li><Link href="/machine"><span>Spiral Analysis</span></Link></li>
            {!researcherMode && (
            <li><Link href="/instruction"><span>Learn More</span></Link></li>
            )}
            <li><Link href="/info"><span>About Us</span></Link></li>

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
                <button onClick={() => setLoginOpen(true)}>
                  <span>Login</span>
                </button>
              </li>
            )}
          </ul>
        )}

        {isMobile && (
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="absolute top-5.5 right-4 z-50"
          >
            <FontAwesomeIcon
              icon={dropdownOpen ? faTimes : faBars}
              className="text-3xl text-black"
            />
          </button>
        )}
      </header>

      {/* Mobile Dropdown OUTSIDE header */}
      {isMobile && dropdownOpen && (
        <div className="fixed top-[75px] left-0 w-full bg-white shadow-lg z-[99999] transition-all duration-300" style={{ borderRadius: "0 0 10px 10px" }}>
          <div className="flex flex-col items-center w-full py-4">
            {[
              { label: "Home", href: "/" },
              { label: "Spiral Analysis", href: "/machine" },
              ...(researcherMode ? [] : [{ label: "Learn More", href: "/instruction" }]),
              { label: "About Us", href: "/info" }
            ].map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setDropdownOpen(false)} className="no-underline">
                <div className="mb-2 py-3 text-center transition-all duration-300" style={{
                  color: "white",
                  fontFamily: "DM Sans, sans-serif",
                  fontWeight: "bold",
                  background: "#2e2b7a",
                  padding: "6px 12px",
                  borderRadius: "20px",
                  border: "1px solid rgba(0, 102, 153, 0.2)",
                  fontSize: "16.5px",
                  display: "inline-block",
                  minWidth: "180px",
                  cursor: "pointer"
                }}
                onMouseEnter={(e) => {
                  e.target.style.color = "#006699";
                  e.target.style.background = "#c4e4f8";
                  e.target.style.borderColor = "transparent";
                  e.target.style.transform = "translateY(-1px)";
                  e.target.style.boxShadow = "0 2px 4px rgba(0, 102, 153, 0.1)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.color = "white";
                  e.target.style.background = "#2e2b7a";
                  e.target.style.borderColor = "rgba(0, 102, 153, 0.2)";
                  e.target.style.transform = "translateY(0)";
                  e.target.style.boxShadow = "none";
                }}>
                  {item.label}
                </div>
              </Link>
            ))}

            {user ? (
              <>
                <Link href="/dashBoard" onClick={() => setDropdownOpen(false)} className="no-underline">
                  <div className="mb-2 py-3 text-center transition-all duration-300" style={{
                    color: "white",
                    fontFamily: "DM Sans, sans-serif",
                    fontWeight: "bold",
                    background: "#2e2b7a",
                    padding: "6px 12px",
                    borderRadius: "20px",
                    border: "1px solid rgba(0, 102, 153, 0.2)",
                    fontSize: "16.5px",
                    display: "inline-block",
                    minWidth: "180px",
                    cursor: "pointer"
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.color = "#006699";
                    e.target.style.background = "#c4e4f8";
                    e.target.style.borderColor = "transparent";
                    e.target.style.transform = "translateY(-1px)";
                    e.target.style.boxShadow = "0 2px 4px rgba(0, 102, 153, 0.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.color = "white";
                    e.target.style.background = "#2e2b7a";
                    e.target.style.borderColor = "rgba(0, 102, 153, 0.2)";
                    e.target.style.transform = "translateY(0)";
                    e.target.style.boxShadow = "none";
                  }}>
                    {getFirstName(user.email)}
                  </div>
                </Link>
                <button onClick={() => { handleLogout(); setDropdownOpen(false); }} className="no-underline">
                  <div className="mb-2 py-3 text-center transition-all duration-300" style={{
                    color: "white",
                    fontFamily: "DM Sans, sans-serif",
                    fontWeight: "bold",
                    background: "#2e2b7a",
                    padding: "6px 12px",
                    borderRadius: "20px",
                    border: "1px solid rgba(0, 102, 153, 0.2)",
                    fontSize: "16.5px",
                    display: "inline-block",
                    minWidth: "180px",
                    cursor: "pointer"
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.color = "#006699";
                    e.target.style.background = "#c4e4f8";
                    e.target.style.borderColor = "transparent";
                    e.target.style.transform = "translateY(-1px)";
                    e.target.style.boxShadow = "0 2px 4px rgba(0, 102, 153, 0.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.color = "white";
                    e.target.style.background = "#2e2b7a";
                    e.target.style.borderColor = "rgba(0, 102, 153, 0.2)";
                    e.target.style.transform = "translateY(0)";
                    e.target.style.boxShadow = "none";
                  }}>
                    Logout
                  </div>
                </button>
              </>
            ) : (
              <button onClick={() => { setLoginOpen(true); setDropdownOpen(false); }} className="no-underline">
                <div className="mb-2 py-3 text-center transition-all duration-300" style={{
                  color: "white",
                  fontFamily: "DM Sans, sans-serif",
                  fontWeight: "bold",
                  background: "#2e2b7a",
                  padding: "6px 12px",
                  borderRadius: "20px",
                  border: "1px solid rgba(0, 102, 153, 0.2)",
                  fontSize: "16.5px",
                  display: "inline-block",
                  minWidth: "180px",
                  cursor: "pointer"
                }}
                onMouseEnter={(e) => {
                  e.target.style.color = "#006699";
                  e.target.style.background = "#c4e4f8";
                  e.target.style.borderColor = "transparent";
                  e.target.style.transform = "translateY(-1px)";
                  e.target.style.boxShadow = "0 2px 4px rgba(0, 102, 153, 0.1)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.color = "white";
                  e.target.style.background = "#2e2b7a";
                  e.target.style.borderColor = "rgba(0, 102, 153, 0.2)";
                  e.target.style.transform = "translateY(0)";
                  e.target.style.boxShadow = "none";
                }}>
                  Login
                </div>
              </button>
            )}
          </div>
        </div>
      )}

      <LoginModal isOpen={isLoginOpen} closeModal={() => setLoginOpen(false)} />
    </div>
  );
}
