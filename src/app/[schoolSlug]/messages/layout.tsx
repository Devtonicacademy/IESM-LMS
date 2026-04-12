import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { SidebarProvider } from "@/components/sidebar-context";
import { SidebarContentWrapper } from "@/components/sidebar-content-wrapper";

export default async function MessagesLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ schoolSlug: string }>;
}) {
    const { schoolSlug } = await params;

    return (
        <SidebarProvider>
            <div className="flex min-h-screen w-full bg-muted/20">
                <DashboardSidebar schoolSlug={schoolSlug} />
                <SidebarContentWrapper className="p-0 flex-1 flex flex-col overflow-hidden">{children}</SidebarContentWrapper>
            </div>
        </SidebarProvider>
    );
}
