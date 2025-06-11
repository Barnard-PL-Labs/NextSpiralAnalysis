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
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [user, setUser] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) {
        router.push("/login");
      } else {
        setUser(data.user);

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("avatar_path")
          .eq("id", data.user.id)
          .maybeSingle();

        if (profileError) {
          console.error("Error fetching profile:", profileError);
        } else if (profile?.avatar_path) {
          const { data: signed } = await supabase.storage
            .from("avatars")
            .createSignedUrl(profile.avatar_path, 3600);

          if (signed?.signedUrl) {
            setAvatarUrl(signed.signedUrl);
          }
        }
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

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

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

  const handleAvatarChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setAvatarFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleAvatarUpload = async () => {
    if (!avatarFile || !user) return;
    setLoading(true);
    try {
      const fileExt = avatarFile.name.split(".").pop();
      const filePath = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, avatarFile, {
          upsert: true,
          contentType: avatarFile.type,
        });

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from("profiles")
        .upsert({ id: user.id, avatar_path: filePath }, { onConflict: "id" });

      if (updateError) throw updateError;

      const { data: signed } = await supabase.storage
        .from("avatars")
        .createSignedUrl(filePath, 3600);

      setAvatarUrl(signed?.signedUrl || null);
      setMessage("Avatar uploaded and saved!");
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      fileInputRef.current.value = "";
    } catch (error) {
      console.error("Upload or save error:", error);
      setMessage(error.message || "Error uploading avatar");
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

        <div style={{ marginBottom: "20px" }}>
          {(previewUrl || avatarUrl) && (
            <img
              src={previewUrl || avatarUrl}
              alt="Avatar preview"
              style={{
                width: 100,
                height: 100,
                borderRadius: "50%",
                marginLeft: '40%',
                objectFit: "cover",
                border: "2px solid #ddd",
                backgroundColor: "white",
              }}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "/Icons/default-avatar.png";
              }}
            />
          )}
        </div>

        <label className={styles.settingsLabel}>
          Profile Picture:
          <input
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className={styles.settingsInput}
            ref={fileInputRef}
          />
        </label>

        {avatarFile && (
          <button
            onClick={handleAvatarUpload}
            className={styles.settingsButton}
            disabled={loading}
          >
            {loading ? "Uploading..." : "Upload Avatar"}
          </button>
        )}

        <form onSubmit={handlePasswordChange} className={styles.settingsForm}>
          <label className={styles.settingsLabel}>
            Current Password:
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className={styles.settingsInput}
              required
            />
          </label>

          <label className={styles.settingsLabel}>
            New Password:
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={styles.settingsInput}
              required
            />
          </label>

          <button type="submit" disabled={loading} className={styles.settingsButton}>
            {loading ? "Updating..." : "Change Password"}
          </button>
        </form>

        <div className={styles.buttonGroup}>
          <button onClick={handleSignOut} className={styles.settingsButton}>
            Sign Out
          </button>

          <button
            className={styles.settingsDeleteBtn}
            onClick={handleDeleteAccount}
          >
            Delete Account
          </button>
        </div>

        {message && (
          <p className={`${styles.settingsMessage} ${message.includes("Error") ? styles.errorMessage : styles.successMessage}`}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
