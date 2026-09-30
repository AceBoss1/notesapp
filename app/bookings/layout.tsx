import AccountSubNav from "@/components/AccountSubNav";

export default function BookingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AccountSubNav />
      {children}
    </>
  );
}
