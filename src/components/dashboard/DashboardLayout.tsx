import { ReactNode, useState, useEffect } from "react";
import { Upload, Film, MessageSquare, Settings, LogOut, Users, Menu, X, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface DashboardLayoutProps {
  children: ReactNode;
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const DashboardLayout = ({ children, activeSection, onSectionChange }: DashboardLayoutProps) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const { logout, currentUser } = useAuth();

  // Close sidebar when clicking on a nav item on mobile
  const handleNavClick = (section: string) => {
    onSectionChange(section);
    setIsSidebarOpen(false);
  };

  // Toggle sidebar state
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/auth");
    } catch (error) {
      // Error is handled in the context
    }
  };

  const navItems = [
    { id: "overview", label: "Dashboard Overview", icon: BarChart3 },
    { id: "upload", label: "Upload Video", icon: Upload },
    { id: "videos", label: "Manage Videos", icon: Film },
    { id: "clients", label: "Clients", icon: Users },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Toggle Button - Visible on all screen sizes */}
      <button
        onClick={toggleSidebar}
        className={cn(
          "fixed z-50 p-2 rounded-md text-foreground bg-card/90 shadow-md transition-all duration-300",
          isSidebarOpen ? 'left-64' : 'left-4 md:left-4',
          "top-4"
        )}
        aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
      >
        {isSidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed left-0 top-0 h-full w-64 border-r border-border bg-card/95 p-6 space-y-8 transition-all duration-300 ease-in-out z-40",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">Previu</h1>
            <p className="text-xs text-muted-foreground">Admin Dashboard</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
                  isActive
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="absolute bottom-6 left-6 right-6">
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-5 w-5" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Overlay - Shown when sidebar is open */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:bg-transparent"
          onClick={toggleSidebar}
          aria-hidden="true"
        />
      )}

      {/* Main Content */}
      <main className={cn(
        "p-8 transition-all duration-300",
        isSidebarOpen ? "md:ml-64" : "md:ml-16" // Adjust margin based on sidebar state
      )}>
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up">
          {/* Header */}
          <header className="space-y-2">
            <h2 className="text-3xl font-bold text-foreground">
              Welcome back{currentUser?.displayName ? `, ${currentUser.displayName}` : ""}
            </h2>
            <p className="text-muted-foreground">
              Manage your client drafts seamlessly
            </p>
          </header>

          {/* Content */}
          <div className="animate-fade-in">{children}</div>
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
