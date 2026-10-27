"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { useTheme } from "@/components/provider/theme-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import Sidebar from "./Sidebar";
import type { SessionUser } from "@/app/admin/useSession";
import { adminPost } from "@/app/admin/apiClient";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface HeaderProps {
  user: SessionUser;
}

export default function Header({ user }: HeaderProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await adminPost("/api/auth/logout");
    router.push("/admin/login");
    router.refresh();
  };

  return (
    <>
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center h-16 px-6 gap-4">
          {/* Mobile hamburger */}
          <Button
            variant="ghost"
            size="icon"
            className="xl:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Icon icon="solar:hamburger-menu-linear" width={22} />
          </Button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Dark mode toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="text-muted-foreground hover:text-foreground"
          >
            {theme === "dark" ? (
              <Icon icon="solar:sun-bold-duotone" width={20} />
            ) : (
              <Icon icon="tabler:moon" width={20} />
            )}
          </Button>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted transition-colors">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white text-sm font-bold">
                  {user.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:flex flex-col items-start leading-tight">
                  <span className="text-sm font-medium text-foreground">{user.displayName}</span>
                  <span className="text-xs text-muted-foreground">
                    {user.role === "ADMIN"
                      ? "แอดมิน"
                      : user.role === "TECHNICIAN"
                        ? "ช่าง"
                        : "ผู้บริหาร"}
                  </span>
                </div>
                <Icon
                  icon="solar:alt-arrow-down-linear"
                  width={16}
                  className="text-muted-foreground hidden sm:block"
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{user.displayName}</p>
                <p className="text-xs text-muted-foreground">{user.username}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-destructive focus:text-destructive gap-2 cursor-pointer"
              >
                <Icon icon="solar:logout-2-linear" width={16} />
                ออกจากระบบ
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Mobile sidebar sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[270px] p-0">
          <VisuallyHidden>
            <SheetTitle>เมนู</SheetTitle>
          </VisuallyHidden>
          <Sidebar user={user} onClose={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
