"use client";

import { use, useState } from "react";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { KeyRound, Mail, ChevronRight, Loader2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface ForgotPasswordProps {
  schoolSlug: string;
}

function ForgotPasswordDialog({ schoolSlug }: ForgotPasswordProps) {
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const cleanEmail = resetEmail.toLowerCase().trim();
    if (!cleanEmail) {
      toast.error("Please enter your email address.");
      return;
    }
    setResetLoading(true);
    try {
      const SUPER_ADMIN_EMAIL = "devtonicllc@gmail.com";
      
      if (cleanEmail !== SUPER_ADMIN_EMAIL) {
        // 1. Check Firestore to see if the user is even registered/invited
        const { collection, query, where, getDocs } = await import("firebase/firestore");
        const { db } = await import("@/lib/firebase");

        const usersRef = collection(db, "schools", schoolSlug, "users");
        const q = query(usersRef, where("email", "==", cleanEmail));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          toast.error("Account not found. Please contact your administrator.");
          setResetLoading(false);
          return;
        }

        const userData = querySnapshot.docs[0].data();

        // 2. We allow them to reset password even if invited !== false
        // because if they failed signup halfway, they exist in Auth but not fully in Firestore.
      }

      // 3. Send the actual reset email
      await sendPasswordResetEmail(auth, cleanEmail);
      toast.success("Password reset email sent! Check your inbox (and spam).");
      setResetOpen(false);
    } catch (err: any) {
      console.error("Reset Error:", err);
      if (err.code === "auth/user-not-found") {
        toast.error("No account found for this email. Did you sign up yet?");
      } else {
        toast.error(err.message || "Failed to send reset email");
      }
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <Dialog open={resetOpen} onOpenChange={setResetOpen}>
      <DialogTrigger render={
        <button type="button" className="text-sm font-medium text-primary hover:underline transition-all">
          Forgot password?
        </button>
      } />
      <DialogContent className="sm:max-w-[425px] rounded-3xl">
        <DialogHeader className="space-y-3 px-1">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-2">
            <KeyRound className="w-6 h-6 text-primary" />
          </div>
          <DialogTitle className="text-2xl font-bold">Reset Password</DialogTitle>
          <DialogDescription className="text-base text-muted-foreground">
            Enter the email associated with your account and we&apos;ll send a link to reset your password.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleReset} className="space-y-4 py-4 px-1">
          <div className="space-y-2">
            <Label htmlFor="reset-email">Email Address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="reset-email"
                type="email"
                placeholder="name@example.com"
                required
                className="pl-10 rounded-xl h-11"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="pt-2 px-0 -mx-1">
            <Button type="submit" className="w-full h-11 rounded-xl font-semibold gap-2" disabled={resetLoading}>
              {resetLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending Link...
                </>
              ) : (
                "Send Reset Link"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function LoginPage({ params }: { params: Promise<{ schoolSlug: string }> }) {
  const { schoolSlug } = use(params);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      const SUPER_ADMIN_EMAIL = "devtonicllc@gmail.com";
      if (email.toLowerCase().trim() === SUPER_ADMIN_EMAIL) {
        toast.success("Super Admin recognized");
        router.push(`/${schoolSlug}/dashboard`);
        return;
      }

      const { doc, getDoc } = await import("firebase/firestore");
      const { db } = await import("@/lib/firebase");
      
      const userDocRef = doc(db, "schools", schoolSlug, "users", userCredential.user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        // They might have a placeholder document because signup failed halfway. Let's find it.
        const { collection, query, where, getDocs, setDoc, deleteDoc, serverTimestamp } = await import("firebase/firestore");
        const usersRef = collection(db, "schools", schoolSlug, "users");
        const q = query(usersRef, where("email", "==", email.toLowerCase().trim()));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const existingDoc = querySnapshot.docs[0];
          const userData = existingDoc.data();
          await setDoc(doc(db, "schools", schoolSlug, "users", userCredential.user.uid), {
            ...userData,
            uid: userCredential.user.uid,
            invited: false,
            updatedAt: serverTimestamp(),
          });
          await deleteDoc(existingDoc.ref);
        } else {
          await auth.signOut();
          toast.error("Access denied. Your account has been removed or not found.");
          return;
        }
      }

      toast.success("Welcome back!");
      router.push(`/${schoolSlug}/dashboard`);
    } catch (err: any) {
      if (err.code === "auth/invalid-credential") {
        try {
          // Check if they are simply an invited user who hasn't signed up yet
          const { collection, query, where, getDocs } = await import("firebase/firestore");
          const { db } = await import("@/lib/firebase");
          const usersRef = collection(db, "schools", schoolSlug, "users");
          const q = query(usersRef, where("email", "==", email.toLowerCase().trim()));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            const userData = querySnapshot.docs[0].data();
            if (userData.invited === true) {
              toast.error("You have a pending invite! Please go to 'Sign Up' to create your password and complete registration.");
              router.push(`/${schoolSlug}/auth/signup`);
              return;
            }
          }
        } catch (firestoreErr) {
          // Ignore firestore errors here and fallback to default error
        }
        toast.error("Invalid email or password. If you haven't yet, please Sign Up first.");
      } else {
        toast.error("Invalid email or password");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const SUPER_ADMIN_EMAIL = "devtonicllc@gmail.com";
      if (user.email?.toLowerCase() === SUPER_ADMIN_EMAIL) {
        toast.success("Super Admin recognized");
        router.push(`/${schoolSlug}/dashboard`);
        return;
      }

      const { collection, query, where, getDocs, doc, setDoc, serverTimestamp, deleteDoc } = await import("firebase/firestore");
      const { db } = await import("@/lib/firebase");

      const usersRef = collection(db, "schools", schoolSlug, "users");
      const q = query(usersRef, where("email", "==", user.email?.toLowerCase().trim()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast.error("Account not found. Contact administrator.");
        await auth.signOut();
        return;
      }

      const existingDoc = querySnapshot.docs[0];
      if (existingDoc.id !== user.uid) {
        const userData = existingDoc.data();
        await setDoc(doc(db, "schools", schoolSlug, "users", user.uid), {
          ...userData,
          uid: user.uid,
          invited: false,
          updatedAt: serverTimestamp(),
        });
        await deleteDoc(existingDoc.ref);
      }

      toast.success("Authenticated with Google");
      router.push(`/${schoolSlug}/dashboard`);
    } catch (err: any) {
      console.error("Google Login Error:", err);
      toast.error("Google sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden bg-[#FAFAFA] dark:bg-black">
      {/* Background blobs */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-[#0A4A6B]/10 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob" />
      <div className="absolute top-0 -right-4 w-72 h-72 bg-[#F4C400]/10 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000" />
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-[#003087]/10 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md z-10"
      >
        <div className="mb-8 text-center space-y-2">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="flex justify-center mb-4"
          >
            <Image
              src="/iesm-logo.jpg"
              alt="IESM Logo"
              width={100}
              height={100}
              className="object-contain"
              priority
            />
          </motion.div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F4C400]/15 text-[#0A4A6B] text-xs font-bold tracking-wider uppercase mb-4">
            IESM Learning Portal
          </div>
          <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl uppercase">
            Sign In
          </h1>
          <p className="text-muted-foreground font-medium">
            Access your <span className="text-foreground font-semibold">IESM</span> learning account
          </p>
        </div>

        <Card className="backdrop-blur-xl bg-white/70 dark:bg-zinc-900/70 border-white/20 dark:border-zinc-800 shadow-2xl rounded-[2rem] overflow-hidden">
          <CardContent className="p-8">
            <form onSubmit={handleEmailLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold ml-1">Email Address</Label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-12 h-12 rounded-2xl bg-muted/30 border-transparent focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/20 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between ml-1">
                  <Label htmlFor="password" title="password-label" className="text-sm font-semibold">Password</Label>
                  <ForgotPasswordDialog schoolSlug={schoolSlug} />
                </div>
                <div className="relative group">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-12 h-12 rounded-2xl bg-muted/30 border-transparent focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/20 transition-all font-medium"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full h-12 rounded-2xl font-bold text-base shadow-lg shadow-primary/20 gap-2 overflow-hidden relative group mt-2" disabled={loading}>
                <span className="relative z-10 flex items-center gap-2">
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign In
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </span>
                <div className="absolute inset-0 bg-primary-foreground/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Button>
            </form>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-muted/50" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-black text-muted-foreground">
                <span className="bg-[#fcfdfd] dark:bg-zinc-900 px-4">Trusted Access</span>
              </div>
            </div>

            <Button
              variant="outline"
              type="button"
              className="w-full h-12 rounded-2xl border-muted hover:bg-muted/50 transition-all font-semibold gap-3 group"
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              <svg className="h-5 w-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Sign in with Google
            </Button>

            <div className="mt-8 text-center text-sm">
              <span className="text-muted-foreground font-medium">Don&apos;t have an account? </span>
              <Link href={`/${schoolSlug}/auth/signup`} className="text-primary hover:underline font-bold transition-all">
                Sign Up
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
