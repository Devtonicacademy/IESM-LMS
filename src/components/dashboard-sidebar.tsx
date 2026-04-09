"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  BarChart,
  CheckSquare,
  PlayCircle,
  Users,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X,
  ClipboardList,
  Award,
  MessageSquare,
  Settings as SettingsIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { useSidebar } from "@/components/sidebar-context";
import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

export function DashboardSidebar({ schoolSlug }: { schoolSlug: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, isSuperAdmin, isAdmin, isInstructor } = useAuth();
  const { isOpen, isCollapsed, toggleCollapsed, close } = useSidebar();
  const [pendingEnrollments, setPendingEnrollments] = useState(0);

  useEffect(() => {
    if (!isAdmin || !schoolSlug) return;
    const q = query(
      collection(db, "schools", schoolSlug, "enrollmentRequests"),
      where("status", "==", "pending")
    );
    const unsub = onSnapshot(q, (snap) => {
      setPendingEnrollments(snap.size);
    });
    return () => unsub();
  }, [isAdmin, schoolSlug]);

  const links = [
    { name: "Dashboard", href: `/${schoolSlug}/dashboard`, icon: BarChart },
    { name: "Course Catalog", href: `/${schoolSlug}/courses`, icon: PlayCircle },
    { name: "Completed Courses", href: `/${schoolSlug}/certificates`, icon: Award },
    { name: "Messages", href: `/${schoolSlug}/messages`, icon: MessageSquare },
    ...(isAdmin || isInstructor
      ? [
          { name: "Manage Courses", href: `/${schoolSlug}/admin/courses`, icon: CheckSquare },
          { name: "Manage Tasks", href: `/${schoolSlug}/admin/tasks`, icon: ClipboardList }
        ]
      : []),
    ...(isAdmin
      ? [
          {
            name: "Enrollment Requests",
            href: `/${schoolSlug}/admin/enrollments`,
            icon: ClipboardList,
            badge: pendingEnrollments,
          },
          { name: "Manage Users", href: `/${schoolSlug}/admin/users`, icon: Users },
          { name: "Settings", href: `/${schoolSlug}/admin/settings`, icon: SettingsIcon },
        ]
      : []),
  ];

  const sidebarWidth = isCollapsed ? "w-16" : "w-64";

  return (
    <>
      {/* Mobile backdrop overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={close}
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen flex flex-col bg-background border-r transition-all duration-300 ease-in-out",
          sidebarWidth,
          // Mobile: hidden off-screen unless isOpen
          isOpen ? "translate-x-0" : "-translate-x-full",
          // Desktop: always visible, ignore isOpen
          "md:translate-x-0"
        )}
      >
        {/* Logo / Header */}
        <div className="flex h-16 items-center px-3 mb-2 mt-1 shrink-0 border-b relative">
          {!isCollapsed && (
            <Link
              href={`/${schoolSlug}/dashboard`}
              onClick={close}
              className="flex items-center gap-2 font-bold text-xl tracking-tight overflow-hidden"
            >
              <img
                src="/iesm-logo.jpg"
                alt="IESM Logo"
                className="h-8 object-contain shrink-0"
              />
              <span className="capitalize text-gray-800 dark:text-gray-100 truncate">
                {schoolSlug.replace(/-/g, " ")}
              </span>
            </Link>
          )}
          {isCollapsed && (
            <Link href={`/${schoolSlug}/dashboard`} onClick={close} className="mx-auto">
              <img
                src="/iesm-logo.jpg"
                alt="IESM Logo"
                className="h-8 object-contain"
              />
            </Link>
          )}

          {/* Mobile close button */}
          <button
            onClick={close}
            className="md:hidden absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-muted text-muted-foreground"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav links */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
          {links.map((link) => {
            const isActive =
              pathname === link.href || pathname.startsWith(link.href + "/");
            const Icon = link.icon;
            return (
              <Link
                key={link.name}
                href={link.href}
                onClick={close}
                title={isCollapsed ? link.name : undefined}
                className={cn(
                  "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all hover:bg-muted",
                  isActive
                    ? "bg-primary/10 text-primary hover:bg-primary/15"
                    : "text-muted-foreground hover:text-foreground",
                  isCollapsed && "justify-center px-2"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                />
                {!isCollapsed && <span className="flex-1">{link.name}</span>}
                {!isCollapsed && (link as any).badge > 0 && (
                  <span className="ml-auto inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
                    {(link as any).badge}
                  </span>
                )}
                {isCollapsed && (link as any).badge > 0 && (
                  <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-red-500" />
                )}
              </Link>
            );
          })}
        </div>

        {/* User info & sign out */}
        <div className="p-3 mt-auto border-t shrink-0">
          {user && !isCollapsed && (
            <div className="flex items-center gap-3 mb-3 px-1">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                {(user.displayName || user.email || "?")[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {user.displayName || "User"}
                </p>
                <p className="text-xs text-muted-foreground font-medium">
                  {isSuperAdmin ? (
                    <span className="text-amber-600 dark:text-amber-400">Super Admin</span>
                  ) : isAdmin ? (
                    "Admin"
                  ) : isInstructor ? (
                    "Instructor"
                  ) : (
                    "Student"
                  )}
                </p>
              </div>
            </div>
          )}
          {user && isCollapsed && (
            <div className="flex justify-center mb-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                {(user.displayName || user.email || "?")[0].toUpperCase()}
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            title="Sign Out"
            className={cn(
              "w-full text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl",
              isCollapsed ? "justify-center px-2" : "justify-start"
            )}
            onClick={async () => {
              await logout();
              router.push(`/${schoolSlug}/auth/login`);
            }}
          >
            <LogOut className={cn("h-4 w-4", !isCollapsed && "mr-3")} />
            {!isCollapsed && "Sign Out"}
          </Button>

          {/* Desktop collapse toggle */}
          <button
            onClick={toggleCollapsed}
            className="hidden md:flex w-full items-center justify-center mt-2 py-1 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-xs gap-1"
            aria-label="Toggle sidebar"
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
