import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto max-w-7xl px-4 md:px-8 py-6">
        {children}
      </main>
      <Footer />
    </div>
  );
}
