import QueryProvider from "@/app/admin/QueryProvider";

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <QueryProvider>{children}</QueryProvider>;
}
