"use client";

import { useEffect, useState, use } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import "@/app/globals.css";

// Assuming we fetch school data to inject CSS variables
export default function SchoolLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ schoolSlug: string }>;
}) {
  const resolvedParams = use(params);
  const [flavorColor, setFlavorColor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSchool() {
      try {
        const slug = resolvedParams.schoolSlug;
        const ref = doc(db, "schools", slug);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          if (data.primaryColor) {
            setFlavorColor(data.primaryColor);
            // Apply CSS variables to document for tailwind theming
            document.documentElement.style.setProperty("--primary", data.primaryColor);
          }
        } else {
          // fallback mock for demo if not seeded yet
          if (slug === "iesm") {
            document.documentElement.style.setProperty("--primary", "#0A4A6B"); // IESM professional blue
          }
        }
      } catch (err) {
        console.error("Failed to load school flavor", err);
      } finally {
        setLoading(false);
      }
    }
    loadSchool();
  }, [resolvedParams.schoolSlug]);

  return <div className="min-h-screen bg-background text-foreground antialiased">{children}</div>;
}
