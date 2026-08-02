import Navbar from "@/components/Navbar";

export default function BoardsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Navbar />
      <main className="flex-1">{children}</main>
    </div>
  );
}