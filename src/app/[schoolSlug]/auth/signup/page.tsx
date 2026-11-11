"use client";

import { use, useState, useRef } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, db, storage } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Mail, KeyRound, Loader2, ChevronRight, UserPlus, Upload, Type, FileSignature } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function SignupPage({ params }: { params: Promise<{ schoolSlug: string }> }) {
    const { schoolSlug } = use(params);
    const router = useRouter();
    
    // Auth info
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    
    // 1. Personal Information
    const [fullName, setFullName] = useState("");
    const [dob, setDob] = useState("");
    const [gender, setGender] = useState("");
    const [contactAddress, setContactAddress] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [nationality, setNationality] = useState("");

    // 2. Membership Category
    const [membershipCategory, setMembershipCategory] = useState("Student Membership");

    // Dynamic Fields
    const [studentInfo, setStudentInfo] = useState({ institutionName: "", courseOfStudy: "", graduationDate: "" });
    const [fellowInfo, setFellowInfo] = useState({ yearsOfExperience: "", currentPosition: "", organization: "", professionalCertifications: "", paymentMethod: "", dateOfPayment: "" });
    const [corporateInfo, setCorporateInfo] = useState({ companyName: "", businessSector: "", registrationNumber: "", address: "", contactPerson: "", position: "", paymentMethod: "", dateOfPayment: "" });
    
    // Declaration & Signature
    const [signatureType, setSignatureType] = useState<"text" | "image">("text");
    const [signatureText, setSignatureText] = useState("");
    const [signatureImage, setSignatureImage] = useState<File | null>(null);
    const [signatureImagePreview, setSignatureImagePreview] = useState<string | null>(null);
    const [signatureDate, setSignatureDate] = useState("");

    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSignatureImage(file);
            setSignatureImagePreview(URL.createObjectURL(file));
        }
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const cleanEmail = email.toLowerCase().trim();

            let userCredential;
            try {
                userCredential = await createUserWithEmailAndPassword(auth, email, password);
            } catch (err: any) {
                if (err.code === "auth/email-already-in-use") {
                    toast.error("This email is already registered! Please go to Sign In, and use 'Forgot Password' if needed.");
                } else {
                    toast.error(err.message || "Failed to create account");
                }
                setLoading(false);
                return;
            }

            const user = userCredential.user;

            try {
                // Upload signature if image
                let finalSignatureUrl = "";
                if (signatureType === "image" && signatureImage) {
                    const sigRef = ref(storage, `signatures/${user.uid}_${Date.now()}`);
                    await uploadBytes(sigRef, signatureImage);
                    finalSignatureUrl = await getDownloadURL(sigRef);
                }

                const membershipData = {
                    personalInfo: { fullName, dob, gender, contactAddress, phoneNumber, nationality },
                    membershipCategory,
                    categorySpecificInfo: membershipCategory === "Student Membership" ? studentInfo : 
                                         membershipCategory === "Fellow Membership" ? fellowInfo : corporateInfo,
                    declaration: {
                        name: fullName,
                        signatureType,
                        signature: signatureType === "image" ? finalSignatureUrl : signatureText,
                        date: signatureDate
                    }
                };

                await updateProfile(user, { displayName: fullName });

                await setDoc(doc(db, "schools", schoolSlug, "users", user.uid), {
                    displayName: fullName,
                    email: cleanEmail,
                    uid: user.uid,
                    role: "student",
                    membershipApplication: membershipData,
                    session: "First Academic Session",
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });

                toast.success("Welcome! Your account has been created.");

                try {
                    await fetch('/api/send-email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: cleanEmail, name: fullName }),
                    });
                } catch (emailErr) {
                    console.error("Failed to send welcome email:", emailErr);
                }

                router.push(`/${schoolSlug}/dashboard`);
            } catch (firestoreErr: any) {
                await user.delete();
                toast.error("Failed to complete signup process.");
                console.error(firestoreErr);
            }
        } catch (err: any) {
            toast.error(err.message || "An unexpected error occurred");
        } finally {
            setLoading(false);
        }
    };

    const renderInput = (label: string, value: string, setter: (val: string) => void, type: string = "text", placeholder: string = "", required: boolean = true) => (
        <div className="space-y-2">
            <Label className="text-sm font-semibold ml-1">{label} {required && <span className="text-red-500">*</span>}</Label>
            <Input type={type} placeholder={placeholder} required={required} value={value} onChange={(e) => setter(e.target.value)} className="h-12 rounded-2xl bg-muted/30 border-transparent focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/20 transition-all" />
        </div>
    );

    const renderSelect = (label: string, value: string, setter: (val: string) => void, options: string[], placeholder: string = "", required: boolean = true) => (
        <div className="space-y-2">
            <Label className="text-sm font-semibold ml-1">{label} {required && <span className="text-red-500">*</span>}</Label>
            <Select value={value} onValueChange={(val) => setter(val as string)} required={required}>
                <SelectTrigger className="w-full h-12 rounded-2xl bg-muted/30 border-transparent focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all">
                    <SelectValue placeholder={placeholder || `Select ${label}`} />
                </SelectTrigger>
                <SelectContent>
                    {options.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );

    return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-y-auto bg-[#FAFAFA] dark:bg-black py-12">
            <div className="absolute top-0 -left-4 w-72 h-72 bg-[#0A4A6B]/10 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob fixed" />
            <div className="absolute top-0 -right-4 w-72 h-72 bg-[#F4C400]/10 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000 fixed" />

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-4xl z-10">
                <div className="mb-8 text-center space-y-2">
                    <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="flex justify-center mb-4">
                        <Image src="/iesm-logo.jpg" alt="IESM Logo" width={100} height={100} className="object-contain" priority />
                    </motion.div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F4C400]/15 text-[#0A4A6B] text-xs font-bold tracking-wider uppercase mb-4">
                        Membership Application
                    </div>
                    <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl">Create Account</h1>
                </div>

                <Card className="backdrop-blur-xl bg-white/70 dark:bg-zinc-900/70 border-white/20 dark:border-zinc-800 shadow-2xl rounded-[2rem] overflow-hidden">
                    <CardContent className="p-8">
                        <form onSubmit={handleSignup} className="space-y-10">
                            
                            {/* Login Credentials */}
                            <div className="space-y-6">
                                <h3 className="text-xl font-bold border-b pb-2 text-primary">Login Credentials</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-sm font-semibold ml-1">Email <span className="text-red-500">*</span></Label>
                                        <div className="relative group">
                                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                            <Input type="email" placeholder="name@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} className="pl-12 h-12 rounded-2xl bg-muted/30 border-transparent focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/20" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-sm font-semibold ml-1">Password <span className="text-red-500">*</span></Label>
                                        <div className="relative group">
                                            <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                            <Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="pl-12 h-12 rounded-2xl bg-muted/30 border-transparent focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/20" />
                                        </div>
                                        <p className="text-[10px] text-muted-foreground ml-1">Must be at least 6 characters</p>
                                    </div>
                                </div>
                            </div>

                            {/* Section 1 */}
                            <div className="space-y-6">
                                <h3 className="text-xl font-bold border-b pb-2 text-primary">1. Personal Information</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {renderInput("Full Name", fullName, setFullName)}
                                    {renderInput("Date of Birth", dob, setDob, "date")}
                                    {renderSelect("Gender", gender, setGender, ["Male", "Female", "Other", "Prefer not to say"], "Select Gender")}
                                    {renderInput("Contact Address", contactAddress, setContactAddress)}
                                    {renderInput("Phone Number", phoneNumber, setPhoneNumber, "tel")}
                                    {renderSelect("Nationality", nationality, setNationality, [
                                        "Nigerian", "American", "British", "Canadian", "Ghanaian", "Kenyan", "South African", "Other"
                                    ], "Select Nationality")}
                                </div>
                            </div>

                            {/* Section 2 */}
                            <div className="space-y-6">
                                <h3 className="text-xl font-bold border-b pb-2 text-primary">2. Membership Category</h3>
                                <div className="flex flex-wrap gap-4">
                                    {["Student Membership", "Corporate Membership"].map((cat) => (
                                        <label key={cat} className={`flex items-center gap-3 p-4 rounded-2xl cursor-pointer border-2 transition-all ${membershipCategory === cat ? 'border-primary bg-primary/5 shadow-md' : 'border-transparent bg-muted/30 hover:bg-muted/50'}`}>
                                            <input type="radio" name="membershipCategory" value={cat} checked={membershipCategory === cat} onChange={(e) => setMembershipCategory(e.target.value)} className="w-5 h-5 text-primary focus:ring-primary" />
                                            <span className="font-semibold">{cat}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Dynamic Forms */}
                            <AnimatePresence mode="wait">
                                <motion.div key={membershipCategory} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-6 overflow-hidden">
                                    <h3 className="text-xl font-bold border-b pb-2 text-primary uppercase">{membershipCategory} FORM</h3>
                                    
                                    {membershipCategory === "Student Membership" && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {renderInput("Name of Institution", studentInfo.institutionName, (v) => setStudentInfo({...studentInfo, institutionName: v}))}
                                            {renderInput("Course of Study", studentInfo.courseOfStudy, (v) => setStudentInfo({...studentInfo, courseOfStudy: v}))}
                                            {renderInput("Expected Graduation Date", studentInfo.graduationDate, (v) => setStudentInfo({...studentInfo, graduationDate: v}), "date")}
                                        </div>
                                    )}



                                    {membershipCategory === "Corporate Membership" && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {renderInput("Company Name", corporateInfo.companyName, (v) => setCorporateInfo({...corporateInfo, companyName: v}))}
                                            {renderInput("Business Sector", corporateInfo.businessSector, (v) => setCorporateInfo({...corporateInfo, businessSector: v}))}
                                            {renderInput("Address", corporateInfo.address, (v) => setCorporateInfo({...corporateInfo, address: v}))}
                                            {renderInput("Contact Person", corporateInfo.contactPerson, (v) => setCorporateInfo({...corporateInfo, contactPerson: v}))}
                                            {renderInput("Position", corporateInfo.position, (v) => setCorporateInfo({...corporateInfo, position: v}))}
                                            {renderInput("Date of Payment", corporateInfo.dateOfPayment, (v) => setCorporateInfo({...corporateInfo, dateOfPayment: v}), "date")}
                                        </div>
                                    )}
                                </motion.div>
                            </AnimatePresence>

                            {/* Declaration */}
                            <div className="space-y-6 bg-primary/5 p-6 rounded-2xl border border-primary/10 mt-8">
                                <h3 className="text-xl font-bold pb-2 text-primary">Declaration</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed italic">
                                    "I/We, <span className="font-bold underline decoration-primary">{fullName || "________________________"}</span>, hereby apply for {membershipCategory} and affirm that the information provided is true and accurate."
                                </p>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                                    {renderInput("Date", signatureDate, setSignatureDate, "date")}
                                </div>

                                <div className="space-y-4 pt-4 border-t border-primary/10">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-sm font-semibold">Signature <span className="text-red-500">*</span></Label>
                                        <div className="flex bg-muted/50 p-1 rounded-xl">
                                            <button type="button" onClick={() => setSignatureType("text")} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${signatureType === "text" ? "bg-white dark:bg-black shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                                                <Type className="w-3 h-3" /> Text
                                            </button>
                                            <button type="button" onClick={() => setSignatureType("image")} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${signatureType === "image" ? "bg-white dark:bg-black shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                                                <Upload className="w-3 h-3" /> Upload
                                            </button>
                                        </div>
                                    </div>

                                    {signatureType === "text" ? (
                                        <div className="relative">
                                            <FileSignature className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input type="text" placeholder="Type your full name as signature" required={signatureType === "text"} value={signatureText} onChange={(e) => setSignatureText(e.target.value)} className="pl-12 h-12 rounded-2xl bg-white dark:bg-black font-signature text-xl" />
                                        </div>
                                    ) : (
                                        <div className="border-2 border-dashed border-muted-foreground/30 rounded-2xl p-6 text-center hover:bg-white/50 transition-colors cursor-pointer relative" onClick={() => fileInputRef.current?.click()}>
                                            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageChange} className="hidden" />
                                            {signatureImagePreview ? (
                                                <div className="relative w-full h-32">
                                                    <Image src={signatureImagePreview} alt="Signature Preview" fill className="object-contain" />
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                                    <Upload className="w-8 h-8" />
                                                    <span className="text-sm font-semibold">Click to upload your signature image</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <Button type="submit" className="w-full h-14 rounded-2xl font-bold text-lg shadow-xl shadow-primary/20 gap-2 overflow-hidden relative group mt-8" disabled={loading}>
                                <span className="relative z-10 flex items-center gap-2">
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Submit Application & Create Account"}
                                    {!loading && <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                                </span>
                                <div className="absolute inset-0 bg-primary-foreground/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </Button>
                        </form>

                        <div className="mt-8 text-center text-sm border-t pt-6">
                            <span className="text-muted-foreground font-medium">Already have an account? </span>
                            <Link href={`/${schoolSlug}/auth/login`} className="text-primary hover:underline font-bold transition-all">
                                Sign In
                            </Link>
                        </div>
                    </CardContent>
                </Card>

                <div className="mt-8 pb-12 flex items-center justify-center gap-6 opacity-40 hover:opacity-80 transition-opacity cursor-default">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
                        <UserPlus className="w-3 h-3" /> Institute of Ergonomics & Safety Management
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
