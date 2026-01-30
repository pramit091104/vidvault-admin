import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Upload, 
  Share2, 
  MessageSquare, 
  CheckCircle, 
  Shield, 
  Users, 
  Clock, 
  Star,
  Play,
  Zap,
  Target,
  TrendingUp,
  FileVideo,
  Lock,
  Eye,
  BarChart3,
  Smartphone,
  Globe,
  ArrowRight,
  Check,
  Mail,
  AlertTriangle,
  Download,
  Timer,
  UserCheck,
  Settings,
  UploadCloud,
  Link as LinkIcon,
  ThumbsUp
} from 'lucide-react';
import { Link } from 'react-router-dom';

const Index = () => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        isScrolled ? 'bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm' : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
                <FileVideo className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">Previu</span>
            </div>
            
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-600 hover:text-gray-900 transition-colors font-medium">Features</a>
              <a href="#how-it-works" className="text-gray-600 hover:text-gray-900 transition-colors font-medium">How it Works</a>
              <a href="#pricing" className="text-gray-600 hover:text-gray-900 transition-colors font-medium">Pricing</a>
              <a href="#testimonials" className="text-gray-600 hover:text-gray-900 transition-colors font-medium">Testimonials</a>
              <a href="#contact" className="text-gray-600 hover:text-gray-900 transition-colors font-medium">Contact</a>
              <Link to="/auth" className="text-gray-600 hover:text-gray-900 transition-colors font-medium">Log in</Link>
              <Link to="/auth">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-all duration-200 hover:shadow-lg">
                  Get Started
                </Button>
              </Link>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <Button variant="ghost" size="sm">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-24 pb-16 lg:pt-32 lg:pb-24 bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="text-center lg:text-left">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
                Get client approval
                <span className="bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent"> without the chaos</span>
              </h1>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed max-w-2xl">
                Share video previews securely, collect precise timestamped feedback, and get approvals faster. 
                No more WhatsApp confusion or scattered comments.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-8">
                <Link to="/auth">
                  <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 text-lg font-semibold rounded-lg transition-all duration-200 hover:shadow-xl hover:scale-105">
                    Start Free Trial
                  </Button>
                </Link>
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="border-2 border-gray-300 text-gray-700 hover:bg-gray-50 px-8 py-4 text-lg font-semibold rounded-lg transition-all duration-200"
                  onClick={() => {
                    // You can replace this with actual demo functionality
                    alert("Demo video coming soon! Sign up for early access.");
                  }}
                >
                  <Play className="w-5 h-5 mr-2" />
                  Watch Demo
                </Button>
              </div>
              <p className="text-sm text-gray-500">
                No credit card required • 14-day free trial • Cancel anytime
              </p>
            </div>
            
            {/* Hero Visual - Dashboard Mockup */}
            <div className="relative">
              <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                    <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                    <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                  </div>
                  <div className="text-sm text-gray-600 font-medium">Project: Brand Video v3</div>
                </div>
                <div className="p-6">
                  <div className="bg-black rounded-lg aspect-video mb-4 flex items-center justify-center relative">
                    <Play className="w-16 h-16 text-white opacity-80" />
                    <div className="absolute bottom-4 left-4 right-4">
                      <div className="bg-white/90 rounded-lg p-2 text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">2:34</span>
                          <span className="text-gray-600">5:12</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1">
                          <div className="bg-blue-600 h-1 rounded-full" style={{width: '45%'}}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-start space-x-3 bg-blue-50 rounded-lg p-3">
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                        JD
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-medium text-sm">John Doe</span>
                          <span className="text-xs text-gray-500">at 2:34</span>
                        </div>
                        <p className="text-sm text-gray-700">Can we make the logo bigger here?</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between bg-green-50 rounded-lg p-3">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <span className="font-medium text-green-800">Project Approved</span>
                      </div>
                      <Badge className="bg-green-100 text-green-800">85% Complete</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Pain Points Section */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Tired of This Feedback Nightmare?
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Every video editor knows these pain points. It's time to fix them.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center group">
              <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                <Mail className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">WhatsApp Chaos</h3>
              <p className="text-gray-600 mb-4 leading-relaxed">
                Scattered feedback across WhatsApp, email, and calls. Vague comments like "change that part at 2:30" leave you guessing.
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 font-semibold text-sm">
                  "Can you make it more... you know, punchy?"
                </p>
              </div>
            </div>
            
            <div className="text-center group">
              <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                <Download className="w-8 h-8 text-orange-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Unsafe File Sharing</h3>
              <p className="text-gray-600 mb-4 leading-relaxed">
                Dropbox and Google Drive links with no control. Clients download, share, and leak your work before approval.
              </p>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="text-orange-800 font-semibold text-sm">
                  Your video is now on 5 different devices
                </p>
              </div>
            </div>
            
            <div className="text-center group">
              <div className="w-16 h-16 bg-yellow-100 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                <AlertTriangle className="w-8 h-8 text-yellow-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Unprofessional Workflow</h3>
              <p className="text-gray-600 mb-4 leading-relaxed">
                Messy communication makes you look disorganized. Clients lose confidence in your professional process.
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800 font-semibold text-sm">
                  "This feels very unorganized..."
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Solution Section */}
      <section className="py-16 lg:py-24 bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              One Platform. Clear Feedback. Fast Approval.
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Previu streamlines your entire client review process with professional tools designed for video creators.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <Card className="bg-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Shield className="w-8 h-8 text-blue-600" />
                </div>
                <CardTitle className="text-xl text-gray-900">Secure Preview Links</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-gray-600 leading-relaxed">
                  Unique access codes, no downloads, controlled access. Your work stays protected until final approval.
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Timer className="w-8 h-8 text-green-600" />
                </div>
                <CardTitle className="text-xl text-gray-900">Timestamped Feedback</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-gray-600 leading-relaxed">
                  Clients click exactly where they want changes. No more guessing what "that part" means.
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <CheckCircle className="w-8 h-8 text-purple-600" />
                </div>
                <CardTitle className="text-xl text-gray-900">Clear Approval System</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-gray-600 leading-relaxed">
                  Track every revision and see approval status in real-time. Professional dashboard for organized workflow.
                </p>
              </CardContent>
            </Card>
          </div>
          
          {/* Metrics Panel */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 max-w-4xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              <div>
                <div className="text-3xl font-bold text-blue-600 mb-2">3</div>
                <div className="text-sm text-gray-600">Active Clients</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-green-600 mb-2">12</div>
                <div className="text-sm text-gray-600">Precise Comments</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-purple-600 mb-2">85%</div>
                <div className="text-sm text-gray-600">Project Approval</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-orange-600 mb-2">2.3x</div>
                <div className="text-sm text-gray-600">Faster Delivery</div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Features Grid */}
      <section id="features" className="py-16 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Everything You Need for Smooth Client Reviews
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Professional tools designed specifically for video creators and their clients.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
              <CardHeader>
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <LinkIcon className="w-6 h-6 text-blue-600" />
                </div>
                <CardTitle className="text-lg text-gray-900">Secure Preview Links</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Password-protected sharing with unique access codes. Links expire when you want them to.
                </p>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
              <CardHeader>
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <MessageSquare className="w-6 h-6 text-green-600" />
                </div>
                <CardTitle className="text-lg text-gray-900">Timestamped Comments</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Comments tied to exact moments in your video timeline. Crystal clear feedback every time.
                </p>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
              <CardHeader>
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
                <CardTitle className="text-lg text-gray-900">Revision Tracking</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  See every version and change request in one place. Never lose track of project progress.
                </p>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
              <CardHeader>
                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Lock className="w-6 h-6 text-red-600" />
                </div>
                <CardTitle className="text-lg text-gray-900">Access Control</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Control who can view, comment, and download. Secure sharing that protects your work.
                </p>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
              <CardHeader>
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Users className="w-6 h-6 text-orange-600" />
                </div>
                <CardTitle className="text-lg text-gray-900">Client Management</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Organize all your clients and projects in one dashboard. Simple and professional.
                </p>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
              <CardHeader>
                <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <BarChart3 className="w-6 h-6 text-indigo-600" />
                </div>
                <CardTitle className="text-lg text-gray-900">Project Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Track views, engagement, and comment activity. Monitor project progress and client interaction.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
      {/* How It Works */}
      <section id="how-it-works" className="py-16 lg:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              From Upload to Approval in 3 Simple Steps
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Get started in minutes. No complex setup, no learning curve.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center group">
              <div className="relative mb-8">
                <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <UploadCloud className="w-10 h-10 text-white" />
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-bold text-sm">1</span>
                </div>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Upload Your Video</h3>
              <p className="text-gray-600 mb-6 leading-relaxed">
                Drag and drop your video file. We handle compression, hosting, and security automatically.
              </p>
              <div className="bg-white rounded-lg p-4 border-2 border-dashed border-gray-300 max-w-sm mx-auto">
                <div className="text-center">
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Drop video here or click to browse</p>
                </div>
              </div>
            </div>
            
            <div className="text-center group">
              <div className="relative mb-8">
                <div className="w-20 h-20 bg-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Share2 className="w-10 h-10 text-white" />
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600 font-bold text-sm">2</span>
                </div>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Share Preview Link</h3>
              <p className="text-gray-600 mb-6 leading-relaxed">
                Send one secure link with access code to your client via email or message. That's it.
              </p>
              <div className="bg-white rounded-lg p-4 border border-gray-200 max-w-sm mx-auto">
                <div className="flex items-center space-x-2">
                  <div className="flex-1 bg-gray-100 rounded px-3 py-2 text-sm text-gray-600">
                    previu.online/v/abc123
                  </div>
                  <Button size="sm" className="bg-green-600 hover:bg-green-700">
                    Copy
                  </Button>
                </div>
              </div>
            </div>
            
            <div className="text-center group">
              <div className="relative mb-8">
                <div className="w-20 h-20 bg-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <ThumbsUp className="w-10 h-10 text-white" />
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-purple-600 font-bold text-sm">3</span>
                </div>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Get Feedback & Approval</h3>
              <p className="text-gray-600 mb-6 leading-relaxed">
                Client leaves timestamped feedback and clicks "Approve". All organized in your dashboard.
              </p>
              <div className="bg-white rounded-lg p-4 border border-gray-200 max-w-sm mx-auto">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 text-sm">
                    <MessageSquare className="w-4 h-4 text-blue-600" />
                    <span className="text-gray-600">2 comments at 1:23</span>
                  </div>
                  <Button size="sm" className="w-full bg-green-600 hover:bg-green-700">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Approve Project
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Who It's For */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Built for Creative Professionals
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Whether you're a solo creator or part of a team, Previu scales with your needs.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 text-center group">
              <CardHeader className="pb-4">
                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Target className="w-8 h-8 text-blue-600" />
                </div>
                <CardTitle className="text-2xl text-gray-900">Freelancers</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 leading-relaxed">
                  Streamline client communication and look more professional. Impress clients with organized workflows and secure sharing.
                </p>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 text-center group">
              <CardHeader className="pb-4">
                <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Users className="w-8 h-8 text-green-600" />
                </div>
                <CardTitle className="text-2xl text-gray-900">Agencies</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 leading-relaxed">
                  Manage multiple client projects without the chaos. Professional client portals and organized feedback systems.
                </p>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 text-center group">
              <CardHeader className="pb-4">
                <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Zap className="w-8 h-8 text-purple-600" />
                </div>
                <CardTitle className="text-2xl text-gray-900">Creative Teams</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 leading-relaxed">
                  Collaborate with stakeholders and streamline approval processes. Perfect for in-house creative teams.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
      {/* Pricing Section */}
      <section id="pricing" className="py-16 lg:py-24 bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Start free, upgrade when you're ready. No hidden fees, no surprises.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free Plan */}
            <Card className="border-2 border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-2xl text-gray-900 mb-2">Free</CardTitle>
                <div className="text-4xl font-bold text-gray-900 mb-2">₹0</div>
                <p className="text-gray-600">per month</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <Check className="w-5 h-5 text-green-600" />
                    <span className="text-gray-700">Up to 5 video uploads/month</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="w-5 h-5 text-green-600" />
                    <span className="text-gray-700">Up to 5 clients</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="w-5 h-5 text-green-600" />
                    <span className="text-gray-700">Basic timestamp comments</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="w-5 h-5 text-green-600" />
                    <span className="text-gray-700">Secure access codes</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="w-5 h-5 text-green-600" />
                    <span className="text-gray-700">100MB file size limit</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="w-5 h-5 text-green-600" />
                    <span className="text-gray-700">Basic client management</span>
                  </div>
                </div>
                <Link to="/auth" className="block">
                  <Button className="w-full bg-gray-900 hover:bg-gray-800 text-white py-3 text-lg font-semibold">
                    Start Free
                  </Button>
                </Link>
              </CardContent>
            </Card>
            
            {/* Premium Plan */}
            <Card className="border-2 border-blue-600 shadow-xl hover:shadow-2xl transition-all duration-300 relative">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-blue-600 text-white px-4 py-1 text-sm font-semibold">
                  Most Popular
                </Badge>
              </div>
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-2xl text-gray-900 mb-2">Premium</CardTitle>
                <div className="text-4xl font-bold text-blue-600 mb-2">₹149</div>
                <p className="text-gray-600">per month</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <Check className="w-5 h-5 text-green-600" />
                    <span className="text-gray-700">Up to 50 uploads/month</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="w-5 h-5 text-green-600" />
                    <span className="text-gray-700">Up to 50 clients</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="w-5 h-5 text-green-600" />
                    <span className="text-gray-700">Advanced timestamp comments</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="w-5 h-5 text-green-600" />
                    <span className="text-gray-700">Resumable uploads</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="w-5 h-5 text-green-600" />
                    <span className="text-gray-700">2GB file size limit</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="w-5 h-5 text-green-600" />
                    <span className="text-gray-700">Advanced client management</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="w-5 h-5 text-green-600" />
                    <span className="text-gray-700">Public sharing with custom URLs</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="w-5 h-5 text-green-600" />
                    <span className="text-gray-700">Priority support</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="w-5 h-5 text-green-600" />
                    <span className="text-gray-700">Analytics & insights</span>
                  </div>
                </div>
                <Link to="/auth" className="block">
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg font-semibold">
                    Start Free Trial
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
          
          <div className="text-center mt-8">
            <p className="text-gray-600">
              14-day free trial • No setup fees • Cancel anytime
            </p>
          </div>
        </div>
      </section>
      {/* Social Proof & Benefits */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Why Creators Choose Previu
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Join thousands of video creators who've transformed their client workflow.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 text-center group">
              <CardHeader>
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Clock className="w-6 h-6 text-green-600" />
                </div>
                <CardTitle className="text-lg text-gray-900">Faster Project Delivery</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Complete projects 2.3x faster with organized feedback and clear approval workflows.
                </p>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 text-center group">
              <CardHeader>
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Shield className="w-6 h-6 text-blue-600" />
                </div>
                <CardTitle className="text-lg text-gray-900">Professional Security</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Protect your work with secure links, access codes, and controlled sharing permissions.
                </p>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 text-center group">
              <CardHeader>
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Star className="w-6 h-6 text-purple-600" />
                </div>
                <CardTitle className="text-lg text-gray-900">Better Client Experience</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Impress clients with professional review portals and seamless feedback collection.
                </p>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 text-center group">
              <CardHeader>
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Settings className="w-6 h-6 text-orange-600" />
                </div>
                <CardTitle className="text-lg text-gray-900">Organized Workflow</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Keep all projects, clients, and feedback organized in one professional dashboard.
                </p>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 text-center group">
              <CardHeader>
                <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <BarChart3 className="w-6 h-6 text-indigo-600" />
                </div>
                <CardTitle className="text-lg text-gray-900">Project Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Track engagement, monitor progress, and understand client behavior with detailed insights.
                </p>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 text-center group">
              <CardHeader>
                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Target className="w-6 h-6 text-red-600" />
                </div>
                <CardTitle className="text-lg text-gray-900">Professional Brand</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Build trust and credibility with clients through professional presentation and workflows.
                </p>
              </CardContent>
            </Card>
          </div>
          {/* Testimonials */}
          <div id="testimonials" className="grid md:grid-cols-3 gap-8">
            <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100">
              <CardContent className="p-6">
                <div className="flex items-center mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-gray-700 mb-4 italic">
                  "Previu completely changed how I work with clients. No more WhatsApp chaos, just clean, professional feedback."
                </p>
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm mr-3">
                    RK
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Rahul Kumar</div>
                    <div className="text-sm text-gray-600">Freelance Video Editor</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100">
              <CardContent className="p-6">
                <div className="flex items-center mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-gray-700 mb-4 italic">
                  "Our agency now handles 3x more projects with the same team. The organized workflow is a game-changer."
                </p>
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-sm mr-3">
                    PS
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Priya Sharma</div>
                    <div className="text-sm text-gray-600">Creative Director</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100">
              <CardContent className="p-6">
                <div className="flex items-center mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-gray-700 mb-4 italic">
                  "Clients love the professional experience. Timestamped feedback means no more guessing what they want."
                </p>
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm mr-3">
                    AM
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Arjun Mehta</div>
                    <div className="text-sm text-gray-600">Motion Graphics Artist</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
      {/* Final CTA Section */}
      <section className="py-16 lg:py-24 bg-gradient-to-br from-blue-600 to-blue-700 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-5xl font-bold mb-6">
            Ready to Streamline Your Video Reviews?
          </h2>
          <p className="text-xl text-blue-100 mb-8 leading-relaxed max-w-2xl mx-auto">
            Join thousands of creators who've ditched the feedback chaos. Get precise comments, 
            secure sharing, and professional approval workflows.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Link to="/auth">
              <Button size="lg" className="bg-white text-blue-600 hover:bg-gray-100 px-8 py-4 text-lg font-semibold rounded-lg transition-all duration-200 hover:shadow-xl hover:scale-105">
                Start Free Trial
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Button 
              size="lg" 
              variant="outline" 
              className="border-2 border-white text-white hover:bg-white hover:text-blue-600 px-8 py-4 text-lg font-semibold rounded-lg transition-all duration-200"
              onClick={() => {
                // You can replace this with actual scheduling functionality
                alert("Schedule a demo by emailing us at demo@previu.online");
              }}
            >
              Schedule Demo
            </Button>
          </div>
          
          <div className="flex flex-wrap justify-center gap-6 text-blue-100">
            <div className="flex items-center space-x-2">
              <Check className="w-5 h-5" />
              <span>2GB max file size</span>
            </div>
            <div className="flex items-center space-x-2">
              <Check className="w-5 h-5" />
              <span>Secure access codes</span>
            </div>
            <div className="flex items-center space-x-2">
              <Check className="w-5 h-5" />
              <span>Precise timestamp feedback</span>
            </div>
          </div>
        </div>
      </section>
      {/* Footer */}
      <footer id="contact" className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
                  <FileVideo className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-bold">Previu</span>
              </div>
              <p className="text-gray-400 leading-relaxed">
                Professional video review and approval platform for creators and their clients.
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Product</h3>
              <ul className="space-y-2">
                <li><a href="#features" className="text-gray-400 hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="text-gray-400 hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#how-it-works" className="text-gray-400 hover:text-white transition-colors">How it Works</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">API</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Company</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Careers</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Press</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Support</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Help Center</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Contact</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Status</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Security</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <p className="text-gray-400 text-sm">
                © 2025 Previu. All rights reserved.
              </p>
              <div className="flex space-x-6 mt-4 md:mt-0">
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