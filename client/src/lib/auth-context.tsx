import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  organizationId?: string;
  [key: string]: unknown;
}

interface AuthState {
  status: AuthStatus;
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

const AUTH_CHANGE_EVENT = "auth-state-change";

function dispatchAuthChange() {
  window.dispatchEvent(new CustomEvent(AUTH_CHANGE_EVENT));
}

function getStoredAuth(): { token: string | null; user: User | null } {
  const token = localStorage.getItem("token");
  const userStr = localStorage.getItem("user");
  let user: User | null = null;
  
  if (userStr) {
    try {
      user = JSON.parse(userStr);
    } catch {
      user = null;
    }
  }
  
  return { token, user };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const syncFromStorage = useCallback(() => {
    const stored = getStoredAuth();
    setToken(stored.token);
    setUser(stored.user);
    setStatus(stored.token ? "authenticated" : "unauthenticated");
  }, []);

  useEffect(() => {
    syncFromStorage();
    
    const handleAuthChange = () => {
      syncFromStorage();
    };
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "token" || e.key === "user") {
        syncFromStorage();
      }
    };

    window.addEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
    window.addEventListener("storage", handleStorageChange);
    
    return () => {
      window.removeEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [syncFromStorage]);

  const login = useCallback((newToken: string, newUser: User) => {
    localStorage.setItem("token", newToken);
    localStorage.setItem("user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    setStatus("authenticated");
    dispatchAuthChange();
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
    setStatus("unauthenticated");
    dispatchAuthChange();
  }, []);

  return (
    <AuthContext.Provider value={{ status, user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthState(): AuthState {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuthState must be used within an AuthProvider");
  }
  return context;
}

export { dispatchAuthChange };
