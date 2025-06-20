"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import styles from "../../styles/Settings.module.css";
import Sidebar from "../../components/SideBar";
import BottomNav from "../../components/BottomNav";

export default function Settings() {
  const router = useRouter();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [user, setUser] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) {
        router.push("/login");
      } else {
        setUser(data.user);
      }
    };

    fetchUser();

    const handleResize = () => {
      setIsMobile(window.innerWidth <= 640);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [router]);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: oldPassword,
      });
      if (signInError) throw signInError;

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      setMessage("Password updated successfully!");
      setOldPassword("");
      setNewPassword("");
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleDeleteAccount = async () => {
    const confirmDelete = confirm("Are you sure you want to delete your account?");
    if (confirmDelete && user) {
      try {
        await supabase.from("profiles").delete().eq("id", user.id);
        await supabase.auth.signOut();
        router.push("/login");
      } catch (error) {
        setMessage(error.message);
      }
    }
  };

  return (
    <div>
      {isMobile ? <BottomNav /> : <Sidebar />}
      <div className={styles.settingsContainer}>
        <h2 className={styles.settingsHeader}>Account Settings</h2>
        
        <div className={styles.accountContainer}>
          <div className={styles.accountTitleRow}>
            <span>Your Account</span>
            <span className={styles.arrow}>{'>'}</span>
          </div>
          <button 
            className={styles.signOutText} 
            onClick={handleSignOut}
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
