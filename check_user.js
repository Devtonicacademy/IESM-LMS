import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyB3FI3GOs5t7Ml1_heFpFjeEpPB6VNf8SY",
  authDomain: "iesm-lms-app-2026.firebaseapp.com",
  projectId: "iesm-lms-app-2026",
  storageBucket: "iesm-lms-app-2026.firebasestorage.app",
  messagingSenderId: "626251942055",
  appId: "1:626251942055:web:56ffc8f038163012b5f382"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkUser(schoolSlug, email) {
  console.log(`Checking user: ${email} in school: ${schoolSlug}`);
  const usersRef = collection(db, "schools", schoolSlug, "users");
  const q = query(usersRef, where("email", "==", email.toLowerCase().trim()));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    console.log("No user found with this email.");
  } else {
    snapshot.forEach(doc => {
      console.log(`Found doc ID: ${doc.id}`);
      console.log(`Data:`, doc.data());
    });
  }
  process.exit(0);
}

async function check() {
    await checkUser("iesm", "eyobor.elvis@gmail.com");
}
check().catch(console.error);
