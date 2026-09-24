"use client";

import type { ReactNode } from "react";

import { usePermissions } from "@/context/PermissionContext";

type PermissionGuardProps = {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
};

export function PermissionGuard({
  permission,
  children,
  fallback = null,
}: PermissionGuardProps) {
  const { hasPermission } = usePermissions();

  if (!hasPermission(permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
