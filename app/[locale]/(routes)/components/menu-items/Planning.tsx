import { CalendarRange } from "lucide-react";
import { NavItem } from "../nav-main";

/** Planning sits beside Projectleiding: three week calendars. */
export const getPlanningMenuItem = (): NavItem => {
  return {
    title: "Planning",
    icon: CalendarRange,
    items: [
      { title: "Planning binnendienst", url: "/planning/binnendienst" },
      { title: "Planning buitendienst", url: "/planning/buitendienst" },
      { title: "Planning Dienst Na Verkoop", url: "/planning/dienst-na-verkoop" },
    ],
  };
};

export default getPlanningMenuItem;
