import AsyncStorage from "@react-native-async-storage/async-storage";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);

const TOKEN_KEY = "ascend_auth_token";

type User = {
  id: number;
  username: string;
  email: string;
};

type AuthContextValue = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const storeToken = useCallback(async (t: string) => {
    await AsyncStorage.setItem(TOKEN_KEY, t);
    setToken(t);
    setAuthTokenGetter(() => t);
  }, []);

  const clearToken = useCallback(async () => {
    await AsyncStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setAuthTokenGetter(() => null);
  }, []);

  const fetchMe = useCallback(async (t: string): Promise<User | null> => {
    try {
      const base = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
      const res = await fetch(`${base}/api/auth/me`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.user ?? data ?? null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(TOKEN_KEY);
        if (stored) {
          setAuthTokenGetter(() => stored);
          const me = await fetchMe(stored);
          if (me) {
            setToken(stored);
            setUser(me);
          } else {
            await AsyncStorage.removeItem(TOKEN_KEY);
          }
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, [fetchMe]);

  const login = useCallback(
    async (email: string, password: string) => {
      const base = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
      const res = await fetch(`${base}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? "Login failed");
      }
      const data = await res.json();
      const t = data.token ?? data.accessToken ?? data.jwt;
      if (!t) throw new Error("No token returned");
      const me = data.user ?? (await fetchMe(t));
      if (!me) throw new Error("Could not load profile");
      await storeToken(t);
      setUser(me);
    },
    [storeToken, fetchMe]
  );

  const signup = useCallback(
    async (username: string, email: string, password: string) => {
      const base = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
      const res = await fetch(`${base}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? "Signup failed");
      }
      const data = await res.json();
      const t = data.token ?? data.accessToken ?? data.jwt;
      if (!t) throw new Error("No token returned");
      const me = data.user ?? (await fetchMe(t));
      if (!me) throw new Error("Could not load profile");
      await storeToken(t);
      setUser(me);
    },
    [storeToken, fetchMe]
  );

  const logout = useCallback(async () => {
    try {
      const base = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
      if (token) {
        await fetch(`${base}/api/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {}
    await clearToken();
    setUser(null);
    router.replace("/login");
  }, [token, clearToken, router]);

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, login, signup, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
