import { HardHat } from "lucide-react";
import { NavItem } from "../nav-main";

/** Projectleiding sits beside Verkoop: one group, and only Dashboard and Projecten under it. */
export const getProjectleidingMenuItem = (): NavItem => {
  return {
    title: "Projectleiding",
    icon: HardHat,
    items: [
      { title: "Dashboard", url: "/projectleiding/dashboard" },
      { title: "Projecten", url: "/projectleiding/projecten" },
    ],
  };
};

export default getProjectleidingMenuItem;
