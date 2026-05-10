"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useParams } from "next/navigation";

// ─── Super-Admin Email ────────────────────────────────────────────────────────
const SUPER_ADMIN_EMAIL = "devtonicllc@gmail.com";

export type AppUser = User & {
  role?: "super-admin" | "admin" | "instructor" | "student";
  schoolId?: string;
  session?: string;
};

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isInstructor: boolean;
  isStudent: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => { },
  isSuperAdmin: false,
  isAdmin: false,
  isInstructor: false,
  isStudent: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const params = useParams();
  const schoolSlug = params?.schoolSlug as string | undefined;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        let role: "super-admin" | "admin" | "instructor" | "student" | undefined = undefined;
        let session: string | undefined = undefined;

        // 1. Check if hardcoded super-admin email
        if (firebaseUser.email?.toLowerCase() === SUPER_ADMIN_EMAIL) {
          role = "super-admin";
        }

        // 2. Check Firestore for role (override or set if not super-admin)
        if (schoolSlug) {
          const userDocRef = doc(db, "schools", schoolSlug, "users", firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const firestoreRole = userDoc.data().role as any;
            session = userDoc.data().session as string | undefined;
            // Only update role if it's not already hardcoded super-admin, 
            // OR if firestore specifically says they are a super-admin now.
            if (role !== "super-admin" || firestoreRole === "super-admin") {
              role = firestoreRole;
            }
          } else {
            // User document was removed or not found.
            const creationTime = new Date(firebaseUser.metadata.creationTime || "").getTime();
            const isJustCreated = (Date.now() - creationTime) < 15000; // 15 seconds grace period
            
            if (firebaseUser.email?.toLowerCase() !== SUPER_ADMIN_EMAIL && !isJustCreated) {
              await signOut(auth);
              setUser(null);
              setLoading(false);
              return;
            }
          }
        }

        const appUser: AppUser = {
          ...firebaseUser,
          role: role,
          schoolId: schoolSlug,
          session: session,
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
        } as AppUser;

        // Sync hardcoded super-admin to Firestore if missing
        if (firebaseUser.email?.toLowerCase() === SUPER_ADMIN_EMAIL && schoolSlug) {
          const userRef = doc(db, "schools", schoolSlug, "users", firebaseUser.uid);
          const snap = await getDoc(userRef);
          if (!snap.exists()) {
            await setDoc(userRef, {
              email: firebaseUser.email,
              displayName: firebaseUser.displayName || "Super Admin",
              role: "super-admin",
              schoolId: schoolSlug,
              createdAt: serverTimestamp(),
            });
          }
        }

        setUser(appUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [schoolSlug]);

  const logout = async () => {
    await signOut(auth);
  };

  const isSuperAdmin = user?.role === "super-admin" || user?.email?.toLowerCase() === SUPER_ADMIN_EMAIL;
  const isAdmin = isSuperAdmin || user?.role === "admin";
  const isInstructor = user?.role === "instructor";
  const isStudent = user?.role === "student" || (!!user && !isAdmin && !isInstructor);

  return (
    <AuthContext.Provider value={{ user, loading, logout, isSuperAdmin, isAdmin, isInstructor, isStudent }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
