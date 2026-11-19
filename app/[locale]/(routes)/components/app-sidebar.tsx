"use client";

import * as React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import Image from "next/image";
import { Puzzle } from "lucide-react";
import { cn } from "@/lib/utils";
import { NavMain } from "./nav-main";
import { NavUser } from "./nav-user";
import getCrmMenuItem from "./menu-items/Crm";
import getEmailsMenuItem from "./menu-items/Emails";
import getDocumentsMenuItem from "./menu-items/Documents";
import getAdministrationMenuItem from "./menu-items/Administration";
import { partnerNavItems } from "@/lib/partner-routes";

/**
 * AppSidebar Component - Task Groups 1.2, 2.2-2.7, 3.1, 5.3, 5.4
 *
 * Core sidebar component for NextCRM application layout.
 * Implements shadcn/ui sidebar pattern with:
 * - TILO wordmark in the sidebar header
 * - Build version display in footer (when expanded)
 * - Navigation with the Verkoop group and the other module items
 * - Nav-user section in footer for user profile and actions
 *
 * Phase 2 Updates:
 * - The sales dashboard lives under Verkoop, not as its own top-level item
 * - Task 2.3: Added CRM module navigation (collapsible group with module filtering)
 * - Task 2.4: Added Projects module navigation (simple item with module filtering)
 * - Task 2.5: Added Emails module navigation (simple item with module filtering)
 * - Task 2.6: Added remaining module navigation items (Employees, Reports, Documents, Databox)
 * - Task 2.7: Added Administration menu with role-based visibility (role === "admin")
 * - NavMain component renders all enabled module navigation items
 * - Module filtering ensures only enabled modules appear in navigation
 * - Role-based visibility: Administration only shows for admin users
 *
 * Phase 3 Updates:
 * - Task 3.1: Added NavUser component in SidebarFooter
 * - NavUser displays user avatar, name, email
 * - NavUser provides dropdown with user actions (Profile, Settings, Logout)
 * - NavUser adapts to collapsed/expanded sidebar states
 * - Build version moved above NavUser in footer
 *
 * Phase 5 Updates (Design Consistency):
 * - Task 5.4: Changed build version text-gray-500 to text-muted-foreground for theme support
 *
 * @param modules - Array of enabled modules from system_Modules_Enabled table
 * @param dict - Localization dictionary for navigation labels
 * @param build - Build number for version display
 * @param session - User session data for role-based navigation and user profile
 */

interface User {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string | null;
  userStatus?: string;
  userLanguage?: string;
  lastLoginAt?: Date;
}

interface Session {
  user: User;
}

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  dict: any;
  session: Session;
  pluginNav?: { title: string; url: string }[];
  appName?: string;
}

export function AppSidebar({
  dict,
  session,
  pluginNav,
  appName = "TILO",
  ...props
}: AppSidebarProps) {
  const { state } = useSidebar();
  const isExpanded = state === "expanded";

  const navItems = [
    getCrmMenuItem({ localizations: dict.crm, role: session?.user?.role ?? undefined }),
    getEmailsMenuItem({ title: dict?.emails || "E-mails" }),
    getDocumentsMenuItem({ title: dict?.documents || "Documenten" }),
  ];

  if (pluginNav?.length) {
    navItems.push({ title: dict?.plugins || "Plugins", icon: Puzzle, items: pluginNav });
  }

  // Administration: admin users only
  if (session?.user?.role === "admin") {
    navItems.push(
      getAdministrationMenuItem({ title: dict?.settings || "Administration" }),
    );
  }

  // Prepare user data for NavUser component
  const userData = {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    avatar: session.user.image,
  };

  return (
    <Sidebar collapsible="icon" {...props}>
      {/* Header with Logo and Branding */}
      <SidebarHeader className="border-b border-black/10">
        <div
          className={cn(
            "flex items-center py-1",
            isExpanded ? "gap-3 px-1" : "justify-center",
          )}
        >
          <Image
            src="/brand/thielemans-mark.png"
            alt=""
            width={80}
            height={80}
            priority
            className="size-9 shrink-0"
          />
          <div className={cn("min-w-0 leading-none", !isExpanded && "sr-only")}>
            <p className="truncate text-xl font-bold tracking-tight text-black">{appName}</p>
            <p className="mt-1 truncate text-[11px] font-medium text-black/70">Thielemans</p>
          </div>
        </div>
      </SidebarHeader>

      {/* Main Content - Navigation */}
      <SidebarContent>
        {/* NavMain component with all enabled module navigation items */}
        <NavMain
          items={session?.user?.role === "partner" ? partnerNavItems(navItems) : navItems}
          dict={dict}
        />
      </SidebarContent>

      {/* Footer with NavUser and Build Version */}
      <SidebarFooter>
        {/* Task 3.1: NavUser component with user profile and actions */}
        <NavUser user={userData} />
      </SidebarFooter>

      {/* Rail for toggling sidebar on desktop */}
      <SidebarRail />
    </Sidebar>
  );
}
