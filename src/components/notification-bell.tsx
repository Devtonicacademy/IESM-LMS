"use client";

import { useEffect, useRef, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  doc,
  writeBatch,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/auth-provider";
import { useParams } from "next/navigation";
import { Bell, CheckCircle, XCircle, BookOpen, X, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface Notification {
  id: string;
  type: string;
  status?: "approved" | "declined";
  courseId: string;
  courseName: string;
  message: string;
  read: boolean;
  createdAt: any;
}

export function NotificationBell() {
  const { user } = useAuth();
  const params = useParams();
  const schoolSlug = params?.schoolSlug as string | undefined;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user || !schoolSlug) return;
    const q = query(
      collection(db, "schools", schoolSlug, "users", user.uid, "notifications"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setNotifications(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Notification, "id">) }))
      );
    });
    return () => unsub();
  }, [user, schoolSlug]);

  // Close panel when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = async () => {
    if (!user || !schoolSlug) return;
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;
    const batch = writeBatch(db);
    unread.forEach((n) => {
      batch.update(doc(db, "schools", schoolSlug, "users", user.uid, "notifications", n.id), {
        read: true,
      });
    });
    await batch.commit();
  };

  const markRead = async (notifId: string) => {
    if (!user || !schoolSlug) return;
    await updateDoc(
      doc(db, "schools", schoolSlug, "users", user.uid, "notifications", notifId),
      { read: true }
    );
  };

  const formatTime = (ts: any) => {
    if (!ts?.toDate) return "";
    const d = ts.toDate();
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="relative" ref={panelRef}>
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full h-9 w-9 relative"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) markAllRead();
        }}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 h-4 min-w-4 px-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-80 bg-background border border-border/70 rounded-2xl shadow-xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
              <h3 className="font-semibold text-sm">Notifications</h3>
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* List */}
            <div className="max-h-96 overflow-y-auto divide-y divide-border/40">
              {notifications.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground text-sm">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  No notifications yet
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 cursor-default transition-colors",
                      !n.read && "bg-primary/5 hover:bg-primary/8"
                    )}
                  >
                    <div
                      className={cn(
                        "shrink-0 mt-0.5 w-8 h-8 rounded-full flex items-center justify-center",
                        n.type === "session"
                          ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                          : n.status === "approved"
                          ? "bg-green-500/15 text-green-600 dark:text-green-400"
                          : "bg-red-500/15 text-red-600 dark:text-red-400"
                      )}
                    >
                      {n.type === "session" ? (
                        <Calendar className="h-4 w-4" />
                      ) : n.status === "approved" ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-snug text-foreground">{n.message}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatTime(n.createdAt)}</p>
                    </div>
                    {!n.read && (
                      <div className="shrink-0 mt-1.5 w-2 h-2 rounded-full bg-primary" />
                    )}
                  </div>
                ))
              )}
            </div>

            {notifications.length > 0 && (
              <div className="border-t border-border/50 px-4 py-2">
                <button
                  onClick={markAllRead}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  Mark all as read
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
