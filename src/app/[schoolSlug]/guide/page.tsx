"use client";

import { use, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useRouter } from "next/navigation";
import { DashboardTopbar } from "@/components/dashboard-topbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Award,
  CheckCircle2,
  Clock,
  ClipboardList,
  HelpCircle,
  Calendar,
  Shield,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  UserCheck,
  FileText,
  Bookmark,
  Activity,
  Info,
  Users,
  CheckSquare,
  Settings,
  Mail,
  PlusCircle,
  Eye,
  Lock,
  MessageSquare,
  Layers,
  FileSpreadsheet
} from "lucide-react";
import Link from "next/link";

interface FAQItem {
  question: string;
  answer: string;
}

const studentFaqs: FAQItem[] = [
  {
    question: "How do I register for a course?",
    answer: "Go to the Course Catalog tab, select the course you're interested in, and click 'Request Enrollment'. If it's a paid course, you will be prompted to pay via Paystack or submit a bank transfer receipt. An admin will review and approve your request within 24 hours."
  },
  {
    question: "Can I register for courses in any session?",
    answer: "No, courses are grouped into Academic Sessions (First, Second, Third). You are assigned to a session (starting at the First Academic Session) and can only register for courses within your current active session."
  },
  {
    question: "What happens if I fail a quiz?",
    answer: "Quizzes require an 80% score to pass. If you fail, you can immediately review the course materials and retake the quiz. There is no limit on quiz retakes."
  },
  {
    question: "How do I log my timesheet study hours?",
    answer: "Your learning timesheet is tracked automatically as you actively view modules, watch videos, read lecture notes, and participate in scheduled live sessions. You must log at least 30 study hours per course before you can sit for the final exam."
  },
  {
    question: "What is the Time Paper in the Final Assessment?",
    answer: "The Time Paper is a PowerPoint presentation summarizing your core research on the course topic. You must upload your slides in the Final Assessment section. Once submitted, it is reviewed by the administrative board."
  },
  {
    question: "When do quizzes and exams become available?",
    answer: "Quizzes, case studies, and final exams are locked for a minimum of 2 weeks (14 days) following your initial course enrollment to ensure adequate study time. Once this duration passes, they unlock automatically provided you have marked all standard modules complete and logged at least 30 study hours on your timesheet."
  },
  {
    question: "How long does it take to get my final certificate?",
    answer: "After completing all requirements (modules, quizzes, case studies, and final project), the admins will review your work within 3 to 5 business days. Once approved, your certificate will be generated and made available for download in the 'Completed Courses' section."
  }
];

const instructorFaqs: FAQItem[] = [
  {
    question: "How do I access student work for grading?",
    answer: "Navigate to the 'Manage Tasks' page from the sidebar. You will find a list of pending tasks and uploads assigned to you or related to your courses. Select a student's submission to view their files, assign a grade (out of 100), and write constructive feedback."
  },
  {
    question: "How do I log attendance for live Zoom or WhatsApp sessions?",
    answer: "Open your active course details page and click on the 'Attendance' tab. Select the lecture session, and mark students as Present, Absent, Late, or Excused. Click save to record their participation."
  },
  {
    question: "Can I add modules, quizzes, or assignments to my courses?",
    answer: "Yes, you can edit courses assigned to you. Go to 'Manage Courses', select a course, and click 'Edit'. You will be able to add or modify modules (lecture text, video links, attachments), configure multiple-choice quizzes, and set up case study upload zones."
  },
  {
    question: "What is the target timeline for grading submissions?",
    answer: "Under IESM policies, instructors are expected to review, grade, and provide written feedback on all case studies, final projects, and Time Papers within 3 to 5 business days of student upload."
  }
];

const adminFaqs: FAQItem[] = [
  {
    question: "How do I verify bank transfer enrollment requests?",
    answer: "Go to the 'Enrollment Requests' page in the sidebar (indicated by a badge count). Review the student details, payment amount, and click the uploaded receipt link to verify. After confirming the transfer in the institute's account, click 'Approve'. This instantly grants access and triggers an automated welcome message."
  },
  {
    question: "How do I create a new course and assign it?",
    answer: "Go to the dashboard or 'Manage Courses' page and click 'Add Course'. Enter the title, description, price, and target Academic Session (First, Second, or Third). Select the designated instructor from the dropdown and click 'Save'. You can then edit the course to add modules."
  },
  {
    question: "How do I promote a student to the next academic session?",
    answer: "The platform promotes students automatically once they complete all courses in their current session. If you need to perform a manual override, navigate to 'Manage Users', select 'Edit User', select the new session or role, and click 'Update'."
  },
  {
    question: "Can I manage logins and trigger password resets?",
    answer: "Yes. If a user is locked out, find them in 'Manage Users', click 'Edit User', and click 'Send Password Reset Email'. They will receive a secure password reset link in their email inbox."
  }
];

