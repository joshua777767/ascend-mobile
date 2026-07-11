import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const USER_ID_KEY = "@ascend/userId";

type UserContextValue = {
  userId: string | null;
  setUserId: (id: string | null) => void;
  isLoaded: boolean;
};

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserIdState] = useState<string | null>(null);
  // isLoaded flips to true once we've attempted to read the persisted userId.
  // SubscriptionProvider waits for this before initialising RevenueCat so we
  // never call Purchases.logOut() for a user who is already authenticated.
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(USER_ID_KEY)
      .then((id) => {
        if (id) setUserIdState(id);
      })
      .catch(() => {})
      .finally(() => setIsLoaded(true));
  }, []);

  const setUserId = useCallback((id: string | null) => {
    setUserIdState(id);
    if (id) {
      AsyncStorage.setItem(USER_ID_KEY, id).catch(() => {});
    } else {
      AsyncStorage.removeItem(USER_ID_KEY).catch(() => {});
    }
  }, []);

  return (
    <UserContext.Provider value={{ userId, setUserId, isLoaded }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}
