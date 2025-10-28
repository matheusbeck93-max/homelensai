import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/SearchBar";
import { Home, MessageCircle, Calculator, LogIn, LogOut, Sparkles, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Signed out",
      description: "You've been successfully signed out.",
    });
  };

  const handleSearch = (query: string) => {
    navigate(`/properties?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      {/* Navigation */}
      <nav className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
            <Home className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">HomeLens</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate("/properties")}>
              Properties
            </Button>
            <Button variant="ghost" onClick={() => navigate("/chat")}>
              <MessageCircle className="mr-2 h-4 w-4" />
              AI Chat
            </Button>
            <Button variant="ghost" onClick={() => navigate("/calculators")}>
              <Calculator className="mr-2 h-4 w-4" />
              Calculators
            </Button>
            {user ? (
              <>
                <Button variant="ghost" onClick={() => navigate("/profile")}>
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </Button>
                <Button variant="outline" onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </Button>
              </>
            ) : (
              <Button onClick={() => navigate("/auth")}>
                <LogIn className="mr-2 h-4 w-4" />
                Sign In
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-20">
        <div className="text-center mb-12 space-y-6">
          <h1 className="text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary via-accent to-secondary">
            Find your next home
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            AI-powered real estate search and analysis for home buyers and investors
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-accent" />
            <span>Powered by advanced AI technology</span>
          </div>
        </div>

        <SearchBar onSearch={handleSearch} />

        {/* Feature Cards */}
        <div className="mb-4">
          <p className="text-sm text-muted-foreground">Select all that apply</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center p-8 rounded-xl bg-card hover:shadow-lg transition-shadow border">
            <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">I'm first time home-buyer</h3>
            <p className="text-muted-foreground">
              Use natural language to find properties that match your exact criteria
            </p>
          </div>

          <div className="text-center p-8 rounded-xl bg-card hover:shadow-lg transition-shadow border">
            <div className="h-12 w-12 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calculator className="h-6 w-6 text-secondary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Calculate Mortgage</h3>
            <p className="text-muted-foreground">
              Get instant ROI calculations and investment insights on any property
            </p>
          </div>

          <div className="text-center p-8 rounded-xl bg-card hover:shadow-lg transition-shadow border">
            <div className="h-12 w-12 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="h-6 w-6 text-accent" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Get Pre-Approved</h3>
            <p className="text-muted-foreground">
              Chat with our AI to get answers about properties, rates, and programs
            </p>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center mt-20">
          <h2 className="text-3xl font-bold mb-6">Ready to get started?</h2>
          <div className="flex gap-4 justify-center">
            <Button size="lg" variant="hero" onClick={() => navigate("/properties")}>
              Browse Properties
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/chat")}>
              Try AI Chat
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
