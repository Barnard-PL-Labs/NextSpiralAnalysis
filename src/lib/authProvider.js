"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

const AuthContext = createContext();

const getFirstName = (email) => {
  if (!email) return "";
  const part = email.split("@")[0].split(".")[0];
  return part.charAt(0).toUpperCase() + part.slice(1);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState("");

  const fetchUsername = async (u) => {
    if (!u) { setUsername(""); return; }
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", u.id)
      .maybeSingle();
    setUsername(profile?.username || getFirstName(u.email));
  };

  useEffect(() => {
    const fetchSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error("Error fetching session:", error);
      } else {
        const u = data?.session?.user || null;
        setUser(u);
        fetchUsername(u);
      }
    };

    fetchSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      const u = session?.user || null;
      setUser(u);
      fetchUsername(u);
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
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={{ user, username }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
