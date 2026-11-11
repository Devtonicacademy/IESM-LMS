"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { DashboardTopbar } from "@/components/dashboard-topbar";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  query,
  orderBy,
  Timestamp,
  arrayUnion,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { sendIntroMessage } from "@/lib/sendIntroMessage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  CheckCircle,
  XCircle,
  Clock,
  Users,
  BookOpen,
  Loader2,
  Filter,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";

interface EnrollmentRequest {
  id: string;
  courseId: string;
  courseName: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  status: "pending" | "approved" | "declined";
  requestedAt: Timestamp;
  pricePaid?: number;
  paymentMethod?: string;
  receiptUrl?: string;
}

const statusConfig = {
  pending: { label: "Pending", color: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30" },
  approved: { label: "Approved", color: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30" },
  declined: { label: "Declined", color: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30" },
};

export default function AdminEnrollmentsPage({
  params,
}: {
  params: Promise<{ schoolSlug: string }>;
}) {
  const { schoolSlug } = use(params);
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();

  const [requests, setRequests] = useState<EnrollmentRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "declined">("pending");

  useEffect(() => {
    if (!loading && !user) router.push(`/${schoolSlug}/auth/login`);
    if (!loading && user && !isAdmin) router.push(`/${schoolSlug}/dashboard`);
  }, [loading, user, isAdmin, router, schoolSlug]);

  useEffect(() => {
    if (!isAdmin) return;
    const q = query(
      collection(db, "schools", schoolSlug, "enrollmentRequests"),
      orderBy("requestedAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setRequests(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EnrollmentRequest, "id">) }))
      );
      setLoadingRequests(false);
    });
    return () => unsub();
  }, [schoolSlug, isAdmin]);

  const handleDecision = async (
    request: EnrollmentRequest,
    decision: "approved" | "declined"
  ) => {
    setProcessingId(request.id);
    try {
      // 1. Update the enrollment request status
      await updateDoc(
        doc(db, "schools", schoolSlug, "enrollmentRequests", request.id),
        { status: decision, decidedAt: serverTimestamp(), decidedBy: user?.uid }
      );

      // 2. If approved, add student to course enrolledStudents
      if (decision === "approved") {
        await updateDoc(doc(db, "schools", schoolSlug, "courses", request.courseId), {
          enrolledStudents: arrayUnion(request.studentId),
        });

        // Send automated intro message
        await sendIntroMessage(schoolSlug, request.courseId, request.courseName, request.studentId, request.studentName);
      }

      // 3. Create in-app notification for student
      const notificationMessage =
        decision === "approved"
          ? `Your enrollment request for "${request.courseName}" has been approved! You now have access.`
          : `Your enrollment request for "${request.courseName}" has been declined.`;

      await addDoc(
        collection(db, "schools", schoolSlug, "users", request.studentId, "notifications"),
        {
          type: "enrollment",
          status: decision,
          courseId: request.courseId,
          courseName: request.courseName,
          message: notificationMessage,
          read: false,
          createdAt: serverTimestamp(),
        }
      );

      // 4. Send email notification
      try {
        await fetch("/api/enrollment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: request.studentEmail,
            studentName: request.studentName,
            courseName: request.courseName,
            status: decision,
            schoolSlug,
          }),
        });
      } catch (emailErr) {
        console.warn("Email sending failed (non-fatal):", emailErr);
      }

      toast.success(
        decision === "approved"
          ? `✅ Enrollment approved for ${request.studentName}`
          : `❌ Enrollment declined for ${request.studentName}`
      );
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to process request: " + (err.message || "Unknown error"));
    } finally {
      setProcessingId(null);
    }
  };

  if (loading || (!user && !loading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const filtered = filter === "all" ? requests : requests.filter((r) => r.status === filter);
  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="flex flex-col flex-1 w-full">
      <DashboardTopbar breadcrumb="Admin / Enrollment Requests" />

      <div className="p-6 md:p-8 max-w-5xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              Enrollment Requests
              {pendingCount > 0 && (
                <span className="inline-flex items-center justify-center h-6 min-w-6 px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  {pendingCount}
                </span>
              )}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Review and approve or decline student enrollment requests.
            </p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          {(["pending", "approved", "declined", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                filter === f
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
              }`}
            >
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
              {f === "pending" && pendingCount > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-yellow-500 text-white text-[10px] font-bold">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* List */}
        {loadingRequests ? (
          <div className="py-16 flex items-center justify-center text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading requests...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground border-2 border-dashed rounded-2xl">
            <Users className="h-10 w-10 opacity-30" />
            <p className="font-medium">No {filter === "all" ? "" : filter} requests</p>
            <p className="text-sm">
              {filter === "pending"
                ? "All enrollment requests have been processed."
                : "No requests match this filter."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {filtered.map((req) => {
                const isProcessing = processingId === req.id;
                const timeAgo = req.requestedAt?.toDate
                  ? formatDistanceToNow(req.requestedAt.toDate(), { addSuffix: true })
                  : "recently";

                return (
                  <motion.div
                    key={req.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card className="border-border/60 hover:shadow-sm transition-shadow">
                      <CardContent className="p-4 sm:p-5">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                          {/* Avatar */}
                          <div className="shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                            {req.studentName?.[0]?.toUpperCase() || "?"}
                          </div>

                          {/* Main info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-sm truncate">{req.studentName}</p>
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
                                  statusConfig[req.status].color
                                }`}
                              >
                                {req.status === "pending" && <Clock className="h-3 w-3" />}
                                {req.status === "approved" && <CheckCircle className="h-3 w-3" />}
                                {req.status === "declined" && <XCircle className="h-3 w-3" />}
                                {statusConfig[req.status].label}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {req.studentEmail}
                            </p>
                            <div className="flex items-center gap-1 mt-1.5">
                              <BookOpen className="h-3.5 w-3.5 text-primary shrink-0" />
                              <p className="text-sm font-medium text-foreground/80 truncate">
                                {req.courseName}
                              </p>
                            </div>
                            {req.pricePaid !== undefined && (
                              <div className="flex flex-col gap-1 mt-2">
                                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold text-green-700 dark:text-green-400 bg-green-500/10 w-fit">
                                  Payment: ₦{req.pricePaid.toLocaleString()} ({req.paymentMethod === 'bank_transfer' ? 'Bank Transfer' : req.paymentMethod})
                                </div>
                                {req.receiptUrl && (
                                  <a href={req.receiptUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline w-fit">
                                    <ExternalLink className="h-3 w-3" />
                                    View Receipt
                                  </a>
                                )}
                                {req.status === "pending" && (
                                  <div className="text-[11px] font-medium text-yellow-700 dark:text-yellow-400 bg-yellow-500/10 p-1.5 rounded border border-yellow-500/20 max-w-sm">
                                    ⚠️ Please verify this payment in the company bank account before approving.
                                  </div>
                                )}
                              </div>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              Requested {timeAgo}
                            </p>
                          </div>

                          {/* Actions */}
                          {req.status === "pending" && (
                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-lg border-red-300 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:border-red-400 gap-1.5"
                                disabled={isProcessing}
                                onClick={() => handleDecision(req, "declined")}
                              >
                                {isProcessing ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <XCircle className="h-3.5 w-3.5" />
                                )}
                                Decline
                              </Button>
                              <Button
                                size="sm"
                                className="rounded-lg bg-green-600 hover:bg-green-700 text-white gap-1.5 border-0 shadow-sm"
                                disabled={isProcessing}
                                onClick={() => handleDecision(req, "approved")}
                              >
                                {isProcessing ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle className="h-3.5 w-3.5" />
                                )}
                                Approve
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
