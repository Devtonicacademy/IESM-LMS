"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/components/auth-provider";
import { 
  Sparkles, 
  ChevronRight, 
  ChevronLeft, 
  X, 
  HelpCircle, 
  BookOpen, 
  Compass, 
  CheckCircle2, 
  ArrowRight,
  RotateCcw
} from "lucide-react";
import { Button } from "@/components/ui/button";

export interface TourStep {
  targetId: string;
  title: string;
  description: string;
  placement?: "top" | "bottom" | "left" | "right" | "center";
  role?: ("admin" | "instructor" | "student" | "all")[];
  icon?: string;
}

interface TourContextType {
  isActive: boolean;
  currentStepIndex: number;
  totalSteps: number;
  currentStep: TourStep | null;
  startTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  resetTourHistory: () => void;
}

const TourContext = createContext<TourContextType | null>(null);

const DEFAULT_TOUR_STEPS: TourStep[] = [
  {
    targetId: "tour-welcome",
    title: "Welcome to IESM LMS! 👋",
    description: "Welcome to your all-in-one learning and management platform. Let's take a quick 1-minute interactive tour to help you navigate and get the most out of your dashboard.",
    placement: "center",
    role: ["all"],
  },
  {
    targetId: "tour-sidebar-nav",
    title: "Main Navigation Menu",
    description: "Explore all portal sections here: view your Course Catalog, access Messages, track Completed Courses & Certifications, and open the complete User Guide.",
    placement: "right",
    role: ["all"],
  },
  {
    targetId: "tour-admin-nav",
    title: "Admin & Instructor Management",
    description: "Course creation, curriculum editing, assignment of tasks, student enrollment approvals, and institutional settings are readily available here for staff members.",
    placement: "right",
    role: ["admin", "instructor"],
  },
  {
    targetId: "tour-search-bar",
    title: "Global Quick Search",
    description: "Quickly locate courses, modules, user guides, or specific topics anywhere across your workspace at any time.",
    placement: "bottom",
    role: ["all"],
  },
  {
    targetId: "tour-theme-toggle",
    title: "Theme Switcher",
    description: "Switch seamlessly between Light and Dark mode, or align with your system settings for comfortable reading day or night.",
    placement: "bottom",
    role: ["all"],
  },
  {
    targetId: "tour-user-profile",
    title: "Profile & Account Details",
    description: "View your user role, manage your account info, adjust personal notification preferences, and upload your profile avatar.",
    placement: "bottom",
    role: ["all"],
  },
  {
    targetId: "tour-notifications",
    title: "Real-time Notifications",
    description: "Stay up-to-date with course announcements, new task assignments, instructor feedback, and grade releases.",
    placement: "bottom",
    role: ["all"],
  },
  {
    targetId: "tour-tasks-section",
    title: "Active Tasks & Assignments",
    description: "View actionable items assigned to you. Review tasks, inspect descriptions, and mark them as complete as you progress.",
    placement: "bottom",
    role: ["all"],
  },
  {
    targetId: "tour-overview-content",
    title: "Your Dashboard Overview",
    description: "Monitor your enrolled courses, student performance, or institutional metrics in one centralized, high-level overview.",
    placement: "top",
    role: ["all"],
  },
  {
    targetId: "tour-help-guide",
    title: "Help Center & Documentation",
    description: "Need help anytime? You can revisit the user guide or replay this walkthrough whenever you wish from the Help button in the top bar.",
    placement: "bottom",
    role: ["all"],
  },
];