export default function UserGuidePage({ params }: { params: Promise<{ schoolSlug: string }> }) {
  const { schoolSlug } = use(params);
  const { user, loading, isAdmin, isInstructor } = useAuth();
  const router = useRouter();

  const [activeRole, setActiveRole] = useState<"student" | "instructor" | "admin">("student");
  const [activeStudentTab, setActiveStudentTab] = useState<"journey" | "checklist" | "exams" | "timesheets">("journey");
  const [activeInstructorTab, setActiveInstructorTab] = useState<"overview" | "grading" | "attendance" | "tasks">("overview");
  const [activeAdminTab, setActiveAdminTab] = useState<"analytics" | "enrollments" | "editor" | "users">("analytics");
  
  const [openFAQIndex, setOpenFAQIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push(`/${schoolSlug}/auth/login`);
    }
  }, [user, loading, router, schoolSlug]);

  useEffect(() => {
    if (isAdmin) {
      setActiveRole("admin");
    } else if (isInstructor) {
      setActiveRole("instructor");
    } else {
      setActiveRole("student");
    }
  }, [isAdmin, isInstructor]);

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-background">Loading guide...</div>;
  }

  const currentFaqs = 
    activeRole === "admin" 
      ? adminFaqs 
      : activeRole === "instructor" 
      ? instructorFaqs 
      : studentFaqs;

  const toggleFAQ = (index: number) => {
    setOpenFAQIndex(openFAQIndex === index ? null : index);
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        staggerChildren: 0.1,
        duration: 0.4
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="flex flex-col flex-1 w-full bg-muted/10 min-h-full">
      <DashboardTopbar breadcrumb="User Guide / How it Works" />
      
      <div className="p-4 sm:p-8 max-w-6xl mx-auto w-full space-y-8 pb-16">
        
        {/* Brand Hero Panel */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0A4A6B] to-[#003087] text-white p-6 sm:p-10 shadow-xl border border-primary/20">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#F4C400]/10 rounded-full mix-blend-screen filter blur-3xl opacity-60 translate-x-12 -translate-y-12" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#C8102E]/5 rounded-full mix-blend-screen filter blur-3xl opacity-40 -translate-x-20 translate-y-20" />
          
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[#F4C400] text-xs font-bold uppercase tracking-wider">
              <Shield className="h-3.5 w-3.5" /> Welcome to IESM LMS
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Shaping Healthier, Safer, and Smarter Workplaces
            </h2>
            <p className="text-sm sm:text-base text-gray-200 leading-relaxed">
              At the **Institute of Ergonomics and Safety Management (IESM)**, we combine academic rigor with practical safety protocols. This role manual helps you understand your capabilities, platform workflows, and core rules.
            </p>
            <div className="pt-2 flex flex-wrap gap-4 text-xs font-semibold text-gray-300">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-[#F4C400]" /> Motto: Knowledge & Safety</span>
              <span className="flex items-center gap-1.5"><Activity className="h-4 w-4 text-[#F4C400]" /> Professional Training & Certification</span>
            </div>
          </div>
        </div>

        {/* Role Selector Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-background border rounded-2xl shadow-sm">
          <div className="space-y-0.5">
            <h4 className="font-bold text-sm text-foreground">Select Role Guide</h4>
            <p className="text-xs text-muted-foreground">Select a role to review actions and permissions on the platform.</p>
          </div>
          <div className="flex bg-muted/60 p-1.5 rounded-xl border w-full sm:w-auto">
            {[
              { id: "student", label: "Student Guide", icon: GraduationCap },
              { id: "instructor", label: "Instructor Guide", icon: BookOpen },
              { id: "admin", label: "Admin Guide", icon: Settings },
            ].map((role) => (
              <button
                key={role.id}
                onClick={() => {
                  setActiveRole(role.id as any);
                  setOpenFAQIndex(null);
                }}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 ${
                  activeRole === role.id
                    ? "bg-white text-[#0A4A6B] shadow-sm border font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <role.icon className="h-4 w-4" />
                {role.label}
              </button>
            ))}
          </div>
        </div>

        {/* ---------------- STUDENT SECTION ---------------- */}
        {activeRole === "student" && (
          <div className="space-y-8">
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Quiz Pass Mark", value: "80%", desc: "Immediate retakes allowed", icon: Award, color: "text-amber-500", bg: "bg-amber-500/10" },
                { label: "Assignment Avg.", value: "70%", desc: "Case studies & projects", icon: FileText, color: "text-blue-500", bg: "bg-blue-500/10" },
                { label: "Review Window", value: "3-5 Days", desc: "For instructor grading", icon: Clock, color: "text-emerald-500", bg: "bg-emerald-500/10" },
                { label: "Max Course Reg.", value: "4 Courses", desc: "Per academic session", icon: Bookmark, color: "text-red-500", bg: "bg-red-500/10" },
              ].map((stat, i) => (
                <Card key={i} className="border-border/60 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-5 flex flex-col items-center text-center space-y-2">
                    <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color}`}>
                      <stat.icon className="h-5 w-5" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
                      <h4 className="text-2xl font-bold tracking-tight text-foreground">{stat.value}</h4>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-tight">{stat.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Dynamic Details Tabs */}
            <div className="space-y-6">
              <div className="flex border-b overflow-x-auto scrollbar-none gap-2 p-1 bg-muted/40 rounded-xl">
                {[
                  { id: "journey", label: "Progression Journey", icon: GraduationCap },
                  { id: "checklist", label: "Course Checklist", icon: ClipboardList },
                  { id: "exams", label: "Quizzes & Exams", icon: HelpCircle },
                  { id: "timesheets", label: "Study Timesheets", icon: Calendar },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveStudentTab(tab.id as any)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
                      activeStudentTab === tab.id
                        ? "bg-background text-[#0A4A6B] dark:text-blue-400 shadow-sm border"
                        : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                    }`}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStudentTab}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                  variants={containerVariants}
                  className="space-y-6"
                >
                  {activeStudentTab === "journey" && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="lg:col-span-2 space-y-6">
                        <Card className="border-border/60 shadow-sm">
                          <CardHeader>
                            <CardTitle className="text-xl flex items-center gap-2">
                              <GraduationCap className="h-5 w-5 text-primary" />
                              Academic Progression Flow
                            </CardTitle>
                            <CardDescription>
                              How students move from Stage 1 to the final graduation stage.
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-8 relative pl-6 before:absolute before:left-10 before:top-8 before:bottom-8 before:w-0.5 before:bg-border/60">
                            
                            {/* Stage 1 */}
                            <motion.div variants={itemVariants} className="relative flex items-start group pl-12">
                              <div className="absolute left-0 top-0.5 flex h-8 w-8 items-center justify-center rounded-full border bg-background shadow-sm text-xs font-bold text-primary group-hover:border-primary transition-colors z-10">
                                01
                              </div>
                              <div className="space-y-1.5 pt-0.5">
                                <h4 className="font-bold text-[#0A4A6B] dark:text-blue-400">First Academic Session (Stage 1)</h4>
                                <p className="text-sm text-muted-foreground font-light leading-relaxed">
                                  Upon registration, you begin in the **First Academic Session**. Focus on fundamental courses in ergonomics, workspace hazards, and basics of occupational health.
                                </p>
                                <span className="inline-flex text-[10px] bg-muted px-2 py-0.5 rounded-md font-semibold text-muted-foreground">
                                  Max 4 Courses Registered
                                </span>
                              </div>
                            </motion.div>

                            {/* Stage 2 */}
                            <motion.div variants={itemVariants} className="relative flex items-start group pl-12">
                              <div className="absolute left-0 top-0.5 flex h-8 w-8 items-center justify-center rounded-full border bg-background shadow-sm text-xs font-bold text-primary group-hover:border-primary transition-colors z-10">
                                02
                              </div>
                              <div className="space-y-1.5 pt-0.5">
                                <h4 className="font-bold text-[#0A4A6B] dark:text-blue-400">Second Academic Session (Stage 2)</h4>
                                <p className="text-sm text-muted-foreground font-light leading-relaxed">
                                  Unlock Stage 2 by successfully completing all courses in your First Academic Session. Deepen your training in safety audits, ergonomics assessments, and legislative compliance.
                                </p>
                                <span className="inline-flex text-[10px] bg-muted px-2 py-0.5 rounded-md font-semibold text-muted-foreground">
                                  Automatic Promotion Upon Stage 1 Completion
                                </span>
                              </div>
                            </motion.div>

                            {/* Stage 3 */}
                            <motion.div variants={itemVariants} className="relative flex items-start group pl-12">
                              <div className="absolute left-0 top-0.5 flex h-8 w-8 items-center justify-center rounded-full border bg-background shadow-sm text-xs font-bold text-[#F4C400] group-hover:border-[#F4C400] transition-colors z-10">
                                03
                              </div>
                              <div className="space-y-1.5 pt-0.5">
                                <h4 className="font-bold text-[#0A4A6B] dark:text-blue-400">Third Academic Session (Stage 3)</h4>
                                <p className="text-sm text-muted-foreground font-light leading-relaxed">
                                  The final advanced stage. Focuses on systems leadership, risk management, and professional project auditing. Completing all Stage 3 courses leads directly to graduation and licensing.
                                </p>
                                <span className="inline-flex text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-md font-semibold font-light leading-relaxed">
                                  🎓 Leads to Professional Certificate & Award
                                </span>
                              </div>
                            </motion.div>

                          </CardContent>
                        </Card>
                      </div>

                      <div className="space-y-6">
                        <Card className="bg-primary/5 border-primary/10 shadow-none">
                          <CardHeader>
                            <CardTitle className="text-lg text-primary flex items-center gap-1.5">
                              <Info className="h-4.5 w-4.5" />
                              Key Rules
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4 text-sm text-muted-foreground">
                            <div className="flex gap-2">
                              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                              <p>
                                <strong>Automatic Promotion</strong>: The system detects when you pass all courses in your current session and immediately promotes you to the next.
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                              <p>
                                <strong>Structured Path</strong>: You cannot skip stages. All modules, quizzes, and projects within the current stage must be marked completed.
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                              <p>
                                <strong>Course Registration limits</strong>: A maximum of <strong>4 courses</strong> can be active/registered per session.
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  )}

                  {activeStudentTab === "checklist" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card className="border-border/60 shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-xl flex items-center gap-2">
                            <ClipboardList className="h-5 w-5 text-primary" />
                            Student Checklist per Course
                          </CardTitle>
                          <CardDescription>
                            To complete a course and earn a certificate, you must satisfy the following:
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {[
                            { title: "Standard Modules", desc: "View all lectures, watch assigned videos, and read provided course notes. Mark each module as complete." },
                            { title: "Graded Quizzes", desc: "Pass all section quizzes. Requires a minimum score of 80% to mark the quiz section as complete." },
                            { title: "Case Studies", desc: "Download case study attachments, complete the assignment, and upload your report. Must score a 70% average." },
                            { title: "Final Assessment", desc: "A combination of a Time Paper, a Final Project, and a presentation defense at the end of the course." },
                          ].map((item, i) => (
                            <div key={i} className="flex gap-3 p-3.5 rounded-xl border bg-background/50">
                              <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                                {i + 1}
                              </div>
                              <div className="space-y-1">
                                <h4 className="font-bold text-sm text-foreground">{item.title}</h4>
                                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                              </div>
                            </div>
                          ))}
                        </CardContent>
                      </Card>

                      <Card className="border-border/60 shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-xl flex items-center gap-2">
                            <Award className="h-5 w-5 text-primary" />
                            Certificate Generation
                          </CardTitle>
                          <CardDescription>
                            Validating your achievements.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                          <p className="text-muted-foreground leading-relaxed">
                            Once all requirements (modules, quizzes, and project uploads) are complete:
                          </p>
                          <div className="space-y-3 bg-muted/40 p-4 rounded-xl border border-dashed">
                            <div className="flex gap-2">
                              <UserCheck className="h-4.5 w-4.5 text-blue-500 shrink-0 mt-0.5" />
                              <p className="text-xs">Instructors grade submissions & write feedback (takes 3-5 days).</p>
                            </div>
                            <div className="flex gap-2">
                              <UserCheck className="h-4.5 w-4.5 text-blue-500 shrink-0 mt-0.5" />
                              <p className="text-xs">Once all elements average above 70%, the course status updates to Completed.</p>
                            </div>
                            <div className="flex gap-2">
                              <UserCheck className="h-4.5 w-4.5 text-blue-500 shrink-0 mt-0.5" />
                              <p className="text-xs">A 'Download Certificate' button becomes active instantly on the completed courses screen.</p>
                            </div>
                          </div>
                          <div className="pt-2">
                            <Link href={`/${schoolSlug}/courses`}>
                              <Button className="w-full gap-2 rounded-xl font-bold bg-[#0A4A6B] hover:bg-[#0A4A6B]/90 text-white">
                                Go to Course Catalog <ArrowRight className="h-4 w-4" />
                              </Button>
                            </Link>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {activeStudentTab === "exams" && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="lg:col-span-2 space-y-6">
                        <Card className="border-border/60 shadow-sm">
                          <CardHeader>
                            <CardTitle className="text-xl flex items-center gap-2">
                              <HelpCircle className="h-5 w-5 text-primary" />
                              Quizzes & Exams Structure
                            </CardTitle>
                            <CardDescription>
                              A review of the assessment types and passing rules.
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-6">
                            
                            <div className="space-y-3">
                              <h4 className="font-bold text-sm text-[#0A4A6B] dark:text-blue-400">1. Section Quizzes</h4>
                              <p className="text-sm text-muted-foreground leading-relaxed">
                                Quizzes occur at the end of specific sections in structured courses. They consist of multiple-choice questions designed to test your knowledge of that section's modules.
                              </p>
                              <div className="bg-muted/40 p-4 rounded-xl space-y-2 border text-xs text-muted-foreground">
                                <p><strong>Frequency</strong>: 1 quiz per section (usually 2-3 sections per course).</p>
                                <p><strong>Passing Score</strong>: <strong>80% minimum</strong>. Score lower, and you must review & try again.</p>
                                <p><strong>Autograding</strong>: Handled instantly by the LMS platform upon submission.</p>
                              </div>
                            </div>

                            <div className="space-y-3 pt-4 border-t">
                              <h4 className="font-bold text-sm text-[#0A4A6B] dark:text-blue-400">2. Case Studies & Graded Assignments</h4>
                              <p className="text-sm text-muted-foreground leading-relaxed">
                                Practical exercise sections require uploading a project file (word document or slides). Instructors score these manually out of 100.
                              </p>
                              <div className="bg-muted/40 p-4 rounded-xl space-y-2 border text-xs text-muted-foreground">
                                <p><strong>Passing Score</strong>: <strong>70% average</strong> across all case studies is required.</p>
                                <p><strong>Grading Timeline</strong>: <strong>3 to 5 business days</strong> for admins/instructors to review and grade.</p>
                              </div>
                            </div>

                            <div className="space-y-3 pt-4 border-t">
                              <h4 className="font-bold text-sm text-[#0A4A6B] dark:text-blue-400">3. Final Assessment (Path to Exam)</h4>
                              <p className="text-sm text-muted-foreground leading-relaxed">
                                Completing all preceding sections unlocks the Final Assessment. This includes:
                              </p>
                              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground pl-2">
                                <li><strong>Time Paper</strong>: Timed research summary slides.</li>
                                <li><strong>Final Project</strong>: Comprehensive safety audit or risk management proposal.</li>
                                <li><strong>Presentation</strong>: Audio/video or live defense of your project.</li>
                              </ul>
                            </div>

                          </CardContent>
                        </Card>
                      </div>

                      <div className="space-y-6">
                        <Card className="border-border/60 shadow-sm bg-[#F4C400]/5 border-[#F4C400]/20">
                          <CardHeader>
                            <CardTitle className="text-lg text-primary flex items-center gap-1.5">
                              <Clock className="h-4.5 w-4.5 text-[#0A4A6B]" />
                              Unlocking Quizzes & Exams
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3 text-sm text-muted-foreground">
                            <p>
                              A course must remain active for a minimum of <strong>6 weeks</strong>.
                            </p>
                            <p>
                              To ensure thorough study, <strong>quizzes, case studies, and final exams are locked for a minimum of 2 weeks (14 days)</strong> after you enroll in the course.
                            </p>
                            <p>
                              Additionally, they will unlock only when:
                            </p>
                            <ol className="list-decimal list-inside space-y-1.5 pl-1 font-semibold text-[#0A4A6B] dark:text-blue-400">
                              <li>All standard modules are marked complete.</li>
                              <li>You have registered at least 30 study hours on your course timesheet.</li>
                            </ol>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  )}

                  {activeStudentTab === "timesheets" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card className="border-border/60 shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-xl flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-primary" />
                            Timesheets & Scheduled Sessions
                          </CardTitle>
                          <CardDescription>
                            How study hours and attendance are tracked.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                          <p>
                            Professional ergonomics training requires dedicated active engagement. IESM LMS employs two methods to track study hours depending on the course structure:
                          </p>
                          
                          <div className="space-y-3">
                            <h4 className="font-bold text-foreground">1. Structured Courses (Active Tracking)</h4>
                            <p className="text-xs">
                              For interactive courses, the system automatically tracks active learning time spent viewing slides, watching lecture videos, and completing portal exercises.
                            </p>
                          </div>

                          <div className="space-y-3 pt-3 border-t">
                            <h4 className="font-bold text-foreground">2. PDF-Only & Downloadable Courses (Manual Logs)</h4>
                            <p className="text-xs font-light">
                              Since PDF lectures open in external browser tabs or download locally, the automated tracker cannot record active study time. For these courses, students utilize the <strong>Manual Timesheet Logger</strong> inside the course page to self-report study sessions.
                            </p>
                            <p className="text-[10px] text-yellow-600 dark:text-yellow-400 font-semibold">
                              ⚠️ Note: Self-reported logs are reviewed and verified by instructors before certificate approval.
                            </p>
                          </div>

                          <div className="space-y-3 pt-3 border-t">
                            <h4 className="font-bold text-foreground">3. Scheduled Sessions & Live Lectures</h4>
                            <p className="text-xs">
                              Instructors host live discussions, practical Q&As, and group audits. Check the <strong>Schedule</strong> tab inside your enrolled course to view details of upcoming live sessions.
                            </p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-border/60 shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-xl flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-primary" />
                            Attendance Marking
                          </CardTitle>
                          <CardDescription>
                            Rules for live lectures.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                          <p className="text-muted-foreground leading-relaxed">
                            During live sessions, the instructor will log attendance. Your attendance status determines your course participation grade:
                          </p>
                          
                          <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                            <div className="p-3 border rounded-xl flex items-center gap-2">
                              <span className="text-green-500 font-bold text-base">●</span>
                              <span>Present</span>
                            </div>
                            <div className="p-3 border rounded-xl flex items-center gap-2">
                              <span className="text-red-500 font-bold text-base">●</span>
                              <span>Absent</span>
                            </div>
                            <div className="p-3 border rounded-xl flex items-center gap-2">
                              <span className="text-yellow-500 font-bold text-base">●</span>
                              <span>Late</span>
                            </div>
                            <div className="p-3 border rounded-xl flex items-center gap-2">
                              <span className="text-blue-500 font-bold text-base">●</span>
                              <span>Excused</span>
                            </div>
                          </div>

                          <p className="text-xs text-muted-foreground mt-2 font-light">
                            You can view your complete attendance history directly under the <strong>Attendance</strong> tab in the active course detail screen.
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* ---------------- INSTRUCTOR SECTION ---------------- */}
        {activeRole === "instructor" && (
          <div className="space-y-8">
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Grading SLA", value: "3-5 Days", desc: "Turnaround target time", icon: Clock, color: "text-[#0A4A6B]", bg: "bg-blue-500/10" },
                { label: "Course Control", value: "Assigned", desc: "Instruct only assigned courses", icon: BookOpen, color: "text-amber-500", bg: "bg-amber-500/10" },
                { label: "Attendance Modes", value: "4 States", desc: "Present, Late, Absent, Excused", icon: UserCheck, color: "text-emerald-500", bg: "bg-emerald-500/10" },
                { label: "Custom Tasks", value: "Task List", desc: "Personal & student task logs", icon: CheckSquare, color: "text-red-500", bg: "bg-red-500/10" },
              ].map((stat, i) => (
                <Card key={i} className="border-border/60 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-5 flex flex-col items-center text-center space-y-2">
                    <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color}`}>
                      <stat.icon className="h-5 w-5" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
                      <h4 className="text-2xl font-bold tracking-tight text-foreground">{stat.value}</h4>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-tight">{stat.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Dynamic Details Tabs */}
            <div className="space-y-6">
              <div className="flex border-b overflow-x-auto scrollbar-none gap-2 p-1 bg-muted/40 rounded-xl">
                {[
                  { id: "overview", label: "Course Overview", icon: BookOpen },
                  { id: "grading", label: "Grading & Feedback", icon: FileText },
                  { id: "attendance", label: "Attendance Tracking", icon: UserCheck },
                  { id: "tasks", label: "Tasks & Messages", icon: MessageSquare },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveInstructorTab(tab.id as any)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
                      activeInstructorTab === tab.id
                        ? "bg-background text-[#0A4A6B] dark:text-blue-400 shadow-sm border"
                        : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                    }`}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={activeInstructorTab}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                  variants={containerVariants}
                  className="space-y-6"
                >
                  {activeInstructorTab === "overview" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card className="border-border/60 shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-xl flex items-center gap-2">
                            <BookOpen className="h-5 w-5 text-primary" />
                            Assigned Courses Directory
                          </CardTitle>
                          <CardDescription>
                            Instructors have restricted view, showing only courses they teach.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                          <p className="font-light">
                            Upon logging in, your dashboard will display all course cards where you are designated as the instructor. On this panel you can:
                          </p>
                          <ul className="list-disc list-inside space-y-2 pl-2 font-light">
                            <li>View the total count of enrolled students in real-time.</li>
                            <li>See how many modules exist inside the curriculum.</li>
                            <li>Open the <strong>Student Progress</strong> modal to see completion percentages.</li>
                          </ul>
                        </CardContent>
                      </Card>

                      <Card className="border-border/60 shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-xl flex items-center gap-2">
                            <Eye className="h-5 w-5 text-primary" />
                            Class Roster & Progress Tracking
                          </CardTitle>
                          <CardDescription>
                            Audit student engagement and identify lagging students.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                          <p className="font-light">
                            Clicking the <strong>"View Student Progress"</strong> button on any course card lists all enrolled students along with:
                          </p>
                          <div className="bg-muted/40 p-4 rounded-xl space-y-2 border text-xs">
                            <p>● Student Name and Email Address.</p>
                            <p>● Completion rate represented as a progress bar ($0\%$ to $100\%$).</p>
                            <p>● Exact counts of standard modules completed (e.g. "4 of 12 complete").</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {activeInstructorTab === "grading" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card className="border-border/60 shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-xl flex items-center gap-2">
                            <FileText className="h-5 w-5 text-primary" />
                            Manual Grading Workflow
                          </CardTitle>
                          <CardDescription>
                            Assess case study files, PowerPoint Time Papers, and final proposals.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                          <p className="font-light">
                            When students complete a case study or a final project, they upload their files. Grading is handled as follows:
                          </p>
                          <ol className="list-decimal list-inside space-y-2 pl-1 font-light">
                            <li>Navigate to the <strong>Manage Tasks</strong> sidebar tab.</li>
                            <li>Locate the pending grading task for the student.</li>
                            <li>Download the uploaded file to review their research or project.</li>
                            <li>Enter a score out of 100. (70% average is required for student completion).</li>
                            <li>Submit feedback which notifies the student instantly.</li>
                          </ol>
                        </CardContent>
                      </Card>

                      <Card className="border-border/60 shadow-sm bg-[#F4C400]/5 border-[#F4C400]/20">
                        <CardHeader>
                          <CardTitle className="text-lg text-primary flex items-center gap-1.5">
                            <Clock className="h-4.5 w-4.5 text-[#0A4A6B]" />
                            Grading Policy Constraints
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm text-muted-foreground">
                          <p className="font-light">
                            <strong>SLA Turnaround</strong>: All manual file uploads must be reviewed, graded, and commented upon within <strong>3 to 5 business days</strong>.
                          </p>
                          <p className="font-light">
                            <strong>Timesheet Verification</strong>: Before verifying a course as complete, double-check that the student's logged study hours are reasonable. If they log manual hours, cross-check their progress notes.
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {activeInstructorTab === "attendance" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card className="border-border/60 shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-xl flex items-center gap-2">
                            <UserCheck className="h-5 w-5 text-primary" />
                            Live Lecture Attendance Logs
                          </CardTitle>
                          <CardDescription>
                            Keeping track of student participation in live Zoom or WhatsApp classes.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                          <p className="font-light">
                            Attendance is logged directly inside the course view:
                          </p>
                          <ul className="list-disc list-inside space-y-2 pl-2 font-light">
                            <li>Open the enrolled course page and click the <strong>Attendance</strong> tab.</li>
                            <li>Click the dropdown or cell corresponding to a student's row.</li>
                            <li>Select the status: **Present**, **Late**, **Absent**, or **Excused**.</li>
                            <li>Click save to update the record. Students can see their attendance summary instantly.</li>
                          </ul>
                        </CardContent>
                      </Card>

                      <Card className="border-border/60 shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-xl flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-primary" />
                            Scheduled Sessions Setup
                          </CardTitle>
                          <CardDescription>
                            Planning ahead for live classes.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                          <p className="font-light">
                            Instructors are responsible for scheduling live class meetups:
                          </p>
                          <div className="bg-muted/40 p-4 rounded-xl text-xs space-y-2 border">
                            <p>1. Go to the <strong>Schedule</strong> tab on the course page.</p>
                            <p>2. Create a new lecture slot with the date, time, and link (e.g. Zoom url).</p>
                            <p>3. Students will see the notification and link on their dashboard.</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {activeInstructorTab === "tasks" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card className="border-border/60 shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-xl flex items-center gap-2">
                            <CheckSquare className="h-5 w-5 text-primary" />
                            Personal Task Management
                          </CardTitle>
                          <CardDescription>
                            Organize your grading deadlines and course reviews.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                          <p className="font-light">
                            Use the **Manage Tasks** page to create checklists for yourself or delegate items:
                          </p>
                          <ul className="list-disc list-inside space-y-2 pl-2 font-light">
                            <li>Add tasks with a Title, Description, and Assigned user.</li>
                            <li>Track task state: pending, in-progress, completed.</li>
                            <li>Completed tasks disappear from active widgets to keep dashboards clean.</li>
                          </ul>
                        </CardContent>
                      </Card>

                      <Card className="border-border/60 shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-xl flex items-center gap-2">
                            <MessageSquare className="h-5 w-5 text-primary" />
                            Student Chat & Inbox
                          </CardTitle>
                          <CardDescription>
                            Direct academic interaction.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                          <p className="font-light">
                            Use the **Messages** sidebar item to:
                          </p>
                          <ul className="list-disc list-inside space-y-2 pl-2 font-light">
                            <li>Chat directly with students who have questions about modules or feedback.</li>
                            <li>Discuss school administration issues directly with Admins.</li>
                            <li>Get real-time notification alerts (blue dots) when new messages arrive.</li>
                          </ul>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* ---------------- ADMIN SECTION ---------------- */}
        {activeRole === "admin" && (
          <div className="space-y-8">
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Dashboard Scope", value: "Full System", desc: "Oversight of all statistics", icon: Shield, color: "text-[#C8102E]", bg: "bg-red-500/10" },
                { label: "Settings Override", value: "Enabled", desc: "Modify tenant parameters", icon: Settings, color: "text-amber-500", bg: "bg-amber-500/10" },
                { label: "User Accounts", value: "Full Admin", desc: "Create, edit, reset, delete", icon: Users, color: "text-emerald-500", bg: "bg-emerald-500/10" },
                { label: "Enrollments", value: "Approval", desc: "Receipt & access validation", icon: UserCheck, color: "text-blue-500", bg: "bg-blue-500/10" },
              ].map((stat, i) => (
                <Card key={i} className="border-border/60 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-5 flex flex-col items-center text-center space-y-2">
                    <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color}`}>
                      <stat.icon className="h-5 w-5" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
                      <h4 className="text-2xl font-bold tracking-tight text-foreground">{stat.value}</h4>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-tight">{stat.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Dynamic Details Tabs */}
            <div className="space-y-6">
              <div className="flex border-b overflow-x-auto scrollbar-none gap-2 p-1 bg-muted/40 rounded-xl">
                {[
                  { id: "analytics", label: "Analytics & Settings", icon: Shield },
                  { id: "enrollments", label: "Enrollments & Receipts", icon: ClipboardList },
                  { id: "editor", label: "Course Creation", icon: PlusCircle },
                  { id: "users", label: "User Control & Tasks", icon: Users },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveAdminTab(tab.id as any)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
                      activeAdminTab === tab.id
                        ? "bg-background text-[#0A4A6B] dark:text-blue-400 shadow-sm border"
                        : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                    }`}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={activeAdminTab}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                  variants={containerVariants}
                  className="space-y-6"
                >
                  {activeAdminTab === "analytics" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card className="border-border/60 shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-xl flex items-center gap-2">
                            <Activity className="h-5 w-5 text-primary" />
                            System Overview Stats
                          </CardTitle>
                          <CardDescription>
                            Overview metrics for school managers.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                          <p className="font-light">
                            The Administrative overview contains high-level metrics aggregating:
                          </p>
                          <ul className="list-disc list-inside space-y-2 pl-2 font-light">
                            <li><strong>Total Courses</strong>: Count of courses in the system database.</li>
                            <li><strong>Total Students</strong>: Count of students registered.</li>
                            <li><strong>Instructors</strong>: Count of registered academic staff.</li>
                            <li><strong>Total Enrollments</strong>: Active student seats across all courses.</li>
                          </ul>
                        </CardContent>
                      </Card>

                      <Card className="border-border/60 shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-xl flex items-center gap-2">
                            <Settings className="h-5 w-5 text-primary" />
                            School Settings Override
                          </CardTitle>
                          <CardDescription>
                            Configure visual branding and contact parameters.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                          <p className="font-light">
                            Navigate to <strong>Settings</strong> to override details:
                          </p>
                          <div className="bg-muted/40 p-4 rounded-xl text-xs space-y-2 border font-light">
                            <p>● Upload logos, banners, and default graphics.</p>
                            <p>● Modify support phone number, emails, and address listings.</p>
                            <p>● View visual rules based on IESM color systems.</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {activeAdminTab === "enrollments" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card className="border-border/60 shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-xl flex items-center gap-2">
                            <ClipboardList className="h-5 w-5 text-primary" />
                            Enrollment Request Approvals
                          </CardTitle>
                          <CardDescription>
                            Verify student tuition payments and bank receipts.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm text-muted-foreground leading-relaxed font-light">
                          <p>
                            When students request enrollment using the Bank Transfer option, they upload an image receipt. As an admin, you must:
                          </p>
                          <ol className="list-decimal list-inside space-y-2 pl-1">
                            <li>Open the <strong>Enrollment Requests</strong> tab from the sidebar.</li>
                            <li>Verify the student's name, email, and the course requested.</li>
                            <li>Click the <strong>Receipt Link</strong> to inspect the bank receipt upload.</li>
                            <li>Once payment is verified on the bank statement, click <strong>Approve</strong>.</li>
                          </ol>
                        </CardContent>
                      </Card>

                      <Card className="border-border/60 shadow-sm bg-[#F4C400]/5 border-[#F4C400]/20">
                        <CardHeader>
                          <CardTitle className="text-lg text-primary flex items-center gap-1.5">
                            <Award className="h-4.5 w-4.5 text-[#0A4A6B]" />
                            Automated Student Onboarding
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm text-muted-foreground font-light">
                          <p>
                            Upon clicking <strong>Approve</strong>, the system automatically:
                          </p>
                          <ul className="list-disc list-inside space-y-1.5 pl-1 font-semibold text-[#0A4A6B] dark:text-blue-400">
                            <li>Adds the student's user ID to the course database list.</li>
                            <li>Triggers a custom introduction message in the student's inbox.</li>
                            <li>Sends a notification confirming successful enrollment.</li>
                          </ul>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {activeAdminTab === "editor" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card className="border-border/60 shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-xl flex items-center gap-2">
                            <PlusCircle className="h-5 w-5 text-primary" />
                            Course Creation Details
                          </CardTitle>
                          <CardDescription>
                            Set up courses, select instructors, and target stages.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm text-muted-foreground leading-relaxed font-light">
                          <p>
                            Create courses by going to <strong>Manage Courses $\rightarrow$ Add Course</strong>.
                          </p>
                          <div className="bg-muted/40 p-4 rounded-xl text-xs space-y-2 border">
                            <p><strong>Title & Description</strong>: Outline syllabus and learning metrics.</p>
                            <p><strong>Instructor Assignment</strong>: Select an active instructor from the user database.</p>
                            <p><strong>Academic Session Tag</strong>: Target **First**, **Second**, or **Third** session (Stage 1, 2, or 3) to lock course enrollment to students in that stage.</p>
                            <p><strong>Tuition Cost</strong>: Enter pricing options (for online credit card / Paystack). Or set to $0$ for free courses.</p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-border/60 shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-xl flex items-center gap-2">
                            <Layers className="h-5 w-5 text-primary" />
                            Curriculum Editor
                          </CardTitle>
                          <CardDescription>
                            Organize modules, quizzes, and assignment uploads.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm text-muted-foreground leading-relaxed font-light">
                          <p>
                            Once a course is created, open the Course Editor to add:
                          </p>
                          <ul className="list-disc list-inside space-y-2 pl-2">
                            <li><strong>Standard Lecture Modules</strong>: Include text notes, file downloads, and video embed links.</li>
                            <li><strong>Multiple Choice Quizzes</strong>: Define questions, answers, and correct key values (minimum passing is 80%).</li>
                            <li><strong>Case Study Zones</strong>: Specify tasks and file upload fields for manual grading.</li>
                          </ul>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {activeAdminTab === "users" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card className="border-border/60 shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-xl flex items-center gap-2">
                            <Users className="h-5 w-5 text-primary" />
                            User Directory Controls
                          </CardTitle>
                          <CardDescription>
                            Create, modify, and manage logins for all tenant users.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm text-muted-foreground leading-relaxed font-light font-light">
                          <p>
                            Under <strong>Manage Users</strong>, admins can search for names or email addresses:
                          </p>
                          <ul className="list-disc list-inside space-y-2 pl-2">
                            <li><strong>Add User</strong>: Manually onboard students or staff.</li>
                            <li><strong>Edit Profile</strong>: Modify names, change email addresses, and update active academic session states.</li>
                            <li><strong>Change Role</strong>: Convert roles (Student $\rightarrow$ Instructor $\rightarrow$ Admin). Super-Admins can also assign other Admins.</li>
                            <li><strong>Reset Password</strong>: Send a password reset link directly to the user's inbox.</li>
                            <li><strong>Delete</strong>: Delete accounts and databases for deactivated students/staff.</li>
                          </ul>
                        </CardContent>
                      </Card>

                      <Card className="border-border/60 shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-xl flex items-center gap-2">
                            <CheckSquare className="h-5 w-5 text-primary" />
                            Delegating Operational Tasks
                          </CardTitle>
                          <CardDescription>
                            Create checklists and assign them to staff members.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm text-muted-foreground leading-relaxed font-light">
                          <p>
                            Use the <strong>Manage Tasks $\rightarrow$ Create Task</strong> dialog:
                          </p>
                          <div className="bg-muted/40 p-4 rounded-xl text-xs space-y-2 border">
                            <p>1. Enter title and details (e.g. "Review risk audit slides").</p>
                            <p>2. Search and select the Instructor or Admin to handle the task.</p>
                            <p>3. Submit. It will appear on their dashboard until marked completed.</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* FAQs Accordion */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl font-bold flex items-center gap-2">
              <HelpCircle className="h-6 w-6 text-primary" />
              Frequently Asked Questions (FAQ)
            </CardTitle>
            <CardDescription>
              Quick answers to typical operations on the LMS.
            </CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-border/60 font-light">
            {currentFaqs.map((faq, index) => {
              const isOpen = openFAQIndex === index;
              return (
                <div key={index} className="py-4">
                  <button
                    onClick={() => toggleFAQ(index)}
                    className="w-full flex items-center justify-between text-left font-bold text-sm sm:text-base text-foreground hover:text-primary transition-colors focus:outline-none"
                  >
                    <span>{faq.question}</span>
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 ml-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 ml-4" />
                    )}
                  </button>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <p className="text-xs sm:text-sm text-muted-foreground mt-3 leading-relaxed bg-muted/20 p-4 rounded-xl border border-border/40 whitespace-pre-wrap">
                          {faq.answer}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Quick Contact Panel */}
        <div className="rounded-3xl border bg-background p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-center gap-6 shadow-sm">
          <div className="space-y-1.5 text-center sm:text-left">
            <h4 className="font-bold text-lg text-foreground font-semibold">Need direct academic or tech support?</h4>
            <p className="text-xs sm:text-sm text-muted-foreground font-light">
              Contact our admissions or registrar office via WhatsApp: <strong>08133634052</strong> or email <strong>Info@ciesmglobal.com</strong>
            </p>
          </div>
          <Link href={`/${schoolSlug}/courses`}>
            <Button size="lg" className="rounded-2xl font-bold bg-[#0A4A6B] hover:bg-[#0A4A6B]/95 text-white gap-2 shadow-lg shadow-[#0A4A6B]/20">
              Go to Course Catalog <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        </div>

      </div>
    </div>
  );
}
