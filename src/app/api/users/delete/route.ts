import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export async function POST(req: Request) {
    try {
        const { uid, email, schoolSlug } = await req.json();

        if (!uid && !email) {
            return NextResponse.json({ error: "Missing uid or email" }, { status: 400 });
        }

        // ── Step 1: Delete from Firebase Authentication (best-effort) ────────────
        // Some users may only be placeholder docs (invited but never signed in),
        // so we tolerate auth/user-not-found and auth/invalid-uid errors.
        try {
            if (uid && !uid.startsWith("user_")) {
                // Only attempt Auth deletion if it looks like a real Firebase Auth UID
                await adminAuth.deleteUser(uid);
            } else if (email) {
                // Try looking up by email as a fallback
                const authUser = await adminAuth.getUserByEmail(email);
                await adminAuth.deleteUser(authUser.uid);
            }
        } catch (authErr: any) {
            const ignoredCodes = [
                "auth/user-not-found",
                "auth/invalid-uid",
                "auth/invalid-email",
            ];
            if (!ignoredCodes.includes(authErr.code)) {
                // Log but do NOT block — we still want to delete the Firestore doc
                console.warn("Could not delete user from Auth (continuing):", authErr.message);
            }
        }

        // ── Step 2: Delete from Firestore (server-side with Admin SDK) ───────────
        if (schoolSlug && uid) {
            try {
                await adminDb
                    .collection("schools")
                    .doc(schoolSlug)
                    .collection("users")
                    .doc(uid)
                    .delete();
            } catch (dbErr: any) {
                console.warn("Could not delete user from Firestore via Admin SDK (continuing to client fallback):", dbErr.message);
            }
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Delete user API error:", error);
        return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 });
    }
}
