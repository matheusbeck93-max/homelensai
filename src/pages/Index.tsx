import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SearchBar } from "@/components/SearchBar";
import { Bot, TrendingUp, Calculator, FileText, Home, MessageSquare, User, LogOut } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
export default function Index() {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({
      data
    }) => setUser(data.user));
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };
  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]);
  };
  const handleSearch = (query: string) => {
    const params = new URLSearchParams({
      q: query
    });
    if (selectedCategories.length > 0) {
      params.set("categories", selectedCategories.join(","));
    }
    navigate(`/properties?${params.toString()}`);
  };
  const features = [{
    icon: Bot,
    title: "AI Property Assistant",
    description: "Get intelligent recommendations based on your preferences and market conditions"
  }, {
    icon: TrendingUp,
    title: "Market Analysis",
    description: "Access real-time market data, trends, and investment insights"
  }, {
    icon: Calculator,
    title: "Financial Tools",
    description: "Calculate mortgages, ROI, and evaluate investment opportunities"
  }];
  return <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      <nav className="border-b bg-primary backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Home className="h-6 w-6 text-primary-foreground" />
            <span className="text-xl font-bold text-primary-foreground">HomeLens</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#features" className="text-primary-foreground hover:opacity-80 transition-opacity font-medium">
              Features
            </a>
            <a href="#pricing" className="text-primary-foreground hover:opacity-80 transition-opacity font-medium">
              Pricing
            </a>
            <a href="#cta" className="text-primary-foreground hover:opacity-80 transition-opacity font-medium">
              Get Started
            </a>
            <ThemeToggle />
            {user ? <>
                <Button variant="secondary" onClick={() => navigate("/chat")}>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Chat
                </Button>
                <Button variant="secondary" onClick={() => navigate("/settings")}>
                  <User className="h-4 w-4 mr-2" />
                  Settings
                </Button>
                <Button variant="outline" className="border-primary-foreground text-primary-foreground hover:bg-primary-foreground/10" onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </> : <>
                <Button variant="secondary" onClick={() => navigate("/auth")} className="text-slate-50 bg-slate-950 hover:bg-slate-800">Login</Button>
                <Button variant="secondary" onClick={() => navigate("/auth")} className="bg-slate-950 hover:bg-slate-800">Sign Up</Button>
              </>}
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-20">
        <div className="text-center max-w-4xl mx-auto mb-16">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Find your new home.
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Your intelligent assistant for finding homes, analyzing investments, and understanding mortgages
          </p>
          
          <div className="mb-8">
            <SearchBar onSearch={handleSearch} />
          </div>

          <div className="mb-4">
            <p className="text-sm text-muted-foreground mb-4">Select all that apply to tailor your search:</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {[{
            id: "first-time-buyer",
            icon: Home,
            label: "First-Time Buyer"
          }, {
            id: "mortgage-calculator",
            icon: Calculator,
            label: "Calculate Mortgage"
          }, {
            id: "pre-approval",
            icon: FileText,
            label: "Get Pre-Approved"
          }].map(({
            id,
            icon: Icon,
            label
          }) => <Card key={id} className={`cursor-pointer transition-all hover:shadow-lg ${selectedCategories.includes(id) ? "border-primary bg-primary/5 shadow-md" : "hover:border-primary/50"}`} onClick={() => toggleCategory(id)}>
                <CardContent className="flex flex-col items-center gap-3 p-6">
                  <Icon className={`h-8 w-8 ${selectedCategories.includes(id) ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="font-medium text-center">{label}</span>
                </CardContent>
              </Card>)}
          </div>
        </div>

        <div id="features" className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-20">
          {features.map((feature, index) => <Card key={index} className="border-2 hover:border-primary/50 transition-colors">
              <CardContent className="p-6">
                <feature.icon className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>)}
        </div>

        <div id="pricing" className="max-w-4xl mx-auto text-center mb-20">
          <h2 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
          <p className="text-xl text-muted-foreground mb-12">
            Everything you need to make informed real estate decisions
          </p>
          
          <Card className="border-2 border-primary">
            <CardContent className="p-12">
              <div className="mb-6">
                <h3 className="text-3xl font-bold mb-2">Free Access</h3>
                <p className="text-muted-foreground">All features included at no cost</p>
              </div>
              <ul className="space-y-4 text-left max-w-md mx-auto mb-8">
                {["Unlimited AI conversations", "Property image analysis", "Market insights and trends", "Mortgage calculators", "Investment analysis tools", "Export conversation history"].map((feature, i) => <li key={i} className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <span>{feature}</span>
                  </li>)}
              </ul>
              <Button size="lg" className="w-full max-w-sm" onClick={() => navigate(user ? "/chat" : "/auth")}>
                {user ? "Start Chatting" : "Get Started Free"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div id="cta" className="text-center max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold mb-4">Ready to find your dream home?</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join thousands of users making smarter real estate decisions with AI
          </p>
          <Button size="lg" onClick={() => navigate(user ? "/chat" : "/auth")}>
            {user ? "Open AI Assistant" : "Get Started Now"}
          </Button>
        </div>
      </div>

      <footer className="border-t py-8 mt-20">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>© 2025 RealEstate AI. Powered by advanced AI technology.</p>
        </div>
      </footer>
    </div>;
}