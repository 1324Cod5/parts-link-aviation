import { createContext, useContext, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetCurrentUser,
  useLogoutUser,
  useSwitchRole,
  getGetCurrentUserQueryKey,
  type SwitchRoleInputRole,
} from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react";

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  logout: () => void;
  switchRole: (role: string) => void;
  isSwitchingRole: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useGetCurrentUser({
    query: {
      queryKey: getGetCurrentUserQueryKey(),
      retry: false,
      staleTime: 0,
      refetchOnMount: true,
      refetchOnWindowFocus: false,
    },
  });

  const logoutMutation = useLogoutUser();
  const switchRoleMutation = useSwitchRole();

  const logout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        window.location.href = "/";
      },
    });
  };

  const switchRole = (role: string) => {
    switchRoleMutation.mutate(
      { data: { role: role as SwitchRoleInputRole } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
          // Full reload ensures all role-gated UI refreshes cleanly
          window.location.reload();
        },
      },
    );
  };

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        logout,
        switchRole,
        isSwitchingRole: switchRoleMutation.isPending,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
