"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { DashboardTopbar } from "@/components/dashboard-topbar";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { ShieldCheck, Check, Info } from "lucide-react";
import { toast } from "sonner";

// High level definitions of permissions requested by the user
const SUPER_ADMIN = "super-admin";
const ADMIN = "admin";
const INSTRUCTOR = "instructor";
const STUDENT = "student";

type PermissionKey = 
  | "canAddUsers"
  | "canAssignSuperAdmin"
  | "canUpdateCoursePrice"
  | "canAssignInstructors"
  | "canChatWithAdmin";

// The default requested mappings
const defaultPermissions: Record<string, Record<PermissionKey, boolean>> = {
  [SUPER_ADMIN]: {
    canAddUsers: true,
    canAssignSuperAdmin: true,
    canUpdateCoursePrice: true,
    canAssignInstructors: true,
    canChatWithAdmin: true,
  },
  [ADMIN]: {
    canAddUsers: true,
    canAssignSuperAdmin: false,
    canUpdateCoursePrice: true,
    canAssignInstructors: true,
    canChatWithAdmin: true,
  },
  [INSTRUCTOR]: {
    canAddUsers: false,
    canAssignSuperAdmin: false,
    canUpdateCoursePrice: false,
    canAssignInstructors: false,
    canChatWithAdmin: true,
  },
  [STUDENT]: {
    canAddUsers: false,
    canAssignSuperAdmin: false,
    canUpdateCoursePrice: false,
    canAssignInstructors: false,
    canChatWithAdmin: true, // students can use chat but maybe distinct
  }
};

const permissionLabels: Record<PermissionKey, string> = {
  canAddUsers: "Can Add Users & Modify Roles",
  canAssignSuperAdmin: "Can Assign 'Super Admin' Role",
  canUpdateCoursePrice: "Can Update Course Prices",
  canAssignInstructors: "Can Assign Instructors to Courses",
  canChatWithAdmin: "Can Chat with Administrators" // global default
};

export default function RolesSettingsPage({
  params,
}: {
  params: Promise<{ schoolSlug: string }>;
}) {
  const { schoolSlug } = use(params);
  const { user, loading, isSuperAdmin } = useAuth();
  const router = useRouter();

  const [permissions, setPermissions] = useState(defaultPermissions);
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push(`/${schoolSlug}/auth/login`);
      return;
    }
    if (!loading && user && !isSuperAdmin) {
      router.push(`/${schoolSlug}/dashboard`);
      return;
    }

    async function loadPermissions() {
      try {
        const ref = doc(db, "schools", schoolSlug, "settings", "permissions");
        const snap = await getDoc(ref);
        if (snap.exists()) {
          // Merge with default ensuring all keys exist
          const data = snap.data();
          const merged = { ...defaultPermissions };
          for (const role of [SUPER_ADMIN, ADMIN, INSTRUCTOR, STUDENT]) {
            if (data[role]) {
              merged[role] = { ...merged[role], ...data[role] };
            }
          }
          setPermissions(merged);
        }
      } catch (err) {
        console.error("Failed to load permissions", err);
      } finally {
        setFetching(false);
      }
    }

    if (isSuperAdmin) {
      loadPermissions();
    }
  }, [user, loading, isSuperAdmin, router, schoolSlug]);

  const togglePermission = (role: string, permKey: PermissionKey) => {
    // Prevent locking out Super Admin from defining roles or locking themselves
    if (role === SUPER_ADMIN && permKey === "canAssignSuperAdmin") {
      toast.error("Super Admin must retain ability to assign Super Admins.");
      return;
    }

    setPermissions(prev => ({
      ...prev,
      [role]: {
        ...prev[role],
        [permKey]: !prev[role][permKey]
      }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "schools", schoolSlug, "settings", "permissions"), permissions, { merge: true });
      toast.success("Role permissions updated successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save permissions.");
    } finally {
      setSaving(false);
    }
  };

  if (loading || fetching) return <div className="py-20 text-center">Loading settings...</div>;

  const rolesList = [SUPER_ADMIN, ADMIN, INSTRUCTOR];

  return (
    <div className="flex flex-col flex-1 w-full bg-muted/10 min-h-screen">
      <DashboardTopbar breadcrumb="Settings / Roles & Permissions" />

      <div className="p-8 max-w-5xl mx-auto w-full space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Roles & Permissions</h1>
          <p className="text-muted-foreground">
            Configure access control dynamically. Checking a box grants that specific capability to the corresponding role globally.
          </p>
        </div>

        <div className="grid gap-6">
          {rolesList.map((roleKey) => (
            <Card key={roleKey} className="border-border/50 shadow-sm overflow-hidden border-l-4" style={{ 
                borderLeftColor: roleKey === SUPER_ADMIN ? '#f59e0b' : roleKey === ADMIN ? '#e11d48' : '#3b82f6' 
            }}>
              <CardHeader className="bg-muted/30 pb-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="capitalize text-xl">{roleKey.replace("-", " ")} Role</CardTitle>
                </div>
                <CardDescription>
                  Access rights assigned to users with the {roleKey} role.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border/50">
                  {Object.keys(permissionLabels).map((pKey) => {
                    const permKey = pKey as PermissionKey;
                    const isEnabled = permissions[roleKey]?.[permKey] || false;
                    const isDisabledForSafety = roleKey === SUPER_ADMIN && permKey === "canAssignSuperAdmin";

                    return (
                      <div key={permKey} className="flex items-center justify-between p-4 hover:bg-muted/10 transition-colors">
                        <div>
                          <p className="font-medium text-sm">{permissionLabels[permKey]}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {isEnabled ? "Has access" : "No access"}
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer"
                            checked={isEnabled}
                            onChange={() => togglePermission(roleKey, permKey)}
                            disabled={isDisabledForSafety}
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/30 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex items-center justify-end pt-4 pb-12 w-full gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mr-auto">
                <Info className="h-4 w-4" />
                These updates take effect immediately on next interaction.
            </div>
          <Button size="lg" onClick={handleSave} disabled={saving} className="rounded-xl px-10 shadow-lg gap-2">
            {saving ? "Saving..." : <><Check className="h-4 w-4" /> Save Configuration</>}
          </Button>
        </div>
      </div>
    </div>
  );
}
