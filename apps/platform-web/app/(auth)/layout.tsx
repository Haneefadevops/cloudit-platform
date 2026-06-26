"use client";

import * as React from "react";
import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4">
      <div className="mb-8 flex items-center gap-2">
        <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
          <span className="text-primary-foreground text-lg font-bold">C</span>
        </div>
        <span className="text-xl font-bold">CloudIT Platform</span>
      </div>
      <div className="w-full max-w-md">
        {children}
      </div>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} CloudIT. All rights reserved.
      </p>
    </div>
  );
}
