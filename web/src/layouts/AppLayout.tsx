import { Outlet } from "react-router-dom";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { SidebarNav } from "@/components/SidebarNav";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export default function AppLayout() {
  const { logout } = useAuth();

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="p-4">
          <span className="font-semibold text-sm">litesoup dashboard</span>
        </SidebarHeader>
        <SidebarContent>
          <SidebarNav />
        </SidebarContent>
        <SidebarFooter className="p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={() =>
              logout().finally(() => {
                window.location.href = "/login";
              })
            }
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign out
          </Button>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="flex h-12 items-center border-b px-4 gap-2">
          <SidebarTrigger />
        </header>
        <div className="flex-1 p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
