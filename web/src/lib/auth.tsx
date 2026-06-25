import { createContext, useContext, useState, useCallback } from "react";
import { login as apiLogin, logout as apiLogout } from "./api";

interface AuthContextValue {
  isLoggedIn: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => sessionStorage.getItem("ls-logged-in") === "1",
  );

  const login = useCallback(async (email: string, password: string) => {
    await apiLogin(email, password);
    sessionStorage.setItem("ls-logged-in", "1");
    setIsLoggedIn(true);
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    sessionStorage.removeItem("ls-logged-in");
    setIsLoggedIn(false);
  }, []);

  return (
    <AuthContext.Provider value={{ isLoggedIn, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
