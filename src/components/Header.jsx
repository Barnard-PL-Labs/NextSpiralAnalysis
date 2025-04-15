"use client";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/authProvider"; 
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import LoginModal from "@/components/LoginModal"
import { useState, useEffect } from "react";
export default function Header({showVideo = true}) {
    const { user } = useAuth();
    const router = useRouter();
    const [isLoginOpen, setLoginOpen] = useState(false);


    const handleLogout = async () => {
        await supabase.auth.signOut();
    };
    

    return (
        <div>
            {/*background video*/}
            {showVideo && (<div className="video">
                <video src="/Icons/indexBackgroundVid.mp4.mp4" id="vid" autoPlay loop muted></video>
            </div>)}

            <header className="heading" style={{'backgroundColor':'black'}}>
                <Link href="/">
                    <h1 id="projectName">
                        <Image src="/Icons/generated-icon-removebg.png" width={50} height={50} alt="Logo" priority />
                        Spiral Analysis
                    </h1>
                </Link>

                <ul className="navItems">
                    <li><Link href="/"><span>Home</span></Link></li>
                    <li><Link href="/machine"><span>Spiral Analysis</span></Link></li>
                    <li><Link href="/moreInfo"><span>Learn More</span></Link></li>
                    <li><Link href="/info"><span>About Us</span></Link></li>
                    {user ? (
                        <>
                            <li><Link href = '/dashBoard'><span>{user.email}</span></Link></li>
                            <li><button onClick={handleLogout} className="logoutBtn"  style={{background: "transparent",border:'none'}}><span>Logout</span></button></li>
                        </>
                    ) : (
                        <li><button onClick={() => setLoginOpen(true)} style={{backgroundColor:'black',border:'none',fontSize:'16.5px'}}><span style={{ backgroundColor: 'black'}}>Login</span>
                      </button></li>
                    )}
                </ul>
            </header>
            <LoginModal isOpen={isLoginOpen} closeModal={() => setLoginOpen(false)} />
                
        </div>
    );
}

