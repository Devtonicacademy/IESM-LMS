import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs, setDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { sendIntroMessage } from "@/lib/sendIntroMessage";

export async function POST(req: Request) {
  try {
    const { reference, schoolSlug, courseId, uid, courseName, studentName, studentEmail } = await req.json();

    if (!reference || !schoolSlug || !courseId || !uid) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Fetch the secret key for the school
    const secretRef = doc(db, "schools", schoolSlug, "settings", "secrets");
    const secretSnap = await getDoc(secretRef);
    if (!secretSnap.exists()) {
      return NextResponse.json({ error: "Paystack is not configured for this school" }, { status: 400 });
    }

    const { paystackSecretKey } = secretSnap.data();
    if (!paystackSecretKey) {
      return NextResponse.json({ error: "Paystack secret key is missing" }, { status: 400 });
    }

    // 2. Fetch payment settings to check autoApprove toggle
    const paymentRef = doc(db, "schools", schoolSlug, "settings", "payment");
    const paymentSnap = await getDoc(paymentRef);
    const autoApprove = paymentSnap.exists() && paymentSnap.data().autoApprovePayments === true;

    // 3. Call Paystack to verify this transaction
    const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        "Content-Type": "application/json",
      },
    });

    const paystackData = await paystackRes.json();

    if (!payloadDataIsSuccessful(paystackData)) {
      return NextResponse.json({ error: "Transaction verification failed" }, { status: 400 });
    }

    // Amount comes in kobo. Real amount in Naira = amount / 100.
    const amountPaid = paystackData.data.amount / 100;

    // 4. Process enrollment status based on autoApprove setting
    const targetStatus = autoApprove ? "approved" : "pending";

    // Check if an enrollment request already exists for this user and course
    const enrollmentsRef = collection(db, "schools", schoolSlug, "enrollmentRequests");
    const q = query(
      enrollmentsRef,
      where("courseId", "==", courseId),
      where("studentId", "==", uid)
    );
    const existSnap = await getDocs(q);

    if (!existSnap.empty) {
      // Update existing request
      const existingDoc = existSnap.docs[0];
      await setDoc(doc(db, "schools", schoolSlug, "enrollmentRequests", existingDoc.id), {
        status: targetStatus,
        paymentMethod: "paystack",
        pricePaid: amountPaid,
        paystackReference: reference,
        ...(autoApprove ? { approvedAt: serverTimestamp() } : {})
      }, { merge: true });
    } else {
      // Create a brand new request
      await addDoc(enrollmentsRef, {
        courseId,
        courseName: courseName || "Unknown Course",
        studentId: uid,
        studentName: studentName || "Student",
        studentEmail: studentEmail || "",
        status: targetStatus,
        requestedAt: serverTimestamp(),
        paymentMethod: "paystack",
        pricePaid: amountPaid,
        paystackReference: reference,
        ...(autoApprove ? { approvedAt: serverTimestamp() } : {})
      });
    }

    // 5. Add student to the course automatically ONLY if autoApprove is true
    if (autoApprove) {
      const courseRef = doc(db, "schools", schoolSlug, "courses", courseId);
      const courseSnap = await getDoc(courseRef);
      if (courseSnap.exists()) {
        const courseData = courseSnap.data();
        const enrolled = courseData.enrolledStudents || [];
        if (!enrolled.includes(uid)) {
          await setDoc(courseRef, {
            enrolledStudents: [...enrolled, uid]
          }, { merge: true });
          
          // Send automated intro message
          await sendIntroMessage(schoolSlug, courseId, courseName || courseData.title || "Unknown Course", uid, studentName);
        }
      }
    }

    // Optional: could trigger process.env based Next.js email here, 
    // or rely on frontend to call the email API since the status is now 'approved'.

    return NextResponse.json({ success: true, message: autoApprove ? "Transaction verified and approved." : "Transaction verified. Waiting for admin approval." });
  } catch (error: any) {
    console.error("Paystack verification error:", error);
    return NextResponse.json({ error: error.message || "Failed to verify payment" }, { status: 500 });
  }
}

function payloadDataIsSuccessful(paystackData: any): boolean {
  return paystackData && paystackData.status === true && paystackData.data && paystackData.data.status === "success";
}
