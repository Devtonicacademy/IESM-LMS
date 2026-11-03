"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { toast } from "sonner";
import { Loader2, Save, Building, CreditCard, User as UserIcon, Lock, CheckCircle2, ShieldAlert, Clock, KeyRound } from "lucide-react";
import { DashboardTopbar } from "@/components/dashboard-topbar";

const NIGERIAN_BANKS = [
  "Access Bank",
  "Citibank Nigeria",
  "Ecobank Nigeria",
  "Fidelity Bank",
  "First Bank of Nigeria",
  "First City Monument Bank",
  "Guaranty Trust Bank (GTBank)",
  "Heritage Bank",
  "Keystone Bank",
  "Kuda Bank",
  "Moniepoint Microfinance Bank",
  "Opay",
  "Palmpay",
  "Polaris Bank",
  "Providus Bank",
  "Stanbic IBTC Bank",
  "Standard Chartered Bank",
  "Sterling Bank",
  "SunTrust Bank",
  "Titan Trust Bank",
  "Union Bank of Nigeria",
  "United Bank for Africa (UBA)",
  "Unity Bank",
  "Wema Bank",
  "Zenith Bank",
].sort();

export default function SettingsPage() {
  const params = useParams();
  const schoolSlug = params.schoolSlug as string;
  const router = useRouter();
  const { user, isAdmin, isSuperAdmin, loading: authLoading } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [courseStudyDuration, setCourseStudyDuration] = useState<number>(6);
  
  const [bankSettings, setBankSettings] = useState({
    bankName: "",
    accountName: "",
    accountNumber: "",
  });

  const [paystackSettings, setPaystackSettings] = useState({
    enabled: false,
    autoApprovePayments: false,
    publicKey: "",
    secretKey: "",
  });

  const [aiApiKey, setAiApiKey] = useState("");
  const [savingAiKey, setSavingAiKey] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push(`/${schoolSlug}/dashboard`);
      return;
    }

    if (user && isAdmin) {
      fetchSettings();
    }
  }, [user, isAdmin, authLoading, schoolSlug, router]);

  const fetchSettings = async () => {
    try {
      const paymentRef = doc(db, "schools", schoolSlug, "settings", "payment");
      const secretsRef = doc(db, "schools", schoolSlug, "settings", "secrets");
      
      const [paymentSnap, secretsSnap] = await Promise.all([
        getDoc(paymentRef),
        getDoc(secretsRef)
      ]);

      if (paymentSnap.exists()) {
        const pData = paymentSnap.data();
        setBankSettings({
          bankName: pData.bankName || "",
          accountName: pData.accountName || "",
          accountNumber: pData.accountNumber || "",
        });
        setPaystackSettings(prev => ({
          ...prev,
          enabled: !!pData.paystackEnabled,
          autoApprovePayments: !!pData.autoApprovePayments,
          publicKey: pData.paystackPublicKey || "",
        }));
        setCourseStudyDuration(pData.courseStudyDuration !== undefined ? Number(pData.courseStudyDuration) : 6);
      }

      if (secretsSnap.exists()) {
        const sData = secretsSnap.data();
        setPaystackSettings(prev => ({
          ...prev,
          secretKey: sData.paystackSecretKey || "",
        }));
        setAiApiKey(sData.aiApiKey || "");
      }
    } catch (err) {
      console.error("Error fetching settings:", err);
      toast.error("Failed to load settings.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (isSuperAdmin && (!bankSettings.bankName || !bankSettings.accountName || !bankSettings.accountNumber)) {
      toast.error("Please fill in all bank details.");
      return;
    }

    setSaving(true);
    try {
      const paymentRef = doc(db, "schools", schoolSlug, "settings", "payment");
      const secretsRef = doc(db, "schools", schoolSlug, "settings", "secrets");

      await Promise.all([
        setDoc(paymentRef, {
          bankName: bankSettings.bankName,
          accountName: bankSettings.accountName,
          accountNumber: bankSettings.accountNumber,
          paystackEnabled: paystackSettings.enabled,
          autoApprovePayments: paystackSettings.autoApprovePayments,
          paystackPublicKey: paystackSettings.publicKey,
          courseStudyDuration: Number(courseStudyDuration),
          updatedAt: new Date(),
        }, { merge: true }),
        setDoc(secretsRef, {
          paystackSecretKey: paystackSettings.secretKey,
          updatedAt: new Date(),
        }, { merge: true }),
      ]);

      toast.success("Settings saved successfully!");
    } catch (err) {
      console.error("Error saving settings:", err);
      toast.error("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAiKey = async () => {
    setSavingAiKey(true);
    try {
      const secretsRef = doc(db, "schools", schoolSlug, "settings", "secrets");
      await setDoc(secretsRef, { aiApiKey: aiApiKey.trim(), updatedAt: new Date() }, { merge: true });
      toast.success("AI API key saved successfully!");
    } catch (err) {
      console.error("Error saving AI key:", err);
      toast.error("Failed to save AI API key.");
    } finally {
      setSavingAiKey(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 w-full">
      <DashboardTopbar breadcrumb="Admin / Settings" />

      <div className="p-6 md:p-8 max-w-3xl mx-auto w-full space-y-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Platform Settings</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure platform-wide settings like payment information.
          </p>
        </div>

        {/* Roles & Permissions Link */}
        <div className="bg-muted/30 border border-border/50 border-dashed rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              Roles & Permissions
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Are you a Super Admin? Manage global access control and permission toggles for user roles.
            </p>
          </div>
          <button
            onClick={() => router.push(`/${schoolSlug}/admin/settings/roles`)}
            className="inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors bg-background border border-border hover:bg-muted hover:text-foreground h-10 px-4 py-2 shrink-0 shadow-sm"
          >
            Manage Permissions
          </button>
        </div>

        {/* Course progression/rules Configuration */}
        <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
          <div className="p-5 border-b bg-muted/40">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Course &amp; Study Progression Rules
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Configure minimum learning duration constraints before assessments are unlocked.
            </p>
          </div>
          <div className="p-6 space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Preparation Time Span (Weeks)
              </label>
              <input
                type="number"
                min="0"
                value={courseStudyDuration}
                onChange={(e) => setCourseStudyDuration(Math.max(0, parseInt(e.target.value) || 0))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <p className="text-xs text-muted-foreground mt-1">
                The number of weeks a student must be enrolled in a course before quizzes, case studies, timesheet activities, and final projects/exams unlock. Default is 6 weeks.
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Rules
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* AI Content Generation API Key */}
        <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
          <div className="p-5 border-b bg-muted/40">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              AI Content Generation
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              API key used to auto-generate quizzes, timesheets, and projects when creating or editing courses.
            </p>
          </div>
          <div className="p-6 space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                AI API Key
              </label>
              <input
                type="password"
                value={aiApiKey}
                onChange={(e) => setAiApiKey(e.target.value)}
                placeholder="Paste your AI API key here..."
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <p className="text-xs text-muted-foreground">The key is stored securely in a separate collection and never exposed to students or instructors.</p>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                onClick={handleSaveAiKey}
                disabled={savingAiKey}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
              >
                {savingAiKey ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Key
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
        {/* Bank Transfer Configuration — Super Admins only */}
        {isSuperAdmin && (
          <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
            <div className="p-5 border-b bg-muted/40">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Building className="h-5 w-5 text-primary" />
                Bank Transfer Configuration
              </h3>
            <p className="text-sm text-muted-foreground mt-1">
              These details will be displayed to students when they enroll in paid courses.
            </p>
          </div>
          <div className="p-6 space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                Bank Name
              </label>
              <select
                value={bankSettings.bankName}
                onChange={(e) => setBankSettings({ ...bankSettings, bankName: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="" disabled>Select a bank...</option>
                {NIGERIAN_BANKS.map((bank) => (
                  <option key={bank} value={bank}>
                    {bank}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <UserIcon className="h-4 w-4 text-muted-foreground" />
                Account Name
              </label>
              <input
                type="text"
                value={bankSettings.accountName}
                onChange={(e) => setBankSettings({ ...bankSettings, accountName: e.target.value })}
                placeholder="e.g. IESM Academy Ltd"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                Account Number
              </label>
              <input
                type="text"
                value={bankSettings.accountNumber}
                onChange={(e) => setBankSettings({ ...bankSettings, accountNumber: e.target.value })}
                placeholder="e.g. 0123456789"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            
            <div className="pt-2 flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
        )}

        {/* Paystack Integration — Super Admins only */}
        {isSuperAdmin && (
          <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
          <div className="p-5 border-b bg-muted/40">
            <h3 className="text-lg font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Paystack Integration
              </span>
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Configure Paystack to enable automated card and bank transfer verifications.
            </p>
          </div>
          <div className="p-6 space-y-5">
            <div className="flex flex-col gap-4 mb-6">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="paystackEnabled"
                  checked={paystackSettings.enabled}
                  onChange={(e) => setPaystackSettings({ ...paystackSettings, enabled: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <label htmlFor="paystackEnabled" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Enable Paystack Gateway
                </label>
              </div>

              <div className="flex items-center space-x-3 border-l-2 pl-4 border-primary/20">
                <input
                  type="checkbox"
                  id="autoApprove"
                  checked={paystackSettings.autoApprovePayments}
                  onChange={(e) => setPaystackSettings({ ...paystackSettings, autoApprovePayments: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <div className="flex flex-col gap-1">
                    <label htmlFor="autoApprove" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Auto-Approve Payments
                    </label>
                    <span className="text-xs text-muted-foreground">Automatically enroll students upon successful Paystack payment without waiting for Admin review.</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                Public Key (Client)
              </label>
              <input
                type="text"
                value={paystackSettings.publicKey}
                onChange={(e) => setPaystackSettings({ ...paystackSettings, publicKey: e.target.value })}
                placeholder="pk_test_..."
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                Secret Key (Server)
              </label>
              <input
                type="password"
                value={paystackSettings.secretKey}
                onChange={(e) => setPaystackSettings({ ...paystackSettings, secretKey: e.target.value })}
                placeholder="sk_test_..."
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <p className="text-xs text-muted-foreground">Secret key is securely stored in a separate collection and never exposed to clients.</p>
            </div>
            
            <div className="pt-2 flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
        )}

      </div>
    </div>
  );
}
