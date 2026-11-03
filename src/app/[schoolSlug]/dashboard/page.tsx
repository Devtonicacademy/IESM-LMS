"use client";

import { use, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Search, Book, LogOut, CheckCircle2, Clock, Users, CheckSquare, Eye } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { DashboardTopbar } from "@/components/dashboard-topbar";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, getDocs, updateDoc, doc } from "firebase/firestore";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { PageLoading } from "@/components/page-loading";
import { cn } from "@/lib/utils";

export default function DashboardPage({ params }: { params: Promise<{ schoolSlug: string }> }) {
  const { schoolSlug } = use(params);
  const { user, loading, logout, isAdmin, isInstructor, isStudent } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push(`/${schoolSlug}/auth/login`);
    }
  }, [user, loading, router, schoolSlug]);

  if (loading || !user) {
    return <PageLoading message="Loading dashboard..." fullScreen />;
  }

  return (
    <div className="flex flex-col flex-1 w-full bg-muted/10 min-h-full">
      <DashboardTopbar breadcrumb="Dashboard / Overview" />
      <div className="p-8 max-w-7xl mx-auto w-full space-y-8">
        
        {/* Everyone sees their tasks */}
        <div id="tour-tasks-section">
          <UserTasksWidget schoolSlug={schoolSlug} userUid={user.uid} />
        </div>

        {/* Dashboard Overview Content */}
        <div id="tour-overview-content" className="space-y-8">
          {/* Admin Section */}
          {isAdmin && (
            <AdminDashboardStats schoolSlug={schoolSlug} />
          )}

          {/* Instructor Section */}
          {isInstructor && (
            <InstructorDashboard schoolSlug={schoolSlug} userUid={user.uid} />
          )}

          {/* Student Section */}
          {isStudent && (
            <StudentEnrollments schoolSlug={schoolSlug} userUid={user.uid} />
          )}
        </div>

      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// User Tasks Widget

function UserTasksWidget({ schoolSlug, userUid }: { schoolSlug: string; userUid: string }) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "schools", schoolSlug, "tasks"),
      where("assignedTo", "==", userUid),
      where("status", "in", ["pending", "in-progress"])
    );
    const unsub = onSnapshot(q, (snap) => {
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [schoolSlug, userUid]);

  async function markCompleted(taskId: string) {
    try {
      await updateDoc(doc(db, "schools", schoolSlug, "tasks", taskId), {
        status: "completed"
      });
      toast.success("Task marked as completed!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update task");
    }
  }

  if (loading) return null;
  if (tasks.length === 0) return null; // hide if no tasks

  return (
    <Card className="border-border/50 shadow-sm border-l-4 border-l-primary">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Pending Tasks ({tasks.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tasks.map(task => (
          <div key={task.id} className="p-4 rounded-xl border bg-card flex flex-col">
            <h4 className="font-semibold text-sm mb-1">{task.title}</h4>
            {task.description && <p className="text-xs text-muted-foreground mb-4 line-clamp-2">{task.description}</p>}
            <div className="mt-auto pt-2 flex items-center justify-between">
              <span className={cn(
                "text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider",
                task.status === "in-progress" ? "bg-blue-100 text-blue-700" : "bg-yellow-100 text-yellow-700"
              )}>
                {task.status}
              </span>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => markCompleted(task.id)}>
                <CheckCircle2 className="h-3 w-3 mr-1" /> Complete
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ----------------------------------------------------------------------
// Admin Dashboard

function AdminDashboardStats({ schoolSlug }: { schoolSlug: string }) {
  const [stats, setStats] = useState({ courses: 0, students: 0, instructors: 0, tasks: 0, enrollments: 0 });
  const [recentCourses, setRecentCourses] = useState<any[]>([]);

  useEffect(() => {
    async function fetchStats() {
      // Courses
      const coursesSnap = await getDocs(collection(db, "schools", schoolSlug, "courses"));
      const courses = coursesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const totalEnrollments = courses.reduce((acc, c: any) => acc + (c.enrolledStudents?.length || 0), 0);
      
      // Users
      const usersSnap = await getDocs(collection(db, "schools", schoolSlug, "users"));
      const students = usersSnap.docs.filter((d) => d.data().role === "student" || !d.data().role).length;
      const instructors = usersSnap.docs.filter((d) => d.data().role === "instructor").length;

      // Tasks (Active)
      const tasksSnap = await getDocs(query(
        collection(db, "schools", schoolSlug, "tasks"),
        where("status", "in", ["pending", "in-progress"])
      ));

      setStats({
        courses: courses.length,
        students,
        instructors,
        tasks: tasksSnap.size,
        enrollments: totalEnrollments
      });

      // Sort courses by createdat/recent
      setRecentCourses(courses.slice(0, 4));
    }
    fetchStats();
  }, [schoolSlug]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight">System Overview</h2>
        <Link href={`/${schoolSlug}/admin/courses/new`}>
          <Button size="sm" className="rounded-xl"><PlusCircle className="mr-2 h-4 w-4"/> Add Course</Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total Courses", value: stats.courses, icon: Book, color: "text-blue-500", bg: "bg-blue-100", href: `/${schoolSlug}/admin/courses` },
          { label: "Total Students", value: stats.students, icon: Users, color: "text-green-500", bg: "bg-green-100", href: `/${schoolSlug}/admin/users` },
          { label: "Instructors", value: stats.instructors, icon: Users, color: "text-purple-500", bg: "bg-purple-100", href: `/${schoolSlug}/admin/users` },
          { label: "Total Enrollments", value: stats.enrollments, icon: CheckCircle2, color: "text-pink-500", bg: "bg-pink-100", href: `/${schoolSlug}/admin/courses` },
          { label: "Active Tasks", value: stats.tasks, icon: CheckSquare, color: "text-orange-500", bg: "bg-orange-100", href: `/${schoolSlug}/dashboard` },
        ].map((s, i) => (
          <Link href={s.href} key={i}>
            <Card className="border-border/50 shadow-sm hover:shadow-md hover:border-primary/50 transition-all h-full cursor-pointer">
              <CardContent className="p-6 flex flex-col gap-2">
                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center mb-2", s.bg)}>
                  <s.icon className={cn("h-5 w-5", s.color)} />
                </div>
                <p className="text-sm text-muted-foreground font-medium group-hover:text-primary transition-colors">{s.label}</p>
                <h3 className="text-3xl font-bold">{s.value}</h3>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4 mt-8">Recent Courses</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {recentCourses.map((course: any) => (
            <Link href={`/${schoolSlug}/courses/${course.id}`} key={course.id}>
              <Card className="overflow-hidden border-border/50 hover:shadow-md hover:border-primary/50 transition-all group flex flex-col p-1.5 rounded-2xl h-full cursor-pointer">
                <div className="h-32 w-full bg-muted rounded-xl mb-3 relative overflow-hidden flex items-center justify-center">
                  <span className="text-4xl opacity-50 mix-blend-multiply dark:mix-blend-screen transition-transform group-hover:scale-110">📚</span>
                </div>
                <CardContent className="p-3 pt-0 flex flex-col flex-1">
                  <div className="flex justify-between items-center text-xs text-muted-foreground mb-2">
                    <span className="flex items-center gap-1"><Book className="h-3 w-3"/> {course.modules?.length || 0} Mod</span>
                    <span className="flex items-center gap-1"><Users className="h-3 w-3"/> {course.enrolledStudents?.length || 0}</span>
                  </div>
                  <h3 className="font-semibold text-sm leading-tight group-hover:text-primary transition-colors">{course.title}</h3>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Instructor Dashboard

function InstructorDashboard({ schoolSlug, userUid }: { schoolSlug: string, userUid: string }) {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [allStudents, setAllStudents] = useState<Record<string, any>>({});
  const [selectedCourse, setSelectedCourse] = useState<any | null>(null);

  useEffect(() => {
    // fetch courses assigned to instructor
    const q = query(
      collection(db, "schools", schoolSlug, "courses"),
      where("instructorId", "==", userUid)
    );
    const unsub = onSnapshot(q, async (snap) => {
      setCourses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [schoolSlug, userUid]);

  useEffect(() => {
    // fetch all students to map IDs to names
    async function fetchStudents() {
      const snap = await getDocs(query(collection(db, "schools", schoolSlug, "users")));
      const map: Record<string, any> = {};
      snap.forEach(d => {
        map[d.id] = { id: d.id, ...d.data() };
      });
      setAllStudents(map);
    }
    fetchStudents();
  }, [schoolSlug]);

  if (loading) return <div className="py-10 animate-pulse text-sm text-muted-foreground">Loading instructor data...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold tracking-tight">Instructor Dashboard</h2>
      <p className="text-sm text-muted-foreground">Manage your assigned courses and track student progress.</p>
      
      {courses.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-12 px-6 text-center border-dashed">
          <Book className="h-8 w-8 text-primary/40 mb-4" />
          <h3 className="text-lg font-medium">No courses assigned</h3>
          <p className="text-sm text-muted-foreground">You have not been assigned to instruct any courses yet.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course: any) => (
            <Card key={course.id} className="h-full flex flex-col hover:border-primary transition-colors hover:shadow-sm">
              <CardHeader>
                <CardTitle className="line-clamp-2 text-lg">{course.title}</CardTitle>
                <CardDescription className="line-clamp-2">{course.description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto pt-4 flex flex-col gap-4 border-t border-border/50">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground font-medium">Enrolled Students</span>
                  <span className="font-bold">{course.enrolledStudents?.length || 0}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground font-medium">Total Modules</span>
                  <span className="font-bold">{course.modules?.length || 0}</span>
                </div>
                <Button 
                    variant="secondary" 
                    className="w-full mt-2" 
                    onClick={() => setSelectedCourse(course)}
                >
                  <Eye className="w-4 h-4 mr-2" /> View Student Progress
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Progress Modal */}
      <Dialog open={!!selectedCourse} onOpenChange={(o) => !o && setSelectedCourse(null)}>
        <DialogContent className="sm:max-w-xl max-h-[80vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>Course Progress</DialogTitle>
            <DialogDescription>
              Student completion rates for <span className="font-medium text-foreground">{selectedCourse?.title}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {(!selectedCourse?.enrolledStudents || selectedCourse.enrolledStudents.length === 0) ? (
              <p className="text-center text-sm text-muted-foreground py-4">No students enrolled in this course.</p>
            ) : (
              selectedCourse.enrolledStudents.map((uid: string) => {
                const student = allStudents[uid] || { displayName: "Unknown", email: "Unknown" };
                const completedModules = selectedCourse.modules?.filter((m: any) => m.completedBy?.includes(uid)).length || 0;
                const totalModules = selectedCourse.modules?.length || 0;
                const progress = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;
                
                return (
                  <div key={uid} className="flex flex-col gap-2 p-3 rounded-xl border border-border/50 bg-muted/10">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{student.displayName || "Unknown User"}</p>
                        <p className="text-xs text-muted-foreground truncate">{student.email}</p>
                      </div>
                      <div className="text-sm font-bold text-primary pl-4">{progress}%</div>
                    </div>
                    <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden mt-1">
                      <div className="bg-primary h-full transition-all duration-500" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground text-right">{completedModules} of {totalModules} modules completed</p>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ----------------------------------------------------------------------
// Student Dashboard

function StudentEnrollments({ schoolSlug, userUid }: { schoolSlug: string, userUid: string }) {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function fetchEnrolled() {
      try {
        const { collection, query, where, getDocs } = await import("firebase/firestore");
        const { db } = await import("@/lib/firebase");
        
        const q = query(
          collection(db, "schools", schoolSlug, "courses"),
          where("enrolledStudents", "array-contains", userUid)
        );
        const snapshot = await getDocs(q);
        setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error("Failed to fetch enrollments", err);
      } finally {
        setLoading(false);
      }
    }
    fetchEnrolled();
  }, [schoolSlug, userUid]);

  if (loading) return <div className="py-10 animate-pulse text-sm text-muted-foreground">Loading your courses...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Your Enrollments</h2>
      {courses.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="flex flex-col items-center justify-center py-12 px-6 text-center border-dashed col-span-full">
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <Book className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-medium">No active courses</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-2 mb-6">
              You haven't enrolled in any courses yet. Check out the catalog to find something new to learn!
            </p>
            <Link href={`/${schoolSlug}/courses`} className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">Browse Catalog</Link>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course: any) => {
            const completedModules = course.modules?.filter((m: any) => m.completedBy?.includes(userUid)).length || 0;
            const totalModules = course.modules?.length || 0;
            const progress = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;
            
            return (
              <Card key={course.id} className="h-full flex flex-col hover:border-primary transition-colors hover:shadow-sm">
                <CardHeader>
                  <CardTitle className="line-clamp-2">{course.title}</CardTitle>
                </CardHeader>
                <CardContent className="mt-auto pt-4 flex flex-col gap-4 border-t border-border/50">
                  <div className="text-sm font-medium">
                    Progress: {progress}% ({completedModules}/{totalModules} modules)
                  </div>
                  <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                    <div className="bg-primary h-full transition-all duration-500" style={{ width: `${progress}%` }} />
                  </div>
                  <Link href={`/${schoolSlug}/courses/${course.id}`} className="mt-2 inline-flex w-full items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
                    Continue Learning
                  </Link>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  );
}
