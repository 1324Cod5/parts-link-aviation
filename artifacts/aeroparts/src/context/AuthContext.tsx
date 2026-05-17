import { createContext, useContext, ReactNode } from "react";
import { useGetCurrentUser, useLogoutUser, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useGetCurrentUser({
    query: {
      queryKey: getGetCurrentUserQueryKey(),
      retry: false,
      staleTime: Infinity,
    },
  });

  const logoutMutation = useLogoutUser();

  const logout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        window.location.href = "/";
      },
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
