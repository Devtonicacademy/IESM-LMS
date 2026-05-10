"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { DashboardTopbar } from "@/components/dashboard-topbar";
import { auth, db } from "@/lib/firebase";
import {
    collection,
    onSnapshot,
    doc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    serverTimestamp,
    setDoc,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Users,
    Search,
    MoreHorizontal,
    UserPlus,
    GraduationCap,
    BookOpen,
    ShieldCheck,
    Trash2,
    RefreshCw,
    Crown,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── Types ─────────────────────────────────────────────────────────────────────
type Role = "super-admin" | "admin" | "instructor" | "student";

interface SchoolUser {
    id: string;
    email: string;
    displayName: string;
    role: Role;
    schoolId: string;
    createdAt?: { seconds: number } | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
const roleConfig: Record<
    Role,
    { label: string; color: string; icon: React.ElementType }
> = {
    "super-admin": {
        label: "Super Admin",
        color:
            "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800",
        icon: Crown,
    },
    admin: {
        label: "Admin",
        color:
            "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border-rose-200 dark:border-rose-800",
        icon: ShieldCheck,
    },
    instructor: {
        label: "Instructor",
        color:
            "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800",
        icon: BookOpen,
    },
    student: {
        label: "Student",
        color:
            "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
        icon: GraduationCap,
    },
};

const ROLES: Role[] = ["super-admin", "admin", "instructor", "student"];

function RoleBadge({ role }: { role: Role }) {
    const cfg = roleConfig[role] ?? roleConfig.student;
    const Icon = cfg.icon;
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
                cfg.color
            )}
        >
            <Icon className="h-3 w-3" />
            {cfg.label}
        </span>
    );
}

