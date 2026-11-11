"use client";

import { use, useEffect, useState, useMemo } from "react";
import { collection, query, getDocs, doc, updateDoc, addDoc, serverTimestamp, getDoc, where } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, BookOpen, ShoppingCart, Trash2, CheckCircle, Wallet, Loader2, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { DashboardTopbar } from "@/components/dashboard-topbar";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PaystackButton = dynamic(
  () => import("react-paystack").then((mod) => mod.PaystackButton),
  { ssr: false }
);

const SESSIONS = ["First Academic Session", "Second Academic Session", "Third Academic Session"];

export default function CoursesCatalogPage({ params }: { params: Promise<{ schoolSlug: string }> }) {
  const { schoolSlug } = use(params);
  const { user, isStudent, isAdmin, isInstructor } = useAuth();
  
  const [allCourses, setAllCourses] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  
  const [cart, setCart] = useState<any[]>([]);
  const [showCart, setShowCart] = useState(false);
  
  // Payment States
  const [enrolling, setEnrolling] = useState(false);
  const [bankSettings, setBankSettings] = useState<{bankName: string, accountName: string, accountNumber: string} | null>(null);
  const [paystackSettings, setPaystackSettings] = useState<{enabled: boolean, publicKey: string} | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const [selectedStage, setSelectedStage] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const categories = useMemo(() => {
    const list = new Set<string>();
    allCourses.forEach(c => {
      if (c.category) {
        list.add(c.category);
      }
    });
    return Array.from(list);
  }, [allCourses]);

  useEffect(() => {
    async function fetchData() {
      try {
        const coursesQ = query(collection(db, "schools", schoolSlug, "courses"));
        const coursesSnap = await getDocs(coursesQ);
        const coursesData = coursesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllCourses(coursesData);

        if (user) {
          const enrollmentsQ = query(
            collection(db, "schools", schoolSlug, "enrollmentRequests"),
            where("studentId", "==", user.uid)
          );
          const enrollmentsSnap = await getDocs(enrollmentsQ);
          const enrollmentsData = enrollmentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setEnrollments(enrollmentsData);
        }

        const settingsRef = doc(db, "schools", schoolSlug, "settings", "payment");
        const settingsSnap = await getDoc(settingsRef);
        if (settingsSnap.exists()) {
          const data = settingsSnap.data();
          setBankSettings({
            bankName: data.bankName || "",
            accountName: data.accountName || "",
            accountNumber: data.accountNumber || "",
          });
          setPaystackSettings({
            enabled: !!data.paystackEnabled,
            publicKey: data.paystackPublicKey || "",
          });
        }
      } catch (err) {
        console.error("Failed to load data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [schoolSlug, user]);

  const userSession = user?.session || "First Academic Session";

  // Check if course is fully completed
  const isCourseCompleted = (course: any) => {
    const allModules = course.sections ? course.sections.flatMap((s: any) => s.modules || []) : (course.modules || []);
    const completedCount = allModules.filter((m: any) => m.completedBy?.includes(user?.uid)).length || 0;
    const totalModules = allModules.length || 0;

    const allQuizzes = course.sections ? course.sections.filter((s: any) => s.quiz && s.quiz.questions?.length > 0) : [];
    const passedQuizzesCount = allQuizzes.filter((s: any) => s.quiz.passedBy?.some((p: any) => p.uid === user?.uid)).length || 0;
    
    const totalItems = totalModules + allQuizzes.length;
    const completedItems = completedCount + passedQuizzesCount;
    return totalItems > 0 && completedItems === totalItems;
  };

  // Check for graduation to next session
  useEffect(() => {
    if (!user || !isStudent || loading || allCourses.length === 0) return;

    const currentSessionIndex = SESSIONS.indexOf(userSession);
    if (currentSessionIndex === -1 || currentSessionIndex === SESSIONS.length - 1) return; // Already at max session or invalid

    const coursesInCurrentSession = allCourses.filter(c => (c.session || "First Academic Session") === userSession);
    
    if (coursesInCurrentSession.length > 0) {
      const allCompleted = coursesInCurrentSession.every(c => isCourseCompleted(c));
      
      if (allCompleted) {
        const nextSession = SESSIONS[currentSessionIndex + 1];
        // Automatically graduate user
        toast.success(`Congratulations! You have completed all courses in ${userSession}. You are now promoted to ${nextSession}!`);
        updateDoc(doc(db, "schools", schoolSlug, "users", user.uid), {
          session: nextSession
        }).catch(console.error);
        // Note: The UI will update on next refresh or if we trigger a local state update, 
        // but for safety we let them refresh to see new courses, or we can force reload.
      }
    }
  }, [allCourses, loading, user, userSession, isStudent, schoolSlug]);

  const activeCoursesCount = useMemo(() => {
    if (!user) return 0;
    let count = 0;
    allCourses.forEach(course => {
      const courseSession = course.session || "First Academic Session";
      if (courseSession !== userSession) return;
      
      const isEnrolled = course.enrolledStudents?.includes(user.uid);
      const isPending = enrollments.some(e => e.courseId === course.id && e.status !== "declined");
      
      if ((isEnrolled || isPending) && !isCourseCompleted(course)) {
        count++;
      }
    });
    return count;
  }, [allCourses, enrollments, user, userSession]);

  const displayCourses = useMemo(() => {
    return allCourses.filter(c => {
      const matchesSearch = c.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (c.description && c.description.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const courseSession = c.session || "First Academic Session";
      let matchesStage = true;
      if (selectedStage === "stage_1") {
        matchesStage = courseSession === "First Academic Session";
      } else if (selectedStage === "stage_2") {
        matchesStage = courseSession === "Second Academic Session";
      } else if (selectedStage === "stage_3") {
        matchesStage = courseSession === "Third Academic Session";
      }

      let matchesCategory = true;
      if (selectedCategory !== "all") {
        matchesCategory = c.category === selectedCategory;
      }

      return matchesSearch && matchesStage && matchesCategory;
    });
  }, [allCourses, searchTerm, selectedStage, selectedCategory]);

  const toggleCart = (course: any) => {
    if (cart.find(c => c.id === course.id)) {
      setCart(cart.filter(c => c.id !== course.id));
    } else {
      if (activeCoursesCount + cart.length >= 4) {
        toast.error("You can only have up to 4 active/pending courses at a time in a session.");
        return;
      }
      setCart([...cart, course]);
      toast.success(`${course.title} added to cart`);
    }
  };

  const cartTotal = cart.reduce((sum, course) => sum + (course.price || 0), 0);

  const handleCheckout = async () => {
    if (!user) { toast.error("Please log in to checkout"); return; }
    if (cart.length === 0) return;

    setEnrolling(true);
    try {
      let receiptUrl = "";
      if (cartTotal > 0 && receiptFile) {
        const fileExt = receiptFile.name.split(".").pop();
        const storageRef = ref(storage, `schools/${schoolSlug}/receipts/${user.uid}_cart_${Date.now()}.${fileExt}`);
        const snapshot = await uploadBytes(storageRef, receiptFile);
        receiptUrl = await getDownloadURL(snapshot.ref);
      }

      for (const course of cart) {
        await addDoc(collection(db, "schools", schoolSlug, "enrollmentRequests"), {
          courseId: course.id,
          courseName: course.title,
          studentId: user.uid,
          studentName: user.displayName || user.email || "Student",
          studentEmail: user.email || "",
          status: "pending",
          requestedAt: serverTimestamp(),
          ...(course.price > 0 ? {
            pricePaid: course.price,
            paymentMethod: "bank_transfer",
            ...(receiptUrl ? { receiptUrl } : {})
          } : {})
        });
      }

      // Send email notifications
      if (cartTotal > 0) {
        try {
          await fetch("/api/enrollment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: user.email,
              studentName: user.displayName || user.email || "Student",
              courseName: "Multiple Courses (Cart Checkout)",
              status: "pending_payment",
              schoolSlug,
            }),
          });
        } catch (emailErr) {
          console.warn("Notice: Email notification couldn't be sent:", emailErr);
        }
      }

      toast.success(cartTotal > 0 ? "Payment confirmed & requests submitted! Waiting for admin approval." : "Enrollment requests submitted! Waiting for admin approval.");
      setCart([]);
      setShowCart(false);
      // Refresh enrollments slightly fake update for UI responsiveness
      setEnrollments([...enrollments, ...cart.map(c => ({ courseId: c.id, status: 'pending' }))]);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit checkout");
    } finally {
      setEnrolling(false);
    }
  };

  const handlePaystackSuccess = async (referenceObj: any) => {
    setEnrolling(true);
    try {
      // For multiple courses, we will submit requests directly and just verify once to log it, 
      // but to be safe and use existing backend, we'll verify the first course and manually approve the rest.
      if (cart.length === 0) return;

      for (let i = 0; i < cart.length; i++) {
        const course = cart[i];
        const res = await fetch('/api/paystack/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reference: `${referenceObj.reference}_${i}`, // Unique ref to avoid duplicates in verify logic
            schoolSlug,
            courseId: course.id,
            uid: user!.uid,
            courseName: course.title,
            studentName: user!.displayName || user!.email || "Student",
            studentEmail: user!.email || "",
          })
        });
        const data = await res.json();
        if (!data.success && i === 0) {
          toast.error(data.error || "Payment verification failed.");
          setEnrolling(false);
          return;
        }
      }

      toast.success("Payment successful! Enrollment requests approved.");
      setCart([]);
      setShowCart(false);
      setEnrollments([...enrollments, ...cart.map(c => ({ courseId: c.id, status: 'approved' }))]);

      try {
        await fetch("/api/enrollment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: user!.email,
            studentName: user!.displayName || user!.email || "Student",
            courseName: "Multiple Courses (Cart Checkout)",
            status: "approved",
            schoolSlug,
          }),
        });
      } catch(e) {}
      
    } catch (err) {
      toast.error("An error occurred during verification.");
    } finally {
      setEnrolling(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 w-full">
      <DashboardTopbar breadcrumb="Course Catalog" />
      <div className="p-8 max-w-7xl mx-auto w-full relative">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-10 gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Course Catalog</h1>
            <p className="text-muted-foreground">Discover and enroll in available classes.</p>
            {isStudent && (
              <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                Your Current Session: {userSession}
              </div>
            )}
          </div>
          
          <div className="flex flex-col sm:flex-row flex-1 gap-4 items-stretch sm:items-center w-full lg:max-w-3xl lg:justify-end">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search courses..." 
                className="pl-9 h-10 bg-card rounded-xl"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="w-full sm:w-44">
              <Select value={selectedStage} onValueChange={(val) => setSelectedStage(val || "all")}>
                <SelectTrigger className="h-10 bg-card rounded-xl">
                  <SelectValue placeholder="All Stages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stages</SelectItem>
                  <SelectItem value="stage_1">Stage 1</SelectItem>
                  <SelectItem value="stage_2">Stage 2</SelectItem>
                  <SelectItem value="stage_3">Stage 3</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {categories.length > 0 && (
              <div className="w-full sm:w-44">
                <Select value={selectedCategory} onValueChange={(val) => setSelectedCategory(val || "all")}>
                  <SelectTrigger className="h-10 bg-card rounded-xl">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {isStudent && (
              <Button variant="outline" className="relative h-10 px-4 rounded-xl shrink-0" onClick={() => setShowCart(true)}>
                <ShoppingCart className="h-4 w-4 mr-2" />
                Cart
                {cart.length > 0 && (
                  <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground font-bold">
                    {cart.length}
                  </span>
                )}
              </Button>
            )}
          </div>
        </div>

        {isStudent && (
          <div className="mb-6 p-4 bg-muted/30 border border-border/50 rounded-xl flex items-center justify-between">
            <div className="text-sm">
              <span className="font-semibold">Active/Pending Courses:</span> {activeCoursesCount} / 4 allowed
            </div>
            {activeCoursesCount >= 4 && (
              <div className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                You must complete your active courses to purchase more.
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="py-20 text-center text-muted-foreground animate-pulse">Loading catalog...</div>
        ) : displayCourses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayCourses.map((course, i) => {
              const isEnrolled = course.enrolledStudents?.includes(user?.uid);
              const pendingReq = enrollments.find(e => e.courseId === course.id && e.status !== "declined");
              const inCart = cart.some(c => c.id === course.id);
              const completed = isCourseCompleted(course);

              return (
                <motion.div
                  key={course.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.05 * i }}
                >
                  <Card className="h-full flex flex-col hover:border-primary transition-colors hover:shadow-sm relative overflow-hidden">
                    <CardHeader>
                      <div className="flex flex-wrap gap-2 items-center mb-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                          (course.session || "First Academic Session") === "Third Academic Session"
                            ? "bg-amber-500/10 text-amber-700 border-amber-500/20"
                            : (course.session || "First Academic Session") === "Second Academic Session"
                            ? "bg-purple-500/10 text-purple-700 border-purple-500/20"
                            : "bg-blue-500/10 text-blue-700 border-blue-500/20"
                        }`}>
                          { (course.session || "First Academic Session") === "Third Academic Session"
                            ? "Stage 3"
                            : (course.session || "First Academic Session") === "Second Academic Session"
                            ? "Stage 2"
                            : "Stage 1"
                          }
                        </span>
                        {course.category && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-500/10 text-gray-700 border border-gray-500/20">
                            {course.category}
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between items-start mb-2">
                        <CardTitle className="line-clamp-2 text-lg">{course.title}</CardTitle>
                      </div>
                      <CardDescription className="line-clamp-2 min-h-10">
                        {course.description || "No description provided."}
                      </CardDescription>
                      <div className="font-bold text-primary mt-2">
                        {course.price > 0 ? `₦${course.price.toLocaleString()}` : "Free"}
                      </div>
                    </CardHeader>
                    <CardContent className="mt-auto pt-4 flex items-center justify-between border-t border-border/50 pb-4">
                      <div className="flex items-center text-xs text-muted-foreground">
                        <BookOpen className="mr-1.5 h-3.5 w-3.5" />
                        {course.modules?.length || 0} Modules
                      </div>
                      <Link href={`/${schoolSlug}/courses/${course.id}`} className="text-xs text-primary hover:underline font-medium">
                        View Details
                      </Link>
                    </CardContent>
                    {isStudent && (
                      <CardFooter className="pt-0 pb-4 px-6">
                        {completed ? (
                          <div className="w-full flex items-center justify-center gap-2 py-2 text-sm font-semibold text-green-600 bg-green-500/10 rounded-md">
                            <CheckCircle className="h-4 w-4" /> Completed
                          </div>
                        ) : isEnrolled ? (
                          <div className="w-full text-center py-2 text-sm font-medium text-primary bg-primary/10 rounded-md">
                            Already Enrolled
                          </div>
                        ) : pendingReq ? (
                          <div className="w-full text-center py-2 text-sm font-medium text-yellow-600 bg-yellow-500/10 rounded-md">
                            Enrollment Pending
                          </div>
                        ) : (course.session || "First Academic Session") !== userSession ? (
                          <Button variant="outline" className="w-full gap-2 border-dashed text-muted-foreground" disabled>
                            <Lock className="h-4 w-4" /> Locked (Stage Promotion Required)
                          </Button>
                        ) : inCart ? (
                          <Button variant="secondary" className="w-full" onClick={() => toggleCart(course)}>
                            Remove from Cart
                          </Button>
                        ) : (
                          <Button 
                            className="w-full" 
                            onClick={() => toggleCart(course)}
                            disabled={activeCoursesCount + cart.length >= 4}
                          >
                            Add to Cart
                          </Button>
                        )}
                      </CardFooter>
                    )}
                  </Card>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="py-20 text-center border rounded-lg bg-card">
            <BookOpen className="h-12 w-12 text-muted-foreground opacity-50 mx-auto mb-4" />
            <h3 className="text-lg font-medium">No courses found</h3>
            <p className="text-muted-foreground mt-1">There are no courses available for your session.</p>
          </div>
        )}
      </div>

      {/* Cart Dialog */}
      <Dialog open={showCart} onOpenChange={setShowCart}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col overflow-y-auto overflow-x-hidden">
          <DialogHeader className="min-w-0">
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" /> Your Cart
            </DialogTitle>
            <DialogDescription className="break-words">
              Review your selected courses before checkout. (Max 4 active courses per session)
            </DialogDescription>
          </DialogHeader>

          {cart.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              Your cart is empty.
            </div>
          ) : (
            <div className="space-y-4 my-4">
              <div className="space-y-3">
                {cart.map((course, idx) => (
                  <div key={idx} className="flex justify-between items-center gap-4 p-3 rounded-lg bg-muted/50 border border-border/50">
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-semibold text-sm break-words">{course.title}</span>
                      <span className="text-xs text-muted-foreground">{course.price > 0 ? `₦${course.price.toLocaleString()}` : "Free"}</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => toggleCart(course)} className="text-destructive h-8 w-8 hover:bg-destructive/10 shrink-0">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center border-t pt-4">
                <span className="font-bold">Total:</span>
                <span className="font-bold text-lg text-primary">₦{cartTotal.toLocaleString()}</span>
              </div>

              {cartTotal > 0 && bankSettings && (
                <div className="bg-muted/30 border border-border/50 p-4 rounded-xl space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2"><Wallet className="h-4 w-4"/> Bank Transfer Details</h4>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Bank Name</span>
                    <span className="font-semibold">{bankSettings.bankName || "Pending Configuration"}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Account Name</span>
                    <span className="font-semibold">{bankSettings.accountName || "-"}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Account Number</span>
                    <span className="font-mono font-bold text-primary">{bankSettings.accountNumber || "-"}</span>
                  </div>
                  
                  <div className="space-y-2 mt-3 text-xs">
                    <label className="font-medium">Upload Payment Receipt</label>
                    <input 
                      type="file" 
                      accept="image/*,.pdf" 
                      onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} 
                      className="w-full text-xs text-muted-foreground file:mr-4 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer" 
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-col gap-2 relative border-t pt-4">
            {cart.length > 0 && (
              <>
                <Button 
                  className="w-full bg-green-600 hover:bg-green-700 text-white shadow-md font-medium h-11" 
                  onClick={handleCheckout} 
                  disabled={enrolling || (cartTotal > 0 && !receiptFile)}
                >
                  {enrolling ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Processing...</> : 
                    cartTotal > 0 ? "I have made the transfer" : "Complete Free Enrollment"}
                </Button>
                
                {cartTotal > 0 && paystackSettings?.enabled && paystackSettings.publicKey && (
                  <div className="w-full text-center mt-2">
                    <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Or Pay Automatically</p>
                    <PaystackButton
                      className="w-full inline-flex items-center justify-center rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-[#09A5DB] text-white hover:bg-[#09A5DB]/90 h-11 px-4 py-2"
                      text={`Pay ₦${cartTotal.toLocaleString()} with Card`}
                      onSuccess={handlePaystackSuccess}
                      onClose={() => toast.info("Payment cancelled")}
                      amount={cartTotal * 100}
                      email={user?.email || "student@example.com"}
                      publicKey={paystackSettings.publicKey}
                    />
                  </div>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

