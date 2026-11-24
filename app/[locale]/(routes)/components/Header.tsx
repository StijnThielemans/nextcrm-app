import FulltextSearch from "./FulltextSearch";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { SetLanguage } from "@/components/SetLanguage";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CommandComponent } from "@/components/CommandComponent";
import SupportComponent from "@/components/support";

type Props = {
  id: string;
  lang: string;
};

/**
 * Header Component - Task Group 3.2
 *
 * Reorganized header for new layout with shadcn dashboard-01 pattern.
 *
 * Layout Structure:
 * - Left side: SidebarTrigger (mobile menu), FulltextSearch
 * - Right side: CommandComponent, SetLanguage, ThemeToggle, SupportComponent
 *
 * Changes from previous version:
 * - Removed AvatarDropdown (functionality moved to nav-user section in sidebar)
 * - Removed unused props: name, email, avatar (now only used by nav-user)
 * - Optimized spacing and alignment for new layout
 * - SidebarTrigger added in Task 2.8.0 for mobile menu control
 *
 * Note: User profile functionality (avatar, name, email, user actions) is now
 * handled by the NavUser component in the sidebar footer (Task 3.1).
 */
const Header = ({ id, lang }: Props) => {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[hsl(215_16%_84%)] bg-card px-2 py-2 md:h-14 md:flex-nowrap md:gap-3 md:px-4 md:py-0 lg:px-8">
      <SidebarTrigger
        className="h-11 w-auto shrink-0 gap-1.5 px-2.5 text-foreground md:size-7 md:px-0 md:text-muted-foreground"
        aria-label="Menu"
      />
      <div className="order-3 min-w-0 w-full md:order-none md:w-auto md:flex-1">
        <FulltextSearch />
      </div>
      <div className="ml-auto flex items-center gap-1">
        <CommandComponent />
        <SetLanguage userId={id} />
        <ThemeToggle />
        <SupportComponent />
      </div>
    </div>
  );
};

export default Header;
