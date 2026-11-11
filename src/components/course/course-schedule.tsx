"use client";

import { useState, useEffect } from "react";
import {
    collection,
    addDoc,
    getDocs,
    query,
    orderBy,
    serverTimestamp,
    Timestamp,
    doc,
    getDoc,
    updateDoc,
    deleteDoc,
    writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
    CalendarDays,
    Clock,
    MapPin,
    Plus,
    RefreshCw,
    X,
    Calendar,
    Video,
    FileText,
    CheckCircle2,
    Award,
    ChevronLeft,
    ChevronRight,
    Mail,
    Trash2,
    Edit2,
    Check,
    VideoOff,
    Info,
    HelpCircle,
    ExternalLink,
    Grid,
    List,
    Lock,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

interface Session {
    id: string;
    title: string;
    description?: string;
    startDateTime: Timestamp;
    endDateTime: Timestamp;
    recurrenceRule?: string;
    locationType?: "online" | "in-person";
    location?: string;
    meetingLink?: string;
    meetingProvider?: string;
    type?: "class" | "session" | "meeting" | "exam" | "quiz";
    quizLinkIndex?: number; // linked section quiz index
    createdBy: string;
}

interface CourseScheduleProps {
    schoolSlug: string;
    courseId: string;
    courseName: string;
    enrolledStudents: string[];
    modules?: { title: string }[];
    sections?: any[];
    enrolledAt?: Date | null;
    courseStudyDuration?: number;
}

const typeConfig = {
    class: { label: "Live Class", color: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20", dotColor: "bg-indigo-500", icon: Video },
    session: { label: "Academic Session", color: "bg-violet-500/10 text-violet-500 border-violet-500/20", dotColor: "bg-violet-500", icon: CalendarDays },
    meeting: { label: "Meeting", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", dotColor: "bg-emerald-500", icon: Clock },
    exam: { label: "Exam", color: "bg-rose-500/10 text-rose-500 border-rose-500/20", dotColor: "bg-rose-500", icon: Award },
    quiz: { label: "Quiz", color: "bg-amber-500/10 text-amber-500 border-amber-500/20", dotColor: "bg-amber-500", icon: HelpCircle },
    milestone: { label: "Unlock Milestone", color: "bg-amber-500/10 text-amber-500 border-amber-500/20", dotColor: "bg-amber-500", icon: Lock },
};

function formatDateTime(ts: Timestamp) {
    const d = ts.toDate();
    return d.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
    });
}

function formatDateKey(date: Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

export default function CourseSchedule({
    schoolSlug,
    courseId,
    courseName,
    enrolledStudents,
    sections = [],
    enrolledAt,
    courseStudyDuration = 6,
}: CourseScheduleProps) {
    const { user, isAdmin, isInstructor } = useAuth();
    const canManage = isAdmin || isInstructor;

    const [sessions, setSessions] = useState<Session[]>([]);
    const [loadingSessions, setLoadingSessions] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingSession, setEditingSession] = useState<Session | null>(null);
    const [saving, setSaving] = useState(false);
    
    // View state: 'list' (Timeline) vs 'calendar'
    const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
    
    // Calendar state
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());

    const referenceDate = enrolledAt || new Date();
    const unlockDate = new Date(referenceDate.getTime() + courseStudyDuration * 7 * 24 * 60 * 60 * 1000);
    const isLocked = enrolledAt ? new Date() < unlockDate : false;
    const isQuizLocked = isLocked && !canManage;
    const mergedSessions = [...sessions];

    // Inject Study Period Begins
    mergedSessions.push({
        id: "milestone-study-start",
        title: "📖 Course Study & Reading Period Begins",
        description: `Start of your active preparation period. Read modules, review documents, and log your study hours. Quizzes and activities will unlock after ${courseStudyDuration} weeks.`,
        startDateTime: Timestamp.fromDate(referenceDate),
        endDateTime: Timestamp.fromDate(new Date(referenceDate.getTime() + 60 * 60 * 1000)),
        type: "session",
        createdBy: "system",
        locationType: "online",
        meetingLink: "",
    } as any);

    // Inject Study Period Ends / Unlock Milestone
    mergedSessions.push({
        id: "milestone-unlock",
        title: "🔓 Reading Ends & Assessments Unlock",
        description: `Your active preparation period is complete. Quizzes, case studies, and final exams are now available to take.`,
        startDateTime: Timestamp.fromDate(unlockDate),
        endDateTime: Timestamp.fromDate(new Date(unlockDate.getTime() + 60 * 60 * 1000)),
        type: "milestone",
        createdBy: "system",
        locationType: "online",
        meetingLink: "",
    } as any);

    // For each quiz, case study, final exam in curriculum sections
    sections.forEach((section: any, sIdx: number) => {
        const sectionPrefix = `Section ${sIdx + 1}: ${section.title}`;
        
        if (section.quiz && section.quiz.questions?.length > 0) {
            mergedSessions.push({
                id: `quiz-milestone-${sIdx}`,
                title: `📝 Quiz: ${section.title}`,
                description: `Online quiz for ${sectionPrefix}. Pass mark: 80% required to progress.`,
                startDateTime: Timestamp.fromDate(unlockDate),
                endDateTime: Timestamp.fromDate(new Date(unlockDate.getTime() + 60 * 60 * 1000)),
                type: "quiz",
                quizLinkIndex: sIdx,
                createdBy: "system",
                locationType: "online",
                meetingLink: "",
            } as any);
        }

        if (section.caseStudy) {
            mergedSessions.push({
                id: `case-study-milestone-${sIdx}`,
                title: `📁 Case Study: ${section.title}`,
                description: `Read the case study scenario and submit your analysis for ${sectionPrefix}.`,
                startDateTime: Timestamp.fromDate(unlockDate),
                endDateTime: Timestamp.fromDate(new Date(unlockDate.getTime() + 60 * 60 * 1000)),
                type: "session",
                createdBy: "system",
                locationType: "online",
                meetingLink: "",
            } as any);
        }

        if (section.finalAssessment) {
            const projectEndDate = new Date(unlockDate.getTime() + 14 * 24 * 60 * 60 * 1000); // 2 weeks duration
            mergedSessions.push({
                id: `final-assessment-milestone-${sIdx}`,
                title: `🏆 Final Exam & Project Period Starts`,
                description: `Complete the final assessment / comprehensive exam for the course.`,
                startDateTime: Timestamp.fromDate(unlockDate),
                endDateTime: Timestamp.fromDate(new Date(unlockDate.getTime() + 60 * 60 * 1000)),
                type: "exam",
                createdBy: "system",
                locationType: "online",
                meetingLink: "",
            } as any);

            mergedSessions.push({
                id: `final-assessment-milestone-end-${sIdx}`,
                title: `🏁 Final Exam & Project Submission Deadline`,
                description: `Deadline to complete and submit all project work and exams.`,
                startDateTime: Timestamp.fromDate(projectEndDate),
                endDateTime: Timestamp.fromDate(new Date(projectEndDate.getTime() + 60 * 60 * 1000)),
                type: "exam",
                createdBy: "system",
                locationType: "online",
                meetingLink: "",
            } as any);
        }
    });

    // Sort chronologically
    mergedSessions.sort((a, b) => a.startDateTime.toDate().getTime() - b.startDateTime.toDate().getTime());

    // form state
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [startDate, setStartDate] = useState("");
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
    const [recurrence, setRecurrence] = useState("none");
    const [locationType, setLocationType] = useState<"online" | "in-person">("online");
    const [meetingProvider, setMeetingProvider] = useState("jitsi");
    const [meetingLink, setMeetingLink] = useState("");
    const [inPersonLocation, setInPersonLocation] = useState("");
    const [type, setType] = useState<"class" | "session" | "meeting" | "exam" | "quiz">("class");
    const [linkedQuizIndex, setLinkedQuizIndex] = useState<string>("none");
    const [sendEmail, setSendEmail] = useState(true);
    const [sendInApp, setSendInApp] = useState(true);

    const sessionsRef = collection(
        db,
        "schools",
        schoolSlug,
        "courses",
        courseId,
        "sessions"
    );

    const loadSessions = async () => {
        try {
            setLoadingSessions(true);
            const q = query(sessionsRef, orderBy("startDateTime", "asc"));
            const snap = await getDocs(q);
            const data = snap.docs.map((d) => {
                const s = d.data();
                // Map legacy data formats to new formats if necessary
                const locType = s.locationType || (s.location && s.location.startsWith("http") ? "online" : "in-person");
                const mLink = s.meetingLink || (locType === "online" ? s.location : undefined);
                const locVal = s.location || (locType === "in-person" ? s.location : undefined);
                
                return {
                    id: d.id,
                    title: s.title,
                    description: s.description || "",
                    startDateTime: s.startDateTime,
                    endDateTime: s.endDateTime,
                    recurrenceRule: s.recurrenceRule || undefined,
                    locationType: locType,
                    location: locVal || undefined,
                    meetingLink: mLink || undefined,
                    meetingProvider: s.meetingProvider || (mLink ? "custom" : undefined),
                    type: s.type || "class",
                    quizLinkIndex: s.quizLinkIndex !== undefined ? s.quizLinkIndex : undefined,
                    createdBy: s.createdBy,
                } as Session;
            });
            setSessions(data);
        } catch (err) {
            console.error("Failed to load sessions:", err);
            toast.error("Failed to load course schedule.");
        } finally {
            setLoadingSessions(false);
        }
    };

    useEffect(() => {
        loadSessions();
    }, [schoolSlug, courseId]);

    // Handle Edit populate
    const startEdit = (s: Session) => {
        setEditingSession(s);
        setTitle(s.title);
        setDescription(s.description || "");
        
        const startDT = s.startDateTime.toDate();
        const endDT = s.endDateTime.toDate();
        
        // Format YYYY-MM-DD
        const year = startDT.getFullYear();
        const month = String(startDT.getMonth() + 1).padStart(2, "0");
        const day = String(startDT.getDate()).padStart(2, "0");
        setStartDate(`${year}-${month}-${day}`);
        
        // Format HH:MM
        setStartTime(startDT.toTimeString().slice(0, 5));
        setEndTime(endDT.toTimeString().slice(0, 5));
        
        setRecurrence(s.recurrenceRule || "none");
        setLocationType(s.locationType || "online");
        setMeetingProvider(s.meetingProvider || "custom");
        setMeetingLink(s.meetingLink || "");
        setInPersonLocation(s.locationType === "in-person" ? s.location || "" : "");
        setType(s.type || "class");
        setLinkedQuizIndex(s.quizLinkIndex !== undefined ? String(s.quizLinkIndex) : "none");
        setSendEmail(false); // Default to false on edit to avoid spamming
        setSendInApp(false);
        
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleCancelForm = () => {
        setShowForm(false);
        setEditingSession(null);
        resetForm();
    };

    const resetForm = () => {
        setTitle("");
        setDescription("");
        setStartDate("");
        setStartTime("");
        setEndTime("");
        setRecurrence("none");
        setLocationType("online");
        setMeetingProvider("jitsi");
        setMeetingLink("");
        setInPersonLocation("");
        setType("class");
        setLinkedQuizIndex("none");
        setSendEmail(true);
        setSendInApp(true);
    };

    // Auto-generate Jitsi link helper
    const getAutoJitsiLink = (sessionTitle: string) => {
        const cleanTitle = sessionTitle.trim().toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
        return `https://meet.jit.si/IESM-LMS-${courseId}-${cleanTitle || "class"}`;
    };

    const handleSave = async () => {
        if (!title || !startDate || !startTime || !endTime) {
            toast.error("Please fill in all required fields.");
            return;
        }
        setSaving(true);
        try {
            const startDT = new Date(`${startDate}T${startTime}`);
            const endDT = new Date(`${startDate}T${endTime}`);
            
            if (endDT <= startDT) {
                toast.error("End time must be after start time.");
                setSaving(false);
                return;
            }

            let finalMeetingLink = meetingLink;
            if (locationType === "online" && meetingProvider === "jitsi" && !meetingLink) {
                finalMeetingLink = getAutoJitsiLink(title);
            }

            const dataToSave = {
                title,
                description: description || null,
                startDateTime: Timestamp.fromDate(startDT),
                endDateTime: Timestamp.fromDate(endDT),
                recurrenceRule: recurrence === "none" ? null : recurrence,
                locationType,
                location: locationType === "in-person" ? (inPersonLocation || null) : null,
                meetingLink: locationType === "online" ? finalMeetingLink : null,
                meetingProvider: locationType === "online" ? meetingProvider : null,
                type,
                quizLinkIndex: (type === "quiz" || type === "exam") && linkedQuizIndex !== "none" ? Number(linkedQuizIndex) : null,
                createdBy: user!.uid,
                updatedAt: serverTimestamp(),
            };

            let savedId = "";

            if (editingSession) {
                // Update
                const docRef = doc(db, "schools", schoolSlug, "courses", courseId, "sessions", editingSession.id);
                await updateDoc(docRef, dataToSave);
                savedId = editingSession.id;
                toast.success("Session updated!");
            } else {
                // Create
                const docRef = await addDoc(sessionsRef, {
                    ...dataToSave,
                    createdAt: serverTimestamp(),
                });
                savedId = docRef.id;
                toast.success("Session scheduled!");
            }

            // --- Notifications ---
            if (!editingSession && enrolledStudents.length > 0) {
                // 1. In-App Notifications
                if (sendInApp) {
                    try {
                        const batch = writeBatch(db);
                        enrolledStudents.forEach((studentId) => {
                            const notifRef = doc(collection(db, "schools", schoolSlug, "users", studentId, "notifications"));
                            batch.set(notifRef, {
                                type: "session",
                                courseId,
                                courseName,
                                message: `A new ${typeConfig[type].label} "${title}" has been scheduled for ${courseName} on ${formatDateTime(Timestamp.fromDate(startDT))}.`,
                                read: false,
                                createdAt: serverTimestamp(),
                            });
                        });
                        await batch.commit();
                    } catch (notifErr) {
                        console.error("Failed to write in-app notifications:", notifErr);
                    }
                }

                // 2. Email Notifications
                if (sendEmail) {
                    try {
                        // Fetch enrolled student emails
                        const recipients: { email: string; name: string }[] = [];
                        for (const uid of enrolledStudents) {
                            const userSnap = await getDoc(doc(db, "schools", schoolSlug, "users", uid));
                            if (userSnap.exists()) {
                                const d = userSnap.data();
                                if (d.email) {
                                    recipients.push({
                                        email: d.email,
                                        name: d.displayName || d.email || uid,
                                    });
                                }
                            }
                        }

                        if (recipients.length > 0) {
                            const locLabel = locationType === "online" 
                                ? `Online (${meetingProvider === "jitsi" ? "Jitsi Meet" : meetingProvider === "zoom" ? "Zoom" : "Video Meeting"})`
                                : inPersonLocation || "In-person Class";

                            await fetch("/api/send-session-email", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    courseName,
                                    sessionTitle: title,
                                    startDateTime: formatDateTime(Timestamp.fromDate(startDT)),
                                    endDateTime: formatDateTime(Timestamp.fromDate(endDT)),
                                    location: locLabel,
                                    recipients,
                                    schoolSlug,
                                }),
                            });
                        }
                    } catch (emailErr) {
                        console.error("Failed to send email notifications:", emailErr);
                    }
                }
            }

            // Reload sessions
            loadSessions();
            setShowForm(false);
            setEditingSession(null);
            resetForm();
        } catch (err: any) {
            toast.error(err.message || "Failed to save session");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this session?")) return;
        try {
            await deleteDoc(doc(db, "schools", schoolSlug, "courses", courseId, "sessions", id));
            toast.success("Session deleted");
            loadSessions();
        } catch (err: any) {
            toast.error(err.message || "Failed to delete session");
        }
    };

    // Calendar logic helpers
    const daysInMonthList = () => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDayOfWeek = firstDay.getDay(); // 0 = Sunday
        const totalDays = lastDay.getDate();
        
        const days = [];
        
        // Previous month padding
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = startDayOfWeek - 1; i >= 0; i--) {
            days.push({
                date: new Date(year, month - 1, prevMonthLastDay - i),
                isCurrentMonth: false,
            });
        }
        
        // Current month days
        for (let i = 1; i <= totalDays; i++) {
            days.push({
                date: new Date(year, month, i),
                isCurrentMonth: true,
            });
        }
        
        // Next month padding
        const remaining = 42 - days.length;
        for (let i = 1; i <= remaining; i++) {
            days.push({
                date: new Date(year, month + 1, i),
                isCurrentMonth: false,
            });
        }
        
        return days;
    };

    const changeMonth = (offset: number) => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1));
    };

    // Filter sessions for selected date in Calendar view
    const selectedDateSessions = mergedSessions.filter((s) => {
        const key1 = formatDateKey(s.startDateTime.toDate());
        const key2 = formatDateKey(selectedDate);
        return key1 === key2;
    });

    // Calendar generation links
    const getGoogleCalendarLink = (session: Session) => {
        try {
            const start = session.startDateTime.toDate().toISOString().replace(/-|:|\.\d\d\d/g, "").slice(0, 15) + "Z";
            const end = session.endDateTime.toDate().toISOString().replace(/-|:|\.\d\d\d/g, "").slice(0, 15) + "Z";
            const text = encodeURIComponent(session.title);
            const details = encodeURIComponent(session.description || `${session.title} for course ${courseName}`);
            const location = encodeURIComponent(
                session.locationType === "online" 
                    ? session.meetingLink || "Online Meeting" 
                    : session.location || "In-person Location"
            );
            return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${start}/${end}&details=${details}&location=${location}`;
        } catch {
            return "#";
        }
    };

    const getIcsDownloadLink = (session: Session) => {
        try {
            const start = session.startDateTime.toDate().toISOString().replace(/-|:|\.\d\d\d/g, "").slice(0, 15) + "Z";
            const end = session.endDateTime.toDate().toISOString().replace(/-|:|\.\d\d\d/g, "").slice(0, 15) + "Z";
            const icsContent = [
                "BEGIN:VCALENDAR",
                "VERSION:2.0",
                "PRODID:-//Devtonic//IESM LMS//EN",
                "BEGIN:VEVENT",
                `UID:${session.id}@iesm-lms`,
                `DTSTAMP:${new Date().toISOString().replace(/-|:|\.\d\d\d/g, "").slice(0, 15) + "Z"}`,
                `DTSTART:${start}`,
                `DTEND:${end}`,
                `SUMMARY:${session.title}`,
                `DESCRIPTION:${session.description || ""}`,
                `LOCATION:${session.locationType === "online" ? session.meetingLink || "Online Meeting" : session.location || ""}`,
                "END:VEVENT",
                "END:VCALENDAR"
            ].join("\r\n");
            return `data:text/calendar;charset=utf-8,${encodeURIComponent(icsContent)}`;
        } catch {
            return "#";
        }
    };

    // Calculate current live sessions
    const getLiveStatus = (s: Session) => {
        const now = new Date();
        const start = s.startDateTime.toDate();
        const end = s.endDateTime.toDate();
        if (now >= start && now <= end) return "LIVE";
        if (now < start) return "UPCOMING";
        return "PAST";
    };

    // Available quizzes in curriculum to link
    const quizOptions = sections
        .map((sec, idx) => {
            if (sec.type === "quiz" || sec.quiz) {
                return { index: idx, title: `Section ${idx + 1}: ${sec.title} (Quiz)` };
            }
            if (sec.type === "final_assessment" || sec.finalAssessment) {
                return { index: idx, title: `Section ${idx + 1}: ${sec.title} (Assessment)` };
            }
            return null;
        })
        .filter(Boolean);

    return (
        <div className="space-y-6">
            {/* Header Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                        <CalendarDays className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-foreground">Course Schedule</h2>
                        <p className="text-xs text-muted-foreground">Academic sessions, live classes, exams & quizzes</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                    {/* View Switcher */}
                    <div className="bg-muted p-1 rounded-lg flex items-center gap-1 text-xs">
                        <button
                            onClick={() => setViewMode("list")}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-medium transition-colors ${
                                viewMode === "list"
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            <List className="h-3.5 w-3.5" />
                            Timeline
                        </button>
                        <button
                            onClick={() => setViewMode("calendar")}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-medium transition-colors ${
                                viewMode === "calendar"
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            <Grid className="h-3.5 w-3.5" />
                            Calendar
                        </button>
                    </div>

                    {canManage && (
                        <Button
                            size="sm"
                            onClick={() => {
                                if (showForm) handleCancelForm();
                                else setShowForm(true);
                            }}
                            variant={showForm ? "outline" : "default"}
                            className="shadow-sm font-semibold"
                        >
                            {showForm ? (
                                <>
                                    <X className="h-4 w-4 mr-1.5" />
                                    Cancel
                                </>
                            ) : (
                                <>
                                    <Plus className="h-4 w-4 mr-1.5" />
                                    Schedule Event
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </div>

            {/* Lock Banner Alert */}
            {unlockDate && new Date() < unlockDate && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <Card className="border-amber-500/20 bg-amber-500/5/10">
                        <CardContent className="p-4 flex items-start gap-3">
                            <Info className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                            <div className="text-sm">
                                <p className="font-bold text-foreground flex items-center gap-1.5">
                                    Assessment Preparation Period Lock Active 🔒
                                </p>
                                <p className="text-muted-foreground text-xs mt-0.5 leading-relaxed">
                                    Quizzes, case studies, timesheets, and final exams are locked during this preparation time span. They will become available on <strong>{unlockDate?.toLocaleDateString(undefined, { dateStyle: 'long' })}</strong>.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            )}

            {/* Create / Edit Form */}
            <AnimatePresence>
                {showForm && (
                    <motion.div
                        initial={{ opacity: 0, y: -15, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: "auto" }}
                        exit={{ opacity: 0, y: -15, height: 0 }}
                        className="overflow-hidden"
                    >
                        <Card className="border-primary/20 bg-primary/5/10 shadow-lg backdrop-blur-md">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-primary" />
                                    {editingSession ? "Edit Scheduled Event" : "Schedule New Academic Event"}
                                </CardTitle>
                                <CardDescription>
                                    Set up classes, sessions, meetings, or quizzes and notify students.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="title">Event Title <span className="text-destructive">*</span></Label>
                                        <Input
                                            id="title"
                                            placeholder="e.g. Lecture 1: Safety Auditing Basics"
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="type">Event Category</Label>
                                        <Select value={type} onValueChange={(val: any) => setType(val)}>
                                            <SelectTrigger id="type"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="class">🎓 Live Class / Lecture</SelectItem>
                                                <SelectItem value="session">📅 Academic Session</SelectItem>
                                                <SelectItem value="meeting">🤝 Meeting / Office Hours</SelectItem>
                                                <SelectItem value="exam">🏆 Final Exam</SelectItem>
                                                <SelectItem value="quiz">📝 Section Quiz</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="description">Description / Notes (Optional)</Label>
                                    <Textarea
                                        id="description"
                                        placeholder="Add important preparation notes, syllabus details, or materials to bring..."
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        rows={2}
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="space-y-1.5">
                                        <Label>Date <span className="text-destructive">*</span></Label>
                                        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Start Time <span className="text-destructive">*</span></Label>
                                        <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>End Time <span className="text-destructive">*</span></Label>
                                        <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label>Recurrence</Label>
                                        <Select value={recurrence} onValueChange={(val: string | null) => setRecurrence(val ?? "none")}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">One-time Event</SelectItem>
                                                <SelectItem value="weekly">Every Week</SelectItem>
                                                <SelectItem value="biweekly">Every 2 Weeks</SelectItem>
                                                <SelectItem value="monthly">Every Month</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {(type === "quiz" || type === "exam") && quizOptions.length > 0 && (
                                        <div className="space-y-1.5 animate-fadeIn">
                                            <Label>Link to Quiz in Curriculum (Optional)</Label>
                                            <Select value={linkedQuizIndex} onValueChange={(val: string | null) => setLinkedQuizIndex(val ?? "none")}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">Do not link quiz</SelectItem>
                                                    {quizOptions.map((opt: any) => (
                                                        <SelectItem key={opt.index} value={String(opt.index)}>
                                                            {opt.title}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                </div>

                                {/* Mode and Location Settings */}
                                <div className="pt-2 border-t border-border/40 space-y-4">
                                    <div className="flex items-center gap-6">
                                        <Label className="text-sm font-semibold">Location Type:</Label>
                                        <div className="flex items-center gap-4">
                                            <label className="flex items-center gap-2 cursor-pointer text-sm">
                                                <input
                                                    type="radio"
                                                    name="locationType"
                                                    checked={locationType === "online"}
                                                    onChange={() => setLocationType("online")}
                                                    className="accent-primary"
                                                />
                                                💻 Virtual / Online
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer text-sm">
                                                <input
                                                    type="radio"
                                                    name="locationType"
                                                    checked={locationType === "in-person"}
                                                    onChange={() => setLocationType("in-person")}
                                                    className="accent-primary"
                                                />
                                                🏢 In-person / Offline
                                            </label>
                                        </div>
                                    </div>

                                    {locationType === "online" ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fadeIn">
                                            <div className="space-y-1.5">
                                                <Label htmlFor="provider">Meeting Provider</Label>
                                                <Select value={meetingProvider} onValueChange={(val: string | null) => setMeetingProvider(val ?? "jitsi")}>
                                                    <SelectTrigger id="provider"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="jitsi">🚀 Jitsi Meet (Free & Auto-generated)</SelectItem>
                                                        <SelectItem value="google_meet">🟢 Google Meet</SelectItem>
                                                        <SelectItem value="zoom">🔵 Zoom</SelectItem>
                                                        <SelectItem value="teams">🟣 Microsoft Teams</SelectItem>
                                                        <SelectItem value="custom">🔗 Custom Link</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label htmlFor="meetingLink">
                                                    Meeting URL {meetingProvider === "jitsi" && <span className="text-muted-foreground text-xs">(optional - auto-generates if empty)</span>}
                                                </Label>
                                                <Input
                                                    id="meetingLink"
                                                    placeholder={meetingProvider === "jitsi" ? "Auto-generates room..." : "https://zoom.us/j/... or google meet URL"}
                                                    value={meetingLink}
                                                    onChange={(e) => setMeetingLink(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-1.5 animate-fadeIn">
                                            <Label htmlFor="location">Physical Location / Room</Label>
                                            <Input
                                                id="location"
                                                placeholder="e.g. Main Hall, Block C Room 202"
                                                value={inPersonLocation}
                                                onChange={(e) => setInPersonLocation(e.target.value)}
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Notifications Options (Only on creation) */}
                                {!editingSession && enrolledStudents.length > 0 && (
                                    <div className="pt-2 border-t border-border/40 flex flex-wrap gap-6">
                                        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={sendInApp}
                                                onChange={(e) => setSendInApp(e.target.checked)}
                                                className="rounded accent-primary h-4 w-4"
                                            />
                                            🔔 Send in-app notification to students
                                        </label>
                                        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={sendEmail}
                                                onChange={(e) => setSendEmail(e.target.checked)}
                                                className="rounded accent-primary h-4 w-4"
                                            />
                                            ✉️ Send email invitation to students
                                        </label>
                                    </div>
                                )}

                                <div className="flex gap-2 pt-2">
                                    <Button onClick={handleSave} disabled={saving} className="flex-1">
                                        {saving ? "Saving..." : editingSession ? "Update Event" : "Schedule Event"}
                                    </Button>
                                    {editingSession && (
                                        <Button variant="outline" onClick={handleCancelForm}>
                                            Cancel
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Loading state */}
            {loadingSessions && (
                <div className="text-center py-12 text-muted-foreground animate-pulse flex flex-col items-center justify-center gap-2">
                    <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                    <span>Loading schedule...</span>
                </div>
            )}

            {/* List / Timeline View */}
            {!loadingSessions && viewMode === "list" && (
                <div className="space-y-6">
                    {mergedSessions.length === 0 ? (
                        <div className="border-2 border-dashed border-muted rounded-2xl p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
                            <Calendar className="h-10 w-10 text-muted-foreground/45" />
                            <h3 className="font-semibold text-base text-foreground">No events scheduled</h3>
                            <p className="text-sm max-w-sm">There are no academic sessions, classes, exams or meetings scheduled for this course yet.</p>
                            {canManage && (
                                <Button size="sm" onClick={() => setShowForm(true)} className="mt-2">
                                    Schedule First Event
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="relative pl-6 sm:pl-8 border-l border-border/70 space-y-6">
                            {mergedSessions.map((s) => {
                                const liveStatus = getLiveStatus(s);
                                const Config = typeConfig[s.type || "class"];
                                const Icon = Config.icon;
                                
                                return (
                                    <motion.div
                                        key={s.id}
                                        initial={{ opacity: 0, x: -15 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="relative"
                                    >
                                        {/* Timeline Node Icon */}
                                        <div className={`absolute -left-[38px] sm:-left-[46px] top-1.5 w-6 h-6 sm:w-8 sm:h-8 rounded-full border bg-background flex items-center justify-center shadow-sm text-foreground transition-all duration-300 ${Config.dotColor} bg-opacity-10 border-foreground/15`}>
                                            <Icon className="h-3 w-3 sm:h-4 sm:w-4 text-foreground" />
                                        </div>

                                        <Card className={`border hover:shadow-md transition-all duration-300 ${
                                            liveStatus === "LIVE" 
                                                ? "border-primary/50 bg-primary/5/10 ring-1 ring-primary/20 shadow-primary/5" 
                                                : "border-border/60 hover:border-border"
                                        }`}>
                                            <CardContent className="p-5">
                                                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                                    <div className="space-y-2 flex-1 min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            {/* Type Tag */}
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${Config.color}`}>
                                                                {Config.label}
                                                            </span>

                                                            {/* Live Badge */}
                                                            {liveStatus === "LIVE" && (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500 text-white animate-pulse">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-white block animate-ping" />
                                                                    LIVE NOW
                                                                </span>
                                                            )}
                                                            {liveStatus === "PAST" && (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground border border-transparent">
                                                                    PAST
                                                                </span>
                                                            )}
                                                            {liveStatus === "UPCOMING" && (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-500 border border-blue-500/15">
                                                                    UPCOMING
                                                                </span>
                                                            )}

                                                            {/* Mode Tag */}
                                                            {s.locationType === "online" ? (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                                                                    <Video className="h-3 w-3" /> Virtual
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                                                                    <MapPin className="h-3 w-3" /> In-person
                                                                </span>
                                                            )}
                                                        </div>

                                                        <h3 className="text-lg font-bold tracking-tight text-foreground truncate">{s.title}</h3>
                                                        
                                                        {s.description && (
                                                            <p className="text-sm text-muted-foreground line-clamp-2">{s.description}</p>
                                                        )}

                                                        <div className="flex flex-wrap gap-4 pt-1 text-sm text-muted-foreground">
                                                            <span className="flex items-center gap-1.5">
                                                                <Clock className="h-4 w-4 text-primary" />
                                                                {formatDateTime(s.startDateTime)} – {s.endDateTime.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                            </span>
                                                            {s.locationType === "in-person" && s.location && (
                                                                <span className="flex items-center gap-1.5">
                                                                    <MapPin className="h-4 w-4 text-primary" />
                                                                    {s.location}
                                                                </span>
                                                            )}
                                                            {s.recurrenceRule && s.recurrenceRule !== "none" && (
                                                                <span className="flex items-center gap-1.5">
                                                                    <RefreshCw className="h-4 w-4 text-primary" />
                                                                    Repeats {s.recurrenceRule}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Actions Row */}
                                                    <div className="flex flex-wrap items-center gap-2 shrink-0 self-end md:self-start">
                                                        {/* Link to Quiz if attached */}
                                                        {s.quizLinkIndex !== undefined && (
                                                            isQuizLocked ? (
                                                                <Button size="sm" variant="outline" disabled className="gap-1.5 font-semibold text-muted-foreground cursor-not-allowed">
                                                                    <Lock className="h-4 w-4" />
                                                                    Locked
                                                                </Button>
                                                            ) : (
                                                                <Link href={`/${schoolSlug}/courses/${courseId}/quiz/${s.quizLinkIndex}`}>
                                                                    <Button size="sm" variant="outline" className="gap-1.5 font-semibold">
                                                                        <FileText className="h-4 w-4 text-primary" />
                                                                        Take quiz
                                                                    </Button>
                                                                </Link>
                                                            )
                                                        )}

                                                        {/* Virtual Meeting Link */}
                                                        {s.locationType === "online" && s.meetingLink && (
                                                            <a href={s.meetingLink} target="_blank" rel="noopener noreferrer">
                                                                <Button size="sm" className="gap-1.5 font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
                                                                    <Video className="h-4 w-4 animate-pulse" />
                                                                    Join Meeting
                                                                    <ExternalLink className="h-3 w-3 opacity-60" />
                                                                </Button>
                                                            </a>
                                                        )}

                                                        {/* Add to Calendar Dropdown / Export */}
                                                        <div className="relative group/cal">
                                                            <Button size="sm" variant="outline" className="gap-1 font-semibold">
                                                                <Calendar className="h-4 w-4 text-primary" />
                                                                Add to Calendar
                                                            </Button>
                                                            <div className="absolute right-0 top-full mt-1.5 bg-background border border-border rounded-xl shadow-lg py-1.5 w-44 z-10 hidden group-hover/cal:block animate-fadeIn">
                                                                <a
                                                                    href={getGoogleCalendarLink(s)}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted text-sm text-foreground transition-colors"
                                                                >
                                                                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                                                                    Google Calendar
                                                                </a>
                                                                <a
                                                                    href={getIcsDownloadLink(s)}
                                                                    download={`${s.title.toLowerCase().replace(/\s+/g, "_")}.ics`}
                                                                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted text-sm text-foreground transition-colors"
                                                                >
                                                                    <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                                                                    Outlook / iCal (.ics)
                                                                </a>
                                                            </div>
                                                        </div>

                                                        {/* Instructor / Admin specific controls */}
                                                        {canManage && (
                                                            <div className="flex items-center gap-1 border-l border-border pl-2 ml-1">
                                                                <Link href={`/${schoolSlug}/courses/${courseId}/attendance?sessionId=${s.id}&sessionTitle=${encodeURIComponent(s.title)}`}>
                                                                    <Button size="sm" variant="ghost" className="h-8 px-2 font-medium" title="Mark Attendance">
                                                                        Mark Roll
                                                                    </Button>
                                                                </Link>
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="h-8 w-8 hover:text-primary transition-colors"
                                                                    onClick={() => startEdit(s)}
                                                                    title="Edit Event"
                                                                >
                                                                    <Edit2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="h-8 w-8 text-destructive hover:bg-destructive/10 transition-colors"
                                                                    onClick={() => handleDelete(s.id)}
                                                                    title="Delete Event"
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Calendar Grid View */}
            {!loadingSessions && viewMode === "calendar" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Calendar Month Card */}
                    <Card className="lg:col-span-2 shadow-md">
                        <CardHeader className="pb-4 border-b border-border/50">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base font-bold flex items-center gap-2">
                                    <Calendar className="h-5 w-5 text-primary" />
                                    Calendar Month
                                </CardTitle>
                                <div className="flex items-center gap-2">
                                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => changeMonth(-1)}>
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <span className="text-sm font-semibold min-w-[120px] text-center capitalize">
                                        {currentMonth.toLocaleString(undefined, { month: "long", year: "numeric" })}
                                    </span>
                                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => changeMonth(1)}>
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 sm:p-6">
                            {/* Days of Week Headers */}
                            <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs text-muted-foreground pb-2 uppercase tracking-wider">
                                <div>Sun</div>
                                <div>Mon</div>
                                <div>Tue</div>
                                <div>Wed</div>
                                <div>Thu</div>
                                <div>Fri</div>
                                <div>Sat</div>
                            </div>

                            {/* Calendar Days Grid */}
                            <div className="grid grid-cols-7 gap-1.5">
                                    {daysInMonthList().map(({ date, isCurrentMonth }, idx) => {
                                        const dateKey = formatDateKey(date);
                                        const hasEvent = mergedSessions.some((s) => formatDateKey(s.startDateTime.toDate()) === dateKey);
                                        const isSelected = formatDateKey(selectedDate) === dateKey;
                                        const isToday = formatDateKey(new Date()) === dateKey;
                                        
                                        // Get events on this specific date to show dot indicators
                                        const dayEvents = mergedSessions.filter((s) => formatDateKey(s.startDateTime.toDate()) === dateKey);

                                    return (
                                        <button
                                            key={idx}
                                            onClick={() => setSelectedDate(date)}
                                            className={`relative min-h-[50px] sm:min-h-[70px] p-1.5 border rounded-xl flex flex-col items-start justify-between transition-all duration-200 select-none group text-left ${
                                                isCurrentMonth 
                                                    ? "bg-background text-foreground border-border/40 hover:bg-muted/30" 
                                                    : "bg-muted/10 text-muted-foreground border-transparent opacity-40 hover:bg-muted/10"
                                            } ${isSelected ? "ring-2 ring-primary border-primary bg-primary/5" : ""} ${
                                                isToday && !isSelected ? "border-primary/45 font-bold" : ""
                                            }`}
                                        >
                                            {/* Day Number */}
                                            <span className={`text-xs p-1 rounded-md flex items-center justify-center font-medium ${
                                                isToday ? "bg-primary text-primary-foreground font-semibold rounded-full w-5 h-5" : ""
                                            }`}>
                                                {date.getDate()}
                                            </span>

                                            {/* Event Dots */}
                                            <div className="flex flex-wrap gap-1 mt-1 w-full max-w-full overflow-hidden">
                                                {dayEvents.slice(0, 3).map((ev) => {
                                                    const Config = typeConfig[ev.type || "class"];
                                                    return (
                                                        <span
                                                            key={ev.id}
                                                            className={`w-1.5 h-1.5 rounded-full ${Config.dotColor}`}
                                                            title={ev.title}
                                                        />
                                                    );
                                                })}
                                                {dayEvents.length > 3 && (
                                                    <span className="text-[9px] text-muted-foreground leading-none font-bold">
                                                        +{dayEvents.length - 3}
                                                    </span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Day Events Sidebar */}
                    <div className="space-y-4">
                        <Card className="shadow-md h-full flex flex-col">
                            <CardHeader className="pb-3 border-b border-border/50 bg-muted/10">
                                <CardTitle className="text-base font-bold flex items-center gap-1.5 text-primary">
                                    <Clock className="h-4.5 w-4.5" />
                                    Schedule Details
                                </CardTitle>
                                <CardDescription className="text-xs">
                                    Events on {selectedDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-4 flex-1 overflow-y-auto space-y-3 min-h-[300px]">
                                {selectedDateSessions.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground flex flex-col items-center justify-center gap-2 h-full justify-items-center">
                                        <Calendar className="h-8 w-8 opacity-20" />
                                        <p className="text-xs">No scheduled activities for this date.</p>
                                        {canManage && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="text-xs mt-2"
                                                onClick={() => {
                                                    // Set form date to selected calendar date
                                                    const y = selectedDate.getFullYear();
                                                    const m = String(selectedDate.getMonth() + 1).padStart(2, "0");
                                                    const d = String(selectedDate.getDate()).padStart(2, "0");
                                                    setStartDate(`${y}-${m}-${d}`);
                                                    setShowForm(true);
                                                }}
                                            >
                                                Add Event Here
                                            </Button>
                                        )}
                                    </div>
                                ) : (
                                    selectedDateSessions.map((s) => {
                                        const Config = typeConfig[s.type || "class"];
                                        const Icon = Config.icon;
                                        
                                        return (
                                            <div
                                                key={s.id}
                                                className="p-3.5 border border-border/60 rounded-xl bg-muted/15 space-y-2 hover:shadow-sm transition-shadow duration-200"
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${Config.color}`}>
                                                        <Icon className="h-2.5 w-2.5" /> {Config.label}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                        <Clock className="h-3 w-3" />
                                                        {s.startDateTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>

                                                <h4 className="font-bold text-sm text-foreground leading-snug">{s.title}</h4>
                                                
                                                {s.description && (
                                                    <p className="text-xs text-muted-foreground line-clamp-2">{s.description}</p>
                                                )}

                                                {/* Meta Info */}
                                                <div className="text-[11px] text-muted-foreground flex flex-wrap gap-2 pt-1 border-t border-border/30">
                                                    {s.locationType === "online" ? (
                                                        <span className="flex items-center gap-1 text-primary">
                                                            💻 Virtual Class
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1 text-primary">
                                                            🏢 Room: {s.location || "N/A"}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Action Buttons */}
                                                <div className="flex flex-wrap gap-2 pt-1">
                                                    {s.locationType === "online" && s.meetingLink && (
                                                        <a href={s.meetingLink} target="_blank" rel="noopener noreferrer" className="flex-1">
                                                            <Button size="xs" className="w-full text-[10px] font-semibold h-7 bg-primary text-primary-foreground">
                                                                Join Class
                                                            </Button>
                                                        </a>
                                                    )}
                                                    {s.quizLinkIndex !== undefined && (
                                                        isQuizLocked ? (
                                                            <Button size="xs" variant="outline" disabled className="w-full text-[10px] font-semibold h-7 text-muted-foreground cursor-not-allowed gap-1">
                                                                <Lock className="h-3 w-3" /> Locked
                                                            </Button>
                                                        ) : (
                                                            <Link href={`/${schoolSlug}/courses/${courseId}/quiz/${s.quizLinkIndex}`} className="flex-1">
                                                                <Button size="xs" variant="outline" className="w-full text-[10px] font-semibold h-7">
                                                                    Take Quiz
                                                                </Button>
                                                            </Link>
                                                        )
                                                    )}
                                                </div>

                                                {/* Manage Row */}
                                                {canManage && (
                                                    <div className="flex justify-end gap-1.5 pt-1.5 border-t border-border/20">
                                                        <Button
                                                            size="xs"
                                                            variant="ghost"
                                                            className="h-6 text-[10px] text-muted-foreground hover:text-primary"
                                                            onClick={() => startEdit(s)}
                                                        >
                                                            Edit
                                                        </Button>
                                                        <Button
                                                            size="xs"
                                                            variant="ghost"
                                                            className="h-6 text-[10px] text-destructive hover:bg-destructive/10"
                                                            onClick={() => handleDelete(s.id)}
                                                        >
                                                            Delete
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
}
