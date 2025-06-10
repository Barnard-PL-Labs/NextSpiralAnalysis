"use client";

import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/authProvider";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import LoginModal from "@/components/LoginModal";
import { useState, useEffect } from "react";

export default function Header() {
  const { user } = useAuth();
  const router = useRouter();
  const [isLoginOpen, setLoginOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div>
      <header className="heading">
        <Link href="/">
          <h1 id="projectName">
            <Image
              src="/Icons/generated-icon-removebg.png"
              width={50}
              height={50}
              alt="Logo"
              priority
            />
            Spiral Analysis
          </h1>
        </Link>

        {isClient && (
          <ul className="navItems">
            <li>
              <Link href="/">
                <span>Home</span>
              </Link>
            </li>
            <li>
              <Link href="/machine">
                <span>Spiral Analysis</span>
              </Link>
            </li>
            <li>
              <Link href="/instruction">
                <span>Learn More</span>
              </Link>
            </li>
            <li>
              <Link href="/info">
                <span>About Us</span>
              </Link>
            </li>
            {user ? (
              <>
                <li>
                  <Link href="/dashBoard">
                    <span>{user.email}</span>
                  </Link>
                </li>
                <li>
                  <button
                    onClick={handleLogout}
                    className="logoutBtn"
                    style={{ background: "transparent", border: "none" }}
                  >
                    <span>Logout</span>
                  </button>
                </li>
              </>
            ) : (
              <li>
                <button
                  onClick={() => setLoginOpen(true)}
                  style={{
                    backgroundColor: "transparent",
                    border: "none",
                    fontSize: "16.5px",
                  }}
                >
                  <span>Login</span>
                </button>
              </li>
            )}
          </ul>
        )}
      </header>
      <LoginModal isOpen={isLoginOpen} closeModal={() => setLoginOpen(false)} />
    </div>
  );
}
