import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
setBaseUrl(BASE);
// Auth is session-cookie based (the API server issues an httpOnly connect.sid
// cookie and has no bearer-token endpoint). Make sure no stale bearer token is
// attached to generated-client requests; cookies carry the session instead.
setAuthTokenGetter(() => null);

type User = {
  id: number;
  username: string;
  email: string;
};

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function toUser(data: any): User | null {
  const raw = data?.user ?? data;
  if (!raw || typeof raw.id !== "number") return null;
  const email: string = raw.email ?? "";
  return {
    id: raw.id,
    email,
    username: raw.username ?? (email ? email.split("@")[0] : "Coach"),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const queryClient = useQueryClient();

  const fetchMe = useCallback(async (): Promise<User | null> => {
    try {
      const res = await fetch(`${BASE}/api/auth/me`, {
        credentials: "include",
      });
      if (!res.ok) return null;
      return toUser(await res.json());
    } catch {
      return null;
    }
  }, []);

  // Restore session from the persisted cookie on launch.
  useEffect(() => {
    (async () => {
      try {
        const me = await fetchMe();
        if (me) setUser(me);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [fetchMe]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? err.message ?? "Login failed");
    }
    const me = toUser(await res.json()) ?? (await fetchMe());
    if (!me) throw new Error("Could not load your account.");
    setUser(me);
  }, [fetchMe]);

  const signup = useCallback(
    async (username: string, email: string, password: string) => {
      const res = await fetch(`${BASE}/api/auth/signup`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? err.message ?? "Signup failed");
      }
      const me = toUser(await res.json()) ?? (await fetchMe());
      if (!me) throw new Error("Could not create your account.");
      setUser(me);
    },
    [fetchMe]
  );

  const logout = useCallback(async () => {
    try {
      await fetch(`${BASE}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {}
    setUser(null);
    // Wipe all cached query data (profile, plan, etc.) so the previous account's
    // data can never drive routing or render for the next signed-in user.
    queryClient.clear();
    router.replace("/login");
  }, [router, queryClient]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
