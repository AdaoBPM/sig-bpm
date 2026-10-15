"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { AuthProvider } from "@/context/AuthContext";
import { PermissionProvider } from "@/context/PermissionContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { queryClient } from "@/lib/queryClient";

type ProvidersProps = {
  children: ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <PermissionProvider>
            {children}
            <Toaster richColors closeButton />
          </PermissionProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
