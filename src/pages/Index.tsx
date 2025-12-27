import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play, Shield, Users, Zap, Upload, MessageSquare, Lock, BarChart3, CheckCircle, Star, TrendingUp, AlertCircle } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    element?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Navigation Header */}
      <nav className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg"></div>
            <h2 className="text-xl font-bold text-white">Previu</h2>
          </div>
          <ul className="flex items-center gap-8">
            <li>
              <button
                onClick={() => scrollToSection("home")}
                className="text-gray-300 hover:text-white transition-colors font-medium"
              >
                HOME
              </button>
            </li>
            <li>
              <button
                onClick={() => scrollToSection("about")}
                className="text-gray-300 hover:text-white transition-colors font-medium"
              >
                ABOUT
              </button>
            </li>
            <li>
              <Button
                onClick={() => navigate("/auth")}
                size="sm"
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold shadow-lg hover:shadow-purple-500/25 transition-all duration-300"
              >
                LOG IN
              </Button>
            </li>
            <li>
              <button
                onClick={() => scrollToSection("contact")}
                className="text-gray-300 hover:text-white transition-colors font-medium"
              >
                CONTACT
              </button>
            </li>
          </ul>
        </div>
      </nav>

      {/* Hero Section */}
      <section id="home" className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
          <div className="absolute top-0 left-0 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-pink-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse animation-delay-2000"></div>
          <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse animation-delay-4000"></div>
        </div>
        
        <div className="relative z-10 text-center space-y-8 px-4 max-w-6xl">
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full text-sm text-white font-medium">
              🎬 Trusted by 500+ Video Creators Worldwide
            </div>
          </div>
          
          <div className="space-y-6">
            <h1 className="text-6xl md:text-8xl font-bold text-white leading-tight">
              <span className="bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent">
                Previu
              </span>
            </h1>
            <p className="text-xl md:text-3xl text-gray-300 max-w-4xl mx-auto leading-relaxed font-light">
              The professional video collaboration platform that transforms 
              <span className="text-white font-semibold"> how creators work with clients</span>. 
              Share drafts securely, get precise feedback, and deliver projects 60% faster.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-8">
            <Button
              onClick={() => navigate("/auth")}
              size="lg"
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold group px-10 py-4 text-lg shadow-2xl hover:shadow-purple-500/25 transition-all duration-300 transform hover:scale-105"
            >
              Start Free Trial
              <ArrowRight className="ml-3 h-5 w-5 group-hover:translate-x-2 transition-transform" />
            </Button>
            <Button
              onClick={() => scrollToSection("about")}
              size="lg"
              variant="outline"
              className="border-2 border-white/20 hover:border-white/40 text-white hover:bg-white/10 px-10 py-4 text-lg backdrop-blur-sm transition-all duration-300"
            >
              <Play className="mr-2 h-5 w-5" />
              Watch Demo
            </Button>
          </div>
          
          <div className="flex items-center justify-center gap-12 pt-12 text-gray-400">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-1">
                {[1,2,3,4].map(i => (
                  <div key={i} className="w-8 h-8 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full border-2 border-white/20"></div>
                ))}
              </div>
              <span className="text-white font-medium">500+ Happy Creators</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex">
                {[1,2,3,4,5].map(i => (
                  <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                ))}
              </div>
              <span className="text-white font-medium">4.9/5 Rating</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-400" />
              <span className="text-white font-medium">60% Faster Delivery</span>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-24 bg-gradient-to-b from-slate-900 to-slate-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-20">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-full text-sm text-red-400 font-medium mb-6">
              <AlertCircle className="h-4 w-4" />
              The Problem We're Solving
            </div>
            <h2 className="text-5xl md:text-6xl font-bold mb-8 text-white">
              Video Collaboration is
              <span className="bg-gradient-to-r from-red-400 to-pink-400 bg-clip-text text-transparent"> Broken</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-4xl mx-auto leading-relaxed">
              Content creators and agencies are losing time, money, and clients due to inefficient collaboration workflows
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="group relative bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700 hover:border-red-500/50 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-pink-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative z-10">
                <div className="w-20 h-20 bg-red-500/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <MessageSquare className="h-10 w-10 text-red-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Endless Revision Cycles</h3>
                <p className="text-gray-400 leading-relaxed mb-6">
                  "Change that part" or "make it pop" - vague feedback leads to countless revisions, frustrated clients, and wasted hours.
                </p>
                <div className="flex items-center gap-2 text-red-400 font-medium">
                  <span>→</span>
                  <span>Average 5+ revision rounds per project</span>
                </div>
              </div>
            </div>
            
            <div className="group relative bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700 hover:border-red-500/50 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-pink-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative z-10">
                <div className="w-20 h-20 bg-red-500/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Lock className="h-10 w-10 text-red-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Security Nightmares</h3>
                <p className="text-gray-400 leading-relaxed mb-6">
                  Sharing drafts via email, Dropbox, or unsecured links risks content leaks, premature releases, and intellectual property theft.
                </p>
                <div className="flex items-center gap-2 text-red-400 font-medium">
                  <span>→</span>
                  <span>78% of creators fear content leaks</span>
                </div>
              </div>
            </div>
            
            <div className="group relative bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700 hover:border-red-500/50 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-pink-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative z-10">
                <div className="w-20 h-20 bg-red-500/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <BarChart3 className="h-10 w-10 text-red-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Workflow Chaos</h3>
                <p className="text-gray-400 leading-relaxed mb-6">
                  Juggling multiple platforms, tracking versions, and managing feedback across emails, Slack, and spreadsheets creates chaos.
                </p>
                <div className="flex items-center gap-2 text-red-400 font-medium">
                  <span>→</span>
                  <span>40+ hours wasted per month on admin</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-24 bg-gradient-to-b from-slate-800 to-slate-900 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-96 h-96 bg-green-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse animation-delay-2000"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <div className="text-center mb-20">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-full text-sm text-green-400 font-medium mb-6">
              <CheckCircle className="h-4 w-4" />
              Our Solution
            </div>
            <h2 className="text-5xl md:text-6xl font-bold mb-8 text-white">
              The Future of
              <span className="bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text text-transparent"> Video Collaboration</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-4xl mx-auto leading-relaxed">
              One platform that transforms chaos into clarity, frustration into satisfaction, and delays into faster delivery
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <div className="group bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700 hover:border-green-500/50 transition-all duration-300">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <CheckCircle className="h-6 w-6 text-green-400" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-2xl font-bold text-white">Precise Timestamp Feedback</h3>
                    <p className="text-gray-400 leading-relaxed">
                      Clients comment at exact moments in the video. No more "change that part" - get specific, actionable feedback that eliminates guesswork.
                    </p>
                    <div className="flex items-center gap-2 text-green-400 font-medium">
                      <span>✓</span>
                      <span>Reduce revision rounds by 80%</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="group bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700 hover:border-green-500/50 transition-all duration-300">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <CheckCircle className="h-6 w-6 text-green-400" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-2xl font-bold text-white">Bank-Level Security</h3>
                    <p className="text-gray-400 leading-relaxed">
                      Unique access codes for each client, encrypted storage, and granular permissions. Your intellectual property stays protected.
                    </p>
                    <div className="flex items-center gap-2 text-green-400 font-medium">
                      <span>✓</span>
                      <span>Zero content leaks guaranteed</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="group bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700 hover:border-green-500/50 transition-all duration-300">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <CheckCircle className="h-6 w-6 text-green-400" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-2xl font-bold text-white">Centralized Command Center</h3>
                    <p className="text-gray-400 leading-relaxed">
                      All projects, versions, feedback, and client communications in one dashboard. No more juggling platforms.
                    </p>
                    <div className="flex items-center gap-2 text-green-400 font-medium">
                      <span>✓</span>
                      <span>Save 40+ hours per month</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="relative">
              <div className="bg-gradient-to-br from-slate-800 to-slate-700 rounded-3xl p-8 border border-slate-600 shadow-2xl">
                <div className="space-y-6">
                  <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-600">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-white font-medium">Live Collaboration Session</span>
                      </div>
                      <span className="text-green-400 text-sm font-medium">Active</span>
                    </div>
                    <div className="space-y-3">
                      <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-3 bg-gradient-to-r from-green-500 to-blue-500 rounded-full" style={{width: '75%'}}></div>
                      </div>
                      <p className="text-gray-400 text-sm">Project completion: 75%</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-600">
                      <Users className="h-8 w-8 text-purple-400 mb-3" />
                      <p className="text-3xl font-bold text-white">12</p>
                      <p className="text-sm text-gray-400">Active Clients</p>
                    </div>
                    <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-600">
                      <MessageSquare className="h-8 w-8 text-blue-400 mb-3" />
                      <p className="text-3xl font-bold text-white">48</p>
                      <p className="text-sm text-gray-400">Comments Today</p>
                    </div>
                  </div>
                  
                  <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-600">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-gray-400">Recent Activity</span>
                      <span className="text-green-400 text-sm">Live</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-gray-300 text-sm">New comment at 02:45</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="text-gray-300 text-sm">Client joined review</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        <span className="text-gray-300 text-sm">Version 3 uploaded</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-gradient-to-b from-slate-900 to-slate-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-20">
            <h2 className="text-5xl md:text-6xl font-bold mb-8 text-white">
              Powerful Features That
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent"> Actually Matter</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-4xl mx-auto leading-relaxed">
              Everything you need to transform your video collaboration workflow, nothing you don't
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="group relative bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700 hover:border-purple-500/50 transition-all duration-300 hover:transform hover:scale-105">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative z-10">
                <div className="w-16 h-16 bg-purple-500/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Upload className="h-8 w-8 text-purple-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Smart Upload</h3>
                <p className="text-gray-400 leading-relaxed mb-6">
                  Upload videos to YouTube or Google Cloud Storage with automatic transcoding and optimization for seamless client viewing.
                </p>
                <div className="flex items-center gap-2 text-purple-400 font-medium">
                  <span>⚡</span>
                  <span>Auto-optimization included</span>
                </div>
              </div>
            </div>
            
            <div className="group relative bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700 hover:border-green-500/50 transition-all duration-300 hover:transform hover:scale-105">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-blue-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative z-10">
                <div className="w-16 h-16 bg-green-500/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Shield className="h-8 w-8 text-green-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Fort Knox Security</h3>
                <p className="text-gray-400 leading-relaxed mb-6">
                  Generate unique security codes and control access with granular permissions. Your content stays protected until you're ready.
                </p>
                <div className="flex items-center gap-2 text-green-400 font-medium">
                  <span>🔒</span>
                  <span>Bank-level encryption</span>
                </div>
              </div>
            </div>
            
            <div className="group relative bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700 hover:border-blue-500/50 transition-all duration-300 hover:transform hover:scale-105">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative z-10">
                <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <MessageSquare className="h-8 w-8 text-blue-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Timestamp Comments</h3>
                <p className="text-gray-400 leading-relaxed mb-6">
                  Clients leave precise feedback at exact moments. No more vague comments - get specific, actionable feedback every time.
                </p>
                <div className="flex items-center gap-2 text-blue-400 font-medium">
                  <span>🎯</span>
                  <span>Precision feedback</span>
                </div>
              </div>
            </div>
            
            <div className="group relative bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700 hover:border-orange-500/50 transition-all duration-300 hover:transform hover:scale-105">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-red-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative z-10">
                <div className="w-16 h-16 bg-orange-500/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Play className="h-8 w-8 text-orange-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Multi-Platform Support</h3>
                <p className="text-gray-400 leading-relaxed mb-6">
                  Works seamlessly with YouTube and Google Cloud Storage. Manage all your video content from one unified dashboard.
                </p>
                <div className="flex items-center gap-2 text-orange-400 font-medium">
                  <span>🔄</span>
                  <span>Unified management</span>
                </div>
              </div>
            </div>
            
            <div className="group relative bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700 hover:border-pink-500/50 transition-all duration-300 hover:transform hover:scale-105">
              <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 to-purple-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative z-10">
                <div className="w-16 h-16 bg-pink-500/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Users className="h-8 w-8 text-pink-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Client Management</h3>
                <p className="text-gray-400 leading-relaxed mb-6">
                  Organize clients, projects, and permissions effortlessly. Keep track of who has access to what content.
                </p>
                <div className="flex items-center gap-2 text-pink-400 font-medium">
                  <span>👥</span>
                  <span>Granular control</span>
                </div>
              </div>
            </div>
            
            <div className="group relative bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700 hover:border-cyan-500/50 transition-all duration-300 hover:transform hover:scale-105">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-blue-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative z-10">
                <div className="w-16 h-16 bg-cyan-500/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Zap className="h-8 w-8 text-cyan-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Real-Time Magic</h3>
                <p className="text-gray-400 leading-relaxed mb-6">
                  Get instant notifications when clients comment or review your drafts. Stay in the loop without constantly checking email.
                </p>
                <div className="flex items-center gap-2 text-cyan-400 font-medium">
                  <span>⚡</span>
                  <span>Instant updates</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="about" className="py-24 bg-gradient-to-b from-slate-800 to-slate-900">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-20">
            <h2 className="text-5xl md:text-6xl font-bold mb-8 text-white">
              Why Creators Choose
              <span className="bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text text-transparent"> Previu</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-4xl mx-auto leading-relaxed">
              Join hundreds of professionals who've transformed their video collaboration workflow
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="space-y-8">
              <div className="group bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700 hover:border-green-500/50 transition-all duration-300">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <TrendingUp className="h-6 w-6 text-green-400" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-2xl font-bold text-white">60% Faster Project Delivery</h3>
                    <p className="text-gray-400 leading-relaxed">
                      Eliminate back-and-forth emails and vague feedback. Get precise comments that reduce revision cycles by more than half.
                    </p>
                    <div className="flex items-center gap-2 text-green-400 font-medium">
                      <span>⚡</span>
                      <span>Save 20+ hours per project</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="group bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700 hover:border-blue-500/50 transition-all duration-300">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <Shield className="h-6 w-6 text-blue-400" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-2xl font-bold text-white">Enterprise-Grade Security</h3>
                    <p className="text-gray-400 leading-relaxed">
                      Your intellectual property is protected with bank-level encryption and unique access codes for each client.
                    </p>
                    <div className="flex items-center gap-2 text-blue-400 font-medium">
                      <span>🔒</span>
                      <span>Zero content leaks ever</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="group bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700 hover:border-purple-500/50 transition-all duration-300">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <Users className="h-6 w-6 text-purple-400" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-2xl font-bold text-white">Happier Clients</h3>
                    <p className="text-gray-400 leading-relaxed">
                      Clients love the professional experience. Easy access, clear feedback, and faster revisions lead to better relationships.
                    </p>
                    <div className="flex items-center gap-2 text-purple-400 font-medium">
                      <span>😊</span>
                      <span>95% client satisfaction</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-8">
              <div className="group bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700 hover:border-orange-500/50 transition-all duration-300">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <Zap className="h-6 w-6 text-orange-400" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-2xl font-bold text-white">Streamlined Workflow</h3>
                    <p className="text-gray-400 leading-relaxed">
                      From upload to delivery, everything happens in one dashboard. No more juggling multiple platforms and tools.
                    </p>
                    <div className="flex items-center gap-2 text-orange-400 font-medium">
                      <span>🚀</span>
                      <span>10x productivity boost</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="group bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700 hover:border-cyan-500/50 transition-all duration-300">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <BarChart3 className="h-6 w-6 text-cyan-400" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-2xl font-bold text-white">Better Project Insights</h3>
                    <p className="text-gray-400 leading-relaxed">
                      Track project progress, client engagement, and revision history. Make data-driven decisions to improve your process.
                    </p>
                    <div className="flex items-center gap-2 text-cyan-400 font-medium">
                      <span>📊</span>
                      <span>Analytics included</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="group bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700 hover:border-pink-500/50 transition-all duration-300">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-pink-500/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <Star className="h-6 w-6 text-pink-400" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-2xl font-bold text-white">Professional Reputation</h3>
                    <p className="text-gray-400 leading-relaxed">
                      Impress clients with a polished, secure collaboration platform that sets you apart from the competition.
                    </p>
                    <div className="flex items-center gap-2 text-pink-400 font-medium">
                      <span>⭐</span>
                      <span>Stand out from crowd</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section id="contact" className="py-24 bg-gradient-to-b from-slate-900 to-slate-800 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-pink-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse animation-delay-2000"></div>
        </div>
        
        <div className="max-w-5xl mx-auto px-4 relative z-10 text-center">
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-3xl p-16 border border-slate-700 shadow-2xl">
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-full text-sm text-purple-300 font-medium">
                <Zap className="h-4 w-4" />
                Limited Time Offer
              </div>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
              Ready to Transform Your
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent"> Video Workflow</span>?
            </h2>
            <p className="text-xl text-gray-400 mb-12 leading-relaxed">
              Join hundreds of creators who've already streamlined their collaboration process
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-12">
              <Button
                onClick={() => navigate("/auth")}
                size="lg"
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold group px-12 py-4 text-lg shadow-2xl hover:shadow-purple-500/25 transition-all duration-300 transform hover:scale-105"
              >
                Start Free Trial
                <ArrowRight className="ml-3 h-5 w-5 group-hover:translate-x-2 transition-transform" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-2 border-white/20 hover:border-white/40 text-white hover:bg-white/10 px-12 py-4 text-lg backdrop-blur-sm transition-all duration-300"
              >
                Schedule Demo
              </Button>
            </div>
            
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                <span className="text-green-400 font-medium">✓</span> No credit card required 
                <span className="mx-2">•</span>
                <span className="text-green-400 font-medium">✓</span> 14-day free trial 
                <span className="mx-2">•</span>
                <span className="text-green-400 font-medium">✓</span> Cancel anytime
              </p>
              
              <div className="flex items-center justify-center gap-8 pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-white mb-1">500+</p>
                  <p className="text-sm text-gray-400">Happy Creators</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-white mb-1">4.9/5</p>
                  <p className="text-sm text-gray-400">Average Rating</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-white mb-1">60%</p>
                  <p className="text-sm text-gray-400">Faster Delivery</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg"></div>
                <h3 className="text-xl font-bold text-white">Previu</h3>
              </div>
              <p className="text-gray-400 leading-relaxed">
                The professional video collaboration platform that transforms how creators work with clients.
              </p>
            </div>
            
            <div className="space-y-4">
              <h4 className="text-white font-semibold">Product</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Features</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Security</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Roadmap</a></li>
              </ul>
            </div>
            
            <div className="space-y-4">
              <h4 className="text-white font-semibold">Company</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Careers</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
            
            <div className="space-y-4">
              <h4 className="text-white font-semibold">Support</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Help Center</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">API Docs</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Status</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Community</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-slate-800 pt-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-gray-400 text-sm">
                &copy; 2025 Previu. All rights reserved.
              </p>
              <div className="flex items-center gap-6">
                <a href="#" className="text-gray-400 hover:text-white transition-colors text-sm">Privacy Policy</a>
                <a href="#" className="text-gray-400 hover:text-white transition-colors text-sm">Terms of Service</a>
                <a href="#" className="text-gray-400 hover:text-white transition-colors text-sm">Cookie Policy</a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
