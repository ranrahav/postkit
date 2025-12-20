import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Palette, Sparkles, Clock, Image, Zap, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

const Landing = () => {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsLoggedIn(true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleGetStarted = () => {
    if (isLoggedIn) {
      navigate("/dashboard");
    } else {
      navigate("/auth");
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
  };

  return (
    <div dir="ltr" className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Header */}
      <header className="absolute top-0 w-full z-50 bg-background/70 backdrop-blur-xl border-b border-border/60">
        <div className="container mx-auto px-6 py-6 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center shadow-sm ring-1 ring-border/50">
              <Palette className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground">Post24</h1>
          </div>
          {isLoggedIn ? (
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => navigate("/dashboard")}>
                Dashboard
              </Button>
              <Button variant="ghost" onClick={handleSignOut}>
                Sign Out
              </Button>
            </div>
          ) : (
            <Button variant="ghost" onClick={() => navigate("/auth")}>
              Sign In
            </Button>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <main>
        <section className="relative min-h-screen flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/40 pointer-events-none" />
          
          <div className="relative z-10 text-center max-w-6xl mx-auto">
            {/* Logo and Brand */}
            <div className="mb-12 flex justify-center">
              <div className="w-32 h-32 bg-gradient-to-br from-primary to-accent rounded-3xl flex items-center justify-center shadow-2xl ring-1 ring-border/50 motion-safe:hover:scale-105 transition-transform duration-normal ease-ios-out">
                <Palette className="h-16 w-16 text-white" />
              </div>
            </div>

            <h1 className="text-7xl md:text-9xl font-bold mb-8 text-foreground leading-tight">
              Post24
            </h1>
            
            <p className="text-4xl md:text-5xl text-muted-foreground mb-16 font-light leading-relaxed">
              It is recommended to <span className="font-semibold text-foreground">post 2 to 4 times a week</span><br />
              you better <span className="font-semibold text-foreground">do it right</span>
            </p>

            {/* Single CTA Button */}
            <Button 
              size="lg" 
              onClick={handleGetStarted}
              className="text-xl md:text-2xl px-16 py-8 h-auto shadow-lg hover:shadow-xl"
            >
              <span>Let's Get Started</span>
            </Button>
          </div>

          {/* Decorative elements */}
          <div className="absolute bottom-20 left-20 w-64 h-64 bg-primary/20 rounded-full blur-3xl" />
          <div className="absolute top-40 right-40 w-80 h-80 bg-accent/60 rounded-full blur-3xl" />
          <div className="absolute top-1/3 left-1/4 w-48 h-48 bg-primary/10 rounded-full blur-2xl" />
          <div className="absolute bottom-1/3 right-1/4 w-56 h-56 bg-accent/40 rounded-full blur-2xl" />
        </section>
      </main>
    </div>
  );
};

export default Landing;
