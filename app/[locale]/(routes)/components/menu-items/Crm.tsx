import { Coins } from "lucide-react";
import { NavItem } from "../nav-main";

/**
 * CRM Module Menu Item - Task Group 2.3
 *
 * Converted from DropdownMenu pattern to collapsible sidebar group.
 * Returns a NavItem object with sub-items for all CRM routes.
 *
 * @param localizations - Localized labels for CRM module items
 * @returns NavItem object with collapsible sub-items for CRM navigation
 */

type Props = {
  localizations: {
    title: string;
    dashboard: string;
    customers: string;
    dossiers: string;
    quotes: string;
    offertebox: string;
  };
  /** Current user's role — the Approvals queue is manager/admin only. */
  role?: string;
};

export const getCrmMenuItem = ({ localizations }: Props): NavItem => {
  return {
    title: localizations.title,
    icon: Coins,
    items: [
      { title: localizations.dashboard, url: "/crm/dashboard" },
      { title: localizations.customers, url: "/crm/accounts" },
      { title: localizations.dossiers, url: "/crm/dossiers" },
      { title: localizations.quotes, url: "/crm/offertes" },
      { title: localizations.offertebox, url: "/crm/offertebox" },
      { title: "RaamStudio", url: "/crm/raamstudio" },
    ],
  };
};

export default getCrmMenuItem;
