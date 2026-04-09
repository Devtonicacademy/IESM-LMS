"use client";

import { use, useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Users,
  BookMarked,
  ArrowLeft,
  Pencil,
  Check,
  X,
  Star,
  UserPlus,
  ClipboardList,
  Award,
  GraduationCap,
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardTopbar } from "@/components/dashboard-topbar";

interface StudentInfo {
  uid: string;
  displayName: string;
  email: string;
}

interface GroupMember {
  uid: string;
  displayName: string;
}

interface ExerciseGroup {
  id: string;
  name: string; // e.g. "Group A"
  members: GroupMember[];
  score?: number;    // group score set by instructor
  feedback?: string; // optional feedback
  gradedAt?: string;
  gradedBy?: string;
}

interface Exercise {
  id: string;
  title: string;
  description: string;
  dueDate?: string;
  maxScore: number;
  isGroupWork: boolean;
  groups: ExerciseGroup[];
  individualScores?: Record<string, { score: number; feedback?: string; gradedAt?: string }>;
  createdAt?: any;
}

export default function ExercisesPage({
  params,
}: {
  params: Promise<{ schoolSlug: string; courseId: string }>;
}) {
  const { schoolSlug, courseId } = use(params);
  const { user, isAdmin, isInstructor, isStudent } = useAuth();
  const canManage = isAdmin || isInstructor;

  const [course, setCourse] = useState<any>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [enrolledStudents, setEnrolledStudents] = useState<StudentInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);
  const [showGroupManager, setShowGroupManager] = useState<string | null>(null); // exerciseId
  const [gradingExercise, setGradingExercise] = useState<string | null>(null); // exerciseId

  // Form state
  const [form, setForm] = useState({
    title: "",
    description: "",
    dueDate: "",
    maxScore: 100,
    isGroupWork: false,
  });

  // Group manager state
  const [newGroupName, setNewGroupName] = useState("");
  const [memberSelections, setMemberSelections] = useState<Record<string, string[]>>({});

  // Grading state
  const [groupScores, setGroupScores] = useState<Record<string, { score: string; feedback: string }>>({});
  const [individualScores, setIndividualScores] = useState<Record<string, { score: string; feedback: string }>>({});

  useEffect(() => {
    async function load() {
      try {
        // Load course info
        const courseSnap = await getDoc(doc(db, "schools", schoolSlug, "courses", courseId));
        if (courseSnap.exists()) {
          const courseData = { id: courseSnap.id, ...courseSnap.data() } as any;
          setCourse(courseData);

          // Load enrolled students
          if (courseData.enrolledStudents?.length > 0) {
            const students: StudentInfo[] = [];
            for (const uid of courseData.enrolledStudents) {
              const userSnap = await getDoc(doc(db, "schools", schoolSlug, "users", uid));
              if (userSnap.exists()) {
                const d = userSnap.data();
                students.push({ uid, displayName: d.displayName || d.email || uid, email: d.email || "" });
              }
            }
            setEnrolledStudents(students);
          }
        }

        // Load exercises
        const exercisesSnap = await getDocs(
          query(collection(db, "schools", schoolSlug, "courses", courseId, "exercises"), orderBy("createdAt", "desc"))
        );
        const exList = exercisesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Exercise));
        setExercises(exList);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load exercises");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [schoolSlug, courseId]);

  // ── Create Exercise ────────────────────────────────────────────────────────
  const handleCreateExercise = async () => {
    if (!form.title.trim()) { toast.error("Exercise title is required"); return; }
    try {
      const data = {
        title: form.title.trim(),
        description: form.description.trim(),
        dueDate: form.dueDate || undefined,
        maxScore: Number(form.maxScore) || 100,
        isGroupWork: form.isGroupWork,
        groups: [],
        individualScores: {},
        createdAt: serverTimestamp(),
        createdBy: user?.uid,
      };
      const ref = await addDoc(
        collection(db, "schools", schoolSlug, "courses", courseId, "exercises"),
        data
      );
      const newEx: Exercise = { id: ref.id, ...data, groups: [] };
      setExercises((prev) => [newEx, ...prev]);
      setForm({ title: "", description: "", dueDate: "", maxScore: 100, isGroupWork: false });
      setShowCreateForm(false);
      toast.success("Exercise created!");
    } catch (err: any) {
      toast.error(err.message || "Failed to create exercise");
    }
  };

  // ── Delete Exercise ────────────────────────────────────────────────────────
  const handleDeleteExercise = async (exerciseId: string) => {
    if (!confirm("Delete this exercise? This cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, "schools", schoolSlug, "courses", courseId, "exercises", exerciseId));
      setExercises((prev) => prev.filter((e) => e.id !== exerciseId));
      toast.success("Exercise deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete exercise");
    }
  };

  // ── Add Group ──────────────────────────────────────────────────────────────
  const handleAddGroup = async (exerciseId: string) => {
    if (!newGroupName.trim()) { toast.error("Group name is required"); return; }
    const ex = exercises.find((e) => e.id === exerciseId);
    if (!ex) return;
    if (ex.groups.some((g) => g.name.toLowerCase() === newGroupName.trim().toLowerCase())) {
      toast.error("A group with that name already exists");
      return;
    }
    const newGroup: ExerciseGroup = { id: crypto.randomUUID(), name: newGroupName.trim(), members: [] };
    const updatedGroups = [...ex.groups, newGroup];
    try {
      await updateDoc(doc(db, "schools", schoolSlug, "courses", courseId, "exercises", exerciseId), {
        groups: updatedGroups,
      });
      setExercises((prev) => prev.map((e) => e.id === exerciseId ? { ...e, groups: updatedGroups } : e));
      setNewGroupName("");
      toast.success(`${newGroup.name} added!`);
    } catch (err: any) {
      toast.error(err.message || "Failed to add group");
    }
  };

  // ── Delete Group ───────────────────────────────────────────────────────────
  const handleDeleteGroup = async (exerciseId: string, groupId: string) => {
    if (!confirm("Remove this group?")) return;
    const ex = exercises.find((e) => e.id === exerciseId);
    if (!ex) return;
    const updatedGroups = ex.groups.filter((g) => g.id !== groupId);
    try {
      await updateDoc(doc(db, "schools", schoolSlug, "courses", courseId, "exercises", exerciseId), {
        groups: updatedGroups,
      });
      setExercises((prev) => prev.map((e) => e.id === exerciseId ? { ...e, groups: updatedGroups } : e));
      toast.success("Group removed");
    } catch (err: any) {
      toast.error(err.message || "Failed to remove group");
    }
  };

  // ── Assign Members to Group ────────────────────────────────────────────────
  const handleSaveGroupMembers = async (exerciseId: string, groupId: string) => {
    const ex = exercises.find((e) => e.id === exerciseId);
    if (!ex) return;
    const selected = memberSelections[groupId] || [];
    const updatedGroups = ex.groups.map((g) => {
      if (g.id !== groupId) return g;
      return {
        ...g,
        members: selected.map((uid) => {
          const s = enrolledStudents.find((st) => st.uid === uid);
          return { uid, displayName: s?.displayName || uid };
        }),
      };
    });
    try {
      await updateDoc(doc(db, "schools", schoolSlug, "courses", courseId, "exercises", exerciseId), {
        groups: updatedGroups,
      });
      setExercises((prev) => prev.map((e) => e.id === exerciseId ? { ...e, groups: updatedGroups } : e));
      toast.success("Group members updated!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update members");
    }
  };

  // ── Grade Groups ───────────────────────────────────────────────────────────
  const handleSaveGroupGrades = async (exerciseId: string) => {
    const ex = exercises.find((e) => e.id === exerciseId);
    if (!ex) return;
    const updatedGroups = ex.groups.map((g) => {
      const scoreData = groupScores[g.id];
      if (!scoreData || scoreData.score === "") return g;
      return {
        ...g,
        score: Number(scoreData.score),
        feedback: scoreData.feedback || "",
        gradedAt: new Date().toISOString(),
        gradedBy: user?.displayName || user?.email || "Instructor",
      };
    });
    try {
      await updateDoc(doc(db, "schools", schoolSlug, "courses", courseId, "exercises", exerciseId), {
        groups: updatedGroups,
      });
      setExercises((prev) => prev.map((e) => e.id === exerciseId ? { ...e, groups: updatedGroups } : e));
      setGradingExercise(null);
      setGroupScores({});
      toast.success("Grades saved! All group members have been graded.");
    } catch (err: any) {
      toast.error(err.message || "Failed to save grades");
    }
  };

  // ── Grade Individuals ──────────────────────────────────────────────────────
  const handleSaveIndividualGrades = async (exerciseId: string) => {
    const ex = exercises.find((e) => e.id === exerciseId);
    if (!ex) return;
    const updatedScores: Record<string, any> = { ...(ex.individualScores || {}) };
    for (const [uid, data] of Object.entries(individualScores)) {
      if (data.score !== "") {
        updatedScores[uid] = {
          score: Number(data.score),
          feedback: data.feedback || "",
          gradedAt: new Date().toISOString(),
          gradedBy: user?.displayName || user?.email || "Instructor",
        };
      }
    }
    try {
      await updateDoc(doc(db, "schools", schoolSlug, "courses", courseId, "exercises", exerciseId), {
        individualScores: updatedScores,
      });
      setExercises((prev) => prev.map((e) => e.id === exerciseId ? { ...e, individualScores: updatedScores } : e));
      setGradingExercise(null);
      setIndividualScores({});
      toast.success("Individual grades saved!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save grades");
    }
  };

  // ── Helper: get student's grade for an exercise ────────────────────────────
  const getStudentGrade = (exercise: Exercise, uid: string) => {
    if (exercise.isGroupWork) {
      const group = exercise.groups.find((g) => g.members.some((m) => m.uid === uid));
      if (group) return { groupName: group.name, score: group.score, feedback: group.feedback };
      return null;
    } else {
      const score = exercise.individualScores?.[uid];
      if (score !== undefined) return { score: (score as any).score, feedback: (score as any).feedback };
      return null;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col flex-1 w-full">
        <DashboardTopbar breadcrumb={`Course / Exercises`} />
        <div className="p-8 flex justify-center">
          <p className="text-muted-foreground animate-pulse">Loading exercises...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 w-full">
      <DashboardTopbar breadcrumb={`${course?.title || "Course"} / Exercises`} />
      <div className="p-6 md:p-8 max-w-5xl mx-auto w-full space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href={`/${schoolSlug}/courses/${courseId}`}>
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Back to Course
            </Button>
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg">
                <ClipboardList className="h-5 w-5 text-white" />
              </div>
              Exercises
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {canManage ? "Manage exercises, groups, and student grades" : "View your assigned exercises and scores"}
            </p>
          </div>
          {canManage && (
            <Button
              onClick={() => setShowCreateForm((v) => !v)}
              className="gap-2 bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 text-white shadow-md border-0"
            >
              <Plus className="h-4 w-4" />
              New Exercise
            </Button>
          )}
        </div>

        {/* ── Create Exercise Form ── */}
        <AnimatePresence>
          {showCreateForm && canManage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <Card className="border-violet-500/30 bg-violet-500/5 shadow-lg">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BookMarked className="h-5 w-5 text-violet-500" />
                    Create New Exercise
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Exercise Title *</Label>
                      <Input
                        value={form.title}
                        onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                        placeholder="e.g. Case Study Analysis"
                        className="h-11 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Due Date (optional)</Label>
                      <Input
                        type="datetime-local"
                        value={form.dueDate}
                        onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                        className="h-11 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Description / Instructions</Label>
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="Describe the exercise task..."
                      rows={3}
                      className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Maximum Score</Label>
                      <Input
                        type="number"
                        value={form.maxScore}
                        onChange={(e) => setForm((f) => ({ ...f, maxScore: Number(e.target.value) }))}
                        className="h-11 rounded-xl"
                        min={1}
                        max={1000}
                      />
                    </div>
                    <div className="flex items-end pb-1 gap-3">
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, isGroupWork: !f.isGroupWork }))}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-all text-sm font-medium ${
                          form.isGroupWork
                            ? "border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-400"
                            : "border-border/50 text-muted-foreground hover:border-violet-500/50"
                        }`}
                      >
                        <Users className="h-4 w-4" />
                        {form.isGroupWork ? "✓ Group Work" : "Individual Work"}
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button onClick={handleCreateExercise} className="gap-2 bg-gradient-to-r from-violet-500 to-indigo-600 text-white border-0">
                      <Check className="h-4 w-4" />
                      Create Exercise
                    </Button>
                    <Button variant="outline" onClick={() => setShowCreateForm(false)} className="gap-2">
                      <X className="h-4 w-4" />
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Exercise List ── */}
        {exercises.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed rounded-2xl bg-muted/5">
            <ClipboardList className="h-14 w-14 text-muted-foreground/30 mb-4" />
            <p className="font-semibold text-muted-foreground">No exercises yet</p>
            {canManage && (
              <p className="text-sm text-muted-foreground/70 mt-1">Click "New Exercise" to create the first one</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {exercises.map((exercise) => {
              const myGrade = user ? getStudentGrade(exercise, user.uid) : null;
              const isExpanded = expandedExerciseId === exercise.id;

              return (
                <motion.div
                  key={exercise.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card className={`overflow-hidden border transition-shadow hover:shadow-md ${isExpanded ? "shadow-md border-violet-500/30" : ""}`}>
                    {/* Exercise Header */}
                    <div
                      className="flex items-center justify-between p-5 cursor-pointer select-none"
                      onClick={() => setExpandedExerciseId(isExpanded ? null : exercise.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${exercise.isGroupWork ? "bg-blue-500/10 text-blue-500" : "bg-violet-500/10 text-violet-500"}`}>
                          {exercise.isGroupWork ? <Users className="h-5 w-5" /> : <GraduationCap className="h-5 w-5" />}
                        </div>
                        <div>
                          <h3 className="font-bold text-base">{exercise.title}</h3>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${exercise.isGroupWork ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" : "bg-violet-500/10 text-violet-600 dark:text-violet-400"}`}>
                              {exercise.isGroupWork ? "Group Work" : "Individual"}
                            </span>
                            <span className="text-xs text-muted-foreground">Max: {exercise.maxScore} pts</span>
                            {exercise.dueDate && (
                              <span className="text-xs text-muted-foreground">
                                Due: {new Date(exercise.dueDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Student score badge */}
                        {isStudent && myGrade && (myGrade as any).score !== undefined && (
                          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 text-sm font-bold">
                            <Award className="h-4 w-4" />
                            {(myGrade as any).score}/{exercise.maxScore}
                          </div>
                        )}
                        {isExpanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                      </div>
                    </div>

                    {/* Expanded Content */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 pb-6 border-t border-border/50 space-y-6 pt-5">
                            {/* Description */}
                            {exercise.description && (
                              <div className="text-sm text-muted-foreground bg-muted/30 rounded-xl p-4">
                                <p className="font-medium text-foreground mb-1">Instructions</p>
                                <p className="whitespace-pre-wrap">{exercise.description}</p>
                              </div>
                            )}

                            {/* ── STUDENT VIEW: My Grade ── */}
                            {isStudent && (
                              <div>
                                <h4 className="font-semibold mb-3 flex items-center gap-2">
                                  <Star className="h-4 w-4 text-yellow-500" />
                                  My Grade
                                </h4>
                                {myGrade ? (
                                  <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                                    {exercise.isGroupWork && (myGrade as any).groupName && (
                                      <p className="text-sm text-muted-foreground mb-1">Group: <span className="font-semibold text-foreground">{(myGrade as any).groupName}</span></p>
                                    )}
                                    {(myGrade as any).score !== undefined ? (
                                      <div className="flex items-center gap-3">
                                        <div className="text-3xl font-extrabold text-green-600 dark:text-green-400">
                                          {(myGrade as any).score}
                                          <span className="text-lg text-muted-foreground font-normal">/{exercise.maxScore}</span>
                                        </div>
                                        <div className="text-sm px-2 py-1 rounded-lg bg-green-500/20 text-green-700 dark:text-green-400 font-medium">
                                          {Math.round(((myGrade as any).score / exercise.maxScore) * 100)}%
                                        </div>
                                      </div>
                                    ) : (
                                      <p className="text-sm text-muted-foreground">You are in this group but no grade has been assigned yet.</p>
                                    )}
                                    {(myGrade as any).feedback && (
                                      <p className="text-sm text-muted-foreground mt-2 italic">"{(myGrade as any).feedback}"</p>
                                    )}
                                  </div>
                                ) : (
                                  <div className="bg-muted/30 border border-dashed border-border rounded-xl p-4 text-center text-muted-foreground text-sm">
                                    {exercise.isGroupWork
                                      ? "You have not been assigned to a group yet."
                                      : "Your grade has not been recorded yet."}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* ── ADMIN/INSTRUCTOR VIEW ── */}
                            {canManage && (
                              <div className="space-y-5">
                                {exercise.isGroupWork && (
                                  <>
                                    {/* Groups Overview */}
                                    <div>
                                      <div className="flex items-center justify-between mb-3">
                                        <h4 className="font-semibold flex items-center gap-2">
                                          <Users className="h-4 w-4 text-blue-500" />
                                          Groups ({exercise.groups.length})
                                        </h4>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="gap-2 text-xs"
                                          onClick={() => setShowGroupManager(showGroupManager === exercise.id ? null : exercise.id)}
                                        >
                                          <UserPlus className="h-3 w-3" />
                                          Manage Groups
                                        </Button>
                                      </div>

                                      {/* Group cards */}
                                      {exercise.groups.length === 0 ? (
                                        <p className="text-sm text-muted-foreground italic">No groups yet. Click "Manage Groups" to add some.</p>
                                      ) : (
                                        <div className="grid sm:grid-cols-2 gap-3">
                                          {exercise.groups.map((group) => (
                                            <div key={group.id} className="p-3 border border-border/50 rounded-xl bg-muted/20 space-y-2">
                                              <div className="flex items-center justify-between">
                                                <span className="font-semibold text-sm">{group.name}</span>
                                                {group.score !== undefined && (
                                                  <span className="text-xs font-bold text-green-600 dark:text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
                                                    {group.score}/{exercise.maxScore}
                                                  </span>
                                                )}
                                              </div>
                                              {group.members.length === 0 ? (
                                                <p className="text-xs text-muted-foreground italic">No members assigned</p>
                                              ) : (
                                                <div className="flex flex-wrap gap-1">
                                                  {group.members.map((m) => (
                                                    <span key={m.uid} className="text-xs bg-background border border-border/50 rounded-full px-2 py-0.5">
                                                      {m.displayName}
                                                    </span>
                                                  ))}
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      )}

                                      {/* Group Manager Panel */}
                                      <AnimatePresence>
                                        {showGroupManager === exercise.id && (
                                          <motion.div
                                            initial={{ opacity: 0, y: -5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -5 }}
                                            className="mt-4 p-4 border border-blue-500/30 bg-blue-500/5 rounded-xl space-y-4"
                                          >
                                            <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">Group Manager</p>

                                            {/* Add new group */}
                                            <div className="flex gap-2">
                                              <Input
                                                value={newGroupName}
                                                onChange={(e) => setNewGroupName(e.target.value)}
                                                placeholder='e.g. "Group A" or "Team Alpha"'
                                                className="h-9 rounded-lg text-sm"
                                                onKeyDown={(e) => e.key === "Enter" && handleAddGroup(exercise.id)}
                                              />
                                              <Button size="sm" onClick={() => handleAddGroup(exercise.id)} className="gap-1 shrink-0">
                                                <Plus className="h-3 w-3" /> Add
                                              </Button>
                                            </div>

                                            {/* Manage existing groups */}
                                            {exercise.groups.map((group) => {
                                              const initSelected = group.members.map((m) => m.uid);
                                              const selected = memberSelections[group.id] ?? initSelected;
                                              const toggleMember = (uid: string) => {
                                                setMemberSelections((prev) => {
                                                  const cur = prev[group.id] ?? initSelected;
                                                  return {
                                                    ...prev,
                                                    [group.id]: cur.includes(uid) ? cur.filter((u) => u !== uid) : [...cur, uid],
                                                  };
                                                });
                                              };
                                              return (
                                                <div key={group.id} className="p-3 bg-background rounded-lg border border-border/50 space-y-2">
                                                  <div className="flex items-center justify-between">
                                                    <span className="font-semibold text-sm">{group.name}</span>
                                                    <button
                                                      onClick={() => handleDeleteGroup(exercise.id, group.id)}
                                                      className="text-destructive hover:text-destructive/80 transition-colors"
                                                    >
                                                      <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                  </div>
                                                  <div className="flex flex-wrap gap-1.5">
                                                    {enrolledStudents.length === 0 && (
                                                      <p className="text-xs text-muted-foreground italic">No enrolled students</p>
                                                    )}
                                                    {enrolledStudents.map((s) => {
                                                      const isSelected = selected.includes(s.uid);
                                                      return (
                                                        <button
                                                          key={s.uid}
                                                          onClick={() => toggleMember(s.uid)}
                                                          className={`text-xs px-2 py-1 rounded-full border transition-all ${isSelected ? "bg-blue-500/15 border-blue-500/40 text-blue-600 dark:text-blue-400 font-medium" : "bg-muted/20 border-border/50 text-muted-foreground hover:border-blue-500/30"}`}
                                                        >
                                                          {isSelected && "✓ "}{s.displayName}
                                                        </button>
                                                      );
                                                    })}
                                                  </div>
                                                  <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="text-xs h-7 gap-1"
                                                    onClick={() => handleSaveGroupMembers(exercise.id, group.id)}
                                                  >
                                                    <Check className="h-3 w-3" /> Save Members
                                                  </Button>
                                                </div>
                                              );
                                            })}
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </div>
                                  </>
                                )}

                                {/* Grading Panel */}
                                <div>
                                  <div className="flex items-center justify-between mb-3">
                                    <h4 className="font-semibold flex items-center gap-2">
                                      <Award className="h-4 w-4 text-yellow-500" />
                                      {exercise.isGroupWork ? "Grade Groups" : "Grade Students"}
                                    </h4>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="gap-2 text-xs"
                                      onClick={() => {
                                        if (gradingExercise === exercise.id) {
                                          setGradingExercise(null);
                                        } else {
                                          setGradingExercise(exercise.id);
                                          if (exercise.isGroupWork) {
                                            const initial: Record<string, { score: string; feedback: string }> = {};
                                            exercise.groups.forEach((g) => {
                                              initial[g.id] = { score: g.score !== undefined ? String(g.score) : "", feedback: g.feedback || "" };
                                            });
                                            setGroupScores(initial);
                                          } else {
                                            const initial: Record<string, { score: string; feedback: string }> = {};
                                            enrolledStudents.forEach((s) => {
                                              const ex = exercises.find((e) => e.id === exercise.id);
                                              const existing = ex?.individualScores?.[s.uid] as any;
                                              initial[s.uid] = { score: existing?.score !== undefined ? String(existing.score) : "", feedback: existing?.feedback || "" };
                                            });
                                            setIndividualScores(initial);
                                          }
                                        }
                                      }}
                                    >
                                      <Pencil className="h-3 w-3" />
                                      {gradingExercise === exercise.id ? "Cancel Grading" : "Open Grading"}
                                    </Button>
                                  </div>

                                  <AnimatePresence>
                                    {gradingExercise === exercise.id && (
                                      <motion.div
                                        initial={{ opacity: 0, y: -5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -5 }}
                                        className="p-4 border border-yellow-500/30 bg-yellow-500/5 rounded-xl space-y-4"
                                      >
                                        {exercise.isGroupWork ? (
                                          <>
                                            {exercise.groups.length === 0 && (
                                              <p className="text-sm text-muted-foreground italic text-center">Create groups first before grading.</p>
                                            )}
                                            {exercise.groups.map((group) => (
                                              <div key={group.id} className="p-3 bg-background rounded-lg border border-border/50 space-y-2">
                                                <div className="flex items-center justify-between">
                                                  <span className="font-semibold text-sm">{group.name}</span>
                                                  <span className="text-xs text-muted-foreground">{group.members.length} member(s)</span>
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                  Members: {group.members.map((m) => m.displayName).join(", ") || "None"}
                                                </p>
                                                <div className="grid sm:grid-cols-2 gap-2">
                                                  <div className="space-y-1">
                                                    <Label className="text-xs">Score (max {exercise.maxScore})</Label>
                                                    <Input
                                                      type="number"
                                                      min={0}
                                                      max={exercise.maxScore}
                                                      value={groupScores[group.id]?.score || ""}
                                                      onChange={(e) => setGroupScores((prev) => ({ ...prev, [group.id]: { ...prev[group.id], score: e.target.value } }))}
                                                      className="h-9 rounded-lg text-sm"
                                                      placeholder="0"
                                                    />
                                                  </div>
                                                  <div className="space-y-1">
                                                    <Label className="text-xs">Feedback (optional)</Label>
                                                    <Input
                                                      value={groupScores[group.id]?.feedback || ""}
                                                      onChange={(e) => setGroupScores((prev) => ({ ...prev, [group.id]: { ...prev[group.id], feedback: e.target.value } }))}
                                                      className="h-9 rounded-lg text-sm"
                                                      placeholder="Great work!"
                                                    />
                                                  </div>
                                                </div>
                                              </div>
                                            ))}
                                            {exercise.groups.length > 0 && (
                                              <Button
                                                onClick={() => handleSaveGroupGrades(exercise.id)}
                                                className="w-full gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-0"
                                              >
                                                <Check className="h-4 w-4" />
                                                Save All Group Grades
                                              </Button>
                                            )}
                                          </>
                                        ) : (
                                          <>
                                            {enrolledStudents.length === 0 && (
                                              <p className="text-sm text-muted-foreground italic text-center">No enrolled students found.</p>
                                            )}
                                            {enrolledStudents.map((student) => (
                                              <div key={student.uid} className="p-3 bg-background rounded-lg border border-border/50 space-y-2">
                                                <p className="font-semibold text-sm">{student.displayName}</p>
                                                <p className="text-xs text-muted-foreground">{student.email}</p>
                                                <div className="grid sm:grid-cols-2 gap-2">
                                                  <div className="space-y-1">
                                                    <Label className="text-xs">Score (max {exercise.maxScore})</Label>
                                                    <Input
                                                      type="number"
                                                      min={0}
                                                      max={exercise.maxScore}
                                                      value={individualScores[student.uid]?.score || ""}
                                                      onChange={(e) => setIndividualScores((prev) => ({ ...prev, [student.uid]: { ...prev[student.uid], score: e.target.value } }))}
                                                      className="h-9 rounded-lg text-sm"
                                                      placeholder="0"
                                                    />
                                                  </div>
                                                  <div className="space-y-1">
                                                    <Label className="text-xs">Feedback (optional)</Label>
                                                    <Input
                                                      value={individualScores[student.uid]?.feedback || ""}
                                                      onChange={(e) => setIndividualScores((prev) => ({ ...prev, [student.uid]: { ...prev[student.uid], feedback: e.target.value } }))}
                                                      className="h-9 rounded-lg text-sm"
                                                      placeholder="Good effort!"
                                                    />
                                                  </div>
                                                </div>
                                              </div>
                                            ))}
                                            {enrolledStudents.length > 0 && (
                                              <Button
                                                onClick={() => handleSaveIndividualGrades(exercise.id)}
                                                className="w-full gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-0"
                                              >
                                                <Check className="h-4 w-4" />
                                                Save All Individual Grades
                                              </Button>
                                            )}
                                          </>
                                        )}
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>

                                {/* All students grades summary */}
                                {exercise.isGroupWork && exercise.groups.some((g) => g.score !== undefined) && gradingExercise !== exercise.id && (
                                  <div className="space-y-2">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Grade Summary</p>
                                    <div className="grid sm:grid-cols-2 gap-2">
                                      {exercise.groups.filter((g) => g.score !== undefined).map((g) => (
                                        <div key={g.id} className="flex items-center justify-between px-3 py-2 bg-muted/30 rounded-lg text-sm">
                                          <span className="font-medium">{g.name}</span>
                                          <span className="font-bold text-green-600 dark:text-green-400">{g.score}/{exercise.maxScore}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {!exercise.isGroupWork && exercise.individualScores && Object.keys(exercise.individualScores).length > 0 && gradingExercise !== exercise.id && (
                                  <div className="space-y-2">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Grade Summary</p>
                                    <div className="grid sm:grid-cols-2 gap-2">
                                      {enrolledStudents.filter((s) => (exercise.individualScores as any)?.[s.uid] !== undefined).map((s) => {
                                        const grade = (exercise.individualScores as any)[s.uid];
                                        return (
                                          <div key={s.uid} className="flex items-center justify-between px-3 py-2 bg-muted/30 rounded-lg text-sm">
                                            <span className="font-medium">{s.displayName}</span>
                                            <span className="font-bold text-green-600 dark:text-green-400">{grade.score}/{exercise.maxScore}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* Delete button */}
                                <div className="pt-2 border-t border-border/50">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteExercise(exercise.id)}
                                    className="gap-2 text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Delete Exercise
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
