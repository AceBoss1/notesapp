import AccountSubNav from "@/components/AccountSubNav";

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AccountSubNav />
      {children}
    </>
  );
}
