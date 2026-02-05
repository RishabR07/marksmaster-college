import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authAPI } from "@/services/api";

interface User {
  id: string;
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  userRole: "admin" | "teacher" | "student" | null;
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
  const [userRole, setUserRole] = useState<"admin" | "teacher" | "student" | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // On component mount, check if user is already logged in
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const currentUser = await authAPI.getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
          // For now, we'll use the role from the JWT or default to 'student'
          // The backend can store the role in the JWT payload
          const role = currentUser.role || "student";
          setUserRole(role as "admin" | "teacher" | "student");
        }
      } catch (error) {
        console.error("Failed to initialize auth:", error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const signOut = async () => {
    authAPI.logout();
    setUser(null);
    setUserRole(null);
    navigate("/");
  };

  return (
    <AuthContext.Provider value={{ user, userRole, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
