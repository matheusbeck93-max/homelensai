import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SearchBar } from "@/components/SearchBar";
import { Bot, TrendingUp, Calculator, FileText, Home, MessageSquare, User, LogOut } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import heroBackground from "@/assets/american-house-hero.jpg";

export default function Index() {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev =>
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    );
  };

  const handleSearch = (query: string) => {
    const params = new URLSearchParams({ q: query });
    if (selectedCategories.length > 0) {
      params.set("categories", selectedCategories.join(","));
    }
    navigate(`/properties?${params.toString()}`);
  };

  const features = [
    {
      icon: Bot,
      title: "AI Property Assistant",
      description: "Get intelligent recommendations based on your preferences and market conditions"
    },
    {
      icon: TrendingUp,
      title: "Market Analysis",
      description: "Access real-time market data, trends, and investment insights"
    },
    {
      icon: Calculator,
      title: "Financial Tools",
      description: "Calculate mortgages, ROI, and evaluate investment opportunities"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Home className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">HomeLens</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#features" className="text-foreground hover:text-primary transition-colors font-medium hidden md:inline">
              Features
            </a>
            <a href="#pricing" className="text-foreground hover:text-primary transition-colors font-medium hidden md:inline">
              Pricing
            </a>
            
            <ThemeToggle />
            {user ? (
              <>
                <Button variant="default" onClick={() => navigate("/chat")}>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Chat
                </Button>
                <Button variant="outline" onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => navigate("/auth")}>Login</Button>
                <Button variant="default" onClick={() => navigate("/auth")}>Sign Up</Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-[600px] lg:min-h-[700px] flex items-center justify-center overflow-hidden">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0">
          <img 
            src={heroBackground}
            alt="Beautiful American home"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[hsl(222,47%,11%)]/80 to-[hsl(222,47%,17%)]/80"></div>
        </div>
        
        {/* Content - Centered */}
        <div className="container mx-auto px-4 py-20 relative z-10">
          <div className="max-w-4xl mx-auto text-center text-white">
            <div className="inline-block mb-4 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
              <span className="text-primary text-sm font-medium">Powered by AI</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              Your <span className="text-primary">Dream Home</span>.<br />
              Your <span className="text-primary">Journey</span>.<br />
              Your <span className="text-primary">Success</span>.
            </h1>
            
            <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
              AI-powered real estate assistant that helps you find properties, analyze investments, and make smarter decisions with confidence.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 mb-12 justify-center">
              <Button size="lg" onClick={() => navigate(user ? "/chat" : "/auth")} className="shadow-glow">
                <MessageSquare className="mr-2 h-5 w-5" />
                {user ? "Start Chatting" : "Get Started Free"}
              </Button>
              <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/10">
                Learn More
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 pt-8 border-t border-white/10 max-w-2xl mx-auto">
              <div>
                <div className="text-3xl font-bold text-primary mb-1">500+</div>
                <div className="text-sm text-gray-400">Happy Users</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-primary mb-1">24/7</div>
                <div className="text-sm text-gray-400">AI Support</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-primary mb-1">100%</div>
                <div className="text-sm text-gray-400">Free to Start</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Search Section */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-8">Start Your Property Search</h2>
            
            <div className="mb-8">
              <SearchBar onSearch={handleSearch} />
            </div>

            <div className="text-center mb-6">
              <p className="text-sm text-muted-foreground">Select categories to personalize your search:</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { id: "first-time-buyer", icon: Home, label: "First-Time Buyer" },
                { id: "mortgage-calculator", icon: Calculator, label: "Calculate Mortgage" },
                { id: "pre-approval", icon: FileText, label: "Get Pre-Approved" }
              ].map(({ id, icon: Icon, label }) => (
                <Card 
                  key={id} 
                  className={`cursor-pointer transition-all hover:shadow-lg hover:border-primary/50 ${
                    selectedCategories.includes(id) ? "border-primary bg-primary/5 shadow-md" : ""
                  }`} 
                  onClick={() => toggleCategory(id)}
                >
                  <CardContent className="flex flex-col items-center gap-3 p-6">
                    <Icon className={`h-8 w-8 ${selectedCategories.includes(id) ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="font-medium text-center">{label}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Why Choose <span className="text-primary">HomeLens</span>?</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Comprehensive AI-powered tools to help you make smarter real estate decisions
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <Card key={index} className="border hover:border-primary/50 hover:shadow-lg transition-all group">
              <CardContent className="p-8">
                <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-xl text-muted-foreground mb-12">
              Everything you need to make informed real estate decisions
            </p>
            
            <Card className="border-2 border-primary shadow-xl">
              <CardContent className="p-12">
                <div className="mb-8">
                  <div className="inline-block px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
                    Free to Start
                  </div>
                  <h3 className="text-4xl font-bold mb-2">$6.97<span className="text-lg font-normal text-muted-foreground">/month</span></h3>
                  <p className="text-muted-foreground text-lg">All premium features included</p>
                </div>
                
                <ul className="space-y-4 text-left max-w-md mx-auto mb-10">
                  {[
                    "Unlimited AI conversations",
                    "Property image analysis",
                    "Market insights and trends",
                    "Mortgage calculators",
                    "Investment analysis tools",
                    "Export conversation history"
                  ].map((feature, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <div className="h-2 w-2 rounded-full bg-primary" />
                      </div>
                      <span className="text-base">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Button size="lg" className="w-full max-w-sm shadow-glow" onClick={() => navigate(user ? "/chat" : "/auth")}>
                  {user ? "Start Chatting Now" : "Get Started Free"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-4xl font-bold mb-4">Ready to Find Your Dream Home?</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join hundreds of users making smarter real estate decisions with AI-powered insights
          </p>
          <Button size="lg" className="shadow-glow" onClick={() => navigate(user ? "/chat" : "/auth")}>
            {user ? "Open AI Assistant" : "Get Started Now"}
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/20 py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Home className="h-5 w-5 text-primary" />
              <span className="font-bold">HomeLens</span>
            </div>
            <p className="text-muted-foreground text-sm">
              © 2025 HomeLens. Powered by advanced AI technology.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
