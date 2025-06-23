"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { FaUser } from "react-icons/fa";
import styles from "../styles/Settings.module.css";

export default function SettingsPopup({ isOpen, onClose }) {
  const router = useRouter();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [user, setUser] = useState(null);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [currentAction, setCurrentAction] = useState("");
  const [showEmailChange, setShowEmailChange] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isConfirmEmailFocused, setIsConfirmEmailFocused] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPasswordValue, setNewPasswordValue] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [isNewPasswordFocused, setIsNewPasswordFocused] = useState(false);
  const [isConfirmNewPasswordFocused, setIsConfirmNewPasswordFocused] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) {
        router.push("/login");
      } else {
        setUser(data.user);
      }
    };

    if (isOpen) {
      fetchUser();
    }
  }, [isOpen, router]);

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
    router.push("/");
  };

  const handleDeleteAccount = async () => {
    setLoading(true);
    setMessage("");

    try {
      // Delete user profile data
      await supabase.from("profiles").delete().eq("id", user.id);
      
      // Delete the user account
      const { error } = await supabase.auth.admin.deleteUser(user.id);
      
      if (error) {
        setMessage(error.message);
      } else {
        setMessage("Account deleted successfully");
        setTimeout(() => {
          supabase.auth.signOut();
          router.push("/login");
        }, 2000);
      }
    } catch (error) {
      setMessage("Error deleting account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleActionClick = (action) => {
    setCurrentAction(action);
    setShowPasswordConfirm(true);
    setConfirmPassword("");
    setIsPasswordFocused(false);
    setMessage("");
  };

  const handleConfirmPassword = async () => {
    if (!confirmPassword.trim()) {
      setMessage("Please enter your password");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: confirmPassword,
      });

      if (error) {
        setMessage("Incorrect password. Please try again.");
      } else {
        if (currentAction === "Change Email") {
          setShowEmailChange(true);
          setShowPasswordConfirm(false);
        } else if (currentAction === "Change Password") {
          setShowPasswordChange(true);
          setShowPasswordConfirm(false);
        } else if (currentAction === "Delete Account") {
          setShowDeleteConfirm(true);
          setShowPasswordConfirm(false);
        } else {
          setMessage(`Password confirmed! ${currentAction} functionality will be implemented here.`);
          setShowPasswordConfirm(false);
          setConfirmPassword("");
          setCurrentAction("");
        }
      }
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailChange = async () => {
    if (!newEmail.trim() || !confirmEmail.trim()) {
      setMessage("Please fill in both email fields");
      return;
    }

    if (newEmail !== confirmEmail) {
      setMessage("Email addresses do not match");
      return;
    }

    if (newEmail === user.email) {
      setMessage("New email must be different from current email");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.updateUser({
        email: newEmail,
      });

      if (error) {
        setMessage(error.message);
      } else {
        setMessage("Email updated successfully! Please check your new email for verification.");
        setShowEmailChange(false);
        setNewEmail("");
        setConfirmEmail("");
        setCurrentAction("");
        // Refresh user data
        const { data } = await supabase.auth.getUser();
        if (data?.user) {
          setUser(data.user);
        }
      }
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChangeSubmit = async () => {
    if (!newPasswordValue.trim() || !confirmNewPassword.trim()) {
      setMessage("Please fill in both password fields");
      return;
    }

    if (newPasswordValue !== confirmNewPassword) {
      setMessage("Passwords do not match");
      return;
    }

    if (newPasswordValue.length < 6) {
      setMessage("Password must be at least 6 characters long");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPasswordValue,
      });

      if (error) {
        setMessage(error.message);
      } else {
        setMessage("Password updated successfully!");
        setShowPasswordChange(false);
        setNewPasswordValue("");
        setConfirmNewPassword("");
        setCurrentAction("");
      }
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToOptions = () => {
    setShowPasswordConfirm(false);
    setShowEmailChange(false);
    setShowPasswordChange(false);
    setShowDeleteConfirm(false);
    setConfirmPassword("");
    setNewEmail("");
    setConfirmEmail("");
    setNewPasswordValue("");
    setConfirmNewPassword("");
    setCurrentAction("");
    setMessage("");
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.settingsPopupContainer} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose}>
          ×
        </button>
        
        <h2 className={styles.settingsHeader}>Account Settings</h2>

        <div className={styles.containersWrapper}>
          <div className={styles.accountContainer}>
            <div className={styles.accountTitleRow}>
              <div className={styles.accountTitleContent}>
                <FaUser className={styles.personIcon} />
                <span>Your Account</span>
              </div>
              <span className={styles.arrow}>{'>'}</span>
            </div>
            <button
              className={styles.signOutButton} 
              onClick={handleSignOut}
            >
              Sign Out
            </button>
          </div>

          <div className={styles.secondaryContainer}>
            {!showPasswordConfirm && !showEmailChange && !showPasswordChange && !showDeleteConfirm ? (
              <div className={styles.secondaryContent}>
                <p onClick={() => handleActionClick("Change Email")}>Change Email</p>
                <p onClick={() => handleActionClick("Change Password")}>Change Password</p>
                <p onClick={() => handleActionClick("Delete Account")} className={styles.deleteAccountText}>Delete Account</p>
              </div>
            ) : showDeleteConfirm ? (
              <div className={styles.deleteConfirmContent}>
                <h3 className={styles.deleteConfirmTitle}>Delete Account</h3>
                <p className={styles.deleteConfirmMessage}>
                  Are you sure you want to delete your account? All medical data associated with this account will be permanently deleted.
                </p>
                <div className={styles.deleteConfirmButtons}>
                  <button
                    className={styles.cancelButton}
                    onClick={handleBackToOptions}
                  >
                    Cancel
                  </button>
                  <button
                    className={styles.deleteConfirmButton}
                    onClick={handleDeleteAccount}
                    disabled={loading}
                  >
                    {loading ? "Deleting..." : "Delete Account"}
                  </button>
                </div>
                {message && (
                  <div className={`${styles.settingsMessage} ${message.includes("Error") ? styles.errorMessage : styles.successMessage}`}>
                    {message}
                  </div>
                )}
              </div>
            ) : showPasswordConfirm ? (
              <div className={styles.emailChangeContent}>
                <button className={styles.backArrow} onClick={handleBackToOptions}>
                  ←
                </button>
                <h3 className={styles.confirmPasswordTitle}>Confirm Password</h3>
                <p className={styles.actionDescription}>Please confirm your password to {currentAction.toLowerCase()}</p>
                <div className={styles.passwordInputContainer}>
                  <input
                    type="password"
                    className={styles.passwordInput}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onFocus={() => setIsPasswordFocused(true)}
                    onBlur={() => setIsPasswordFocused(false)}
                    placeholder={isPasswordFocused ? "" : "Password"}
                  />
                </div>
                <button
                  className={styles.confirmButton}
                  onClick={handleConfirmPassword}
                  disabled={loading}
                >
                  {loading ? "Confirming..." : "Confirm"}
                </button>
                {message && (
                  <div className={`${styles.settingsMessage} ${message.includes("Incorrect") || message.includes("Please") ? styles.errorMessage : styles.successMessage}`}>
                    {message}
                  </div>
                )}
              </div>
            ) : showEmailChange ? (
              <div className={styles.emailChangeContent}>
                <button className={styles.backArrow} onClick={handleBackToOptions}>
                  ←
                </button>
                <h3 className={styles.confirmPasswordTitle}>Change Email</h3>
                <p className={styles.actionDescription}>Enter your new email address</p>
                <div className={styles.passwordInputContainer}>
                  <input
                    type="email"
                    className={styles.passwordInput}
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    onFocus={() => setIsEmailFocused(true)}
                    onBlur={() => setIsEmailFocused(false)}
                    placeholder={isEmailFocused ? "" : "New Email"}
                  />
                </div>
                <div className={styles.passwordInputContainer}>
                  <input
                    type="email"
                    className={styles.passwordInput}
                    value={confirmEmail}
                    onChange={(e) => setConfirmEmail(e.target.value)}
                    onFocus={() => setIsConfirmEmailFocused(true)}
                    onBlur={() => setIsConfirmEmailFocused(false)}
                    placeholder={isConfirmEmailFocused ? "" : "Confirm New Email"}
                  />
                </div>
                <button
                  className={styles.confirmButton}
                  onClick={handleEmailChange}
                  disabled={loading}
                >
                  {loading ? "Updating..." : "Update Email"}
                </button>
                {message && (
                  <div className={`${styles.settingsMessage} ${message.includes("do not match") || message.includes("Please") || message.includes("different") ? styles.errorMessage : styles.successMessage}`}>
                    {message}
                  </div>
                )}
              </div>
            ) : (
              <div className={styles.emailChangeContent}>
                <button className={styles.backArrow} onClick={handleBackToOptions}>
                  ←
                </button>
                <h3 className={styles.confirmPasswordTitle}>Change Password</h3>
                <p className={styles.actionDescription}>Enter your new password</p>
                <div className={styles.passwordInputContainer}>
                  <input
                    type="password"
                    className={styles.passwordInput}
                    value={newPasswordValue}
                    onChange={(e) => setNewPasswordValue(e.target.value)}
                    onFocus={() => setIsNewPasswordFocused(true)}
                    onBlur={() => setIsNewPasswordFocused(false)}
                    placeholder={isNewPasswordFocused ? "" : "New Password"}
                  />
                </div>
                <div className={styles.passwordInputContainer}>
                  <input
                    type="password"
                    className={styles.passwordInput}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    onFocus={() => setIsConfirmNewPasswordFocused(true)}
                    onBlur={() => setIsConfirmNewPasswordFocused(false)}
                    placeholder={isConfirmNewPasswordFocused ? "" : "Confirm New Password"}
                  />
                </div>
                <button
                  className={styles.confirmButton}
                  onClick={handlePasswordChangeSubmit}
                  disabled={loading}
                >
                  {loading ? "Updating..." : "Update Password"}
                </button>
                {message && (
                  <div className={`${styles.settingsMessage} ${message.includes("do not match") || message.includes("Please") || message.includes("characters") ? styles.errorMessage : styles.successMessage}`}>
                    {message}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 