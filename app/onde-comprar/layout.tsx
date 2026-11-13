import Navbar from "@/components/Navbar";

export default function OndeComprarLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <div className="pt-16 lg:pt-[99px]">{children}</div>
    </>
  );
}
