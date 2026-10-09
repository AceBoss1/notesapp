import AdminSubNav from "@/components/AdminSubNav";
import AdminGate from "@/components/AdminGate";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AdminSubNav />
      <AdminGate>{children}</AdminGate>
    </>
  );
}
