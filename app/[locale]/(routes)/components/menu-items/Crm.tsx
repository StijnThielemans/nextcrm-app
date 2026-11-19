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
    accounts: string;
    contacts: string;
    leads: string;
    opportunities: string;
    contracts: string;
    products: string;
    priceLists: string;
    orders: string;
  };
  /** Current user's role — the Approvals queue is manager/admin only. */
  role?: string;
};

export const getCrmMenuItem = ({ localizations }: Props): NavItem => {
  void localizations;
  return {
    title: "Verkoop",
    icon: Coins,
    items: [
      { title: "Dashboard", url: "/crm/dashboard" },
      { title: "Klanten", url: "/crm/accounts" },
      { title: "Offertedossiers", url: "/crm/dossiers" },
      { title: "Offertes", url: "/crm/offertes" },
    ],
  };
};

export default getCrmMenuItem;
