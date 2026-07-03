import { useState, useEffect } from "react";
import { SeoCanonical } from "@/components/seo/SeoCanonical";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Home, Sparkles, Calculator, ShieldCheck, TrendingUp } from "lucide-react";
import { signUpSchema, signInSchema } from "@/lib/validation";
import { z } from "zod";
import { lovable } from "@/integrations/lovable";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '/';

  const resolveLandingPath = async (userId: string): Promise<string> => {
    const { data } = await supabase
      .from('profiles')
      .select('onboarding_completed')
      .eq('id', userId)
      .maybeSingle();
    return data?.onboarding_completed ? redirectPath : '/profile-setup';
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        // Always land on home after OAuth; ProtectedRoute will push new users to /profile-setup.
        redirect_uri: `${window.location.origin}${redirectPath}`,
      });
      if (result.error) {
        toast({
          title: "Google sign-in failed",
          description: result.error.message ?? "Please try again.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      // On redirected:true the browser navigates away; otherwise session is set.
      if (!result.redirected) {
        navigate(redirectPath);
      }
    } catch (err) {
      toast({
        title: "Google sign-in failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate input
      const validated = signUpSchema.parse({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
      });

      const { error } = await supabase.auth.signUp({
        email: validated.email,
        password: validated.password,
        options: {
          emailRedirectTo: `${window.location.origin}/chat`,
          data: {
            full_name: validated.fullName,
          },
        },
      });

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Your account has been created. Welcome to HomeLens!",
      });
      navigate('/profile-setup');
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.issues[0].message,
          variant: "destructive",
        });
      } else if (error instanceof Error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate input
      const validated = signInSchema.parse({
        email: email.trim(),
        password,
      });

      const { error } = await supabase.auth.signInWithPassword({
        email: validated.email,
        password: validated.password,
      });

      if (error) throw error;

      toast({
        title: "Welcome back!",
        description: "You've successfully signed in.",
      });
      const { data: { user } } = await supabase.auth.getUser();
      navigate(user ? await resolveLandingPath(user.id) : redirectPath);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.issues[0].message,
          variant: "destructive",
        });
      } else if (error instanceof Error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 to-accent/10 p-4 flex items-center justify-center">
      <SeoCanonical />
      <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-8 items-center">
        <aside className="hidden lg:flex flex-col gap-6 px-2">
          <div className="flex items-center gap-2">
            <Home className="h-7 w-7 text-primary" aria-hidden="true" />
            <span className="text-xl font-semibold text-foreground">HomeLens AI</span>
          </div>
          <h1 className="text-3xl xl:text-4xl font-bold leading-tight text-foreground">
            Big decisions deserve the full picture.
          </h1>
          <p className="text-base text-muted-foreground">
            Free AI copilot for US home buyers and investors. Paste any Zillow, Redfin, or Realtor listing — get an instant match score, fair-price read, and neighborhood intel.
          </p>
          <ul className="space-y-4 mt-2">
            <li className="flex gap-3">
              <Sparkles className="h-5 w-5 text-primary mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-medium text-foreground">Instant match score</p>
                <p className="text-sm text-muted-foreground">0–10 fit rating based on your goals, budget, and target cities.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <TrendingUp className="h-5 w-5 text-primary mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-medium text-foreground">Fair-price + neighborhood signals</p>
                <p className="text-sm text-muted-foreground">Live taxes, flood risk, schools, and price vs. Zestimate in one view.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <Calculator className="h-5 w-5 text-primary mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-medium text-foreground">Investor-grade calculators</p>
                <p className="text-sm text-muted-foreground">Mortgage, cash flow, cap rate, and rehab math built in.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <ShieldCheck className="h-5 w-5 text-primary mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-medium text-foreground">Free to start</p>
                <p className="text-sm text-muted-foreground">No credit card. Buyer ($9.97/mo) unlocks saved analyses and history.</p>
              </div>
            </li>
          </ul>
        </aside>

      <Card className="w-full max-w-md mx-auto lg:mx-0">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4 lg:hidden">
            <Home className="h-10 w-10 text-primary" aria-hidden="true" />
          </div>
          <CardTitle className="text-2xl text-center">Welcome to HomeLens</CardTitle>
          <CardDescription className="text-center">
            Sign in or create a free account to start analyzing listings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            className="w-full mb-4 gap-2"
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
            </svg>
            Continue with Google
          </Button>
          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or with email</span>
            </div>
          </div>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullname">Full Name</Label>
                  <Input
                    id="fullname"
                    type="text"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating account..." : "Create Account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
