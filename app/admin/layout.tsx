import AdminSubNav from "@/components/AdminSubNav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AdminSubNav />
      {children}
    </>
  );
}
