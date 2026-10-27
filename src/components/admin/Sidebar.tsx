"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, type NavItem } from "./sidebar-items";
import type { SessionUser } from "@/app/admin/useSession";

interface SidebarProps {
  user: SessionUser;
  onClose?: () => void;
}

export default function Sidebar({ user, onClose }: SidebarProps) {
  const pathname = usePathname();

  const visible = NAV_ITEMS.filter((item) => item.roles.includes(user.role));

  return (
    <div className="flex flex-col h-full w-[270px] bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary text-white">
          <Icon icon="solar:tram-bold" width={20} />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="font-bold text-sm text-sidebar-foreground">แจ้งซ่อม</span>
          <span className="text-xs text-muted-foreground">โฟล์คลิฟท์</span>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-4 py-4 overflow-y-auto">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-3 mb-2">
          เมนูหลัก
        </p>
        <ul className="space-y-0.5">
          {visible.map((item) => (
            <SidebarItem
              key={item.href}
              item={item}
              isActive={
                item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href)
              }
              onClose={onClose}
            />
          ))}
        </ul>
      </nav>

      {/* User info footer */}
      <div className="px-4 py-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/50">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white text-sm font-bold shrink-0">
            {user.displayName.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col leading-tight min-w-0">
            <span className="text-sm font-medium text-sidebar-foreground truncate">
              {user.displayName}
            </span>
            <span className="text-xs text-muted-foreground">
              {user.role === "ADMIN" ? "แอดมิน" : user.role === "TECHNICIAN" ? "ช่าง" : "ผู้บริหาร"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarItem({
  item,
  isActive,
  onClose,
}: {
  item: NavItem;
  isActive: boolean;
  onClose?: () => void;
}) {
  return (
    <li>
      <Link
        href={item.href}
        onClick={onClose}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
        )}
      >
        <Icon icon={item.icon} width={20} className="shrink-0" />
        <span>{item.label}</span>
        {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
      </Link>
    </li>
  );
}
