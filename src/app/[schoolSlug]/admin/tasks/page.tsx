"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { DashboardTopbar } from "@/components/dashboard-topbar";
import { db } from "@/lib/firebase";
import {
    collection,
    onSnapshot,
    addDoc,
    doc,
    deleteDoc,
    query,
    orderBy,
    updateDoc,
    serverTimestamp,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
    Search,
    PlusCircle,
    MoreHorizontal,
    Trash2,
    CheckCircle2,
    Clock,
    UserCircle,
    CheckSquare,
} from "lucide-react";
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

interface Task {
    id: string;
    title: string;
    description: string;
    assignedTo: string;
    assignedToName?: string;
    status: 'pending' | 'in-progress' | 'completed';
    createdAt?: any;
}

export default function AdminTasksPage({ params }: { params: Promise<{ schoolSlug: string }> }) {
    const { schoolSlug } = use(params);
    const { user, loading, isAdmin, isInstructor } = useAuth();
    const router = useRouter();

    const [tasks, setTasks] = useState<Task[]>([]);
    const [loadingTasks, setLoadingTasks] = useState(true);
    const [search, setSearch] = useState("");
    
    // Create task
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newTask, setNewTask] = useState({ title: "", description: "", assignedTo: "", assignedToName: "" });
    const [isCreating, setIsCreating] = useState(false);
    
    // Users for assignment
    const [users, setUsers] = useState<any[]>([]);
    const [userSearch, setUserSearch] = useState("");

    // Delete task
    const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);

    useEffect(() => {
        if (!loading && !user) router.push(`/${schoolSlug}/auth/login`);
        if (!loading && user && !isAdmin && !isInstructor) router.push(`/${schoolSlug}/dashboard`);
    }, [loading, user, isAdmin, isInstructor, router, schoolSlug]);

    useEffect(() => {
        if (!isAdmin && !isInstructor) return;
        const q = query(
            collection(db, "schools", schoolSlug, "tasks"),
            orderBy("createdAt", "desc")
        );
        const unsub = onSnapshot(
            q,
            (snap) => {
                setTasks(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Task, "id">) })));
                setLoadingTasks(false);
            },
            (err) => {
                console.error(err);
                setLoadingTasks(false);
            }
        );
        return () => unsub();
    }, [schoolSlug, isAdmin, isInstructor]);

    useEffect(() => {
        if (isCreateOpen) {
            const q = query(collection(db, "schools", schoolSlug, "users"));
            const unsub = onSnapshot(q, (snap) => {
                setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            });
            return () => unsub();
        }
    }, [isCreateOpen, schoolSlug]);

    const filtered = tasks.filter((t) =>
        t.title.toLowerCase().includes(search.toLowerCase()) || 
        t.assignedToName?.toLowerCase().includes(search.toLowerCase())
    );

    const filteredUsers = users.filter(u => 
        (u.displayName || u.email || "").toLowerCase().includes(userSearch.toLowerCase())
    );

    async function handleCreateTask() {
        if (!newTask.title || !newTask.assignedTo) {
            toast.error("Please fill in title and select a user");
            return;
        }
        setIsCreating(true);
        try {
            await addDoc(collection(db, "schools", schoolSlug, "tasks"), {
                ...newTask,
                status: 'pending',
                createdAt: serverTimestamp()
            });
            toast.success("Task created successfully");
            setIsCreateOpen(false);
            setNewTask({ title: "", description: "", assignedTo: "", assignedToName: "" });
        } catch (err) {
            console.error(err);
            toast.error("Failed to create task");
        } finally {
            setIsCreating(false);
        }
    }

    async function handleDelete() {
        if (!deleteTarget) return;
        try {
            await deleteDoc(doc(db, "schools", schoolSlug, "tasks", deleteTarget.id));
            toast.success("Task deleted");
            setDeleteTarget(null);
        } catch (err) {
            console.error(err);
            toast.error("Failed to delete task");
        }
    }

    async function handleStatusChange(taskId: string, newStatus: 'pending' | 'in-progress' | 'completed') {
        try {
            await updateDoc(doc(db, "schools", schoolSlug, "tasks", taskId), {
                status: newStatus
            });
            toast.success("Status updated");
        } catch (err) {
            console.error(err);
            toast.error("Failed to update status");
        }
    }

    if (loading || (!user && !loading)) {
        return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
    }

    return (
        <div className="flex flex-col flex-1 w-full">
            <DashboardTopbar breadcrumb="Tasks / Manage Tasks" />

            <div className="p-8 max-w-7xl mx-auto w-full space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Manage Tasks</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Create tasks, assign them to users, and track completion progress.
                        </p>
                    </div>
                    <Button
                        onClick={() => setIsCreateOpen(true)}
                        className="rounded-xl h-10 px-4"
                    >
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Create Task
                    </Button>
                </div>

                <Card className="border-border/50 shadow-sm">
                    <CardHeader className="pb-4 flex flex-col sm:flex-row sm:items-center gap-4">
                        <CardTitle className="text-base font-semibold flex-1">
                            All Tasks <span className="font-normal text-muted-foreground text-sm ml-1">({filtered.length})</span>
                        </CardTitle>
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Search tasks..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9 rounded-xl bg-muted/50 border-transparent focus-visible:bg-background h-9"
                            />
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {loadingTasks ? (
                            <div className="py-16 text-center text-muted-foreground">Loading tasks...</div>
                        ) : filtered.length === 0 ? (
                            <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
                                <CheckSquare className="h-8 w-8 opacity-40" />
                                <p className="font-medium">No tasks found</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/30">
                                            <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Task</th>
                                            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Assigned To</th>
                                            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                                            <th className="px-4 py-3" />
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/50">
                                        {filtered.map((task) => (
                                            <tr key={task.id} className="hover:bg-muted/30 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <p className="font-medium truncate max-w-sm">{task.title}</p>
                                                    <p className="text-xs text-muted-foreground truncate max-w-sm">{task.description}</p>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <UserCircle className="h-4 w-4 text-muted-foreground" />
                                                        <span className="font-medium">{task.assignedToName || 'Unknown User'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="flex items-center gap-2">
                                                        {task.status === 'pending' && <Clock className="h-4 w-4 text-yellow-500" />}
                                                        {task.status === 'in-progress' && <Clock className="h-4 w-4 text-blue-500" />}
                                                        {task.status === 'completed' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                                                        <span className={cn(
                                                            "text-xs font-medium px-2 py-1 rounded-full capitalize",
                                                            task.status === 'pending' && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-500",
                                                            task.status === 'in-progress' && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-500",
                                                            task.status === 'completed' && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-500",
                                                        )}>
                                                            {task.status}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent focus:outline-none">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-40">
                                                            <DropdownMenuItem onClick={() => handleStatusChange(task.id, 'pending')}>
                                                                Mark Pending
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleStatusChange(task.id, 'in-progress')}>
                                                                Mark In-Progress
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleStatusChange(task.id, 'completed')}>
                                                                Mark Completed
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                onClick={() => setDeleteTarget(task)}
                                                                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                                            >
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

            {/* Create Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Create Task</DialogTitle>
                        <DialogDescription>
                            Assign a new task to any user in the school.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Task Title</label>
                            <Input
                                placeholder="E.g. Review student assignments"
                                value={newTask.title}
                                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Description (Optional)</label>
                            <Textarea
                                placeholder="Add any details or instructions..."
                                value={newTask.description}
                                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Assign To</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    placeholder="Search users..."
                                    value={userSearch}
                                    onChange={(e) => setUserSearch(e.target.value)}
                                    className="pl-9 h-9"
                                />
                            </div>
                            <div className="border rounded-md mt-2 max-h-40 overflow-y-auto">
                                {filteredUsers.map(u => (
                                    <div 
                                        key={u.id}
                                        className={cn(
                                            "px-3 py-2 text-sm cursor-pointer hover:bg-muted/50 flex flex-col",
                                            newTask.assignedTo === u.id ? "bg-primary/10 border-l-2 border-primary" : ""
                                        )}
                                        onClick={() => setNewTask({ ...newTask, assignedTo: u.id, assignedToName: u.displayName || u.email || "Unknown" })}
                                    >
                                        <span className="font-medium">{u.displayName || "Unknown User"}</span>
                                        <span className="text-xs text-muted-foreground">{u.email} ({u.role || "student"})</span>
                                    </div>
                                ))}
                                {filteredUsers.length === 0 && <div className="px-3 py-4 text-center text-sm text-muted-foreground">No users found</div>}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreateTask} disabled={isCreating || !newTask.title || !newTask.assignedTo}>
                            {isCreating ? "Creating..." : "Create Task"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Delete Task</DialogTitle>
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
