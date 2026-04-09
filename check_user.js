import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBABt_PG5DKA8pJeHKUWPMZOvOmW0SGN8g",
  authDomain: "devtonic-lms.firebaseapp.com",
  projectId: "devtonic-lms",
  storageBucket: "devtonic-lms.firebasestorage.app",
  messagingSenderId: "479474889146",
  appId: "1:479474889146:web:b567320a08a225228aed83"
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
