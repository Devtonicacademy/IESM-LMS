"use client";

import { use, useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  updateDoc,
  arrayUnion,
  Timestamp,
  addDoc,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/components/auth-provider";
import { PaystackButton } from "react-paystack";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, CheckCircle, Circle, PlayCircle, FileText, File, Award, ClipboardList, Wallet } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { motion } from "framer-motion";
import Link from "next/link";
import CourseSchedule from "@/components/course/course-schedule";
import StudentNotes from "@/components/course/student-notes";
import { DashboardTopbar } from "@/components/dashboard-topbar";
import { generateCertificate } from "@/lib/generate-certificate";
import CourseCurriculumList from "@/components/course/course-curriculum-list";

interface AttendanceLogEntry {
  id: string;
  sessionId: string;
  sessionTitle: string;
  date: Timestamp;
  studentStatuses: { uid: string; displayName: string; status: string }[];
  topicsCovered: string;
  comment: string;
  loggedAt: Timestamp;
}

const statusColors: Record<string, string> = {
  present: "text-green-600 dark:text-green-400",
  absent: "text-red-500 dark:text-red-400",
  late: "text-yellow-600 dark:text-yellow-400",
  excused: "text-blue-500 dark:text-blue-400",
};

export default function CourseDetailPage({
  params,
}: {
  params: Promise<{ schoolSlug: string; courseId: string }>;
}) {
  const { schoolSlug, courseId } = use(params);
  const { user, isAdmin, isInstructor, isStudent } = useAuth();

  const [course, setCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollmentStatus, setEnrollmentStatus] = useState<"none" | "pending" | "approved" | "declined">("none");
  const [myAttendanceLogs, setMyAttendanceLogs] = useState<AttendanceLogEntry[]>([]);
  const [allLogs, setAllLogs] = useState<AttendanceLogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [bankSettings, setBankSettings] = useState<{bankName: string, accountName: string, accountNumber: string} | null>(null);
  const [paystackSettings, setPaystackSettings] = useState<{enabled: boolean, publicKey: string} | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const ref = doc(db, "schools", schoolSlug, "settings", "payment");
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setBankSettings({
            bankName: data.bankName || "",
            accountName: data.accountName || "",
            accountNumber: data.accountNumber || "",
          });
          setPaystackSettings({
            enabled: !!data.paystackEnabled,
            publicKey: data.paystackPublicKey || "",
          });
        }
      } catch (err) {
        console.error("Failed to load settings", err);
      }
    }
    fetchSettings();
  }, [schoolSlug]);

  useEffect(() => {
    async function fetchCourse() {
      try {
        const ref = doc(db, "schools", schoolSlug, "courses", courseId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setCourse({ id: snap.id, ...snap.data() });
        }
      } catch (err) {
        console.error("Failed to load course", err);
      } finally {
        setLoading(false);
      }
    }
    fetchCourse();
  }, [schoolSlug, courseId]);

  // Check if student has a pending/approved/declined enrollment request
  useEffect(() => {
    if (!user || !isStudent) return;
    async function checkEnrollmentRequest() {
      try {
        const q = query(
          collection(db, "schools", schoolSlug, "enrollmentRequests"),
          where("courseId", "==", courseId),
          where("studentId", "==", user!.uid)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          setEnrollmentStatus(snap.docs[0].data().status as any);
        }
      } catch (err) {
        console.error(err);
      }
    }
    checkEnrollmentRequest();
  }, [user, isStudent, schoolSlug, courseId]);

  // Load attendance logs
  useEffect(() => {
    if (!user) return;
    async function loadLogs() {
      setLogsLoading(true);
      try {
        const logsRef = collection(
          db, "schools", schoolSlug, "courses", courseId, "attendanceLogs"
        );
        const q = query(logsRef, orderBy("loggedAt", "desc"));
        const snap = await getDocs(q);
        const logs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceLogEntry));
        setAllLogs(logs);

        if (isStudent) {
          setMyAttendanceLogs(
            logs.filter((l) =>
              l.studentStatuses?.some((s) => s.uid === user!.uid)
            )
          );
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLogsLoading(false);
      }
    }
    loadLogs();
  }, [user, schoolSlug, courseId, isStudent]);

  if (loading) return <div className="py-20 text-center animate-pulse">Loading course details...</div>;
  if (!course) return <div className="py-20 text-center">Course not found.</div>;

  const isEnrolled = user && course.enrolledStudents?.includes(user.uid);
  const canManage = isAdmin || isInstructor;

  const handleEnroll = async (confirmedPayment = false) => {
    if (!user) { toast.error("Please log in to enroll"); return; }
    
    // If course has a price and payment hasn't been confirmed in the modal yet
    if (course.price > 0 && !confirmedPayment) {
      setShowPaymentModal(true);
      return;
    }

    setEnrolling(true);
    try {
      let receiptUrl = "";
      if (course.price > 0 && receiptFile) {
        const fileExt = receiptFile.name.split(".").pop();
        const storageRef = ref(storage, `schools/${schoolSlug}/receipts/${user.uid}_${Date.now()}.${fileExt}`);
        const snapshot = await uploadBytes(storageRef, receiptFile);
        receiptUrl = await getDownloadURL(snapshot.ref);
      }

      await addDoc(collection(db, "schools", schoolSlug, "enrollmentRequests"), {
        courseId,
        courseName: course.title,
        studentId: user.uid,
        studentName: user.displayName || user.email || "Student",
        studentEmail: user.email || "",
        status: "pending",
        requestedAt: serverTimestamp(),
        ...(course.price > 0 ? {
          pricePaid: course.price,
          paymentMethod: "bank_transfer",
          ...(receiptUrl ? { receiptUrl } : {})
        } : {})
      });
      
      if (course.price > 0) {
        // Send email notification for paid course using "pending_payment"
        try {
          await fetch("/api/enrollment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: user.email,
              studentName: user.displayName || user.email || "Student",
              courseName: course.title,
              status: "pending_payment",
              schoolSlug,
            }),
          });
        } catch (emailErr) {
          console.warn("Notice: Email notification couldn't be sent:", emailErr);
        }
      }

      setEnrollmentStatus("pending");
      setShowPaymentModal(false);
      toast.success(course.price > 0 ? "Payment confirmed & request submitted! Waiting for admin approval." : "Enrollment request submitted! Waiting for admin approval.");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit enrollment request");
    } finally {
      setEnrolling(false);
    }
  };

  const handlePaystackSuccess = async (referenceObj: any) => {
    setEnrolling(true);
    try {
      const res = await fetch('/api/paystack/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference: referenceObj.reference,
          schoolSlug,
          courseId,
          uid: user!.uid,
          courseName: course.title,
          studentName: user!.displayName || user!.email || "Student",
          studentEmail: user!.email || "",
        })
      });
      
      const data = await res.json();
      if (data.success) {
        toast.success("Payment successful! You are now enrolled.");
        
        try {
          await fetch("/api/enrollment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: user!.email,
              studentName: user!.displayName || user!.email || "Student",
              courseName: course.title,
              status: "approved",
              schoolSlug,
            }),
          });
        } catch(e) {}
        
        setShowPaymentModal(false);
        setEnrollmentStatus("approved");
      } else {
        toast.error(data.error || "Payment verification failed.");
      }
    } catch (err) {
      toast.error("An error occurred during verification.");
    } finally {
      setEnrolling(false);
    }
  };

  const toggleModuleCompletion = async (moduleIndex: number, isCompleted: boolean) => {
    if (!user || !isEnrolled) return;
    try {
      const newModules = [...(course.modules || [])];
      if (moduleIndex >= 0 && moduleIndex < newModules.length) {
        const mod = newModules[moduleIndex];
        if (!mod.completedBy) mod.completedBy = [];
        if (isCompleted) {
          mod.completedBy = mod.completedBy.filter((id: string) => id !== user.uid);
        } else {
          mod.completedBy.push(user.uid);
        }
      }

      const newSections = course.sections ? JSON.parse(JSON.stringify(course.sections)) : [];
      if (newSections.length > 0) {
        const targetMod = newModules[moduleIndex];
        if (targetMod) {
          newSections.forEach((s: any) => {
            s.modules?.forEach((m: any) => {
              if (m.title === targetMod.title && m.content === targetMod.content) {
                m.completedBy = targetMod.completedBy;
              }
            });
          });
        }
      }

      const ref = doc(db, "schools", schoolSlug, "courses", courseId);
      await updateDoc(ref, {
        modules: newModules,
        sections: newSections.length > 0 ? newSections : undefined
      });

      setCourse({ ...course, modules: newModules, sections: newSections.length > 0 ? newSections : undefined });
      if (!isCompleted) toast.success("Module marked as complete!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update progress");
    }
  };

  const allModules = course.sections ? course.sections.flatMap((s: any) => s.modules || []) : (course.modules || []);
  const completedCount = allModules.filter((m: any) => m.completedBy?.includes(user?.uid)).length || 0;
  const totalModules = allModules.length || 0;

  const allQuizzes = course.sections ? course.sections.filter((s: any) => s.quiz && s.quiz.questions?.length > 0) : [];
  const passedQuizzesCount = allQuizzes.filter((s: any) => s.quiz.passedBy?.some((p: any) => p.uid === user?.uid)).length || 0;
  
  const totalItems = totalModules + allQuizzes.length;
  const completedItems = completedCount + passedQuizzesCount;
  const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  const isFullyCompleted = progressPercent === 100 && totalItems > 0;

  const tabs = [
    { id: "content", label: "Content", show: true },
    { id: "schedule", label: "Schedule", show: true },
    { id: "attendance", label: canManage ? "Attendance" : "My Attendance", show: isEnrolled || canManage },
    { id: "exercises", label: "Exercises", show: true },
    { id: "notes", label: "My Notes", show: isEnrolled && isStudent },
  ].filter((t) => t.show);

  return (
    <div className="flex flex-col flex-1 w-full">
      <DashboardTopbar breadcrumb={`Course Catalog / ${course.title}`} />
      <div className="p-8 max-w-5xl mx-auto w-full">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-3">{course.title}</h1>
            <p className="text-lg text-muted-foreground whitespace-pre-wrap mb-4">{course.description}</p>
            {course.price > 0 && (
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20 font-medium font-mono">
                ₦{course.price.toLocaleString()}
              </div>
            )}
            {(!course.price || course.price === 0) && (
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 font-medium">
                Free Course
              </div>
            )}
          </div>
          <div className="shrink-0 w-full md:w-auto">
            {isEnrolled ? (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-center">
                <div className="text-sm font-medium text-primary mb-1">Status</div>
                {course.courseType === "pdf_only" ? (
                  <div className="text-xl font-bold text-primary mt-2 mb-2">Enrolled & Active</div>
                ) : (
                  <>
                    <div className="text-2xl font-bold">{progressPercent}%</div>
                    <div className="w-full bg-primary/20 h-2 rounded-full mt-2 mb-3 overflow-hidden">
                      <div className="bg-primary h-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
                    </div>
                  </>
                )}
                {isFullyCompleted && isStudent && course.courseType !== "pdf_only" && (
                  <Button
                    size="sm"
                    variant="default"
                    className="w-full gap-2 mt-2 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white shadow-md border-0"
                    onClick={() => {
                      generateCertificate({
                        studentName: user?.displayName || user?.email || "Student",
                        courseName: course.title,
                        completionDate: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
                        schoolName: schoolSlug.replace(/-/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()),
                      });
                    }}
                  >
                    <Award className="w-4 h-4" /> Download Certificate
                  </Button>
                )}
              </div>
            ) : canManage ? (
              <Link href={`/${schoolSlug}/admin/courses/${courseId}/edit`}>
                <Button variant="outline" size="lg">Edit Course</Button>
              </Link>
            ) : enrollmentStatus === "pending" ? (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-center">
                <div className="text-sm font-medium text-yellow-700 dark:text-yellow-400 mb-1">⏳ Pending Approval</div>
                <p className="text-xs text-muted-foreground">Your enrollment request is awaiting admin review.</p>
              </div>
            ) : enrollmentStatus === "declined" ? (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center">
                <div className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">❌ Request Declined</div>
                <p className="text-xs text-muted-foreground">Contact administration for more information.</p>
              </div>
            ) : (
              <Button size="lg" className="w-full md:w-auto" onClick={() => handleEnroll(false)} disabled={enrolling}>
                {enrolling ? "Submitting..." : course.price > 0 ? `Pay ₦${course.price.toLocaleString()} to Enroll` : "Request Enrollment"}
              </Button>
            )}
          </div>
        </div>

        <Tabs defaultValue="content">
          <TabsList className="flex w-full mb-6 overflow-x-auto">
            {tabs.map((t) => (
              <TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="content">
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center">
                  <BookOpen className="mr-2 h-6 w-6 text-primary" /> Curriculum
                </h2>
                {isEnrolled && course.courseType !== "pdf_only" && (
                  <div className="text-sm font-medium text-muted-foreground">
                    {completedCount} / {totalModules} Completed
                  </div>
                )}
              </div>

              {course && (
                <CourseCurriculumList
                  course={course}
                  schoolSlug={schoolSlug}
                  courseId={courseId}
                  user={user}
                  isEnrolled={Boolean(isEnrolled)}
                  onToggleModuleCompletion={toggleModuleCompletion}
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="schedule">
            <CourseSchedule
              schoolSlug={schoolSlug}
              courseId={courseId}
              courseName={course.title}
              enrolledStudents={course.enrolledStudents || []}
              modules={course.modules || []}
            />
          </TabsContent>

          {(isEnrolled || canManage) && (
            <TabsContent value="attendance">
              {canManage ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold">Attendance History</h2>
                    <p className="text-sm text-muted-foreground">{allLogs.length} log{allLogs.length !== 1 ? "s" : ""} total</p>
                  </div>
                  {logsLoading && <p className="text-center animate-pulse">Loading logs...</p>}
                  {!logsLoading && allLogs.length === 0 && (
                    <div className="border border-dashed rounded-lg p-6 text-center text-muted-foreground text-sm">
                      No attendance has been logged yet. Go to the Schedule tab and click "Mark Attendance" on a session.
                    </div>
                  )}
                  {allLogs.map((log) => (
                    <Card key={log.id}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{log.sessionTitle}</CardTitle>
                        <p className="text-xs text-muted-foreground">
                          Logged: {log.loggedAt?.toDate?.().toLocaleString() ?? "N/A"}
                        </p>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm">
                        {log.topicsCovered && <p><strong>Topics:</strong> {log.topicsCovered}</p>}
                        {log.comment && <p><strong>Notes:</strong> {log.comment}</p>}
                        <div className="grid grid-cols-2 gap-1">
                          {log.studentStatuses?.map((s) => (
                            <div key={s.uid} className="flex items-center gap-2 text-xs">
                              <span className={statusColors[s.status] || "text-muted-foreground"}>●</span>
                              <span>{s.displayName}</span>
                              <span className={`capitalize ${statusColors[s.status] || ""}`}>{s.status}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold">My Attendance</h2>
                  {logsLoading && <p className="text-center animate-pulse">Loading...</p>}
                  {!logsLoading && myAttendanceLogs.length === 0 && (
                    <div className="border border-dashed rounded-lg p-6 text-center text-muted-foreground text-sm">
                      No attendance has been recorded for you yet.
                    </div>
                  )}
                  {myAttendanceLogs.map((log) => {
                    const myStatus = log.studentStatuses?.find((s) => s.uid === user?.uid);
                    return (
                      <Card key={log.id}>
                        <CardContent className="p-4 flex items-center justify-between">
                          <div>
                            <p className="font-medium">{log.sessionTitle}</p>
                            <p className="text-xs text-muted-foreground">
                              {log.date?.toDate?.().toLocaleDateString() ?? ""}
                            </p>
                            {log.topicsCovered && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Topics: {log.topicsCovered}
                              </p>
                            )}
                            {log.comment && (
                              <p className="text-xs text-muted-foreground">
                                📋 {log.comment}
                              </p>
                            )}
                          </div>
                          {myStatus && (
                            <span className={`text-sm font-semibold capitalize ${statusColors[myStatus.status] || ""}`}>
                              {myStatus.status}
                            </span>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          )}

          <TabsContent value="exercises">
            <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg">
                <ClipboardList className="h-8 w-8 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-1">Exercises & Assignments</h3>
                <p className="text-muted-foreground text-sm max-w-sm">
                  {canManage
                    ? "Create exercises, manage student groups, and grade performance."
                    : "View your assigned exercises and check your scores."}
                </p>
              </div>
              <Link href={`/${schoolSlug}/courses/${courseId}/exercises`}>
                <Button className="gap-2 bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 text-white border-0 shadow-md">
                  <ClipboardList className="h-4 w-4" />
                  {canManage ? "Manage Exercises" : "View Exercises"}
                </Button>
              </Link>
            </div>
          </TabsContent>

          {isEnrolled && isStudent && (
            <TabsContent value="notes">
              <StudentNotes courseId={courseId} />
            </TabsContent>
          )}
        </Tabs>
      </motion.div>
      </div>

      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-green-600" /> Payment Details
            </DialogTitle>
            <DialogDescription className="text-base pt-2">
              To complete your enrollment for <strong className="text-foreground">{course.title}</strong>, please pay <strong className="text-green-600 dark:text-green-400 font-mono">₦{course.price?.toLocaleString()}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-muted/30 border border-border/50 p-5 rounded-xl space-y-4 my-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Bank Name</span>
              <span className="font-semibold text-right">{bankSettings?.bankName || "Pending Configuration"}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Account Name</span>
              <span className="font-semibold text-right">{bankSettings?.accountName || "-"}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Account Number</span>
              <span className="font-mono font-bold tracking-wider text-lg text-primary bg-primary/10 px-2 py-0.5 rounded text-right">{bankSettings?.accountNumber || "-"}</span>
            </div>
          </div>
          
          <div className="space-y-2 mb-4 text-sm mt-3">
            <label className="font-medium">Upload Payment Receipt (Optional)</label>
            <input 
              type="file" 
              accept="image/*,.pdf" 
              onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} 
              className="w-full text-xs text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer" 
            />
          </div>
          
          <div className="text-xs text-muted-foreground bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 p-3 rounded-lg border border-yellow-500/20 mb-4">
            ⚠️ <strong>Important:</strong> After making the transfer, click the button below. An admin will verify the payment and approve your enrollment.
          </div>

          <DialogFooter className="flex-col sm:flex-col gap-2 relative">
            <Button className="w-full bg-green-600 hover:bg-green-700 text-white shadow-md font-medium h-11" onClick={() => handleEnroll(true)} disabled={enrolling}>
               {enrolling ? "Submitting Request..." : "I have made the transfer"}
            </Button>
            
            {paystackSettings?.enabled && paystackSettings.publicKey && (
              <div className="w-full text-center my-1 pt-1 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2 mt-2 font-medium uppercase tracking-wider">Or Pay Automatically</p>
                <PaystackButton
                  className="w-full inline-flex items-center justify-center rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-[#09A5DB] text-white hover:bg-[#09A5DB]/90 h-11 px-4 py-2"
                  text="Pay with Card (Instant Access)"
                  onSuccess={(reference) => handlePaystackSuccess(reference)}
                  onClose={() => console.log('Payment closed')}
                  reference={`iesm_${new Date().getTime()}_${Math.floor(Math.random() * 1000000)}`}
                  email={user?.email || ""}
                  amount={(course?.price || 0) * 100}
                  publicKey={paystackSettings.publicKey}
                />
              </div>
            )}

            <Button variant="ghost" className="w-full sm:mt-2 text-muted-foreground" onClick={() => setShowPaymentModal(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
