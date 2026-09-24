"use client";

import Link from "next/link";

import { BpmLogo } from "@/components/layout/BpmLogo";
import { Button } from "@/components/ui/button";

type ErrorPageLayoutProps = {
  title: string;
  description: string;
  actionLabel: string;
  actionHref?: string;
  onAction?: () => void;
};

export function ErrorPageLayout({
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: ErrorPageLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md space-y-6 rounded-sm border border-gray-200 bg-white p-8 text-center">
        <div className="flex justify-center">
          <BpmLogo className="h-10 w-auto" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">
            {title}
          </h1>
          <p className="text-sm text-gray-600">{description}</p>
        </div>

        {actionHref ? (
          <Link
            href={actionHref}
            className="bg-bpm-primary hover:bg-bpm-primary-hover inline-flex h-9 w-full items-center justify-center rounded-sm text-sm font-bold text-black shadow-sm"
          >
            {actionLabel}
          </Link>
        ) : (
          <Button
            type="button"
            onClick={onAction}
            className="bg-bpm-primary hover:bg-bpm-primary-hover w-full rounded-sm font-bold text-black shadow-sm"
          >
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
