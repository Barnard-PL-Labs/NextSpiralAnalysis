"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

const AuthContext = createContext();

const getEmailPrefix = (email) => {
  if (!email) return "";
  return email.split("@")[0];
};

const AUTH_OPERATION_TIMEOUT_MS = 10000;

const withTimeout = (promise, timeoutMs, label) => {
  let timeoutId;

  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out`));
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

const isStaleRefreshTokenError = (error) => {
  const message = `${error?.message || ""} ${error?.name || ""}`.toLowerCase();
  return (
    message.includes("invalid refresh token") ||
    message.includes("refresh token not found") ||
    message.includes("refresh token has expired") ||
    message.includes("invalid_grant")
  );
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState("");

  const fetchUsername = (u) => {
    setUsername(u ? getEmailPrefix(u.email) : "");
  };

  const clearLocalSession = useCallback(() => {
    setUser(null);
    setUsername("");
    clearStoredSupabaseAuth();
  }, []);

  const validateSession = useCallback(async () => {
    try {
      const { data: sessionData } = await withTimeout(
        supabase.auth.getSession(),
        AUTH_OPERATION_TIMEOUT_MS,
        "Session check"
      );

      if (!sessionData?.session) {
        clearLocalSession();
        return;
      }

      const { data, error } = await withTimeout(
        supabase.auth.getUser(),
        AUTH_OPERATION_TIMEOUT_MS,
        "Session validation"
      );
      if (error || !data?.user) {
        clearLocalSession();
        return;
      }

      setUser(data.user);
      fetchUsername(data.user);
    } catch (error) {
      if (!isStaleRefreshTokenError(error)) {
        console.warn("Session validation failed; clearing local session.");
      }
      clearLocalSession();
    }
  }, [clearLocalSession]);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      const u = session?.user || null;
      setUser(u);
      fetchUsername(u);

      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        if (event === "SIGNED_IN" && u) {
          const { data: existing } = await supabase
            .from("profiles")
            .select("id")
            .eq("id", u.id)
            .maybeSingle();
          if (!existing) {
            await supabase.from("profiles").insert({
              id: u.id,
              username: u.email?.split("@")[0] || "",
              created_at: new Date().toISOString(),
            });
          }
        }
      }
    });

    validateSession();

    const handleWake = () => {
      if (!document.hidden) validateSession();
    };

    document.addEventListener("visibilitychange", handleWake);
    window.addEventListener("focus", validateSession);

    return () => {
      authListener?.subscription?.unsubscribe();
      document.removeEventListener("visibilitychange", handleWake);
      window.removeEventListener("focus", validateSession);
    };
  }, [validateSession]);

  const logout = async () => {
    try {
      await withTimeout(
        supabase.auth.signOut(),
        AUTH_OPERATION_TIMEOUT_MS,
        "Sign out"
      );
    } catch (error) {
      if (!isStaleRefreshTokenError(error)) {
        console.warn("signOut failed, forcing local clear.");
      }
    } finally {
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {}
      clearLocalSession();
    }
  };

  return <AuthContext.Provider value={{ user, username, logout }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
