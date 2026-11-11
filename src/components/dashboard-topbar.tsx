"use client";

import { Search, Menu, HelpCircle, Compass } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/components/auth-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { useSidebar } from "@/components/sidebar-context";
import { NotificationBell } from "@/components/notification-bell";
import { useTour } from "@/components/tour-guide";
import Link from "next/link";
import { useParams } from "next/navigation";

export function DashboardTopbar({ breadcrumb = "Dashboard" }: { breadcrumb?: string }) {
  const { user, isSuperAdmin, isAdmin, isInstructor } = useAuth();
  const { toggleOpen, isCollapsed } = useSidebar();
  const { startTour } = useTour();
  const params = useParams();
  const schoolSlug = params?.schoolSlug as string | undefined;

  return (
    <header className="sticky top-0 z-30 flex h-20 items-center justify-between bg-background border-b px-4 md:px-8">
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile: always, desktop: only when collapsed */}
        <Button
          variant="ghost"
          size="icon"
          className="rounded-xl h-9 w-9 md:hidden"
          onClick={toggleOpen}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight leading-tight">
            {breadcrumb.split(" / ")[0]}
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-0.5 hidden sm:block">
            {breadcrumb}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-6">
        <div id="tour-search-bar" className="relative w-48 md:w-72 hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search anything"
            className="w-full pl-9 bg-muted/50 border-transparent focus-visible:bg-background rounded-full h-10"
          />
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          {/* Setup Wizard / Help Tour Trigger Button */}
          <div id="tour-help-guide">
            <Button
              variant="outline"
              size="sm"
              onClick={startTour}
              className="gap-1.5 h-9 rounded-full px-3 text-xs font-semibold hover:border-primary/50 transition-colors shadow-sm"
              title="Start App Tour"
            >
              <Compass className="h-4 w-4 text-primary" />
              <span className="hidden sm:inline">Tour</span>
            </Button>
          </div>

          <div id="tour-theme-toggle">
            <ThemeToggle />
          </div>

          <div className="flex items-center gap-2 md:gap-3 pl-2 border-l">
            <div id="tour-user-profile">
              <Link href={schoolSlug ? `/${schoolSlug}/profile` : "#"} className="flex items-center gap-2 md:gap-3 group" title="My Profile">
                <Avatar className="h-8 w-8 md:h-9 md:w-9 border ring-2 ring-transparent group-hover:ring-primary/40 transition-all">
                  <AvatarImage
                    src={user?.photoURL || `https://api.dicebear.com/7.x/notionists/svg?seed=${user?.uid || "guest"}`}
                    alt="Profile"
                    className="object-cover"
                  />
                  <AvatarFallback>
                    {user?.email?.charAt(0).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden sm:block">
                  <p className="text-sm font-medium leading-none mb-1 group-hover:text-primary transition-colors">
                    {user?.displayName || "Admin User"}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize leading-none">
                    {isSuperAdmin ? "Super Admin" : isAdmin ? "Admin" : isInstructor ? "Instructor" : "Student"}
                  </p>
                </div>
              </Link>
            </div>

            <div id="tour-notifications">
              <NotificationBell />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
