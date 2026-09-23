"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// Asks the server whether the signed-in user is a superuser. Replaces the old
// client-side comparison against NEXT_PUBLIC_SUPERUSER_EMAILS, which shipped
// every superuser's address in the JS bundle.
export function useSuperuser(user) {
  const [isSuperuser, setIsSuperuser] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (!user) {
        if (!cancelled) { setIsSuperuser(false); setLoading(false); }
        return;
      }
      if (!cancelled) setLoading(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) throw new Error("No session");
        const res = await fetch("/api/superuser-status", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = await res.json().catch(() => ({}));
        if (!cancelled) setIsSuperuser(res.ok && body.isSuperuser === true);
      } catch {
        if (!cancelled) setIsSuperuser(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    check();
    return () => { cancelled = true; };
  }, [user?.id]);

  return { isSuperuser, loading };
}
