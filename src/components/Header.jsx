"use client";

import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/authProvider";
import { supabase } from "@/lib/supabaseClient";
import LoginModal from "@/components/LoginModal";
import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars, faTimes } from "@fortawesome/free-solid-svg-icons";

export default function Header() {
  const { user } = useAuth();
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
            <li><Link href="/instruction"><span>Learn More</span></Link></li>
            <li><Link href="/info"><span>About Us</span></Link></li>

            {user ? (
              <>
                <li><Link href="/dashBoard"><span>{user.email}</span></Link></li>
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
        <div className="fixed top-[75px] left-0 w-full bg-white text-black shadow-lg z-[99999] transition-all duration-300">
          <div className="flex flex-col w-full">
            {[{ label: "Home", href: "/" },
              { label: "Spiral Analysis", href: "/machine" },
              { label: "Learn More", href: "/instruction" },
              { label: "About Us", href: "/info" }].map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setDropdownOpen(false)} className="w-full no-underline">
                <div className="py-4 text-lg font-semibold text-center hover:bg-gray-200 transition">
                  {item.label}
                </div>
              </Link>
            ))}

            {user ? (
              <>
                <Link href="/dashBoard" onClick={() => setDropdownOpen(false)} className="w-full no-underline">
                  <div className="py-4 text-lg font-semibold text-center hover:bg-gray-200 transition">
                    {user.email}
                  </div>
                </Link>
                <button onClick={() => { handleLogout(); setDropdownOpen(false); }} className="w-full no-underline">
                  <div className="py-4 text-lg font-semibold text-center hover:bg-gray-200 transition">
                    Logout
                  </div>
                </button>
              </>
            ) : (
              <button onClick={() => { setLoginOpen(true); setDropdownOpen(false); }} className="w-full no-underline">
                <div className="py-4 text-lg font-semibold text-center hover:bg-gray-200 transition">
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
