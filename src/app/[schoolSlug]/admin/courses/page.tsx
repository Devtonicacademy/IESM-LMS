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
    deleteDoc,
    query,
    orderBy,
    updateDoc,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Search,
    PlusCircle,
    MoreHorizontal,
    Edit,
    Trash2,
    Book,
    Users,
    UserCheck,
} from "lucide-react";
import Link from "next/link";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Course {
    id: string;
    title: string;
    description: string;
    instructorId: string;
    modules?: any[];
    enrolledStudents?: string[];
    createdAt?: any;
}

export default function AdminCoursesPage({ params }: { params: Promise<{ schoolSlug: string }> }) {
    const { schoolSlug } = use(params);
    const { user, loading, isAdmin, isInstructor } = useAuth();
    const router = useRouter();

    const [courses, setCourses] = useState<Course[]>([]);
    const [loadingCourses, setLoadingCourses] = useState(true);
    const [search, setSearch] = useState("");
    const [deleteTarget, setDeleteTarget] = useState<Course | null>(null);
    const [enrollTarget, setEnrollTarget] = useState<Course | null>(null);
    const [instructorTarget, setInstructorTarget] = useState<Course | null>(null);
    const [students, setStudents] = useState<any[]>([]);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [studentSearch, setStudentSearch] = useState("");
    const [instructors, setInstructors] = useState<any[]>([]);
    const [loadingInstructors, setLoadingInstructors] = useState(false);
    const [instructorSearch, setInstructorSearch] = useState("");

    useEffect(() => {
        if (!loading && !user) router.push(`/${schoolSlug}/auth/login`);
        if (!loading && user && !isAdmin && !isInstructor) router.push(`/${schoolSlug}/dashboard`);
    }, [loading, user, isAdmin, isInstructor, router, schoolSlug]);

    useEffect(() => {
        if (!isAdmin && !isInstructor) return;
        const q = query(
            collection(db, "schools", schoolSlug, "courses"),
            orderBy("createdAt", "desc")
        );
        const unsub = onSnapshot(
            q,
            (snap) => {
                setCourses(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Course, "id">) })));
                setLoadingCourses(false);
            },
            (err) => {
                console.error(err);
                setLoadingCourses(false);
            }
        );
        return () => unsub();
    }, [schoolSlug, isAdmin, isInstructor]);

    useEffect(() => {
        if (enrollTarget) {
            setLoadingStudents(true);
            const q = query(collection(db, "schools", schoolSlug, "users"));
            const unsub = onSnapshot(q, (snap) => {
                const allUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                setStudents(allUsers.filter((u: any) => u.role === "student" || !u.role));
                setLoadingStudents(false);
            });
            return () => unsub();
        }
    }, [enrollTarget, schoolSlug]);

    useEffect(() => {
        if (instructorTarget) {
            setLoadingInstructors(true);
            const q = query(collection(db, "schools", schoolSlug, "users"));
            const unsub = onSnapshot(q, (snap) => {
                const allUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                setInstructors(allUsers.filter((u: any) => u.role === "instructor"));
                setLoadingInstructors(false);
            });
            return () => unsub();
        }
    }, [instructorTarget, schoolSlug]);

    const filtered = courses.filter((c) =>
        c.title.toLowerCase().includes(search.toLowerCase())
    );

    async function handleDelete() {
        if (!deleteTarget) return;
        try {
            await deleteDoc(doc(db, "schools", schoolSlug, "courses", deleteTarget.id));
            toast.success("Course deleted successfully.");
            setDeleteTarget(null);
        } catch (err) {
            console.error(err);
            toast.error("Failed to delete course.");
        }
    }

    async function toggleEnrollment(studentId: string, isEnrolled: boolean) {
        if (!enrollTarget) return;
        try {
            const courseRef = doc(db, "schools", schoolSlug, "courses", enrollTarget.id);
            const newEnrolled = isEnrolled
                ? (enrollTarget.enrolledStudents || []).filter(id => id !== studentId)
                : [...(enrollTarget.enrolledStudents || []), studentId];

            await updateDoc(courseRef, { enrolledStudents: newEnrolled });
            setEnrollTarget({ ...enrollTarget, enrolledStudents: newEnrolled });
            toast.success(isEnrolled ? "Student removed" : "Student enrolled");
        } catch (err) {
            console.error(err);
            toast.error("Action failed");
        }
    }

    async function setCourseInstructor(instructorId: string | null) {
        if (!instructorTarget) return;
        try {
            const courseRef = doc(db, "schools", schoolSlug, "courses", instructorTarget.id);
            await updateDoc(courseRef, { instructorId: instructorId || "" });
            setInstructorTarget({ ...instructorTarget, instructorId: instructorId || "" });
            toast.success(instructorId ? "Instructor assigned" : "Instructor removed");
        } catch (err) {
            console.error(err);
            toast.error("Failed to assign instructor");
        }
    }

    if (loading || (!user && !loading)) {
        return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
    }

    const filteredStudents = students.filter(s =>
        (s.displayName || s.email || "").toLowerCase().includes(studentSearch.toLowerCase())
    );
    const filteredInstructors = instructors.filter(i => 
        (i.displayName || i.email || "").toLowerCase().includes(instructorSearch.toLowerCase())
    );

    return (
        <div className="flex flex-col flex-1 w-full">
            <DashboardTopbar breadcrumb="Courses / Manage Courses" />

            <div className="p-8 max-w-7xl mx-auto w-full space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Manage Courses</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Create, edit, and manage all courses in your school.
                        </p>
                    </div>
                    <Link
                        href={`/${schoolSlug}/admin/courses/new`}
                        className="inline-flex items-center justify-center rounded-xl text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 gap-2"
                    >
                        <PlusCircle className="h-4 w-4" />
                        Add Course
                    </Link>
                </div>

                <Card className="border-border/50 shadow-sm">
                    <CardHeader className="pb-4 flex flex-col sm:flex-row sm:items-center gap-4">
                        <CardTitle className="text-base font-semibold flex-1">
                            All Courses <span className="font-normal text-muted-foreground text-sm ml-1">({filtered.length})</span>
                        </CardTitle>
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Search courses..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9 rounded-xl bg-muted/50 border-transparent focus-visible:bg-background h-9"
                            />
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {loadingCourses ? (
                            <div className="py-16 text-center text-muted-foreground">Loading courses...</div>
                        ) : filtered.length === 0 ? (
                            <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
                                <Book className="h-8 w-8 opacity-40" />
                                <p className="font-medium">No courses found</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/30">
                                            <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Title</th>
                                            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Modules</th>
                                            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Enrolled</th>
                                            <th className="px-4 py-3" />
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/50">
                                        {filtered.map((course) => (
                                            <tr key={course.id} className="hover:bg-muted/30 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <p className="font-medium truncate max-w-sm">{course.title}</p>
                                                    <p className="text-xs text-muted-foreground truncate max-w-sm">{course.description}</p>
                                                </td>
                                                <td className="px-4 py-4 text-muted-foreground">
                                                    {course.modules?.length || 0} modules
                                                </td>
                                                <td className="px-4 py-4 text-muted-foreground">
                                                    {course.enrolledStudents?.length || 0} students
                                                </td>
                                                <td className="px-4 py-4">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent focus:outline-none">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-40">
                                                            <DropdownMenuItem
                                                                onClick={() => router.push(`/${schoolSlug}/admin/courses/${course.id}/edit`)}
                                                                className="cursor-pointer flex items-center gap-2"
                                                            >
                                                                <Edit className="h-4 w-4" />
                                                                Edit Course
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                onClick={() => setEnrollTarget(course)}
                                                                className="cursor-pointer flex items-center gap-2"
                                                            >
                                                                <Users className="h-4 w-4" />
                                                                Enroll Students
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                onClick={() => setInstructorTarget(course)}
                                                                className="cursor-pointer flex items-center gap-2"
                                                            >
                                                                <UserCheck className="h-4 w-4" />
                                                                Assign Instructor
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                onClick={() => setDeleteTarget(course)}
                                                                className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer flex items-center gap-2"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                                Delete
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Enroll Dialog */}
            <Dialog open={!!enrollTarget} onOpenChange={(o) => !o && setEnrollTarget(null)}>
                <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col p-0">
                    <DialogHeader className="p-6 pb-0">
                        <DialogTitle>Enroll Students</DialogTitle>
                        <DialogDescription>
                            Manage students for <span className="font-medium text-foreground">{enrollTarget?.title}</span>
                        </DialogDescription>
                        <div className="relative mt-4">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Search students..."
                                value={studentSearch}
                                onChange={(e) => setStudentSearch(e.target.value)}
                                className="pl-9 rounded-xl h-10"
                            />
                        </div>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto p-6 space-y-2">
                        {loadingStudents ? (
                            <p className="text-center text-sm text-muted-foreground py-4">Loading students...</p>
                        ) : filteredStudents.length === 0 ? (
                            <p className="text-center text-sm text-muted-foreground py-4">No students found.</p>
                        ) : (
                            filteredStudents.map((s) => {
                                const isEnrolled = enrollTarget?.enrolledStudents?.includes(s.id);
                                return (
                                    <div key={s.id} className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-muted/20">
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium truncate">{s.displayName || "Unknown User"}</p>
                                            <p className="text-xs text-muted-foreground truncate">{s.email}</p>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant={isEnrolled ? "outline" : "default"}
                                            className="rounded-lg h-8"
                                            onClick={() => toggleEnrollment(s.id, !!isEnrolled)}
                                        >
                                            {isEnrolled ? "Remove" : "Enroll"}
                                        </Button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Assign Instructor Dialog */}
            <Dialog open={!!instructorTarget} onOpenChange={(o) => !o && setInstructorTarget(null)}>
                <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col p-0">
                    <DialogHeader className="p-6 pb-0">
                        <DialogTitle>Assign Instructor</DialogTitle>
                        <DialogDescription>
                            Select an instructor for <span className="font-medium text-foreground">{instructorTarget?.title}</span>
                        </DialogDescription>
                        <div className="relative mt-4">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Search instructors..."
                                value={instructorSearch}
                                onChange={(e) => setInstructorSearch(e.target.value)}
                                className="pl-9 rounded-xl h-10"
                            />
                        </div>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto p-6 space-y-2">
                        {loadingInstructors ? (
                            <p className="text-center text-sm text-muted-foreground py-4">Loading instructors...</p>
                        ) : filteredInstructors.length === 0 ? (
                            <p className="text-center text-sm text-muted-foreground py-4">No instructors found.</p>
                        ) : (
                            <div className="space-y-4">
                                {instructorTarget?.instructorId && (
                                    <div className="flex justify-end border-b border-border/50 pb-4">
                                        <Button variant="outline" size="sm" onClick={() => setCourseInstructor(null)} className="text-destructive h-8">
                                            Remove Current Instructor
                                        </Button>
                                    </div>
                                )}
                                {filteredInstructors.map((instructor) => {
                                    const isAssigned = instructorTarget?.instructorId === instructor.id;
                                    return (
                                        <div key={instructor.id} className={cn("flex items-center justify-between p-3 rounded-xl border transition-colors", isAssigned ? "border-primary bg-primary/5" : "border-border/50 bg-muted/20")}>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium truncate">{instructor.displayName || "Unknown User"}</p>
                                                <p className="text-xs text-muted-foreground truncate">{instructor.email}</p>
                                                {isAssigned && <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-semibold uppercase tracking-wider">Assigned</span>}
                                            </div>
                                            {!isAssigned && (
                                                <Button
                                                    size="sm"
                                                    variant="default"
                                                    className="rounded-lg h-8 px-4 ml-3"
                                                    onClick={() => setCourseInstructor(instructor.id)}
                                                >
                                                    Assign
                                                </Button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Delete Course</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete <span className="font-medium text-foreground">{deleteTarget?.title}</span>? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setDeleteTarget(null)} className="rounded-xl">Cancel</Button>
                        <Button variant="destructive" onClick={handleDelete} className="rounded-xl">Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