function formatDate(ts?: { seconds: number } | null) {
    if (!ts) return "—";
    return new Date(ts.seconds * 1000).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

// ─── Edit User Dialog ───────────────────────────────────────────────────────────
function EditUserDialog({
    user,
    schoolSlug,
    onClose,
}: {
    user: SchoolUser;
    schoolSlug: string;
    onClose: () => void;
}) {
    const [name, setName] = useState(user.displayName || "");
    const [email, setEmail] = useState(user.email || "");
    const [role, setRole] = useState<Role>(user.role || "student");
    const [joinedDate, setJoinedDate] = useState(
        user.createdAt ? new Date(user.createdAt.seconds * 1000).toISOString().split("T")[0] : ""
    );
    const [saving, setSaving] = useState(false);
    const [resetting, setResetting] = useState(false);
    const { isSuperAdmin } = useAuth();
    const availableRoles = isSuperAdmin ? ROLES : ROLES.filter(r => r !== "super-admin");

    async function handleUpdate() {
        if (!name.trim() || !email.trim()) {
            toast.error("Name and email are required.");
            return;
        }
        setSaving(true);
        try {
            const updateData: any = {
                displayName: name.trim(),
                email: email.trim().toLowerCase(),
                role,
            };

            if (joinedDate) {
                // Convert string date back to Firestore timestamp (simplified)
                const d = new Date(joinedDate);
                updateData.createdAt = { seconds: Math.floor(d.getTime() / 1000), nanoseconds: 0 };
            }

            await updateDoc(doc(db, "schools", schoolSlug, "users", user.id), updateData);
            toast.success("User updated successfully.");
            onClose();
        } catch (err) {
            console.error(err);
            toast.error("Failed to update user.");
        } finally {
            setSaving(false);
        }
    }

    async function handlePasswordReset() {
        if (!user.email) return;
        setResetting(true);
        try {
            const { sendPasswordResetEmail } = await import("firebase/auth");
            await sendPasswordResetEmail(auth, user.email);
            toast.success(`Password reset email sent to ${user.email}`);
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || "Failed to send reset email.");
        } finally {
            setResetting(false);
        }
    }

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Edit User Details</DialogTitle>
                    <DialogDescription>
                        Update name, email, and role for this user.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-muted-foreground">User ID (Read Only)</label>
                        <Input value={user.id} disabled className="bg-muted text-xs" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Full Name</label>
                        <Input
                            placeholder="Full Name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Email Address</label>
                        <Input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Role</label>
                        <div className="flex gap-2">
                            {availableRoles.map((r) => (
                                <button
                                    key={r}
                                    type="button"
                                    onClick={() => setRole(r)}
                                    className={cn(
                                        "flex-1 py-2 px-3 rounded-xl border text-sm font-medium transition-all",
                                        role === r
                                            ? "border-primary bg-primary/10 text-primary"
                                            : "border-border text-muted-foreground hover:border-primary/50"
                                    )}
                                >
                                    {r.charAt(0).toUpperCase() + r.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Date Joined</label>
                        <Input
                            type="date"
                            value={joinedDate}
                            onChange={(e) => setJoinedDate(e.target.value)}
                        />
                    </div>

                    <div className="pt-4 border-t">
                        <Button
                            variant="outline"
                            className="w-full justify-start gap-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-100"
                            onClick={handlePasswordReset}
                            disabled={resetting}
                        >
                            <RefreshCw className={cn("h-4 w-4", resetting && "animate-spin")} />
                            {resetting ? "Sending..." : "Send Password Reset Email"}
                        </Button>
                        <p className="text-[11px] text-muted-foreground mt-2 px-1">
                            This will send an email to the user with a link to set their own password securely.
                        </p>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} className="rounded-xl">
                        Cancel
                    </Button>
                    <Button
                        onClick={handleUpdate}
                        disabled={saving}
                        className="rounded-xl"
                    >
                        {saving ? "Saving..." : "Save Changes"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ─── Invite Dialog ─────────────────────────────────────────────────────────────
function InviteDialog({ schoolSlug }: { schoolSlug: string }) {
    const [open, setOpen] = useState(false);
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    const [role, setRole] = useState<Role>("student");
    const [saving, setSaving] = useState(false);
    const { isSuperAdmin } = useAuth();
    const availableRoles = isSuperAdmin ? ROLES : ROLES.filter(r => r !== "super-admin");

    async function handleInvite() {
        if (!email.trim() || !name.trim()) {
            toast.error("Name and email are required.");
            return;
        }
        setSaving(true);
        try {
            // Create a placeholder user doc (real auth created on first login)
            const placeholderId = `user_${Date.now()}_${Math.random()
                .toString(36)
                .slice(2, 8)}`;

            // For instructors: generate a token client-side and store it
            const inviteToken = role === "instructor"
                ? crypto.randomUUID()
                : null;
            const inviteTokenExpiresAt = inviteToken
                ? Date.now() + 7 * 24 * 60 * 60 * 1000
                : null;

            await setDoc(doc(db, "schools", schoolSlug, "users", placeholderId), {
                email: email.trim().toLowerCase(),
                displayName: name.trim(),
                role,
                schoolId: schoolSlug,
                invited: true,
                ...(inviteToken ? { inviteToken, inviteTokenExpiresAt } : {}),
                createdAt: serverTimestamp(),
            });

            // For instructors, send a personalised invite email with a signup link
            if (role === "instructor" && inviteToken) {
                try {
                    const res = await fetch("/api/send-invite", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            email: email.trim().toLowerCase(),
                            name: name.trim(),
                            schoolSlug,
                            token: inviteToken,
                        }),
                    });
                    if (res.ok) {
                        toast.success(`Invite email sent to ${name}.`);
                    } else {
                        toast.success(`${name} added as instructor.`);
                        toast.warning("Invite email could not be delivered — check server logs.");
                    }
                } catch (emailErr) {
                    console.error("Invite email error:", emailErr);
                    toast.success(`${name} added as instructor.`);
                    toast.warning("Invite email failed to send.");
                }
            } else {
                toast.success(`${name} added as ${role}.`);
            }

            setEmail("");
            setName("");
            setRole("student");
            setOpen(false);
        } catch (err) {
            console.error(err);
            toast.error("Failed to add user.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
                render={
                    <Button className="gap-2 rounded-xl" id="invite-user-btn">
                        <UserPlus className="h-4 w-4" />
                        Add User
                    </Button>
                }
            />
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Add a User</DialogTitle>
                    <DialogDescription>
                        Create a profile for a student, instructor, or admin.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Full Name *</label>
                        <Input
                            id="invite-name"
                            placeholder="e.g. Amaka Okafor"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Email Address *</label>
                        <Input
                            id="invite-email"
                            type="email"
                            placeholder="e.g. amaka@school.ng"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Role</label>
                        <div className="flex gap-2">
                            {availableRoles.map((r) => (
                                <button
                                    key={r}
                                    type="button"
                                    onClick={() => setRole(r)}
                                    className={cn(
                                        "flex-1 py-2 px-3 rounded-xl border text-sm font-medium transition-all",
                                        role === r
                                            ? "border-primary bg-primary/10 text-primary"
                                            : "border-border text-muted-foreground hover:border-primary/50"
                                    )}
                                >
                                    {r.charAt(0).toUpperCase() + r.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className={`p-3 rounded-xl border ${role === "instructor" ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50" : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50"}`}>
                        <p className={`text-[11px] leading-relaxed font-medium ${role === "instructor" ? "text-blue-800 dark:text-blue-300" : "text-amber-800 dark:text-amber-300"}`}>
                            {role === "instructor" ? (
                                <><strong>📧 Invite Email:</strong> An invitation email will be sent to this instructor with a secure link to create their password and confirm their name.</>
                            ) : (
                                <><strong>Note:</strong> Students and admins can sign in or use the registration page to set up their account.</>
                            )}
                        </p>
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => setOpen(false)}
                        className="rounded-xl"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleInvite}
                        disabled={saving}
                        className="rounded-xl"
                        id="confirm-invite-btn"
                    >
                        {saving ? "Adding..." : "Add User"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ─── Delete Confirm Dialog ─────────────────────────────────────────────────────
function DeleteDialog({
    user,
    schoolSlug,
    onClose,
}: {
    user: SchoolUser;
    schoolSlug: string;
    onClose: () => void;
}) {
    const [deleting, setDeleting] = useState(false);

    async function handleDelete() {
        setDeleting(true);
        try {
            // First, delete the user from Firebase Authentication
            const response = await fetch("/api/users/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ uid: user.id, email: user.email }),
            });

            const result = await response.json();
            
            if (!response.ok && result.error !== "Failed to delete from Auth") {
                throw new Error(result.error || "Failed to delete from Firebase Auth");
            }

            // Then, delete from Firestore
            await deleteDoc(doc(db, "schools", schoolSlug, "users", user.id));
            
            toast.success(`${user.displayName} removed.`);
            onClose();
        } catch (err) {
            console.error(err);
            toast.error("Failed to remove user.");
            setDeleting(false);
        }
    }

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>Remove User</DialogTitle>
                    <DialogDescription>
                        Are you sure you want to remove{" "}
                        <span className="font-medium text-foreground">
                            {user.displayName}
                        </span>{" "}
                        from this school? This cannot be undone.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={onClose} className="rounded-xl">
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={deleting}
                        className="rounded-xl"
                    >
                        {deleting ? "Removing..." : "Remove"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function UsersPage({
    params,
}: {
    params: Promise<{ schoolSlug: string }>;
}) {
    const { schoolSlug } = use(params);
    const { user: currentUser, loading: authLoading, isAdmin } = useAuth();
    const router = useRouter();

    const [users, setUsers] = useState<SchoolUser[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [search, setSearch] = useState("");
    const [filterRole, setFilterRole] = useState<Role | "all">("all");
    const [changingRole, setChangingRole] = useState<string | null>(null);
    const [editTarget, setEditTarget] = useState<SchoolUser | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<SchoolUser | null>(null);
    const [enrollTargetUser, setEnrollTargetUser] = useState<SchoolUser | null>(null);
    const [allCourses, setAllCourses] = useState<any[]>([]);
    const [loadingCourses, setLoadingCourses] = useState(false);

    // ── Auth guard ──────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!authLoading && !currentUser) {
            router.push(`/${schoolSlug}/auth/login`);
        }
        if (!authLoading && currentUser && !isAdmin) {
            router.push(`/${schoolSlug}/dashboard`);
        }
    }, [authLoading, currentUser, isAdmin, router, schoolSlug]);

    // ── Real-time Firestore listener ────────────────────────────────────────────
    useEffect(() => {
        if (!isAdmin) return;
        const q = query(
            collection(db, "schools", schoolSlug, "users"),
            orderBy("createdAt", "desc")
        );
        const unsub = onSnapshot(
            q,
            (snap) => {
                setUsers(
                    snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SchoolUser, "id">) }))
                );
                setLoadingUsers(false);
            },
            (err) => {
                console.error(err);
                setLoadingUsers(false);
            }
        );
        return () => unsub();
    }, [schoolSlug, isAdmin]);

    useEffect(() => {
        if (enrollTargetUser) {
            setLoadingCourses(true);
            const q = query(collection(db, "schools", schoolSlug, "courses"), orderBy("title"));
            const unsub = onSnapshot(q, (snap) => {
                setAllCourses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
                setLoadingCourses(false);
            });
            return () => unsub();
        }
    }, [enrollTargetUser, schoolSlug]);

    // ── Role change ─────────────────────────────────────────────────────────────
    async function handleRoleChange(userId: string, newRole: Role) {
        setChangingRole(userId);
        try {
            await updateDoc(doc(db, "schools", schoolSlug, "users", userId), {
                role: newRole,
            });
            toast.success("Role updated.");
        } catch (err) {
            console.error(err);
            toast.error("Failed to update role.");
        } finally {
            setChangingRole(null);
        }
    }

    async function toggleCourseEnrollment(courseId: string, isEnrolled: boolean) {
        if (!enrollTargetUser) return;
        try {
            const courseRef = doc(db, "schools", schoolSlug, "courses", courseId);
            const course = allCourses.find(c => c.id === courseId);
            const enrolled = course.enrolledStudents || [];
            const newEnrolled = isEnrolled
                ? enrolled.filter((id: string) => id !== enrollTargetUser.id)
                : [...enrolled, enrollTargetUser.id];

            await updateDoc(courseRef, { enrolledStudents: newEnrolled });
            toast.success(isEnrolled ? "Unenrolled" : "Enrolled");
        } catch (err) {
            console.error(err);
            toast.error("Failed to update enrollment");
        }
    }

    // ── Derived list ────────────────────────────────────────────────────────────
    const filtered = users.filter((u) => {
        const matchesRole = filterRole === "all" || u.role === filterRole;
        const q = search.toLowerCase();
        const matchesSearch =
            !q ||
            u.displayName?.toLowerCase().includes(q) ||
            u.email?.toLowerCase().includes(q);
        return matchesRole && matchesSearch;
    });

    const counts = {
        all: users.length,
        "super-admin": users.filter((u) => u.role === "super-admin").length,
        admin: users.filter((u) => u.role === "admin").length,
        instructor: users.filter((u) => u.role === "instructor").length,
        student: users.filter((u) => u.role === "student").length,
    };

    if (authLoading || (!currentUser && !authLoading)) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                Loading...
            </div>
        );
    }

    return (
        <div className="flex flex-col flex-1 w-full">
            <DashboardTopbar breadcrumb="Users / Manage Users" />

            <div className="p-8 max-w-7xl mx-auto w-full space-y-8">
                {/* ── Header ── */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Users</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Manage all students, instructors, and admins for this school.
                        </p>
                    </div>
                    <InviteDialog schoolSlug={schoolSlug} />
                </div>

                {/* ── Stat cards ── */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {(
                        [
                            { label: "Total Users", key: "all", icon: Users, color: "text-primary" },
                            { label: "Super Admins", key: "super-admin", icon: Crown, color: "text-amber-500" },
                            { label: "Admins", key: "admin", icon: ShieldCheck, color: "text-rose-500" },
                            { label: "Instructors", key: "instructor", icon: BookOpen, color: "text-blue-500" },
                            { label: "Students", key: "student", icon: GraduationCap, color: "text-emerald-500" },
                        ] as const
                    ).map(({ label, key, icon: Icon, color }) => (
                        <Card
                            key={key}
                            className={cn(
                                "cursor-pointer transition-all border-border/50 hover:shadow-md",
                                filterRole === key && "ring-2 ring-primary/40"
                            )}
                            onClick={() => setFilterRole(key)}
                        >
                            <CardContent className="p-5 flex items-center gap-4">
                                <div className="rounded-xl bg-muted p-2.5">
                                    <Icon className={cn("h-5 w-5", color)} />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{counts[key]}</p>
                                    <p className="text-xs text-muted-foreground">{label}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* ── Table card ── */}
                <Card className="border-border/50 shadow-sm">
                    <CardHeader className="pb-4 flex flex-col sm:flex-row sm:items-center gap-4">
                        <CardTitle className="text-base font-semibold flex-1">
                            {filterRole === "all"
                                ? "All Users"
                                : roleConfig[filterRole].label + "s"}{" "}
                            <span className="font-normal text-muted-foreground text-sm ml-1">
                                ({filtered.length})
                            </span>
                        </CardTitle>

                        <div className="flex items-center gap-3 flex-wrap">
                            {/* Search */}
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    id="user-search"
                                    placeholder="Search name or email…"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-9 rounded-xl bg-muted/50 border-transparent focus-visible:bg-background h-9"
                                />
                            </div>

                            {/* Role filter pills */}
                            <div className="hidden lg:flex items-center gap-1 bg-muted/50 p-1 rounded-xl">
                                {(["all", "super-admin", "admin", "instructor", "student"] as const).map(
                                    (r) => (
                                        <button
                                            key={r}
                                            onClick={() => setFilterRole(r)}
                                            className={cn(
                                                "px-3 h-7 text-xs font-medium rounded-lg transition-all",
                                                filterRole === r
                                                    ? "bg-background shadow-sm text-foreground"
                                                    : "text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            {r.charAt(0).toUpperCase() + r.slice(1)}
                                        </button>
                                    )
                                )}
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="p-0">
                        {loadingUsers ? (
                            <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
                                <RefreshCw className="h-6 w-6 animate-spin opacity-50" />
                                <p className="text-sm">Loading users…</p>
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
                                <div className="rounded-full bg-muted p-4">
                                    <Users className="h-8 w-8 opacity-40" />
                                </div>
                                <p className="font-medium">No users found</p>
                                <p className="text-sm">
                                    {search
                                        ? "Try a different search term."
                                        : "Add users with the button above."}
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/30">
                                            <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                                User
                                            </th>
                                            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">
                                                Email
                                            </th>
                                            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                                Role
                                            </th>
                                            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">
                                                Joined
                                            </th>
                                            <th className="px-4 py-3" />
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/50">
                                        {filtered.map((u) => {
                                            const initials = (u.displayName || u.email || "?")
                                                .split(" ")
                                                .map((w) => w[0])
                                                .slice(0, 2)
                                                .join("")
                                                .toUpperCase();

                                            return (
                                                <tr
                                                    key={u.id}
                                                    className="hover:bg-muted/30 transition-colors group"
                                                >
                                                    {/* Avatar + name */}
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <Avatar className="h-9 w-9 border shrink-0">
                                                                <AvatarImage
                                                                    src={`https://api.dicebear.com/7.x/notionists/svg?seed=${u.id}`}
                                                                    alt={u.displayName}
                                                                />
                                                                <AvatarFallback className="text-xs font-semibold">
                                                                    {initials}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <div className="min-w-0">
                                                                <p className="font-medium truncate">
                                                                    {u.displayName || "—"}
                                                                </p>
                                                                <p className="text-xs text-muted-foreground sm:hidden truncate">
                                                                    {u.email}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Email */}
                                                    <td className="px-4 py-4 text-muted-foreground hidden sm:table-cell">
                                                        <span className="truncate max-w-[220px] block">
                                                            {u.email}
                                                        </span>
                                                    </td>

                                                    {/* Role badge + change */}
                                                    <td className="px-4 py-4">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger
                                                                disabled={changingRole === u.id}
                                                                className={cn(
                                                                    "focus:outline-none cursor-pointer hover:opacity-80 transition-opacity",
                                                                    changingRole === u.id && "opacity-50"
                                                                )}
                                                            >
                                                                <RoleBadge role={u.role ?? "student"} />
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="start" className="w-40">
                                                                <DropdownMenuLabel className="text-xs">
                                                                    Change Role
                                                                </DropdownMenuLabel>
                                                                <DropdownMenuSeparator />
                                                                {ROLES.map((r) => (
                                                                    <DropdownMenuItem
                                                                        key={r}
                                                                        onClick={() => handleRoleChange(u.id, r)}
                                                                        className={cn(
                                                                            "gap-2 text-sm",
                                                                            u.role === r &&
                                                                            "font-medium text-primary bg-primary/5"
                                                                        )}
                                                                    >
                                                                        {r.charAt(0).toUpperCase() + r.slice(1)}
                                                                        {u.role === r && (
                                                                            <span className="ml-auto text-primary text-xs">
                                                                                ✓
                                                                            </span>
                                                                        )}
                                                                    </DropdownMenuItem>
                                                                ))}
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </td>

                                                    {/* Joined date */}
                                                    <td className="px-4 py-4 text-muted-foreground text-xs hidden md:table-cell">
                                                        {formatDate(u.createdAt)}
                                                    </td>

                                                    {/* Actions */}
                                                    <td className="px-4 py-4">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger
                                                                id={`user-actions-${u.id}`}
                                                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent focus:outline-none"
                                                            >
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-40">
                                                                {(u.role === "student" || !u.role) && (
                                                                    <DropdownMenuItem
                                                                        onClick={() => setEnrollTargetUser(u)}
                                                                        className="gap-2 text-sm"
                                                                    >
                                                                        <BookOpen className="h-3.5 w-3.5" />
                                                                        Enroll in Course
                                                                    </DropdownMenuItem>
                                                                )}
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem
                                                                    onClick={() => setEditTarget(u)}
                                                                    className="gap-2 text-sm"
                                                                >
                                                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                                                    Edit Details
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                {ROLES.map((r) => (
                                                                    <DropdownMenuItem
                                                                        key={r}
                                                                        onClick={() => handleRoleChange(u.id, r)}
                                                                        className="gap-2 text-sm"
                                                                    >
                                                                        <span>Make {r.charAt(0).toUpperCase() + r.slice(1)}</span>
                                                                    </DropdownMenuItem>
                                                                ))}
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem
                                                                    className="gap-2 text-sm text-destructive focus:text-destructive"
                                                                    onClick={() => setDeleteTarget(u)}
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                    Remove
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Enroll User Dialog */}
            <Dialog open={!!enrollTargetUser} onOpenChange={(o) => !o && setEnrollTargetUser(null)}>
                <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col p-0">
                    <DialogHeader className="p-6 pb-0">
                        <DialogTitle>Enroll in Courses</DialogTitle>
                        <DialogDescription>
                            Manage course enrollments for <span className="font-medium text-foreground">{enrollTargetUser?.displayName}</span>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto p-6 space-y-2">
                        {loadingCourses ? (
                            <p className="text-center text-sm text-muted-foreground py-4">Loading courses...</p>
                        ) : allCourses.length === 0 ? (
                            <p className="text-center text-sm text-muted-foreground py-4">No courses available.</p>
                        ) : (
                            allCourses.map((c) => {
                                const isEnrolled = c.enrolledStudents?.includes(enrollTargetUser?.id);
                                return (
                                    <div key={c.id} className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-muted/20">
                                        <div className="min-w-0 pr-4">
                                            <p className="text-sm font-medium truncate">{c.title}</p>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant={isEnrolled ? "outline" : "default"}
                                            className="rounded-lg h-8 shrink-0"
                                            onClick={() => toggleCourseEnrollment(c.id, !!isEnrolled)}
                                        >
                                            {isEnrolled ? "Unenroll" : "Enroll"}
                                        </Button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── Edit user ── */}
            {editTarget && (
                <EditUserDialog
                    user={editTarget}
                    schoolSlug={schoolSlug}
                    onClose={() => setEditTarget(null)}
                />
            )}

            {/* ── Delete confirm ── */}
            {deleteTarget && (
                <DeleteDialog
                    user={deleteTarget}
                    schoolSlug={schoolSlug}
                    onClose={() => setDeleteTarget(null)}
                />
            )}
        </div>
    );
}
