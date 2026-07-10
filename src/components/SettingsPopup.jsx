"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/authProvider";
import { FaUser, FaIdCard, FaEnvelope, FaLock, FaTrashAlt, FaChevronRight } from "react-icons/fa";
import styles from "../styles/Settings.module.css";

const ChevronLeft = () => (
  <svg viewBox="0 0 10 10" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="7,1 3,5 7,9" />
  </svg>
);

export default function SettingsPopup({ isOpen, onClose }) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentAction, setCurrentAction] = useState("");
  const [showEmailChange, setShowEmailChange] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPasswordValue, setNewPasswordValue] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [profileUsername, setProfileUsername] = useState("");
  const [profileBio, setProfileBio] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) { router.push("/login"); return; }
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, bio")
        .eq("id", user.id)
        .maybeSingle();
      if (profile) {
        setProfileUsername(profile.username || "");
        setProfileBio(profile.bio || "");
      }
    };
    if (isOpen) fetchProfile();
  }, [isOpen, user, router]);

  const handleSignOut = async () => {
    await logout();
    router.push("/");
  };

  const handleDeleteAccount = async () => {
    setLoading(true);
    setMessage("");
    try {
      await supabase.from("profiles").delete().eq("id", user.id);
      const { error } = await supabase.auth.admin.deleteUser(user.id);
      if (error) {
        setMessage(error.message);
      } else {
        setMessage("Account deleted successfully");
        setTimeout(() => { supabase.auth.signOut(); router.push("/login"); }, 2000);
      }
    } catch {
      setMessage("Error deleting account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleActionClick = (action) => {
    setCurrentAction(action);
    setShowPasswordConfirm(true);
    setConfirmPassword("");
    setMessage("");
  };

  const handleConfirmPassword = async () => {
    if (!confirmPassword.trim()) { setMessage("Please enter your password"); return; }
    setLoading(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: user.email, password: confirmPassword });
      if (error) {
        setMessage("Incorrect password. Please try again.");
      } else {
        if (currentAction === "Change Email") { setShowEmailChange(true); setShowPasswordConfirm(false); }
        else if (currentAction === "Change Password") { setShowPasswordChange(true); setShowPasswordConfirm(false); }
        else if (currentAction === "Delete Account") { setShowDeleteConfirm(true); setShowPasswordConfirm(false); }
      }
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailChange = async () => {
    if (!newEmail.trim() || !confirmEmail.trim()) { setMessage("Please fill in both email fields"); return; }
    if (newEmail !== confirmEmail) { setMessage("Email addresses do not match"); return; }
    if (newEmail === user.email) { setMessage("New email must be different from current email"); return; }
    setLoading(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) { setMessage(error.message); }
      else {
        setMessage("Email updated! Please check your new inbox for verification.");
        setShowEmailChange(false); setNewEmail(""); setConfirmEmail(""); setCurrentAction("");
      }
    } catch (err) { setMessage(err.message); }
    finally { setLoading(false); }
  };

  const handlePasswordChangeSubmit = async () => {
    if (!newPasswordValue.trim() || !confirmNewPassword.trim()) { setMessage("Please fill in both password fields"); return; }
    if (newPasswordValue !== confirmNewPassword) { setMessage("Passwords do not match"); return; }
    if (newPasswordValue.length < 6) { setMessage("Password must be at least 6 characters"); return; }
    setLoading(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.updateUser({ password: newPasswordValue });
      if (error) { setMessage(error.message); }
      else {
        setMessage("Password updated successfully!");
        setShowPasswordChange(false); setNewPasswordValue(""); setConfirmNewPassword(""); setCurrentAction("");
      }
    } catch (err) { setMessage(err.message); }
    finally { setLoading(false); }
  };

  const handleProfileSave = async () => {
    if (!user) return;
    setLoading(true);
    setMessage("");
    const { error } = await supabase.from("profiles").upsert({
      id: user.id, email: user.email || "",
      username: profileUsername.trim(), bio: profileBio.trim(),
    });
    setLoading(false);
    if (error) setMessage(error.message);
    else setMessage("Profile updated successfully!");
  };

  const handleBackToOptions = () => {
    setShowPasswordConfirm(false); setShowEmailChange(false);
    setShowPasswordChange(false); setShowDeleteConfirm(false);
    setConfirmPassword(""); setNewEmail(""); setConfirmEmail("");
    setNewPasswordValue(""); setConfirmNewPassword("");
    setCurrentAction(""); setMessage("");
  };

  const isSubview = showPasswordConfirm || showEmailChange || showPasswordChange || showDeleteConfirm;
  const emailPrefix = user?.email?.split("@")[0];

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.settingsPopupContainer} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className={styles.settingsPopupHeader}>
          <div className={styles.avatarMark}>
            <FaUser />
          </div>
          <div className={styles.headerText}>
            <h2 className={styles.settingsHeader}>Account Settings</h2>
            {user?.email && <p className={styles.headerEmail}>{user.email}</p>}
          </div>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>

        {/* Body */}
        <div className={styles.containersWrapper}>

          {/* Left nav */}
          <div className={styles.accountContainer}>
            <div
              className={`${styles.accountTitleRow} ${!showProfile ? styles.active : ""}`}
              onClick={() => { setShowProfile(false); setMessage(""); handleBackToOptions(); }}
            >
              <div className={styles.accountTitleContent}>
                <FaUser className={styles.personIcon} />
                <span>Account</span>
              </div>
              <span className={styles.arrow}><FaChevronRight /></span>
            </div>
            <div
              className={`${styles.accountSubsection} ${showProfile ? styles.active : ""}`}
              onClick={() => { setShowProfile(true); setMessage(""); }}
            >
              <div className={styles.accountTitleContent}>
                <FaIdCard className={styles.personIcon} />
                <span>Profile</span>
              </div>
              <span className={styles.arrow}><FaChevronRight /></span>
            </div>
            <div className={styles.navSpacer} />
            <button className={styles.signOutButton} onClick={handleSignOut}>Sign Out</button>
          </div>

          {/* Right content */}
          <div className={styles.secondaryContainer}>

            {showProfile ? (
              <div className={styles.subviewContent}>
                <div className={styles.subviewHeader}>
                  <h3 className={styles.subviewTitle}>Profile</h3>
                </div>
                {user?.email && <div className={styles.emailChip}><FaEnvelope size={11} />{user.email}</div>}
                <div className={styles.passwordInputContainer}>
                  <label className={styles.inputLabel}>Display Name</label>
                  <input type="text" className={styles.passwordInput} value={profileUsername}
                    onChange={(e) => setProfileUsername(e.target.value)} placeholder="Your name" maxLength={50} />
                </div>
                <div className={styles.passwordInputContainer}>
                  <label className={styles.inputLabel}>Bio</label>
                  <textarea className={styles.passwordInput} value={profileBio}
                    onChange={(e) => setProfileBio(e.target.value)} placeholder="Short bio (optional)"
                    rows={3} maxLength={200} style={{ resize: "none", lineHeight: 1.5 }} />
                </div>
                <button className={styles.confirmButton} onClick={handleProfileSave} disabled={loading}>
                  {loading ? "Saving…" : "Save Profile"}
                </button>
                {message && <div className={`${styles.settingsMessage} ${message.toLowerCase().includes("error") ? styles.errorMessage : styles.successMessage}`}>{message}</div>}
              </div>

            ) : !isSubview ? (
              <div className={styles.secondaryContent}>
                <div className={styles.actionRow} onClick={() => handleActionClick("Change Email")}>
                  <div className={styles.actionRowIcon}><FaEnvelope /></div>
                  <div className={styles.actionRowLabel}>
                    <div>Change Email</div>
                    <div className={styles.actionRowDesc}>Update your login email</div>
                  </div>
                  <span className={styles.actionRowChevron}><FaChevronRight /></span>
                </div>
                <div className={styles.actionRow} onClick={() => handleActionClick("Change Password")}>
                  <div className={styles.actionRowIcon}><FaLock /></div>
                  <div className={styles.actionRowLabel}>
                    <div>Change Password</div>
                    <div className={styles.actionRowDesc}>Update your password</div>
                  </div>
                  <span className={styles.actionRowChevron}><FaChevronRight /></span>
                </div>
                <div className={`${styles.actionRow} ${styles.danger}`} onClick={() => handleActionClick("Delete Account")}>
                  <div className={styles.actionRowIcon}><FaTrashAlt /></div>
                  <div className={styles.actionRowLabel}>
                    <div>Delete Account</div>
                    <div className={styles.actionRowDesc}>Permanently remove your data</div>
                  </div>
                  <span className={styles.actionRowChevron}><FaChevronRight /></span>
                </div>
              </div>

            ) : showDeleteConfirm ? (
              <div className={styles.deleteConfirmContent}>
                <h3 className={styles.deleteConfirmTitle}>Delete Account</h3>
                <p className={styles.deleteConfirmMessage}>
                  Are you sure? All medical data associated with this account will be permanently deleted and cannot be recovered.
                </p>
                <div className={styles.deleteConfirmButtons}>
                  <button className={styles.cancelButton} onClick={handleBackToOptions}>Cancel</button>
                  <button className={styles.deleteConfirmButton} onClick={handleDeleteAccount} disabled={loading}>
                    {loading ? "Deleting…" : "Delete Account"}
                  </button>
                </div>
                {message && <div className={`${styles.settingsMessage} ${message.includes("Error") ? styles.errorMessage : styles.successMessage}`}>{message}</div>}
              </div>

            ) : showPasswordConfirm ? (
              <div className={styles.subviewContent}>
                <div className={styles.subviewHeader}>
                  <button className={styles.backBtn} onClick={handleBackToOptions}><ChevronLeft /></button>
                  <h3 className={styles.subviewTitle}>Confirm Password</h3>
                </div>
                <p className={styles.actionDescription}>Enter your current password to {currentAction.toLowerCase()}</p>
                <div className={styles.passwordInputContainer}>
                  <label className={styles.inputLabel}>Current Password</label>
                  <input type="password" className={styles.passwordInput} value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleConfirmPassword()}
                    placeholder="••••••••" />
                </div>
                <button className={styles.confirmButton} onClick={handleConfirmPassword} disabled={loading}>
                  {loading ? "Verifying…" : "Continue"}
                </button>
                {message && <div className={`${styles.settingsMessage} ${message.includes("Incorrect") || message.includes("Please") ? styles.errorMessage : styles.successMessage}`}>{message}</div>}
              </div>

            ) : showEmailChange ? (
              <div className={styles.subviewContent}>
                <div className={styles.subviewHeader}>
                  <button className={styles.backBtn} onClick={handleBackToOptions}><ChevronLeft /></button>
                  <h3 className={styles.subviewTitle}>Change Email</h3>
                </div>
                <p className={styles.actionDescription}>Enter your new email address below</p>
                <div className={styles.passwordInputContainer}>
                  <label className={styles.inputLabel}>New Email</label>
                  <input type="email" className={styles.passwordInput} value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)} placeholder="you@example.com" />
                </div>
                <div className={styles.passwordInputContainer}>
                  <label className={styles.inputLabel}>Confirm New Email</label>
                  <input type="email" className={styles.passwordInput} value={confirmEmail}
                    onChange={(e) => setConfirmEmail(e.target.value)} placeholder="you@example.com" />
                </div>
                <button className={styles.confirmButton} onClick={handleEmailChange} disabled={loading}>
                  {loading ? "Updating…" : "Update Email"}
                </button>
                {message && <div className={`${styles.settingsMessage} ${message.includes("do not match") || message.includes("Please") || message.includes("different") ? styles.errorMessage : styles.successMessage}`}>{message}</div>}
              </div>

            ) : (
              <div className={styles.subviewContent}>
                <div className={styles.subviewHeader}>
                  <button className={styles.backBtn} onClick={handleBackToOptions}><ChevronLeft /></button>
                  <h3 className={styles.subviewTitle}>Change Password</h3>
                </div>
                <p className={styles.actionDescription}>Choose a new password — at least 6 characters</p>
                <div className={styles.passwordInputContainer}>
                  <label className={styles.inputLabel}>New Password</label>
                  <input type="password" className={styles.passwordInput} value={newPasswordValue}
                    onChange={(e) => setNewPasswordValue(e.target.value)} placeholder="••••••••" />
                </div>
                <div className={styles.passwordInputContainer}>
                  <label className={styles.inputLabel}>Confirm Password</label>
                  <input type="password" className={styles.passwordInput} value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)} placeholder="••••••••" />
                </div>
                <button className={styles.confirmButton} onClick={handlePasswordChangeSubmit} disabled={loading}>
                  {loading ? "Updating…" : "Update Password"}
                </button>
                {message && <div className={`${styles.settingsMessage} ${message.includes("do not match") || message.includes("Please") || message.includes("characters") ? styles.errorMessage : styles.successMessage}`}>{message}</div>}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
