import "./globals.css";
import backgroundStyles from "@/styles/Background.module.css";
import { AuthProvider } from "@/lib/authProvider";
import { ResearcherModeProvider } from "@/lib/researcherModeContext";
import ClientLayout from "@/components/ClientLayout";

export const metadata = {
  title: "Spiral Analysis",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className={backgroundStyles.drawingContainer} />
        <AuthProvider>
          <ResearcherModeProvider>
          <ClientLayout>{children}</ClientLayout>
          </ResearcherModeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
