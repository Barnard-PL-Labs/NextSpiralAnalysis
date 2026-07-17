"use client";
import { useState, useEffect, Fragment } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { Dialog, Transition } from "@headlessui/react";
import Image from "next/image";
import { FaExclamationCircle } from "react-icons/fa";

const AUTH_OPERATION_TIMEOUT_MS = 10000;

const withTimeout = (promise, timeoutMs, label) => {
  let timeoutId;

  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out. Please try again.`));
    }, timeoutMs);
  });

  return Promise.race([Promise.resolve(promise), timeout]).finally(() => {
    clearTimeout(timeoutId);
  });
};

const clearStoredSupabaseAuth = () => {
  if (typeof window === "undefined") return;

  Object.keys(window.localStorage)
    .filter((key) => key.startsWith("sb-") && key.endsWith("-auth-token"))
    .forEach((key) => window.localStorage.removeItem(key));
};

const getAuthRedirectBase = () => {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredUrl) return configuredUrl.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
};

export default function LoginModal({ isOpen, closeModal, initialMessage = "" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [message, setMessage] = useState("");
  const [isForgot, setIsForgot] = useState(false);
  const [signupMode, setSignupMode] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!isOpen || !initialMessage) return;
    setSignupMode(false);
    setIsForgot(false);
    setMessage(initialMessage);
  }, [initialMessage, isOpen]);

  const handleCreateAccount = async () => {
    if (password != confirmPassword) {
      setMessage("Passwords don't match!");
      return;
    }
    try {
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {}
      clearStoredSupabaseAuth();

      const redirectBase = getAuthRedirectBase();
      const { data, error } = await withTimeout(
        supabase.auth.signUp({
          email,
          password,
          options: redirectBase
            ? { emailRedirectTo: `${redirectBase}/?confirmed=true` }
            : undefined,
        }),
        AUTH_OPERATION_TIMEOUT_MS,
        "Sign up"
      );
      if (error) {
        setMessage(error.message);
      } else {
        if (data.user) {
          await supabase.from("profiles").upsert({
            id: data.user.id,
            email: data.user.email || email,
            username: fullName.trim() || email.split("@")[0],
            created_at: new Date().toISOString(),
          });
        }
        setMessage("Check your email to confirm your account!");
      }
    } catch (error) {
      setMessage(error.message || "Failed to create account. Please try again.");
    }
  };

  const switchToSignup = () => {
    setSignupMode(true);
    setMessage("");
  };

  const switchToLogin = () => {
    setSignupMode(false);
    setMessage("");
    setIsForgot(false);
  };

  const handleLogin = async () => {
    try {
      const { error } = await withTimeout(
        supabase.auth.signInWithPassword({
          email,
          password,
        }),
        AUTH_OPERATION_TIMEOUT_MS,
        "Login"
      );
      if (error) {
        if (error.message === "Invalid login credentials") {
          setMessage("Invalid email or password. Please try again.");
        } else if (error.message === "Email not confirmed") {
          setMessage("Please confirm your email before logging in.");
        } else {
          setMessage("An unexpected error occurred. Please try again later.");
        }
      } else {
        closeModal();
        router.push("/");
      }
    } catch (error) {
      setMessage(error.message || "Failed to log in. Please try again.");
    }
  };

  const handleForgotPassword = async () => {
    const redirectBase = getAuthRedirectBase();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${redirectBase}/reset-password`,
    });

    if (error) {
      setMessage("Failed to send reset email: " + error.message);
    } else {
      setMessage("Password reset email sent! Check your inbox.");
      setIsForgot(false);
    }
  };

  return (
    <Transition appear show={isOpen === true} as={Fragment}>
      <Dialog
        as="div"
        onClose={closeModal}
        style={{ position: "fixed", inset: "0", zIndex: 9999 }}
      >
        <div className="modal-wrapper">
          <Transition.Child
            as={Fragment}
            enter="modal-enter"
            enterFrom="modal-enter-from"
            enterTo="modal-enter-to"
            leave="modal-leave"
            leaveFrom="modal-leave-from"
            leaveTo="modal-leave-to"
          >
            <Dialog.Panel className="login-modal">
              <button
                type="button"
                className="closeButton"
                onClick={closeModal}
              >
                &times;
              </button>

              <div className="modal-header">
                <svg width="28" height="28" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M50 50 Q54 34 66 32 Q82 30 84 50 Q86 72 64 78 Q38 84 28 60 Q16 32 42 18 Q72 4 90 28" stroke="#7c3aed" strokeWidth="7" strokeLinecap="round" fill="none"/>
                </svg>
                <h2 style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "1.15rem", letterSpacing: "-0.01em", color: "var(--color-text-primary)", margin: 0 }}>Spiral Analysis</h2>
              </div>

              <h2 className="modal-title">
                {isForgot
                  ? "Reset Password"
                  : signupMode
                  ? "Create Account"
                  : "Login"}
              </h2>

              <div className="modal-form-wrapper">
                <div className="modal-form">
                  {message && (
                    <div className="error-container">
                      <div className="icon-background">
                        <FaExclamationCircle className="error-icon" />
                      </div>
                      <p className="error-text">{message}</p>
                    </div>
                  )}

                  {signupMode && !isForgot && (
                    <input
                      type="text"
                      placeholder="Full Name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  )}

                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />

                  {!isForgot && (
                    <input
                      type="password"
                      placeholder={signupMode ? "Create Password" : "Password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  )}

                  {signupMode && !isForgot && (
                    <input
                      type="password"
                      placeholder="Confirm Password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  )}
                  {!signupMode && (
                    <div style={{ textAlign: "right", marginTop: "-6px", marginBottom: "4px" }}>
                      <button
                        onClick={() => setIsForgot(!isForgot)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--color-accent)",
                          cursor: "pointer",
                          fontSize: "0.78em",
                          padding: 0,
                        }}
                      >
                        {isForgot ? "Back to Login" : "Forgot Password?"}
                      </button>
                    </div>
                  )}

                  {signupMode && !isForgot && (
                    <>
                      <div style={{ textAlign: "right", marginBottom: "10px" }}>
                        <button
                          onClick={switchToLogin}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--color-accent)",
                            cursor: "pointer",
                            fontSize: "0.9em",
                            padding: 0,
                          }}
                        >
                          Already have an account? Login
                        </button>
                      </div>
                    </>
                  )}
                  {isForgot ? (
                    <button
                      onClick={handleForgotPassword}
                      className="btn-primary"
                    >
                      Send Reset Email
                    </button>
                  ) : signupMode ? (
                    // Signup mode buttons
                    <>
                      <button
                        onClick={handleCreateAccount}
                        className="btn-primary"
                      >
                        Create Account
                      </button>
                      <button onClick={switchToLogin} className="btn-secondary">
                        Back to Login
                      </button>
                    </>
                  ) : (
                    // Login buttons
                    <>
                      <button onClick={handleLogin} className="btn-primary">
                        Login
                      </button>
                      <button
                        onClick={() => {
                          setSignupMode(true);
                        }}
                        className="btn-secondary"
                      >
                        Sign Up
                      </button>
                    </>
                  )}
                </div>

                <div className="vertical-divider"></div>

                <div className="modal-form-right">
                  <Image
                    src="/Icons/trueSpiralLogin.png"
                    width={260}
                    height={210}
                    alt="SpiralPic"
                  />
                </div>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}