export function TourProvider({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, isInstructor, isStudent } = useAuth();
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Filter steps based on role
  const steps = DEFAULT_TOUR_STEPS.filter((step) => {
    if (!step.role || step.role.includes("all")) return true;
    if (isAdmin && step.role.includes("admin")) return true;
    if (isInstructor && step.role.includes("instructor")) return true;
    if (isStudent && step.role.includes("student")) return true;
    return false;
  });

  const currentStep = steps[currentStepIndex] || null;

  // Auto trigger for first-time user
  useEffect(() => {
    if (!user) return;
    const storageKey = `iesm_tour_completed_${user.uid}`;
    const hasSeenTour = localStorage.getItem(storageKey);
    if (!hasSeenTour) {
      // Delay slightly so layout finishes mounting
      const timer = setTimeout(() => {
        setIsActive(true);
        setCurrentStepIndex(0);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [user]);

  // Update target rect when step changes or window resizes
  const updateTargetPosition = useCallback(() => {
    if (!isActive || !currentStep) {
      setTargetRect(null);
      return;
    }

    if (currentStep.placement === "center" || currentStep.targetId === "tour-welcome") {
      setTargetRect(null);
      return;
    }

    const element = document.getElementById(currentStep.targetId);
    if (element) {
      // Smoothly scroll element into view if not in viewport
      const rect = element.getBoundingClientRect();
      const inView =
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth);

      if (!inView) {
        element.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
        // Recalculate after slight scroll delay
        setTimeout(() => {
          const updated = element.getBoundingClientRect();
          setTargetRect(updated);
        }, 300);
      } else {
        setTargetRect(rect);
      }
    } else {
      setTargetRect(null);
    }
  }, [isActive, currentStep]);

  useEffect(() => {
    updateTargetPosition();
    window.addEventListener("resize", updateTargetPosition);
    window.addEventListener("scroll", updateTargetPosition, true);
    return () => {
      window.removeEventListener("resize", updateTargetPosition);
      window.removeEventListener("scroll", updateTargetPosition, true);
    };
  }, [updateTargetPosition]);

  const markTourCompleted = () => {
    if (user) {
      localStorage.setItem(`iesm_tour_completed_${user.uid}`, "true");
    }
  };

  const startTour = () => {
    setCurrentStepIndex(0);
    setIsActive(true);
  };

  const nextStep = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      setIsActive(false);
      markTourCompleted();
    }
  };

  const prevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const skipTour = () => {
    setIsActive(false);
    markTourCompleted();
  };

  const resetTourHistory = () => {
    if (user) {
      localStorage.removeItem(`iesm_tour_completed_${user.uid}`);
    }
    startTour();
  };

  return (
    <TourContext.Provider
      value={{
        isActive,
        currentStepIndex,
        totalSteps: steps.length,
        currentStep,
        startTour,
        nextStep,
        prevStep,
        skipTour,
        resetTourHistory,
      }}
    >
      {children}
      {mounted && typeof document !== "undefined" && (
        <TourOverlay
          isActive={isActive}
          step={currentStep}
          stepIndex={currentStepIndex}
          totalSteps={steps.length}
          targetRect={targetRect}
          onNext={nextStep}
          onPrev={prevStep}
          onSkip={skipTour}
        />
      )}
    </TourContext.Provider>
  );
}

export function useTour() {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error("useTour must be used within a TourProvider");
  }
  return context;
}

interface TourOverlayProps {
  isActive: boolean;
  step: TourStep | null;
  stepIndex: number;
  totalSteps: number;
  targetRect: DOMRect | null;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}

