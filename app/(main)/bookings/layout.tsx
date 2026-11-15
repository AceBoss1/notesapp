import AccountShell from "@/components/account/AccountShell";

// My account's frame: the grouped menu, and on a phone the bar that opens it (components/account/AccountShell.tsx).
export default function BookingsLayout({ children }: { children: React.ReactNode }) {
  return <AccountShell>{children}</AccountShell>;
}
