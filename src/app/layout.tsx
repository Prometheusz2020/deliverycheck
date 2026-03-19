import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZtiLabs | Delivery Check",
  description: "Gestão inteligente de entregas para logística moderna",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>
        <div className="min-h-screen relative p-4 md:p-8 flex flex-col items-center">
          {/* Decorative background glows */}
          <div className="fixed top-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 blur-[150px] rounded-full -z-10 anima-glow"></div>
          <div className="fixed bottom-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-500/10 blur-[150px] rounded-full -z-10 anima-glow"></div>
          
          <div className="w-full max-w-7xl">
            {children}
          </div>
          
          <footer className="mt-auto py-8 text-center text-text-3 text-[10px] uppercase tracking-[0.2em] opacity-40">
            Powered by ZtiLabs &copy; 2026
          </footer>
        </div>
      </body>
    </html>
  );
}
