"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

import { useAuth } from "@/context/AuthContext";

type PermissionContextValue = {
  permissions: string[];
  hasPermission: (permission: string) => boolean;
};

const PermissionContext = createContext<PermissionContextValue | null>(null);

type PermissionProviderProps = {
  children: ReactNode;
};

export function PermissionProvider({ children }: PermissionProviderProps) {
  const { user } = useAuth();

  const permissions = user?.permissions ?? [];

  const value = useMemo<PermissionContextValue>(
    () => ({
      permissions,
      hasPermission: (permission: string) => permissions.includes(permission),
    }),
    [permissions],
  );

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error("usePermissions deve ser usado dentro de PermissionProvider");
  }
  return context;
}
