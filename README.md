# IESM LMS (Devtonic LMS)

A modern, multi-tenant Learning Management System (LMS) designed for schools and instructors to manage courses, enrollments, assessments, and certificates.

---

## 🏗 App Architecture: Where Everything Is

This section provides a deep dive into how the application works, how it's structured, and where you can find the underlying code. The app is built on **Next.js 16 (App Router)** and uses **Firebase** for its entire backend.

### 1. The Frontend (Client & Server Components)
All page routing and UI logic live in the [`src/app`](file:///Users/admin/Desktop/PROJECTS/IESM%20LMS/src/app) directory using the Next.js App Router paradigm.

- **Multi-Tenant Routing:** The entire app is wrapped in a dynamic route `[schoolSlug]`. This means URLs look like `devtonic-lms.web.app/my-school-name/dashboard`. 
  - 📂 Explore the tenant routes: [`src/app/[schoolSlug]`](file:///Users/admin/Desktop/PROJECTS/IESM%20LMS/src/app/[schoolSlug])
- **Public Portal:** The landing and routing pages are handled outside the slug.
  - 📂 Explore the portal: [`src/app/portal`](file:///Users/admin/Desktop/PROJECTS/IESM%20LMS/src/app/portal)
- **UI Components:** We use Tailwind CSS and shadcn/ui. Shared components, layout wrappers, and specialized course editors are here.
  - 📂 Explore components: [`src/components`](file:///Users/admin/Desktop/PROJECTS/IESM%20LMS/src/components)

### 2. Backend Logic (APIs & Serverless Functions)
Instead of a traditional Express server, backend logic is handled via **Next.js API Routes**. When deployed to Firebase, these are automatically converted into **Firebase Cloud Functions (Node.js 2nd Gen)**.

You can find all backend APIs in [`src/app/api`](file:///Users/admin/Desktop/PROJECTS/IESM%20LMS/src/app/api). Key endpoints include:
- 🔗 **[`/api/enrollment`](file:///Users/admin/Desktop/PROJECTS/IESM%20LMS/src/app/api/enrollment):** Handles student enrollments into courses.
- 🔗 **[`/api/send-invite`](file:///Users/admin/Desktop/PROJECTS/IESM%20LMS/src/app/api/send-invite) & [`/api/send-email`](file:///Users/admin/Desktop/PROJECTS/IESM%20LMS/src/app/api/send-email):** Uses `nodemailer` to trigger emails.
- 🔗 **[`/api/generate-quiz`](file:///Users/admin/Desktop/PROJECTS/IESM%20LMS/src/app/api/generate-quiz):** AI-powered or automated quiz generation logic.
- 🔗 **[`/api/paystack`](file:///Users/admin/Desktop/PROJECTS/IESM%20LMS/src/app/api/paystack):** Payment verification webhooks for subscriptions and course purchases.

### 3. Data Storage & Firebase Integration
The application interacts directly with Firebase services from both the client (for real-time updates) and the server (for secure operations).

- **Client-Side Firebase Config:** Initializes the Firebase app for the browser (Auth, Firestore, Storage).
  - 🔗 File: [`src/lib/firebase.ts`](file:///Users/admin/Desktop/PROJECTS/IESM%20LMS/src/lib/firebase.ts)
- **Server-Side Firebase Admin:** Used within `/api` routes to bypass security rules and perform administrative tasks (like deleting users or minting invite tokens).
  - 🔗 File: [`src/lib/firebase-admin.ts`](file:///Users/admin/Desktop/PROJECTS/IESM%20LMS/src/lib/firebase-admin.ts)
- **Cloud Firestore (Database):** NoSQL document database. We strictly control who can read/write data using Firebase Security Rules.
  - 🔗 File: [`firestore.rules`](file:///Users/admin/Desktop/PROJECTS/IESM%20LMS/firestore.rules)
  - 🔗 File: [`firestore.indexes.json`](file:///Users/admin/Desktop/PROJECTS/IESM%20LMS/firestore.indexes.json) (Defines optimized queries)
- **Firebase Storage (Media):** Where course videos, images, and certificates are saved.
  - 🔗 File: [`storage.rules`](file:///Users/admin/Desktop/PROJECTS/IESM%20LMS/storage.rules)

---

## 🚀 From Development to Production

### Local Development
To run the app locally, Next.js spins up a local Node server that handles both the React frontend and the API routes.
```bash
npm install
npm run dev
```
- **Environment Variables:** During development, the app reads secrets from [`.env.local`](file:///Users/admin/Desktop/PROJECTS/IESM%20LMS/.env.local).

### How Deployment Works (Under the Hood)
When we run `npx firebase deploy --only hosting`, a complex orchestrated build happens:

1. **Next.js Standalone Build:** The CLI triggers `next build`. Because we configured `output: "standalone"` in [`next.config.ts`](file:///Users/admin/Desktop/PROJECTS/IESM%20LMS/next.config.ts), Next.js strips away development dependencies and creates a highly optimized, lightweight Node.js server bundle.
2. **Firebase Frameworks Integration:** The Firebase CLI detects the Next.js build. It takes all the static assets (HTML, CSS, Images) and uploads them to the **Firebase Hosting CDN** for blazing-fast delivery.
3. **Cloud Functions Provisioning:** It takes the dynamic parts of the app (Server Components, SSR pages like `/[schoolSlug]/dashboard`, and all `/api` routes) and wraps them inside a single Google Cloud Function named `ssrdevtoniclms`. 
4. **Traffic Routing:** Firebase Hosting configuration (found in [`firebase.json`](file:///Users/admin/Desktop/PROJECTS/IESM%20LMS/firebase.json)) automatically rewrites incoming dynamic requests to trigger the Cloud Function.

### Live Architecture Summary:
- **Static Assets** -> Served globally via Firebase Hosting CDN.
- **Dynamic Pages / APIs** -> Served via Firebase Cloud Functions (Node.js v24 environment).
- **Database / Auth** -> Handled directly by Firebase backend services via the client SDK or Admin SDK.
