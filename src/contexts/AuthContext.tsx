import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type UserProfile = Tables<"users">;

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  // Tracks which user's profile is currently loaded, so we only re-gate + refetch
  // on an actual identity change (login/logout) — not on routine token refreshes.
  const loadedUserId = useRef<string | null>(null);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("users")
      .select("*, organisations(module_type, industry, name, phone, email, vat_number, address, logo_url)")
      .eq("id", userId)
      .maybeSingle();
    loadedUserId.current = userId;
    setProfile(data as any);
    return data;
  };

  useEffect(() => {
    let mounted = true;

    // IMPORTANT: keep `loading` true until the profile (and its org, which
    // decides the fridge-vs-fleet layout) is actually loaded. Previously loading
    // flipped to false the instant the session was known while the profile fetch
    // was still in flight, so pages rendered with a null profile — defaulting to
    // the fleet ("Vector") layout for a beat before swapping to the fridge one.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      const uid = nextSession?.user?.id ?? null;

      if (!uid) {
        loadedUserId.current = null;
        setProfile(null);
        setLoading(false);
        return;
      }

      // Same user (e.g. token refresh) — profile already loaded, don't re-gate.
      if (uid === loadedUserId.current) return;

      setLoading(true);
      // Defer the Supabase call to avoid a deadlock inside the auth callback.
      setTimeout(() => {
        if (!mounted) return;
        fetchProfile(uid).finally(() => { if (mounted) setLoading(false); });
      }, 0);
    });

    supabase.auth.getSession().then(({ data: { session: initial } }) => {
      if (!mounted) return;
      setSession(initial);
      setUser(initial?.user ?? null);
      if (initial?.user) {
        fetchProfile(initial.user.id).finally(() => { if (mounted) setLoading(false); });
      } else {
        setLoading(false);
      }
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    loadedUserId.current = null;
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
