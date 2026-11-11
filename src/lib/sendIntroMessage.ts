import { db } from "./firebase";
import { collection, doc, setDoc, getDoc, addDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";

export async function sendIntroMessage(
  schoolSlug: string,
  courseId: string,
  courseName: string,
  studentId: string,
  studentName: string
) {
  try {
    // 1. Fetch course details to get instructorId
    const courseRef = doc(db, "schools", schoolSlug, "courses", courseId);
    const courseSnap = await getDoc(courseRef);
    let instructorId = "system";
    let instructorName = "System";

    if (courseSnap.exists()) {
      const cData = courseSnap.data();
      if (cData.instructorId) {
        instructorId = cData.instructorId;
        // Fetch instructor name
        const instSnap = await getDoc(doc(db, "schools", schoolSlug, "users", instructorId));
        if (instSnap.exists() && instSnap.data().displayName) {
          instructorName = instSnap.data().displayName;
        } else {
          instructorName = "Instructor";
        }
      }
    }

    // 2. Check if chat already exists between student and instructor
    const chatsRef = collection(db, "schools", schoolSlug, "chats");
    const q = query(chatsRef, where("participants", "array-contains", studentId));
    const existSnap = await getDocs(q);
    
    let chatId: string | null = null;
    existSnap.forEach((d) => {
      const data = d.data();
      if (data.type === "direct" && data.participants.includes(instructorId)) {
        chatId = d.id;
      }
    });

    if (!chatId) {
      // Create new chat
      const newChatRef = doc(collection(db, "schools", schoolSlug, "chats"));
      await setDoc(newChatRef, {
        type: "direct",
        participants: [studentId, instructorId],
        participantNames: {
          [studentId]: studentName || "Student",
          [instructorId]: instructorName,
        },
        updatedAt: serverTimestamp(),
      });
      chatId = newChatRef.id;
    } else {
      // Update existing chat
      await setDoc(doc(db, "schools", schoolSlug, "chats", chatId), {
        updatedAt: serverTimestamp()
      }, { merge: true });
    }

    // 3. Send message
    await addDoc(collection(db, "schools", schoolSlug, "chats", chatId, "messages"), {
      text: `Hello ${studentName || "there"}! Welcome to the course "${courseName}". I'm ${instructorName}, and I'm excited to have you here. If you have any questions, feel free to ask me here!`,
      senderId: instructorId,
      senderName: instructorName,
      createdAt: serverTimestamp(),
    });

  } catch (error) {
    console.error("Failed to send intro message:", error);
  }
}
