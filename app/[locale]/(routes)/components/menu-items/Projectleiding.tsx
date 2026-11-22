import { HardHat } from "lucide-react";
import { NavItem } from "../nav-main";

/** Projectleiding sits beside Verkoop: Dashboard, Projectbox and Projecten. */
export const getProjectleidingMenuItem = (): NavItem => {
  return {
    title: "Projectleiding",
    icon: HardHat,
    items: [
      { title: "Dashboard", url: "/projectleiding/dashboard" },
      { title: "Projectbox", url: "/projectleiding/projectbox" },
      { title: "Projecten", url: "/projectleiding/projecten" },
    ],
  };
};

export default getProjectleidingMenuItem;
