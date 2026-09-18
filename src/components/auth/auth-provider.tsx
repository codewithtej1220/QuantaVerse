"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { ApiError } from "@/lib/api";
import {
  fetchMe,
  login as loginRequest,
  logout as logoutRequest,
  onSessionChange,
  readSession,
  register as registerRequest,
  writeSession,
  type StudentProfile,
} from "@/lib/auth";
import { clearProgress } from "@/lib/progress-store";

interface AuthState {
  user: StudentProfile | null;
  ready: boolean;
  /* Both hand back the profile, so a caller can send each role to its own home. */
  signIn: (email: string, password: string) => Promise<StudentProfile>;
  signUp: (input: {
    email: string;
    password: string;
    display_name: string;
    institution?: string | null;
    professor_code?: string | null;
    teaches?: string[];
  }) => Promise<StudentProfile>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StudentProfile | null>(null);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    if (!readSession()) {
      setUser(null);
      setReady(true);
      return;
    }
    try {
      setUser(await fetchMe());
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) writeSession(null);
      setUser(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onSessionChange(() => {
      if (!readSession()) {
        clearProgress();
        setUser(null);
      }
    });
    void Promise.resolve().then(load);
    return unsubscribe;
  }, [load]);

  const signIn = useCallback(async (email: string, password: string) => {
    const payload = await loginRequest({ email, password });
    writeSession(payload.tokens);
    setUser(payload.user);
    return payload.user;
  }, []);

  const signUp = useCallback(
    async (input: {
      email: string;
      password: string;
      display_name: string;
      institution?: string | null;
      professor_code?: string | null;
      teaches?: string[];
    }) => {
      const payload = await registerRequest(input);
      writeSession(payload.tokens);
      setUser(payload.user);
      return payload.user;
    },
    [],
  );

  const signOut = useCallback(async () => {
    await logoutRequest();
    clearProgress();
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, ready, signIn, signUp, signOut, refreshUser: load }),
    [user, ready, signIn, signUp, signOut, load],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
