import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {ArrowRight } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    element?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Header */}
      <nav className="sticky top-0 z-50 bg-card border-b border-border/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
            </div>
            <h2 className="text-xl font-bold text-foreground">Previu</h2>
          </div>
          <ul className="flex items-center gap-8">
            <li>
              <button
                onClick={() => scrollToSection("home")}
                className="text-foreground hover:text-primary transition-colors font-medium"
              >
                HOME
              </button>
            </li>
            <li>
              <button
                onClick={() => scrollToSection("about")}
                className="text-foreground hover:text-primary transition-colors font-medium"
              >
                ABOUT
              </button>
            </li>
            <li>
              <Button
                onClick={() => navigate("/auth")}
                size="sm"
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
              >
                LOG IN
              </Button>
            </li>
            <li>
              <button
                onClick={() => scrollToSection("contact")}
                className="text-foreground hover:text-primary transition-colors font-medium"
              >
                CONTACT
              </button>
            </li>
          </ul>
        </div>
      </nav>

      {/* Hero Section */}
      <section id="home" className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 relative overflow-hidden">
        <div className="relative z-10 text-center space-y-8 px-4 animate-fade-in-up max-w-4xl">
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="p-4 rounded-2xl bg-primary/10 animate-glow-pulse">
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
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-12 text-foreground">Dashboard Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-xl bg-card border border-border/50 space-y-3 hover:border-primary/50 transition-colors">
              <h3 className="font-semibold text-lg text-primary">Video Management</h3>
              <p className="text-muted-foreground">
                Seamlessly upload, organize, and manage your video drafts with an intuitive interface. Keep all your content in one centralized location.
              </p>
            </div>
            <div className="p-6 rounded-xl bg-card border border-border/50 space-y-3 hover:border-primary/50 transition-colors">
              <h3 className="font-semibold text-lg text-primary">Secure Access</h3>
              <p className="text-muted-foreground">
                Generate unique security codes for controlled client access. Protect your content with robust access controls and user management.
              </p>
            </div>
            <div className="p-6 rounded-xl bg-card border border-border/50 space-y-3 hover:border-primary/50 transition-colors">
              <h3 className="font-semibold text-lg text-primary">Live Comments</h3>
              <p className="text-muted-foreground">
                Receive real-time timestamp feedback from your clients. Collaborate efficiently with detailed comments and suggestions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* About/Benefits Section */}
      <section id="about" className="py-16 bg-card/50">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-4xl font-bold mb-8 text-foreground">How Previu Dashboard Helps You</h2>
          <div className="space-y-4">
            <div className="flex gap-4 items-start p-4 rounded-lg bg-background">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-primary font-bold">✓</span>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">Streamlined Content Management</h3>
                <p className="text-muted-foreground">
                  Manage all your video drafts in one place with easy organization, tagging, and categorization features.
                </p>
              </div>
            </div>
            <div className="flex gap-4 items-start p-4 rounded-lg bg-background">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-primary font-bold">✓</span>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">Collaborative Workflow</h3>
                <p className="text-muted-foreground">
                  Share drafts with clients securely and gather real-time feedback through timestamped comments for efficient revisions.
                </p>
              </div>
            </div>
            <div className="flex gap-4 items-start p-4 rounded-lg bg-background">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-primary font-bold">✓</span>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">Enhanced Security</h3>
                <p className="text-muted-foreground">
                  Protect your intellectual property with unique access codes and secure sharing links. Control exactly who views what.
                </p>
              </div>
            </div>
            <div className="flex gap-4 items-start p-4 rounded-lg bg-background">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-primary font-bold">✓</span>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">Improved Productivity</h3>
                <p className="text-muted-foreground">
                  Save time with an intuitive admin interface, reduce back-and-forth communications, and get projects done faster.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-16 bg-background">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-6 text-foreground">Get in Touch</h2>
          <p className="text-lg text-muted-foreground mb-8">
            Have questions? We'd love to hear from you. Contact us for support and inquiries.
          </p>
          <div className="space-y-3">
            <p className="text-foreground">
              <span className="font-semibold">Email:</span> support@previu.com
            </p>
            <p className="text-foreground">
              <span className="font-semibold">Phone:</span> +1 (555) 123-4567
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border/50 py-6">
        <div className="max-w-6xl mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2025 Previu. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
