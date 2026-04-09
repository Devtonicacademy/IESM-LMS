"use client";

import { use } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { UserPlus, Shield, BookOpen } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function SchoolLandingPage({
  params,
}: {
  params: Promise<{ schoolSlug: string }>;
}) {
  const { schoolSlug } = use(params);

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-[#0A4A6B]/5 via-white to-[#F4C400]/5 dark:from-[#0A4A6B]/10 dark:via-black dark:to-[#F4C400]/5">
      {/* Background blobs */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-[#0A4A6B]/10 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob" />
      <div className="absolute top-0 -right-4 w-72 h-72 bg-[#F4C400]/10 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000" />
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-[#003087]/10 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000" />

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-2xl z-10"
      >
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          className="flex justify-center mb-6"
        >
          <Image
            src="/iesm-logo.jpg"
            alt="IESM Logo"
            width={140}
            height={140}
            className="object-contain"
            priority
          />
        </motion.div>

        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl mb-4">
          Institute of <span className="text-primary">Ergonomics & Safety Management</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-3">
          Shaping healthier, safer, and smarter workplaces through world-class training and certification programs.
        </p>
        <p className="text-sm font-bold text-[#F4C400] dark:text-[#F4C400] uppercase tracking-widest mb-8">
          Motto: Knowledge & Safety
        </p>

        <div className="flex flex-col sm:flex-row justify-center gap-4 mb-12">
          <Link href={`/${schoolSlug}/auth/signup`}>
            <Button size="lg" className="gap-2 h-12 px-8 rounded-2xl font-bold text-base shadow-lg shadow-primary/20">
              <UserPlus className="h-5 w-5" />
              Sign Up
            </Button>
          </Link>
          <Link href={`/${schoolSlug}/auth/login`}>
            <Button size="lg" variant="outline" className="gap-2 h-12 px-8 rounded-2xl font-bold text-base">
              Sign In
            </Button>
          </Link>
        </div>

        {/* Services preview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-4 rounded-2xl bg-white/60 dark:bg-zinc-900/60 border border-border/50 backdrop-blur-sm"
          >
            <BookOpen className="h-6 w-6 text-primary mx-auto mb-2" />
            <p className="text-xs font-bold text-foreground">Training & Certification</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="p-4 rounded-2xl bg-white/60 dark:bg-zinc-900/60 border border-border/50 backdrop-blur-sm"
          >
            <Shield className="h-6 w-6 text-[#F4C400] mx-auto mb-2" />
            <p className="text-xs font-bold text-foreground">Workplace Safety</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="p-4 rounded-2xl bg-white/60 dark:bg-zinc-900/60 border border-border/50 backdrop-blur-sm"
          >
            <svg className="h-6 w-6 text-[#C8102E] mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <p className="text-xs font-bold text-foreground">Risk & Hazard Control</p>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