function TourOverlay({
  isActive,
  step,
  stepIndex,
  totalSteps,
  targetRect,
  onNext,
  onPrev,
  onSkip,
}: TourOverlayProps) {
  if (!isActive || !step) return null;

  const isCenter = !targetRect || step.placement === "center";

  // Calculate popover coordinates when element is spotlighted
  let popoverStyle: React.CSSProperties = {};
  if (targetRect && !isCenter) {
    const margin = 16;
    const popoverWidth = 360;
    const popoverHeight = 220; // approximate

    let top = 0;
    let left = 0;

    switch (step.placement) {
      case "bottom":
        top = targetRect.bottom + margin;
        left = Math.max(16, Math.min(window.innerWidth - popoverWidth - 16, targetRect.left + targetRect.width / 2 - popoverWidth / 2));
        break;
      case "top":
        top = Math.max(16, targetRect.top - popoverHeight - margin);
        left = Math.max(16, Math.min(window.innerWidth - popoverWidth - 16, targetRect.left + targetRect.width / 2 - popoverWidth / 2));
        break;
      case "right":
        top = Math.max(16, Math.min(window.innerHeight - popoverHeight - 16, targetRect.top));
        left = Math.min(window.innerWidth - popoverWidth - 16, targetRect.right + margin);
        break;
      case "left":
        top = Math.max(16, Math.min(window.innerHeight - popoverHeight - 16, targetRect.top));
        left = Math.max(16, targetRect.left - popoverWidth - margin);
        break;
      default:
        top = targetRect.bottom + margin;
        left = targetRect.left;
    }

    // Edge boundaries
    if (top + popoverHeight > window.innerHeight) {
      top = Math.max(16, window.innerHeight - popoverHeight - 16);
    }
    if (top < 16) top = 16;

    popoverStyle = {
      position: "fixed",
      top: `${top}px`,
      left: `${left}px`,
      zIndex: 9999,
      maxWidth: `${popoverWidth}px`,
      width: "calc(100vw - 32px)",
    };
  }

  return createPortal(
    <div className="fixed inset-0 z-[9998] overflow-hidden pointer-events-auto">
      {/* Background Mask / Spotlight */}
      {targetRect && !isCenter ? (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none transition-all duration-300"
          style={{ zIndex: 9998 }}
        >
          <defs>
            <mask id="tour-spotlight-mask">
              {/* Full white cover */}
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {/* Black cutout around target element */}
              <rect
                x={targetRect.left - 6}
                y={targetRect.top - 6}
                width={targetRect.width + 12}
                height={targetRect.height + 12}
                rx="12"
                ry="12"
                fill="black"
              />
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(0, 0, 0, 0.65)"
            mask="url(#tour-spotlight-mask)"
          />
        </svg>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/65 backdrop-blur-sm"
        />
      )}

      {/* Target Highlight Pulsing Ring */}
      {targetRect && !isCenter && (
        <div
          style={{
            position: "fixed",
            top: targetRect.top - 6,
            left: targetRect.left - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
            borderRadius: 12,
            zIndex: 9998,
          }}
          className="border-2 border-primary shadow-[0_0_20px_rgba(var(--primary-rgb,10,74,107),0.6)] animate-pulse pointer-events-none"
        />
      )}

      {/* Popover / Card Content */}
      <AnimatePresence mode="wait">
        {isCenter ? (
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[9999]">
            <motion.div
              key="center-dialog"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="bg-card text-card-foreground border shadow-2xl rounded-2xl p-6 sm:p-8 max-w-lg w-full relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-blue-500 to-indigo-500" />
              
              <button
                onClick={onSkip}
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground p-1 rounded-lg transition-colors"
                aria-label="Skip tour"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
                  <Compass className="h-6 w-6 animate-spin-slow" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary mb-1">
                    <Sparkles className="h-3 w-3" /> Quick Setup Tour
                  </div>
                  <h3 className="text-xl font-bold tracking-tight">{step.title}</h3>
                </div>
              </div>

              <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                {step.description}
              </p>

              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-xs font-medium text-muted-foreground">
                  Step {stepIndex + 1} of {totalSteps}
                </span>

                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={onSkip} className="text-xs">
                    Skip Tour
                  </Button>
                  <Button size="sm" onClick={onNext} className="gap-1.5 text-xs font-medium">
                    Start Tour <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        ) : (
          <motion.div
            key={`step-${stepIndex}`}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            style={popoverStyle}
            className="bg-card text-card-foreground border shadow-2xl rounded-2xl p-5 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-blue-500" />

            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                  {stepIndex + 1}
                </span>
                <h4 className="font-semibold text-sm leading-snug">{step.title}</h4>
              </div>
              <button
                onClick={onSkip}
                className="text-muted-foreground hover:text-foreground p-0.5 rounded"
                aria-label="Close tour"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              {step.description}
            </p>

            {/* Stepper Progress Dots & Buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <div className="flex items-center gap-1">
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === stepIndex
                        ? "w-4 bg-primary"
                        : i < stepIndex
                        ? "w-1.5 bg-primary/40"
                        : "w-1.5 bg-muted-foreground/20"
                    }`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                {stepIndex > 0 && (
                  <Button variant="ghost" size="sm" onClick={onPrev} className="h-7 px-2 text-xs">
                    <ChevronLeft className="h-3.5 w-3.5 mr-0.5" /> Back
                  </Button>
                )}
                <Button size="sm" onClick={onNext} className="h-7 px-3 text-xs gap-1">
                  {stepIndex === totalSteps - 1 ? (
                    <>
                      Finish <CheckCircle2 className="h-3.5 w-3.5 ml-1" />
                    </>
                  ) : (
                    <>
                      Next <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body
  );
}
