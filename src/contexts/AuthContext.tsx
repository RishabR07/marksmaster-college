import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { authAPI } from "@/services/api";

type AppRole = "admin" | "teacher" | "student";
const ROLE_CACHE_KEY = "student-hub:user-role";
type RoleCache = { userId: string; role: AppRole };

const isAppRole = (value: unknown): value is AppRole =>
  value === "admin" || value === "teacher" || value === "student";

interface User {
  id: string;
  email?: string;
  user_metadata?: Record<string, any>;
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  userRole: AppRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userRole: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // On component mount, check if user is already logged in
  useEffect(() => {
    const readCachedRole = (userId: string): AppRole | null => {
      try {
        const raw = localStorage.getItem(ROLE_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as RoleCache;
        if (parsed?.userId === userId && isAppRole(parsed?.role)) {
          return parsed.role;
        }
      } catch {
        // ignore cache parse issues
      }
      return null;
    };

    const setResolvedRole = (userId: string, role: AppRole | null) => {
      if (!role) return;
      setUserRole(role);
      localStorage.setItem(ROLE_CACHE_KEY, JSON.stringify({ userId, role }));
    };

    const clearResolvedRole = () => {
      setUserRole(null);
      localStorage.removeItem(ROLE_CACHE_KEY);
    };

    const initializeAuth = async () => {
      try {
        // Get current user from Supabase
        const currentUser = await authAPI.getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
          const cachedRole = readCachedRole(currentUser.id);
          if (cachedRole) setUserRole(cachedRole);
          
          // Get user role from database
          const role = await authAPI.getUserRole(currentUser.id);
          if (isAppRole(role)) {
            setResolvedRole(currentUser.id, role);
          }
        }
      } catch (error) {
        console.error("Failed to initialize auth:", error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user);
          const cachedRole = readCachedRole(session.user.id);
          if (cachedRole) setUserRole(cachedRole);
          const role = await authAPI.getUserRole(session.user.id);
          if (isAppRole(role)) {
            setResolvedRole(session.user.id, role);
          }
        } else {
          setUser(null);
          clearResolvedRole();
        }
      }
    );

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      await authAPI.logout();
      setUser(null);
      setUserRole(null);
      localStorage.removeItem(ROLE_CACHE_KEY);
      navigate("/");
    } catch (error) {
      console.error("Failed to sign out:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, userRole, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
