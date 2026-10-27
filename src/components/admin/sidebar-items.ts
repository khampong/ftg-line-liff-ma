export interface NavItem {
  label: string;
  href: string;
  icon: string; // iconify icon name
  roles: Array<"ADMIN" | "TECHNICIAN" | "MANAGER">;
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: "แดชบอร์ด",
    href: "/admin",
    icon: "solar:widget-2-linear",
    roles: ["ADMIN", "TECHNICIAN", "MANAGER"],
  },
  {
    label: "ลูกค้า",
    href: "/admin/customers",
    icon: "solar:users-group-rounded-linear",
    roles: ["ADMIN", "MANAGER"],
  },
  {
    label: "รถโฟล์คลิฟท์",
    href: "/admin/assets",
    icon: "solar:tram-linear",
    roles: ["ADMIN", "MANAGER"],
  },
  {
    label: "ใบแจ้งซ่อม",
    href: "/admin/tickets",
    icon: "solar:document-text-linear",
    roles: ["ADMIN", "TECHNICIAN", "MANAGER"],
  },
  {
    label: "รายงาน",
    href: "/admin/reports",
    icon: "solar:chart-2-linear",
    roles: ["ADMIN", "MANAGER"],
  },
  {
    label: "ผู้ใช้งาน",
    href: "/admin/users",
    icon: "solar:shield-user-linear",
    roles: ["ADMIN"],
  },
];

export const ROLE_LABEL: Record<"ADMIN" | "TECHNICIAN" | "MANAGER", string> = {
  ADMIN: "แอดมิน",
  TECHNICIAN: "ช่าง",
  MANAGER: "ผู้บริหาร",
};
