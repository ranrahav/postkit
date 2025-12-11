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
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      {/* Header */}
      <header className="absolute top-0 w-full z-50 bg-white/10 backdrop-blur-sm border-b border-white/20">
        <div className="container mx-auto px-6 py-6 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <Palette className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-2xl font-semibold text-slate-900">Post24</h1>
          </div>
          {isLoggedIn ? (
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => navigate("/dashboard")}>
                לוח בקרה
              </Button>
              <Button variant="ghost" onClick={handleSignOut}>
                יציאה
              </Button>
            </div>
          ) : (
            <Button variant="ghost" onClick={() => navigate("/auth")}>
              התחברות
            </Button>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <main>
        <section className="relative min-h-screen flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-transparent to-purple-50/30 pointer-events-none" />
          
          <div className="relative z-10 text-center max-w-6xl mx-auto">
            {/* Logo and Brand */}
            <div className="mb-12 flex justify-center">
              <div className="w-32 h-32 bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl flex items-center justify-center shadow-2xl hover:scale-105 transition-transform duration-300">
                <Palette className="h-16 w-16 text-white" />
              </div>
            </div>

            <h1 className="text-7xl md:text-9xl font-bold mb-8 text-slate-900 leading-tight">
              Post24
            </h1>
            
            <p className="text-4xl md:text-5xl text-slate-600 mb-16 font-light leading-relaxed">
              יוצרים את <span className="font-semibold text-slate-900">החלק הוויזואלי</span> של כל פוסט
            </p>

            {/* Single CTA Button */}
            <Button 
              size="lg" 
              onClick={handleGetStarted}
              className="text-2xl px-16 py-8 h-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-2xl hover:shadow-3xl transition-all duration-300"
            >
              <span>בואו נתחיל</span>
            </Button>
          </div>

          {/* Decorative elements */}
          <div className="absolute bottom-20 left-20 w-64 h-64 bg-gradient-to-br from-blue-200 to-purple-200 rounded-full opacity-20 blur-3xl" />
          <div className="absolute top-40 right-40 w-80 h-80 bg-gradient-to-br from-purple-200 to-pink-200 rounded-full opacity-20 blur-3xl" />
          <div className="absolute top-1/3 left-1/4 w-48 h-48 bg-gradient-to-br from-pink-200 to-orange-200 rounded-full opacity-15 blur-2xl" />
          <div className="absolute bottom-1/3 right-1/4 w-56 h-56 bg-gradient-to-br from-blue-300 to-cyan-200 rounded-full opacity-15 blur-2xl" />
        </section>
      </main>
    </div>
  );
};

export default Landing;
