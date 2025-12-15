import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Moon, ArrowRight } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10" />
      
      {/* Content */}
      <div className="relative z-10 text-center space-y-8 px-4 animate-fade-in-up">
        <div className="flex items-center justify-center gap-4 mb-8">
          <div className="p-4 rounded-2xl bg-primary/10 animate-glow-pulse">
            <Moon className="h-16 w-16 text-primary" />
          </div>
        </div>
        
        <div className="space-y-4">
          <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            Previu
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
            Professional admin dashboard for seamless video draft management
          </p>
        </div>

        <div className="flex items-center justify-center gap-4 pt-8">
          <Button
            onClick={() => navigate("/auth")}
            size="lg"
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium group"
          >
            Access Dashboard
            <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>

        <div className="pt-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <div className="p-6 rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 space-y-2">
            <h3 className="font-semibold text-primary">Video Management</h3>
            <p className="text-sm text-muted-foreground">
              Seamlessly upload and manage your video drafts
            </p>
          </div>
          <div className="p-6 rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 space-y-2">
            <h3 className="font-semibold text-primary">Secure Access</h3>
            <p className="text-sm text-muted-foreground">
              Generate unique codes for controlled client access
            </p>
          </div>
          <div className="p-6 rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 space-y-2">
            <h3 className="font-semibold text-primary">Live Comments</h3>
            <p className="text-sm text-muted-foreground">
              Real-time timestamp feedback from your clients
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
