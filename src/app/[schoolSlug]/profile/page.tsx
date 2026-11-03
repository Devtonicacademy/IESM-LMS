"use client";

import { use, useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { db, storage, auth } from "@/lib/firebase";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { updateProfile } from "firebase/auth";
import { DashboardTopbar } from "@/components/dashboard-topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
    User,
    Camera,
    Save,
    Loader2,
    Phone,
    MapPin,
    Globe,
    Calendar,
    GraduationCap,
    Building2,
    Briefcase,
    FileSignature,
    Type,
    Upload,
    Shield,
    RefreshCw,
    ChevronRight,
    BadgeCheck,
} from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

const NATIONALITIES = [
    "Nigerian", "American", "British", "Canadian", "Ghanaian",
    "Kenyan", "South African", "Other",
];

const GENDERS = ["Male", "Female", "Other", "Prefer not to say"];

const fadeUp = {
    hidden: { opacity: 0, y: 24 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: { delay: i * 0.08, duration: 0.4, ease: "easeOut" as const },
    }),
};

function SectionCard({
    icon: Icon,
    title,
    description,
    children,
    index = 0,
}: {
    icon: React.ElementType;
    title: string;
    description?: string;
    children: React.ReactNode;
    index?: number;
}) {
    return (
        <motion.div
            custom={index}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
        >
            <Card className="border-border/50 shadow-sm rounded-2xl overflow-hidden">
                <CardHeader className="pb-4 border-b border-border/40 bg-muted/20">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <Icon className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-base font-semibold">{title}</CardTitle>
                            {description && (
                                <CardDescription className="text-xs mt-0.5">{description}</CardDescription>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-6">{children}</CardContent>
            </Card>
        </motion.div>
    );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <Label className="text-sm font-medium text-muted-foreground">{label}</Label>
            {children}
        </div>
    );
}

function StyledInput({
    value,
    onChange,
    type = "text",
    placeholder,
    disabled,
    icon: Icon,
}: {
    value: string;
    onChange: (v: string) => void;
    type?: string;
    placeholder?: string;
    disabled?: boolean;
    icon?: React.ElementType;
}) {
    return (
        <div className="relative group">
            {Icon && (
                <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors pointer-events-none" />
            )}
            <Input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                disabled={disabled}
                className={cn(
                    "h-11 rounded-xl bg-muted/30 border-transparent focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/30 transition-all",
                    Icon && "pl-10"
                )}
            />
        </div>
    );
}

export default function ProfilePage({ params }: { params: Promise<{ schoolSlug: string }> }) {
    const { schoolSlug } = use(params);
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    // ── Profile picture ────────────────────────────────────────────
    const [photoURL, setPhotoURL] = useState("");
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const photoInputRef = useRef<HTMLInputElement>(null);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);

    // ── Personal info ──────────────────────────────────────────────
    const [fullName, setFullName] = useState("");
    const [dob, setDob] = useState("");
    const [gender, setGender] = useState("");
    const [contactAddress, setContactAddress] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [nationality, setNationality] = useState("");
    const [bio, setBio] = useState("");

    // ── Membership category ────────────────────────────────────────
    const [membershipCategory, setMembershipCategory] = useState("");

    // ── Student-specific ───────────────────────────────────────────
    const [institutionName, setInstitutionName] = useState("");
    const [courseOfStudy, setCourseOfStudy] = useState("");
    const [graduationDate, setGraduationDate] = useState("");

    // ── Corporate-specific ─────────────────────────────────────────
    const [companyName, setCompanyName] = useState("");
    const [businessSector, setBusinessSector] = useState("");
    const [companyAddress, setCompanyAddress] = useState("");
    const [contactPerson, setContactPerson] = useState("");
    const [position, setPosition] = useState("");

    // ── Signature ──────────────────────────────────────────────────
    const [signatureType, setSignatureType] = useState<"text" | "image">("text");
    const [signatureText, setSignatureText] = useState("");
    const [signatureImageUrl, setSignatureImageUrl] = useState("");
    const [signatureFile, setSignatureFile] = useState<File | null>(null);
    const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
    const sigInputRef = useRef<HTMLInputElement>(null);

    // ── UI state ───────────────────────────────────────────────────
    const [firestoreData, setFirestoreData] = useState<any>(null);
    const [pageLoading, setPageLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // ── Auth guard ─────────────────────────────────────────────────
    useEffect(() => {
        if (!authLoading && !user) router.push(`/${schoolSlug}/auth/login`);
    }, [authLoading, user, router, schoolSlug]);

    // ── Load Firestore profile data ────────────────────────────────
    const loadProfile = useCallback(async () => {
        if (!user) return;
        try {
            const snap = await getDoc(doc(db, "schools", schoolSlug, "users", user.uid));
            if (snap.exists()) {
                const data = snap.data();
                setFirestoreData(data);

                // Personal info
                const pi = data.membershipApplication?.personalInfo || {};
                setFullName(data.displayName || pi.fullName || "");
                setDob(pi.dob || "");
                setGender(pi.gender || "");
                setContactAddress(pi.contactAddress || "");
                setPhoneNumber(pi.phoneNumber || "");
                setNationality(pi.nationality || "");
                setBio(data.bio || "");
                setPhotoURL(data.photoURL || user.photoURL || "");

                // Membership
                const cat = data.membershipApplication?.membershipCategory || "";
                setMembershipCategory(cat);
                const specific = data.membershipApplication?.categorySpecificInfo || {};
                if (cat === "Student Membership") {
                    setInstitutionName(specific.institutionName || "");
                    setCourseOfStudy(specific.courseOfStudy || "");
                    setGraduationDate(specific.graduationDate || "");
                } else if (cat === "Corporate Membership") {
                    setCompanyName(specific.companyName || "");
                    setBusinessSector(specific.businessSector || "");
                    setCompanyAddress(specific.address || "");
                    setContactPerson(specific.contactPerson || "");
                    setPosition(specific.position || "");
                }

                // Signature
                const decl = data.membershipApplication?.declaration || {};
                if (decl.signatureType === "image") {
                    setSignatureType("image");
                    setSignatureImageUrl(decl.signature || "");
                } else {
                    setSignatureType("text");
                    setSignatureText(decl.signature || "");
                }
            }
        } catch (err) {
            console.error("Failed to load profile", err);
        } finally {
            setPageLoading(false);
        }
    }, [user, schoolSlug]);

    useEffect(() => { loadProfile(); }, [loadProfile]);

    // ── Photo picker ───────────────────────────────────────────────
    function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setPhotoFile(file);
        setPhotoPreview(URL.createObjectURL(file));
    }

    // ── Signature image picker ─────────────────────────────────────
    function handleSigImageChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setSignatureFile(file);
        setSignaturePreview(URL.createObjectURL(file));
    }

    // ── Upload photo to Storage ────────────────────────────────────
    async function uploadPhoto(): Promise<string | null> {
        if (!photoFile || !user) return null;
        const storageRef = ref(storage, `profilePictures/${user.uid}_${Date.now()}`);
        await uploadBytes(storageRef, photoFile);
        return getDownloadURL(storageRef);
    }

    // ── Upload signature image ─────────────────────────────────────
    async function uploadSignatureImage(): Promise<string | null> {
        if (!signatureFile || !user) return null;
        const storageRef = ref(storage, `signatures/${user.uid}_sig_${Date.now()}`);
        await uploadBytes(storageRef, signatureFile);
        return getDownloadURL(storageRef);
    }

    // ── Save all ───────────────────────────────────────────────────
    async function handleSave() {
        if (!user) return;
        setSaving(true);
        try {
            // Upload new photo if selected
            let finalPhotoURL = photoURL;
            if (photoFile) {
                const url = await uploadPhoto();
                if (url) finalPhotoURL = url;
            }

            // Upload new signature image if selected
            let finalSignature = signatureType === "text" ? signatureText : signatureImageUrl;
            if (signatureType === "image" && signatureFile) {
                const url = await uploadSignatureImage();
                if (url) finalSignature = url;
            }

            // Build category-specific info
            let categorySpecificInfo: Record<string, string> = {};
            if (membershipCategory === "Student Membership") {
                categorySpecificInfo = { institutionName, courseOfStudy, graduationDate };
            } else if (membershipCategory === "Corporate Membership") {
                categorySpecificInfo = {
                    companyName, businessSector,
                    address: companyAddress, contactPerson, position,
                };
            }

            // Update Firestore
            const updatePayload: Record<string, any> = {
                displayName: fullName.trim(),
                photoURL: finalPhotoURL,
                bio: bio,
                updatedAt: serverTimestamp(),
                "membershipApplication.personalInfo.fullName": fullName.trim(),
                "membershipApplication.personalInfo.dob": dob,
                "membershipApplication.personalInfo.gender": gender,
                "membershipApplication.personalInfo.contactAddress": contactAddress,
                "membershipApplication.personalInfo.phoneNumber": phoneNumber,
                "membershipApplication.personalInfo.nationality": nationality,
                "membershipApplication.declaration.signature": finalSignature,
                "membershipApplication.declaration.signatureType": signatureType,
                "membershipApplication.declaration.name": fullName.trim(),
            };

            // Category-specific fields
            if (membershipCategory) {
                Object.entries(categorySpecificInfo).forEach(([k, v]) => {
                    updatePayload[`membershipApplication.categorySpecificInfo.${k}`] = v;
                });
            }

            await updateDoc(doc(db, "schools", schoolSlug, "users", user.uid), updatePayload);

            // Update Firebase Auth profile
            if (auth.currentUser) {
                await updateProfile(auth.currentUser, {
                    displayName: fullName.trim(),
                    photoURL: finalPhotoURL || null,
                });
            }

            // Reset photo file states
            setPhotoURL(finalPhotoURL);
            setPhotoFile(null);
            setPhotoPreview(null);

            if (signatureType === "image" && signatureFile) {
                setSignatureImageUrl(finalSignature);
                setSignatureFile(null);
                setSignaturePreview(null);
            }

            toast.success("Profile updated successfully!");
        } catch (err: any) {
            console.error(err);
            toast.error("Failed to save profile. Please try again.");
        } finally {
            setSaving(false);
        }
    }

    if (authLoading || pageLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!user) return null;

    const displayPhoto = photoPreview || photoURL || null;
    const initials = (fullName || user.email || "?")
        .split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

    return (
        <div className="flex flex-col flex-1 w-full min-h-full">
            <DashboardTopbar breadcrumb="Dashboard / My Profile" />

            {/* ── Hero Banner ─────────────────────────────────────── */}
            <div className="relative h-40 md:h-52 bg-gradient-to-br from-[#0A4A6B] via-primary to-[#1a6a9a] shrink-0">
                {/* Decorative SVG waves */}
                <svg
                    className="absolute inset-0 w-full h-full opacity-20"
                    viewBox="0 0 1200 300"
                    preserveAspectRatio="none"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        d="M0,160 C150,200 350,80 600,120 C850,160 1050,60 1200,100 L1200,300 L0,300 Z"
                        fill="white"
                    />
                    <path
                        d="M0,200 C200,160 400,240 600,200 C800,160 1000,220 1200,180 L1200,300 L0,300 Z"
                        fill="white"
                        opacity="0.5"
                    />
                </svg>

                {/* Floating blobs */}
                <div className="absolute -top-10 -right-10 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
                <div className="absolute top-4 left-1/4 w-40 h-40 bg-[#F4C400]/20 rounded-full blur-2xl" />
                <div className="absolute -bottom-8 left-10 w-48 h-48 bg-white/10 rounded-full blur-3xl" />

                {/* Bottom fade into page */}
                <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-background to-transparent" />
            </div>

            <div className="px-4 md:px-8 pb-12 max-w-4xl mx-auto w-full -mt-20 space-y-6">

                {/* ── Profile picture + name header ───────────────── */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative z-10 flex flex-col sm:flex-row sm:items-end gap-4"
                >
                    {/* Avatar uploader */}
                    <div className="relative group w-28 h-28 shrink-0">
                        <Avatar className="w-28 h-28 border-4 border-background shadow-xl">
                            <AvatarImage src={displayPhoto || undefined} alt={fullName} className="object-cover" />
                            <AvatarFallback className="text-3xl font-bold bg-primary/20 text-primary">
                                {initials}
                            </AvatarFallback>
                        </Avatar>
                        <button
                            type="button"
                            onClick={() => photoInputRef.current?.click()}
                            className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-1 cursor-pointer"
                        >
                            <Camera className="h-6 w-6" />
                            <span className="text-[10px] font-bold">Change</span>
                        </button>
                        <input
                            type="file"
                            accept="image/*"
                            ref={photoInputRef}
                            onChange={handlePhotoChange}
                            className="hidden"
                        />
                        {photoFile && (
                            <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow">
                                <BadgeCheck className="w-3.5 h-3.5 text-white" />
                            </span>
                        )}
                    </div>

                    {/* Name + role */}
                    <div className="flex-1 pb-2">
                        <h1 className="text-2xl font-bold tracking-tight leading-tight">
                            {fullName || user.displayName || "Your Name"}
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">{user.email}</p>
                        {membershipCategory && (
                            <span className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                                <Shield className="w-3 h-3" /> {membershipCategory}
                            </span>
                        )}
                    </div>

                    {/* Save button (desktop) */}
                    <div className="hidden sm:block pb-2">
                        <Button
                            onClick={handleSave}
                            disabled={saving}
                            className="rounded-xl h-10 px-6 gap-2 shadow-lg shadow-primary/20"
                        >
                            {saving ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                            ) : (
                                <><Save className="w-4 h-4" /> Save Changes</>
                            )}
                        </Button>
                    </div>
                </motion.div>


                {/* ── Personal Information ────────────────────────── */}
                <SectionCard
                    icon={User}
                    title="Personal Information"
                    description="Your basic profile details"
                    index={0}
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <FieldRow label="Full Name">
                            <StyledInput value={fullName} onChange={setFullName} placeholder="Your full name" icon={User} />
                        </FieldRow>
                        <FieldRow label="Date of Birth">
                            <StyledInput value={dob} onChange={setDob} type="date" icon={Calendar} />
                        </FieldRow>
                        <FieldRow label="Gender">
                            <Select value={gender} onValueChange={(v) => setGender(v ?? "")}>
                                <SelectTrigger className="h-11 rounded-xl bg-muted/30 border-transparent focus:ring-2 focus:ring-primary/30">
                                    <SelectValue placeholder="Select gender" />
                                </SelectTrigger>
                                <SelectContent>
                                    {GENDERS.map((g) => (
                                        <SelectItem key={g} value={g}>{g}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </FieldRow>
                        <FieldRow label="Nationality">
                            <Select value={nationality} onValueChange={(v) => setNationality(v ?? "")}>
                                <SelectTrigger className="h-11 rounded-xl bg-muted/30 border-transparent focus:ring-2 focus:ring-primary/30">
                                    <SelectValue placeholder="Select nationality" />
                                </SelectTrigger>
                                <SelectContent>
                                    {NATIONALITIES.map((n) => (
                                        <SelectItem key={n} value={n}>{n}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </FieldRow>
                        <FieldRow label="Phone Number">
                            <StyledInput value={phoneNumber} onChange={setPhoneNumber} type="tel" placeholder="+234 ..." icon={Phone} />
                        </FieldRow>
                        <FieldRow label="Contact Address">
                            <StyledInput value={contactAddress} onChange={setContactAddress} placeholder="Your address" icon={MapPin} />
                        </FieldRow>
                    </div>
                    {/* Bio — full width below the grid */}
                    <div className="mt-5 space-y-1.5">
                        <Label className="text-sm font-medium text-muted-foreground">Bio / About Me</Label>
                        <Textarea
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            placeholder="Tell others a little about yourself…"
                            rows={4}
                            className="rounded-xl bg-muted/30 border-transparent focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/30 resize-none transition-all"
                        />
                    </div>
                </SectionCard>

                {/* ── Student Membership Details ──────────────────── */}
                {membershipCategory === "Student Membership" && (
                    <SectionCard
                        icon={GraduationCap}
                        title="Student Membership Details"
                        description="Your academic institution and course information"
                        index={1}
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <FieldRow label="Name of Institution">
                                <StyledInput value={institutionName} onChange={setInstitutionName} placeholder="University / College name" icon={Building2} />
                            </FieldRow>
                            <FieldRow label="Course of Study">
                                <StyledInput value={courseOfStudy} onChange={setCourseOfStudy} placeholder="e.g. Occupational Safety" icon={GraduationCap} />
                            </FieldRow>
                            <FieldRow label="Expected Graduation Date">
                                <StyledInput value={graduationDate} onChange={setGraduationDate} type="date" icon={Calendar} />
                            </FieldRow>
                        </div>
                    </SectionCard>
                )}

                {/* ── Corporate Membership Details ────────────────── */}
                {membershipCategory === "Corporate Membership" && (
                    <SectionCard
                        icon={Building2}
                        title="Corporate Membership Details"
                        description="Your company and professional information"
                        index={1}
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <FieldRow label="Company Name">
                                <StyledInput value={companyName} onChange={setCompanyName} placeholder="Company name" icon={Building2} />
                            </FieldRow>
                            <FieldRow label="Business Sector">
                                <StyledInput value={businessSector} onChange={setBusinessSector} placeholder="e.g. Oil & Gas, Construction" icon={Briefcase} />
                            </FieldRow>
                            <FieldRow label="Company Address">
                                <StyledInput value={companyAddress} onChange={setCompanyAddress} placeholder="Company address" icon={MapPin} />
                            </FieldRow>
                            <FieldRow label="Contact Person">
                                <StyledInput value={contactPerson} onChange={setContactPerson} placeholder="Name of contact person" icon={User} />
                            </FieldRow>
                            <FieldRow label="Your Position / Title">
                                <StyledInput value={position} onChange={setPosition} placeholder="e.g. HSE Manager" icon={Briefcase} />
                            </FieldRow>
                        </div>
                    </SectionCard>
                )}

                {/* ── Signature ───────────────────────────────────── */}
                <SectionCard
                    icon={FileSignature}
                    title="Declaration & Signature"
                    description="Your signature on the membership declaration"
                    index={2}
                >
                    <div className="space-y-4">
                        {/* Toggle */}
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">Signature Type</Label>
                            <div className="flex bg-muted/60 p-1 rounded-xl gap-1">
                                <button
                                    type="button"
                                    onClick={() => setSignatureType("text")}
                                    className={cn(
                                        "px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5",
                                        signatureType === "text"
                                            ? "bg-background shadow-sm text-primary"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <Type className="w-3 h-3" /> Text
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSignatureType("image")}
                                    className={cn(
                                        "px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5",
                                        signatureType === "image"
                                            ? "bg-background shadow-sm text-primary"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <Upload className="w-3 h-3" /> Image
                                </button>
                            </div>
                        </div>

                        {signatureType === "text" ? (
                            <div className="relative group">
                                <FileSignature className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors pointer-events-none" />
                                <Input
                                    value={signatureText}
                                    onChange={(e) => setSignatureText(e.target.value)}
                                    placeholder="Type your full name as signature"
                                    className="h-11 pl-10 rounded-xl bg-muted/30 border-transparent focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/30 font-serif italic text-lg"
                                />
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {/* Current or preview */}
                                {(signaturePreview || signatureImageUrl) && (
                                    <div className="relative w-full h-24 rounded-xl border bg-muted/30 overflow-hidden">
                                        <Image
                                            src={signaturePreview || signatureImageUrl}
                                            alt="Signature"
                                            fill
                                            className="object-contain"
                                        />
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={() => sigInputRef.current?.click()}
                                    className="w-full border-2 border-dashed border-muted-foreground/30 rounded-xl p-5 text-center hover:border-primary/50 hover:bg-muted/30 transition-all flex flex-col items-center gap-2 text-muted-foreground cursor-pointer group"
                                >
                                    <Upload className="w-6 h-6 group-hover:text-primary transition-colors" />
                                    <span className="text-sm font-medium group-hover:text-primary transition-colors">
                                        {signaturePreview || signatureImageUrl
                                            ? "Upload a new signature image"
                                            : "Click to upload signature image"}
                                    </span>
                                    <span className="text-xs">PNG, JPG up to 5MB</span>
                                </button>
                                <input
                                    type="file"
                                    accept="image/*"
                                    ref={sigInputRef}
                                    onChange={handleSigImageChange}
                                    className="hidden"
                                />
                            </div>
                        )}
                    </div>
                </SectionCard>

                {/* ── Account Info (read-only) ─────────────────────── */}
                <SectionCard
                    icon={Shield}
                    title="Account Information"
                    description="System-managed details — contact an admin to change these"
                    index={3}
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <FieldRow label="Email Address">
                            <div className="relative">
                                <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                <Input
                                    value={user.email || ""}
                                    disabled
                                    className="h-11 pl-10 rounded-xl bg-muted/50 border-transparent text-muted-foreground cursor-not-allowed"
                                />
                            </div>
                        </FieldRow>
                        <FieldRow label="User ID">
                            <Input
                                value={user.uid}
                                disabled
                                className="h-11 rounded-xl bg-muted/50 border-transparent text-muted-foreground text-xs cursor-not-allowed"
                            />
                        </FieldRow>
                        <FieldRow label="Membership Category">
                            <Input
                                value={membershipCategory || "Not set"}
                                disabled
                                className="h-11 rounded-xl bg-muted/50 border-transparent text-muted-foreground cursor-not-allowed"
                            />
                        </FieldRow>
                        <FieldRow label="Session">
                            <Input
                                value={firestoreData?.session || "Not assigned"}
                                disabled
                                className="h-11 rounded-xl bg-muted/50 border-transparent text-muted-foreground cursor-not-allowed"
                            />
                        </FieldRow>
                    </div>
                </SectionCard>

                {/* ── Save button (mobile) ─────────────────────────── */}
                <motion.div
                    custom={4}
                    initial="hidden"
                    animate="visible"
                    variants={fadeUp}
                    className="sm:hidden"
                >
                    <Button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full h-12 rounded-2xl font-bold text-base gap-2 shadow-lg shadow-primary/20"
                    >
                        {saving ? (
                            <><Loader2 className="w-5 h-5 animate-spin" /> Saving Changes...</>
                        ) : (
                            <><Save className="w-5 h-5" /> Save Changes <ChevronRight className="w-4 w-4" /></>
                        )}
                    </Button>
                </motion.div>
            </div>
        </div>
    );
}
