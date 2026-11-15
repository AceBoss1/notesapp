import AdminShell from "@/components/admin/AdminShell";
import AdminGate from "@/components/AdminGate";

// The admin frame: the sidebar (a drawer on phones) from the Moda redesign, then the page, kept to the staff member's role.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminShell>
      <AdminGate>{children}</AdminGate>
    </AdminShell>
  );
}
