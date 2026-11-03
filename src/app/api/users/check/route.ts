import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(req: Request) {
  try {
    const { email, inviteToken, schoolSlug } = await req.json();

    if (!schoolSlug) {
      return NextResponse.json({ error: 'Missing schoolSlug' }, { status: 400 });
    }

    if (!email && !inviteToken) {
      return NextResponse.json({ error: 'Missing email or inviteToken' }, { status: 400 });
    }

    const schoolsRef = adminDb.collection("schools").doc(schoolSlug);
    const usersRef = schoolsRef.collection("users");

    // Case 1: Check by email (Forgot password flow)
    if (email) {
      const cleanEmail = email.toLowerCase().trim();
      const snapshot = await usersRef.where("email", "==", cleanEmail).limit(1).get();

      return NextResponse.json({ exists: !snapshot.empty });
    }

    // Case 2: Check by invite token (Instructor signup verification flow)
    if (inviteToken) {
      const cleanToken = inviteToken.trim();
      let snapshot = await usersRef.where("inviteToken", "==", cleanToken).limit(1).get();

      if (snapshot.empty) {
        // Fallback: search across all schools users subcollections in case schoolSlug had casing or slug mismatches
        snapshot = await adminDb.collectionGroup("users").where("inviteToken", "==", cleanToken).limit(1).get();
      }

      if (snapshot.empty) {
        return NextResponse.json({
          exists: false,
          error: "This invite link is invalid or has already been used."
        });
      }

      const doc = snapshot.docs[0];
      const data = doc.data();

      // Check expiry
      if (data.inviteTokenExpiresAt && Date.now() > data.inviteTokenExpiresAt) {
        return NextResponse.json({
          exists: false,
          error: "This invite link has expired. Please ask your admin to resend the invite."
        });
      }

      return NextResponse.json({
        exists: true,
        placeholderId: doc.id,
        email: data.email || "",
        displayName: data.displayName || "",
        inviteTokenExpiresAt: data.inviteTokenExpiresAt || null
      });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error: any) {
    console.error('Error in users check API:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
