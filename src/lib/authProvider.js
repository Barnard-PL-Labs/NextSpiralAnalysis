"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

const AuthContext = createContext();

const getEmailPrefix = (email) => {
  if (!email) return "";
  return email.split("@")[0];
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState("");

  const fetchUsername = (u) => {
    if (u) setUsername(getEmailPrefix(u.email));
  };

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      const u = session?.user || null;
      setUser(u);

      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        if (u) fetchUsername(u);
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

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("signOut failed, forcing local clear:", error);
      setUser(null);
      setUsername("");
    }
  };

  return <AuthContext.Provider value={{ user, username, logout }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
