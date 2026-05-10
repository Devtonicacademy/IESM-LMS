import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";

export async function POST(req: Request) {
    try {
        const { uid, email } = await req.json();

        if (!uid && !email) {
            return NextResponse.json({ error: "Missing uid or email" }, { status: 400 });
        }

        try {
            // First try by UID
            if (uid) {
                await adminAuth.deleteUser(uid);
            } else if (email) {
                // Fallback to email if UID is just a placeholder
                const user = await adminAuth.getUserByEmail(email);
                if (user) {
                    await adminAuth.deleteUser(user.uid);
                }
            }
        } catch (err: any) {
            // If the user is not found in Firebase Auth, it might just be a placeholder doc
            // We ignore the auth/user-not-found error so the process can continue to delete the Firestore doc
            if (err.code !== 'auth/user-not-found') {
                console.error("Error deleting user from Auth:", err);
                return NextResponse.json({ error: "Failed to delete from Auth", details: err.message }, { status: 500 });
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Delete user API error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
