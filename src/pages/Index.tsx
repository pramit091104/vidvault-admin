import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play, Shield, Users, Zap, Upload, MessageSquare, Lock, BarChart3, CheckCircle, Star, TrendingUp, AlertCircle, Menu, X, IndianRupee, Crown } from "lucide-react";
import { PremiumPaymentModal } from "@/components/payment/PremiumPaymentModal";

const Index = () => {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    element?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Header - Mobile Optimized */}
      <nav className="sticky top-0 z-50 bg-background/95 border-b border-border backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-xl font-bold text-foreground">Previu</h2>
          </div>
          
          {/* Desktop Navigation */}
          <ul className="hidden md:flex items-center gap-6 lg:gap-8">
            <li>
              <button
                onClick={() => scrollToSection("home")}
                className="text-muted-foreground hover:text-foreground transition-colors font-medium text-sm lg:text-base"
              >
                HOME
              </button>
            </li>
            <li>
              <button
                onClick={() => scrollToSection("about")}
                className="text-muted-foreground hover:text-foreground transition-colors font-medium text-sm lg:text-base"
              >
                ABOUT
              </button>
            </li>
            <li>
              <button
                onClick={() => scrollToSection("pricing")}
                className="text-muted-foreground hover:text-foreground transition-colors font-medium text-sm lg:text-base"
              >
                PRICING
              </button>
            </li>
            <li>
              <Button
                onClick={() => navigate("/auth")}
                size="sm"
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-3 py-2 text-sm"
              >
                LOG IN
              </Button>
            </li>
            <li>
              <button
                onClick={() => scrollToSection("contact")}
                className="text-muted-foreground hover:text-foreground transition-colors font-medium text-sm lg:text-base"
              >
                CONTACT
              </button>
            </li>
          </ul>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors touch-manipulation"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X className="h-5 w-5 sm:h-6 sm:w-6" /> : <Menu className="h-5 w-5 sm:h-6 sm:w-6" />}
          </button>
        </div>

        {/* Mobile Menu - Improved */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-background/95 border-t border-border backdrop-blur-sm">
            <div className="px-3 sm:px-4 py-3 sm:py-4 space-y-3">
              <button
                onClick={() => {
                  scrollToSection("home");
                  setIsMobileMenuOpen(false);
                }}
                className="block w-full text-left text-muted-foreground hover:text-foreground transition-colors font-medium py-3 px-2 rounded-lg hover:bg-muted/50 touch-manipulation"
              >
                HOME
              </button>
              <button
                onClick={() => {
                  scrollToSection("about");
                  setIsMobileMenuOpen(false);
                }}
                className="block w-full text-left text-muted-foreground hover:text-foreground transition-colors font-medium py-3 px-2 rounded-lg hover:bg-muted/50 touch-manipulation"
              >
                ABOUT
              </button>
              <button
                onClick={() => {
                  scrollToSection("pricing");
                  setIsMobileMenuOpen(false);
                }}
                className="block w-full text-left text-muted-foreground hover:text-foreground transition-colors font-medium py-3 px-2 rounded-lg hover:bg-muted/50 touch-manipulation"
              >
                PRICING
              </button>
              <Button
                onClick={() => {
                  navigate("/auth");
                  setIsMobileMenuOpen(false);
                }}
                size="sm"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 text-base touch-manipulation"
              >
                LOG IN
              </Button>
              <button
                onClick={() => {
                  scrollToSection("contact");
                  setIsMobileMenuOpen(false);
                }}
                className="block w-full text-left text-muted-foreground hover:text-foreground transition-colors font-medium py-3 px-2 rounded-lg hover:bg-muted/50 touch-manipulation"
              >
                CONTACT
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section - Mobile Optimized */}
      <section id="home" className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 relative overflow-hidden px-3 sm:px-4">
        {/* Colorful background elements */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-64 sm:w-96 h-64 sm:h-96 bg-gradient-to-br from-blue-400/20 to-indigo-500/20 rounded-full blur-3xl"></div>
          <div className="absolute top-0 right-0 w-64 sm:w-96 h-64 sm:h-96 bg-gradient-to-br from-purple-400/20 to-pink-500/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-64 sm:w-96 h-64 sm:h-96 bg-gradient-to-br from-indigo-400/15 to-blue-500/15 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative z-10 text-center space-y-6 sm:space-y-8 max-w-6xl w-full">          
          <div className="space-y-4 sm:space-y-6">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-8xl font-bold leading-tight">
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
                Previu
              </span>
            </h1>
            <p className="text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl text-gray-700 max-w-4xl mx-auto leading-relaxed font-light px-2 sm:px-4">
              Professional video sharing platform for creators and agencies. 
              <span className="text-gray-900 font-semibold"> Upload, share securely, and get precise timestamp feedback</span> 
              from clients on your video projects.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 pt-6 sm:pt-8">
            <Button
              onClick={() => navigate("/auth")}
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold group px-8 sm:px-10 py-3 sm:py-4 text-base sm:text-lg shadow-lg transition-all duration-300 transform hover:scale-105 glow-primary w-full sm:w-auto touch-manipulation"
            >
              Start Free Trial
              <ArrowRight className="ml-2 sm:ml-3 h-4 w-4 sm:h-5 sm:w-5 group-hover:translate-x-2 transition-transform" />
            </Button>
          </div>
        </div>
      </section>

      {/* Problem Section - Mobile Optimized */}
      <section className="py-16 sm:py-20 lg:py-24 bg-gradient-to-br from-red-50 to-orange-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4">
          <div className="text-center mb-12 sm:mb-16 lg:mb-20">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-red-100 border border-red-200 rounded-full text-xs sm:text-sm text-red-700 font-medium mb-4 sm:mb-6">
              <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4" />
              The Problem We're Solving
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold mb-6 sm:mb-8 text-gray-900 px-2">
              Video Collaboration is
              <span className="bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent"> Broken</span>
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-gray-600 max-w-4xl mx-auto leading-relaxed px-2 sm:px-4">
              Video creators and agencies struggle with secure sharing, vague feedback, and managing client access to video drafts
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
            <div className="group bg-white/80 backdrop-blur-sm rounded-2xl p-6 sm:p-8 border border-red-100 hover:border-red-200 transition-all duration-300 shadow-lg hover:shadow-xl">
              <div className="relative z-10">
                <div className="w-16 sm:w-20 h-16 sm:h-20 bg-gradient-to-br from-red-100 to-red-200 rounded-2xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform duration-300">
                  <MessageSquare className="h-8 sm:h-10 w-8 sm:w-10 text-red-600" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">Endless Revision Cycles</h3>
                <p className="text-gray-600 leading-relaxed mb-4 sm:mb-6 text-sm sm:text-base">
                  "Change that part" or "make it pop" - vague feedback leads to countless revisions, frustrated clients, and wasted hours.
                </p>
                <div className="flex items-center gap-2 text-red-600 font-medium text-sm sm:text-base">
                  <span>→</span>
                  <span>Average 5+ revision rounds per project</span>
                </div>
              </div>
            </div>
            
            <div className="group bg-white/80 backdrop-blur-sm rounded-2xl p-6 sm:p-8 border border-red-100 hover:border-red-200 transition-all duration-300 shadow-lg hover:shadow-xl">
              <div className="relative z-10">
                <div className="w-16 sm:w-20 h-16 sm:h-20 bg-gradient-to-br from-red-100 to-red-200 rounded-2xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Lock className="h-8 sm:h-10 w-8 sm:w-10 text-red-600" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">Insecure File Sharing</h3>
                <p className="text-gray-600 leading-relaxed mb-4 sm:mb-6 text-sm sm:text-base">
                  Sharing video drafts via email, Dropbox, or public links risks content leaks, unauthorized downloads, and loss of control over your work.
                </p>
                <div className="flex items-center gap-2 text-red-600 font-medium text-sm sm:text-base">
                  <span>→</span>
                  <span>78% of creators fear content leaks</span>
                </div>
              </div>
            </div>
            
            <div className="group bg-white/80 backdrop-blur-sm rounded-2xl p-6 sm:p-8 border border-red-100 hover:border-red-200 transition-all duration-300 shadow-lg hover:shadow-xl">
              <div className="relative z-10">
                <div className="w-16 sm:w-20 h-16 sm:h-20 bg-gradient-to-br from-red-100 to-red-200 rounded-2xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform duration-300">
                  <BarChart3 className="h-8 sm:h-10 w-8 sm:w-10 text-red-600" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">Client Access Management</h3>
                <p className="text-gray-600 leading-relaxed mb-4 sm:mb-6 text-sm sm:text-base">
                  Tracking which clients have access to which videos, managing permissions, and organizing feedback becomes chaotic across multiple projects.
                </p>
                <div className="flex items-center gap-2 text-red-600 font-medium text-sm sm:text-base">
                  <span>→</span>
                  <span>Hours wasted on client coordination</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-24 bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
        
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-20">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 border border-green-200 rounded-full text-sm text-green-700 font-medium mb-6">
              <CheckCircle className="h-4 w-4" />
              Our Solution
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-8 text-gray-900">
              The Future of
              <span className="bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text text-transparent"> Video Collaboration</span>
            </h2>
            <p className="text-lg sm:text-xl text-gray-600 max-w-4xl mx-auto leading-relaxed px-4">
              A secure video sharing platform that gives you control over access, precise feedback collection, and professional client management
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <div className="group bg-white/80 backdrop-blur-sm rounded-2xl p-8 border border-green-100 hover:border-green-200 transition-all duration-300 shadow-lg hover:shadow-xl">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-green-200 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-2xl font-bold text-gray-900">Secure Video Sharing</h3>
                    <p className="text-gray-600 leading-relaxed">
                      Upload videos to Google Cloud Storage with unique access codes for each client. Control who sees what and when.
                    </p>
                    <div className="flex items-center gap-2 text-green-600 font-medium">
                      <span>✓</span>
                      <span>Unique access codes per client</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="group bg-white/80 backdrop-blur-sm rounded-2xl p-8 border border-green-100 hover:border-green-200 transition-all duration-300 shadow-lg hover:shadow-xl">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-green-200 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-2xl font-bold text-gray-900">Timestamp Comments</h3>
                    <p className="text-gray-600 leading-relaxed">
                      Clients leave feedback at exact moments in your videos. Get precise, actionable comments instead of vague "change this" requests.
                    </p>
                    <div className="flex items-center gap-2 text-green-600 font-medium">
                      <span>✓</span>
                      <span>Precise feedback at exact timestamps</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="group bg-white/80 backdrop-blur-sm rounded-2xl p-8 border border-green-100 hover:border-green-200 transition-all duration-300 shadow-lg hover:shadow-xl">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-green-200 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-2xl font-bold text-gray-900">Client & Project Management</h3>
                    <p className="text-gray-600 leading-relaxed">
                      Organize clients, track video access, manage permissions, and monitor engagement. All your video projects in one dashboard.
                    </p>
                    <div className="flex items-center gap-2 text-green-600 font-medium">
                      <span>✓</span>
                      <span>Centralized project management</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="relative">
              <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 border border-green-100 shadow-2xl">
                <div className="space-y-6">
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-100">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-gray-900 font-medium">Live Collaboration Session</span>
                      </div>
                      <span className="text-green-600 text-sm font-medium bg-green-100 px-2 py-1 rounded-full">Active</span>
                    </div>
                    <div className="space-y-3">
                      <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-3 bg-gradient-to-r from-green-500 to-teal-500 rounded-full" style={{width: '75%'}}></div>
                      </div>
                      <p className="text-gray-600 text-sm">Project completion: 75%</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
                      <Users className="h-8 w-8 text-blue-600 mb-3" />
                      <p className="text-3xl font-bold text-gray-900">12</p>
                      <p className="text-sm text-gray-600">Active Clients</p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border border-purple-100">
                      <MessageSquare className="h-8 w-8 text-purple-600 mb-3" />
                      <p className="text-3xl font-bold text-gray-900">48</p>
                      <p className="text-sm text-gray-600">Comments Today</p>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-2xl p-6 border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-gray-600">Recent Activity</span>
                      <span className="text-green-600 text-sm bg-green-100 px-2 py-1 rounded-full">Live</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-gray-700 text-sm">New comment at 02:45</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="text-gray-700 text-sm">Client joined review</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        <span className="text-gray-700 text-sm">Version 3 uploaded</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section - Mobile Optimized */}
      <section className="py-16 sm:py-20 lg:py-24 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4">
          <div className="text-center mb-12 sm:mb-16 lg:mb-20">
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-6 sm:mb-8 text-gray-900 px-2">
              Powerful Features That
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent"> Actually Matter</span>
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-gray-600 max-w-4xl mx-auto leading-relaxed px-2">
              Everything you need to transform your video collaboration workflow, nothing you don't
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            <div className="group bg-white/80 backdrop-blur-sm rounded-2xl p-6 sm:p-8 border border-purple-100 hover:border-purple-200 transition-all duration-300 shadow-lg hover:shadow-xl">
              <div className="relative z-10">
                <div className="w-12 sm:w-16 h-12 sm:h-16 bg-gradient-to-br from-purple-100 to-purple-200 rounded-2xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Upload className="h-6 sm:h-8 w-6 sm:w-8 text-purple-600" />
                </div>
                <h3 className="text-lg sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">Smart Video Upload</h3>
                <p className="text-gray-600 leading-relaxed mb-4 sm:mb-6 text-sm sm:text-base">
                  Upload videos up to 2GB with automatic method selection. Small files use direct upload, large files use resumable chunked upload with pause/resume.
                </p>
                <div className="flex items-center gap-2 text-purple-600 font-medium text-sm">
                  <span>⚡</span>
                  <span>Auto-optimized upload method</span>
                </div>
              </div>
            </div>
            
            <div className="group bg-white/80 backdrop-blur-sm rounded-2xl p-6 sm:p-8 border border-emerald-100 hover:border-emerald-200 transition-all duration-300 shadow-lg hover:shadow-xl">
              <div className="relative z-10">
                <div className="w-12 sm:w-16 h-12 sm:h-16 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-2xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Shield className="h-6 sm:h-8 w-6 sm:w-8 text-emerald-600" />
                </div>
                <h3 className="text-lg sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">Access Control</h3>
                <p className="text-gray-600 leading-relaxed mb-4 sm:mb-6 text-sm sm:text-base">
                  Generate unique security codes for each video and client. Control access with granular permissions and track who viewed what when.
                </p>
                <div className="flex items-center gap-2 text-emerald-600 font-medium text-sm">
                  <span>🔒</span>
                  <span>Secure access management</span>
                </div>
              </div>
            </div>
            
            <div className="group relative bg-white/80 backdrop-blur-sm rounded-2xl p-6 sm:p-8 border border-blue-100 hover:border-blue-200 transition-all duration-300 hover:transform hover:scale-105 shadow-lg hover:shadow-xl">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-cyan-50/50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative z-10">
                <div className="w-12 sm:w-16 h-12 sm:h-16 bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform duration-300">
                  <MessageSquare className="h-6 sm:h-8 w-6 sm:w-8 text-blue-600" />
                </div>
                <h3 className="text-lg sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">Timestamp Comments</h3>
                <p className="text-gray-600 leading-relaxed mb-4 sm:mb-6 text-sm sm:text-base">
                  Clients leave precise feedback at exact moments. No more vague comments - get specific, actionable feedback every time.
                </p>
                <div className="flex items-center gap-2 text-blue-600 font-medium text-sm">
                  <span>🎯</span>
                  <span>Precision feedback</span>
                </div>
              </div>
            </div>
            
            <div className="group relative bg-white/80 backdrop-blur-sm rounded-2xl p-6 sm:p-8 border border-orange-100 hover:border-orange-200 transition-all duration-300 hover:transform hover:scale-105 shadow-lg hover:shadow-xl">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-50/50 to-red-50/50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative z-10">
                <div className="w-12 sm:w-16 h-12 sm:h-16 bg-gradient-to-br from-orange-100 to-orange-200 rounded-2xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Play className="h-6 sm:h-8 w-6 sm:w-8 text-orange-600" />
                </div>
                <h3 className="text-lg sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">Secure Cloud Storage</h3>
                <p className="text-gray-600 leading-relaxed mb-4 sm:mb-6 text-sm sm:text-base">
                  Store videos on Google Cloud Storage with automatic method selection. Small files use direct upload, large files use resumable chunked upload with pause/resume.
                </p>
                <div className="flex items-center gap-2 text-orange-600 font-medium text-sm">
                  <span>🔄</span>
                  <span>GCS integration</span>
                </div>
              </div>
            </div>
            
            <div className="group relative bg-white/80 backdrop-blur-sm rounded-2xl p-6 sm:p-8 border border-pink-100 hover:border-pink-200 transition-all duration-300 hover:transform hover:scale-105 shadow-lg hover:shadow-xl">
              <div className="absolute inset-0 bg-gradient-to-br from-pink-50/50 to-rose-50/50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative z-10">
                <div className="w-12 sm:w-16 h-12 sm:h-16 bg-gradient-to-br from-pink-100 to-pink-200 rounded-2xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Users className="h-6 sm:h-8 w-6 sm:w-8 text-pink-600" />
                </div>
                <h3 className="text-lg sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">Client Management</h3>
                <p className="text-gray-600 leading-relaxed mb-4 sm:mb-6 text-sm sm:text-base">
                  Organize clients, projects, and permissions effortlessly. Keep track of who has access to what content.
                </p>
                <div className="flex items-center gap-2 text-pink-600 font-medium text-sm">
                  <span>👥</span>
                  <span>Granular control</span>
                </div>
              </div>
            </div>
            
            <div className="group relative bg-white/80 backdrop-blur-sm rounded-2xl p-6 sm:p-8 border border-teal-100 hover:border-teal-200 transition-all duration-300 hover:transform hover:scale-105 shadow-lg hover:shadow-xl">
              <div className="absolute inset-0 bg-gradient-to-br from-teal-50/50 to-cyan-50/50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative z-10">
                <div className="w-12 sm:w-16 h-12 sm:h-16 bg-gradient-to-br from-teal-100 to-teal-200 rounded-2xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Zap className="h-6 sm:h-8 w-6 sm:w-8 text-teal-600" />
                </div>
                <h3 className="text-lg sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">Analytics & Tracking</h3>
                <p className="text-gray-600 leading-relaxed mb-4 sm:mb-6 text-sm sm:text-base">
                  Track video views, client engagement, access patterns, and comment activity. Monitor project progress and client interaction.
                </p>
                <div className="flex items-center gap-2 text-teal-600 font-medium text-sm">
                  <span>⚡</span>
                  <span>Real-time analytics</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section - Mobile Optimized */}
      <section id="pricing" className="py-16 sm:py-20 lg:py-24 bg-background">
        <div className="max-w-7xl mx-auto px-3 sm:px-4">
          <div className="text-center mb-12 sm:mb-16 lg:mb-20">
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-6 sm:mb-8 text-foreground px-2">
              Simple, Transparent
              <span className="bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent"> Pricing</span>
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-4xl mx-auto leading-relaxed px-2">
              Start free, upgrade when you're ready. No hidden fees, no surprises.
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 max-w-5xl mx-auto">
            {/* Free Plan */}
            <div className="group bg-card/50 rounded-3xl p-6 sm:p-8 border border-border hover:border-muted-foreground/30 transition-all duration-300">
              <div className="text-center mb-6 sm:mb-8">
                <h3 className="text-2xl sm:text-3xl font-bold text-foreground mb-3 sm:mb-4">Free</h3>
                <div className="flex items-center justify-center gap-2 mb-3 sm:mb-4">
                  <span className="text-3xl sm:text-5xl font-bold text-foreground">₹0</span>
                  <span className="text-muted-foreground text-sm sm:text-base">/month</span>
                </div>
                <p className="text-muted-foreground text-sm sm:text-base">Perfect for getting started</p>
              </div>
              
              <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0" />
                  <span className="text-foreground text-sm sm:text-base">Up to 5 video uploads per month</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0" />
                  <span className="text-foreground text-sm sm:text-base">Up to 5 clients</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0" />
                  <span className="text-foreground text-sm sm:text-base">Basic timestamp comments</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0" />
                  <span className="text-foreground text-sm sm:text-base">Secure client access codes</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0" />
                  <span className="text-foreground text-sm sm:text-base">100MB file size limit</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0" />
                  <span className="text-foreground text-sm sm:text-base">Basic client management</span>
                </div>
              </div>
              
              <Button
                onClick={() => navigate("/auth")}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 text-base sm:text-lg transition-all duration-300 touch-manipulation"
              >
                Start Free
              </Button>
            </div>

            {/* Premium Plan */}
            <div className="group relative bg-gradient-to-br from-primary/5 to-muted-foreground/5 rounded-3xl p-6 sm:p-8 border-2 border-primary/30 hover:border-primary/50 transition-all duration-300 transform hover:scale-105">
              <div className="absolute -top-3 sm:-top-4 left-1/2 transform -translate-x-1/2">
                <div className="bg-gradient-to-r from-primary to-muted-foreground text-primary-foreground px-4 sm:px-6 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold flex items-center gap-1 sm:gap-2">
                  <Crown className="h-3 w-3 sm:h-4 sm:w-4" />
                  MOST POPULAR
                </div>
              </div>
              
              <div className="text-center mb-6 sm:mb-8 pt-3 sm:pt-4">
                <h3 className="text-2xl sm:text-3xl font-bold text-foreground mb-3 sm:mb-4">Premium</h3>
                <div className="flex items-center justify-center gap-2 mb-3 sm:mb-4">
                  <IndianRupee className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
                  <span className="text-3xl sm:text-5xl font-bold text-foreground">149</span>
                  <span className="text-muted-foreground text-sm sm:text-base">/month</span>
                </div>
                <p className="text-muted-foreground text-sm sm:text-base">Everything you need to scale</p>
              </div>
              
              <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
                  <span className="text-foreground text-sm sm:text-base">Up to 50 video uploads per month</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
                  <span className="text-foreground text-sm sm:text-base">Up to 50 clients</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
                  <span className="text-foreground text-sm sm:text-base">Advanced timestamp comments</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
                  <span className="text-foreground text-sm sm:text-base">Resumable uploads (pause/resume)</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
                  <span className="text-foreground text-sm sm:text-base">2GB file size limit</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
                  <span className="text-foreground text-sm sm:text-base">Advanced client management</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
                  <span className="text-foreground text-sm sm:text-base">Public video sharing with custom URLs</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
                  <span className="text-foreground text-sm sm:text-base">Priority support</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
                  <span className="text-foreground text-sm sm:text-base">Analytics & insights</span>
                </div>
              </div>
              
              <PremiumPaymentModal>
                <Button
                  className="w-full bg-gradient-to-r from-primary to-muted-foreground hover:from-primary/90 hover:to-muted-foreground/90 text-primary-foreground font-bold py-3 text-base sm:text-lg transition-all duration-300 shadow-lg touch-manipulation"
                >
                  <Crown className="mr-2 h-4 w-4" />
                  Upgrade to Premium
                </Button>
              </PremiumPaymentModal>
            </div>
          </div>
          
          <div className="text-center mt-12 sm:mt-16">
            <p className="text-muted-foreground mb-4 sm:mb-6 text-sm sm:text-base px-2">
              All plans include: secure video sharing, unique access codes, timestamp comments, and client management
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="text-sm sm:text-base">14-day free trial</span>
              </div>
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="text-sm sm:text-base">No setup fees</span>
              </div>
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="text-sm sm:text-base">Cancel anytime</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="about" className="py-24 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-20">
            <h2 className="text-5xl md:text-6xl font-bold mb-8 text-foreground">
              Why Creators Choose
              <span className="bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent"> Previu</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-4xl mx-auto leading-relaxed">
              Join hundreds of professionals who've transformed their video collaboration workflow
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="space-y-8">
              <div className="group bg-card/50 rounded-2xl p-8 border border-border hover:border-muted-foreground/30 transition-all duration-300">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-2xl font-bold text-foreground">Faster Project Delivery</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Eliminate back-and-forth emails and vague feedback. Timestamp comments provide precise feedback that reduces revision cycles.
                    </p>
                    <div className="flex items-center gap-2 text-green-600 font-medium">
                      <span>⚡</span>
                      <span>Reduce revision rounds significantly</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="group bg-card/50 backdrop-blur-sm rounded-2xl p-8 border border-border hover:border-blue-500/50 transition-all duration-300">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <Shield className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-2xl font-bold text-foreground">Professional Security</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Your videos are protected with unique access codes, secure cloud storage, and controlled permissions for each client.
                    </p>
                    <div className="flex items-center gap-2 text-blue-600 font-medium">
                      <span>🔒</span>
                      <span>Secure by design</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="group bg-card/50 backdrop-blur-sm rounded-2xl p-8 border border-border hover:border-primary/50 transition-all duration-300">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-2xl font-bold text-foreground">Better Client Experience</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Clients get easy access to videos with simple codes, can leave precise feedback, and enjoy a professional review experience.
                    </p>
                    <div className="flex items-center gap-2 text-primary font-medium">
                      <span>😊</span>
                      <span>Professional client portal</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-8">
              <div className="group bg-card/50 backdrop-blur-sm rounded-2xl p-8 border border-border hover:border-orange-500/50 transition-all duration-300">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <Zap className="h-6 w-6 text-orange-600" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-2xl font-bold text-foreground">Organized Workflow</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Manage all your video projects, client access, and feedback from one dashboard. Track engagement and monitor project progress.
                    </p>
                    <div className="flex items-center gap-2 text-orange-600 font-medium">
                      <span>🚀</span>
                      <span>Centralized management</span>
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-cyan-500/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <BarChart3 className="h-6 w-6 text-cyan-600" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-2xl font-bold text-foreground">Project Analytics</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Track video views, client engagement, comment activity, and access patterns. Get insights into your project performance.
                    </p>
                    <div className="flex items-center gap-2 text-cyan-600 font-medium">
                      <span>📊</span>
                      <span>Engagement tracking</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="group bg-card/50 backdrop-blur-sm rounded-2xl p-8 border border-border hover:border-pink-500/50 transition-all duration-300">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-pink-500/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <Star className="h-6 w-6 text-pink-600" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-2xl font-bold text-foreground">Professional Brand</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Present a polished, secure video sharing experience that sets you apart. Custom access codes and professional interface impress clients.
                    </p>
                    <div className="flex items-center gap-2 text-pink-600 font-medium">
                      <span>⭐</span>
                      <span>Professional presentation</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section id="contact" className="py-24 bg-background">
        
        <div className="max-w-5xl mx-auto px-4 text-center">
          <div className="bg-card/50 rounded-3xl p-16 border border-border shadow-xl">
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary/10 to-muted-foreground/10 border border-primary/30 rounded-full text-sm text-primary font-medium">
                <Zap className="h-4 w-4" />
                Limited Time Offer
              </div>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
              Ready to Streamline Your
              <span className="bg-gradient-to-r from-primary to-muted-foreground bg-clip-text text-transparent"> Video Sharing</span>?
            </h2>
            <p className="text-xl text-muted-foreground mb-12 leading-relaxed">
              Join creators who've simplified their video collaboration workflow with secure sharing and precise feedback
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-12">
              <Button
                onClick={() => navigate("/auth")}
                size="lg"
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold group px-12 py-4 text-lg shadow-lg transition-all duration-300 transform hover:scale-105"
              >
                Start Free Trial
                <ArrowRight className="ml-3 h-5 w-5 group-hover:translate-x-2 transition-transform" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-2 border-border hover:border-muted-foreground/50 text-foreground hover:bg-muted/50 px-12 py-4 text-lg transition-all duration-300"
              >
                Schedule Demo
              </Button>
            </div>
            
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                <span className="text-green-600 font-medium">✓</span> No credit card required 
                <span className="mx-2">•</span>
                <span className="text-green-600 font-medium">✓</span> 14-day free trial 
                <span className="mx-2">•</span>
                <span className="text-green-600 font-medium">✓</span> Cancel anytime
              </p>
              
              <div className="flex items-center justify-center gap-8 pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-foreground mb-1">2GB</p>
                  <p className="text-sm text-muted-foreground">Max File Size</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-foreground mb-1">Secure</p>
                  <p className="text-sm text-muted-foreground">Access Codes</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-foreground mb-1">Precise</p>
                  <p className="text-sm text-muted-foreground">Timestamp Feedback</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-muted/30 border-t border-border py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-primary to-muted-foreground rounded-lg"></div>
                <h3 className="text-xl font-bold text-foreground">Previu</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Professional video sharing platform for creators and agencies. Upload, share securely, and collect precise feedback from clients.
              </p>
            </div>
            
            <div className="space-y-4">
              <h4 className="text-foreground font-semibold">Product</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Features</a></li>
                <li><a href="#pricing" onClick={() => scrollToSection("pricing")} className="text-muted-foreground hover:text-foreground transition-colors">Pricing</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Security</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Roadmap</a></li>
              </ul>
            </div>
            
            <div className="space-y-4">
              <h4 className="text-foreground font-semibold">Company</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">About</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Blog</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Careers</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Contact</a></li>
              </ul>
            </div>
            
            <div className="space-y-4">
              <h4 className="text-foreground font-semibold">Support</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Help Center</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">API Docs</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Status</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Community</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-border pt-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-muted-foreground text-sm">
                &copy; 2025 Previu. All rights reserved.
              </p>
              <div className="flex items-center gap-6">
                <a href="#" className="text-muted-foreground hover:text-foreground transition-colors text-sm">Privacy Policy</a>
                <a href="#" className="text-muted-foreground hover:text-foreground transition-colors text-sm">Terms of Service</a>
                <a href="#" className="text-muted-foreground hover:text-foreground transition-colors text-sm">Cookie Policy</a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
