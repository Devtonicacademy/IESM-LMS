"use client";

import { useSidebar } from "@/components/sidebar-context";
import { cn } from "@/lib/utils";

export function SidebarContentWrapper({ children, className }: { children: React.ReactNode, className?: string }) {
  const { isCollapsed } = useSidebar();
  return (
    <div
      className={cn(
        "flex flex-col flex-1 transition-all duration-300",
        isCollapsed ? "md:pl-16" : "md:pl-64",
        className
      )}
    >
      {children}
    </div>
  );
}
