import * as admin from 'firebase-admin';

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 
                  process.env.FIREBASE_PROJECT_ID || 
                  process.env.GCLOUD_PROJECT || 
                  process.env.GCP_PROJECT || 
                  'devtonic-lms';

if (!admin.apps.length) {
    if (process.env.FIREBASE_PRIVATE_KEY) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: projectId,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            }),
        });
    } else {
        admin.initializeApp({
            projectId: projectId,
        });
    }
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
