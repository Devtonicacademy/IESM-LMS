"use client";

import { use, useEffect, useState } from "react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import {
    collection,
    collectionGroup,
    query,
    where,
    getDocs,
    doc,
    updateDoc,
    serverTimestamp,
} from "firebase/firestore";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Loader2, KeyRound, User, ShieldCheck, AlertTriangle, CheckCircle2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function InstructorSignupPage({
    params,
}: {
    params: Promise<{ schoolSlug: string; token: string }>;
}) {
    const { schoolSlug, token } = use(params);
    const router = useRouter();

    // Token validation state
    const [validating, setValidating] = useState(true);
    const [tokenError, setTokenError] = useState<string | null>(null);

    // User data resolved from token
    const [placeholderId, setPlaceholderId] = useState("");
    const [lockedEmail, setLockedEmail] = useState("");
    const [adminName, setAdminName] = useState(""); // pre-filled name from admin

    // Form fields
    const [fullName, setFullName] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);

    // ── Validate token on mount ────────────────────────────────────────────────
    useEffect(() => {
        async function validateToken() {
            const cleanToken = token ? token.trim() : "";

            // Step 1: Try server-side API check
            try {
                const response = await fetch("/api/users/check", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ inviteToken: cleanToken, schoolSlug }),
                });

                if (response.ok) {
                    const resData = await response.json();

                    if (resData.exists) {
                        setPlaceholderId(resData.placeholderId);
                        setLockedEmail(resData.email || "");
                        setAdminName(resData.displayName || "");
                        setFullName(resData.displayName || ""); // pre-fill with admin's name
                        setValidating(false);
                        return;
                    }
                }
            } catch (apiErr) {
                console.warn("API invite verification failed, attempting client-side fallback:", apiErr);
            }

            // Step 2: Fallback to direct client-side Firestore verification
            try {
                const usersRef = collection(db, "schools", schoolSlug, "users");
                let q = query(usersRef, where("inviteToken", "==", cleanToken));
                let snap = await getDocs(q);

                if (snap.empty) {
                    // Search across collectionGroup in case of schoolSlug casing mismatch
                    const groupRef = collectionGroup(db, "users");
                    q = query(groupRef, where("inviteToken", "==", cleanToken));
                    snap = await getDocs(q);
                }

                if (snap.empty) {
                    setTokenError("This invite link is invalid or has already been used.");
                    setValidating(false);
                    return;
                }

                const docData = snap.docs[0].data();
                const placeholderDocId = snap.docs[0].id;

                if (docData.inviteTokenExpiresAt && Date.now() > docData.inviteTokenExpiresAt) {
                    setTokenError("This invite link has expired. Please ask your admin to resend the invite.");
                    setValidating(false);
                    return;
                }

                setPlaceholderId(placeholderDocId);
                setLockedEmail(docData.email || "");
                setAdminName(docData.displayName || "");
                setFullName(docData.displayName || "");
                setValidating(false);
            } catch (clientErr) {
                console.error("Client invite verification error:", clientErr);
                setTokenError("Something went wrong while verifying your invite. Please try again.");
                setValidating(false);
            }
        }

        validateToken();
    }, [schoolSlug, token]);

    // ── Handle signup ──────────────────────────────────────────────────────────
    async function handleSignup(e: React.FormEvent) {
        e.preventDefault();

        if (!fullName.trim()) {
            toast.error("Please enter your full name.");
            return;
        }
        if (password.length < 6) {
            toast.error("Password must be at least 6 characters.");
            return;
        }
        if (password !== confirmPassword) {
            toast.error("Passwords do not match.");
            return;
        }

        setLoading(true);
        try {
            let user;
            // Create Firebase Auth account with the locked email
            try {
                const userCredential = await createUserWithEmailAndPassword(auth, lockedEmail, password);
                user = userCredential.user;
            } catch (err: any) {
                if (err.code === "auth/email-already-in-use") {
                    // Try signing in with existing account using the entered password
                    try {
                        const signInCred = await signInWithEmailAndPassword(auth, lockedEmail, password);
                        user = signInCred.user;
                    } catch (signInErr: any) {
                        toast.error("An account with this email already exists. Please enter your existing password to claim your instructor invite.");
                        setLoading(false);
                        return;
                    }
                } else {
                    toast.error(err.message || "Failed to create account.");
                    setLoading(false);
                    return;
                }
            }

            try {
                // Update Firebase Auth display name
                if (user) {
                    await updateProfile(user, { displayName: fullName.trim() });

                    // Move placeholder doc to real UID doc & clear token
                    const newDocRef = doc(db, "schools", schoolSlug, "users", user.uid);
                    const oldDocRef = doc(db, "schools", schoolSlug, "users", placeholderId);

                    // Read old doc data
                    const groupRef = collectionGroup(db, "users");
                    const q = query(groupRef, where("inviteToken", "==", token.trim()));
                    const snap = await getDocs(q);
                    const existingData = snap.docs[0]?.data() ?? {};

                    // Write to new UID-keyed doc
                    const { setDoc } = await import("firebase/firestore");
                    await setDoc(newDocRef, {
                        ...existingData,
                        displayName: fullName.trim(),
                        email: lockedEmail,
                        uid: user.uid,
                        role: "instructor",
                        invited: false,
                        inviteToken: null,
                        inviteTokenExpiresAt: null,
                        createdAt: existingData.createdAt || serverTimestamp(),
                        updatedAt: serverTimestamp(),
                    });

                    // Delete old placeholder doc (if different)
                    if (placeholderId && placeholderId !== user.uid) {
                        try {
                            const { deleteDoc } = await import("firebase/firestore");
                            await deleteDoc(oldDocRef);
                        } catch (_) {}
                    }

                    setDone(true);
                    toast.success("Account set up successfully! Welcome aboard.");

                    setTimeout(() => {
                        router.push(`/${schoolSlug}/dashboard`);
                    }, 1500);
                }
            } catch (firestoreErr) {
                console.error(firestoreErr);
                toast.error("Failed to finalise your account. Please try again.");
            }
        } catch (err: any) {
            toast.error(err.message || "An unexpected error occurred.");
        } finally {
            setLoading(false);
        }
    }

    // ── Loading state ──────────────────────────────────────────────────────────
    if (validating) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] dark:bg-black">
                <div className="flex flex-col items-center gap-4 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin text-[#0A4A6B]" />
                    <p className="text-sm font-medium">Verifying your invite link…</p>
                </div>
            </div>
        );
    }

    // ── Invalid token ──────────────────────────────────────────────────────────
    if (tokenError) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] dark:bg-black p-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-md"
                >
                    <Card className="rounded-[2rem] shadow-2xl border-white/20 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl">
                        <CardContent className="p-10 flex flex-col items-center gap-5 text-center">
                            <div className="rounded-full bg-rose-100 dark:bg-rose-900/30 p-4">
                                <AlertTriangle className="h-8 w-8 text-rose-600" />
                            </div>
                            <h1 className="text-xl font-bold text-foreground">Invalid Invite Link</h1>
                            <p className="text-sm text-muted-foreground leading-relaxed">{tokenError}</p>
                            <Link
                                href={`/${schoolSlug}/auth/login`}
                                className="text-[#0A4A6B] font-semibold text-sm hover:underline"
                            >
                                Go to Login
                            </Link>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        );
    }

    // ── Success state ──────────────────────────────────────────────────────────
    if (done) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] dark:bg-black p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full max-w-md"
                >
                    <Card className="rounded-[2rem] shadow-2xl border-white/20 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl">
                        <CardContent className="p-10 flex flex-col items-center gap-5 text-center">
                            <div className="rounded-full bg-emerald-100 dark:bg-emerald-900/30 p-4">
                                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                            </div>
                            <h1 className="text-xl font-bold">Account Created!</h1>
                            <p className="text-sm text-muted-foreground">
                                Welcome, <strong>{fullName}</strong>. Redirecting you to your dashboard…
                            </p>
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        );
    }

    // ── Main form ──────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-y-auto bg-[#FAFAFA] dark:bg-black py-12">
            {/* Background blobs */}
            <div className="absolute top-0 -left-4 w-72 h-72 bg-[#0A4A6B]/10 rounded-full mix-blend-multiply filter blur-3xl opacity-30 fixed" />
            <div className="absolute top-0 -right-4 w-72 h-72 bg-[#F4C400]/10 rounded-full mix-blend-multiply filter blur-3xl opacity-30 fixed" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md z-10"
            >
                {/* Header */}
                <div className="mb-8 text-center space-y-2">
                    <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="flex justify-center mb-4">
                        <Image src="/iesm-logo.jpg" alt="IESM Logo" width={90} height={90} className="object-contain" priority />
                    </motion.div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold tracking-wider uppercase mb-3">
                        <ShieldCheck className="w-3 h-3" />
                        Instructor Invitation
                    </div>
                    <h1 className="text-3xl font-black tracking-tight text-foreground">Complete Your Setup</h1>
                    <p className="text-sm text-muted-foreground">
                        You&apos;ve been invited to join IESM LMS as an Instructor.
                    </p>
                </div>

                <Card className="backdrop-blur-xl bg-white/70 dark:bg-zinc-900/70 border-white/20 dark:border-zinc-800 shadow-2xl rounded-[2rem] overflow-hidden">
                    <CardContent className="p-8">
                        <form onSubmit={handleSignup} className="space-y-6">

                            {/* Locked email */}
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold ml-1">Email Address</Label>
                                <div className="relative">
                                    <Input
                                        type="email"
                                        value={lockedEmail}
                                        disabled
                                        className="h-12 rounded-2xl bg-muted/50 border-transparent text-muted-foreground cursor-not-allowed"
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium bg-muted px-2 py-0.5 rounded-full">
                                        Locked
                                    </div>
                                </div>
                                <p className="text-[11px] text-muted-foreground ml-1">
                                    Your email is set by your administrator and cannot be changed.
                                </p>
                            </div>

                            {/* Full name */}
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold ml-1">
                                    Full Name <span className="text-red-500">*</span>
                                </Label>
                                <div className="relative group">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    <Input
                                        type="text"
                                        placeholder="Enter your full name"
                                        required
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        className="pl-12 h-12 rounded-2xl bg-muted/30 border-transparent focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/20"
                                    />
                                </div>
                                {adminName && adminName !== fullName && (
                                    <p className="text-[11px] text-muted-foreground ml-1">
                                        Pre-filled from admin: <em>{adminName}</em>
                                    </p>
                                )}
                            </div>

                            {/* Password */}
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold ml-1">
                                    Password <span className="text-red-500">*</span>
                                </Label>
                                <div className="relative group">
                                    <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    <Input
                                        type="password"
                                        placeholder="Create a password"
                                        required
                                        minLength={6}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="pl-12 h-12 rounded-2xl bg-muted/30 border-transparent focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/20"
                                    />
                                </div>
                                <p className="text-[10px] text-muted-foreground ml-1">Must be at least 6 characters</p>
                            </div>

                            {/* Confirm Password */}
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold ml-1">
                                    Confirm Password <span className="text-red-500">*</span>
                                </Label>
                                <div className="relative group">
                                    <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    <Input
                                        type="password"
                                        placeholder="Re-enter your password"
                                        required
                                        minLength={6}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="pl-12 h-12 rounded-2xl bg-muted/30 border-transparent focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/20"
                                    />
                                </div>
                                {confirmPassword && password !== confirmPassword && (
                                    <p className="text-[11px] text-rose-500 ml-1">Passwords do not match</p>
                                )}
                            </div>

                            <Button
                                type="submit"
                                className="w-full h-14 rounded-2xl font-bold text-base shadow-xl shadow-primary/20 gap-2 mt-2"
                                disabled={loading}
                            >
                                {loading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    "Create My Account"
                                )}
                            </Button>
                        </form>

                        <div className="mt-6 text-center text-sm border-t pt-5">
                            <span className="text-muted-foreground">Already have an account? </span>
                            <Link href={`/${schoolSlug}/auth/login`} className="text-primary hover:underline font-bold">
                                Sign In
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
}
