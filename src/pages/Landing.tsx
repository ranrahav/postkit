import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileText, Sparkles, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
const Landing = () => {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({
      data: {
        session
      }
    }) => {
      if (session) {
        setIsLoggedIn(true);
      }
    });
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);
  const handleGetStarted = () => {
    if (isLoggedIn) {
      navigate("/create");
    } else {
      navigate("/auth");
    }
  };
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
  };
  return <div dir="rtl" className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold bg-gradient-to-l from-accent to-primary bg-clip-text text-transparent">
            SlideMint
          </h1>
          <div className="flex gap-2">
            {isLoggedIn ? <>
                <Button variant="ghost" onClick={() => navigate("/my-carousels")}>
                  הקרוסלות שלי
                </Button>
                <Button variant="ghost" onClick={handleSignOut}>
                  יציאה
                </Button>
              </> : <Button variant="ghost" onClick={() => navigate("/auth")}>
                התחברות
              </Button>}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 text-center py-[50px]">
        <div className="max-w-3xl mx-auto space-y-6">
          <h2 className="text-5xl md:text-6xl font-bold leading-tight">
            הפוך כל טקסט לקרוסלת{" "}
            <span className="bg-gradient-to-l from-accent to-primary bg-clip-text text-transparent">
              לינקדאין
            </span>{" "}
            תוך שניות
          </h2>
          <p className="text-xl text-muted-foreground">
            צור קרוסלות מקצועיות ומעוצבות מטקסט ארוך בעברית או אנגלית
          </p>
          <Button size="lg" onClick={handleGetStarted} className="text-lg px-8 py-6">
            התחל בחינם
          </Button>
        </div>
      </section>

      {/* Features Section */}
      <section className="container px-4 mx-[150px] py-[50px]">
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <Card className="p-8 text-center space-y-4 hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mx-auto">
              <FileText className="w-6 h-6 text-accent" />
            </div>
            <h3 className="text-xl font-semibold">מדביקים טקסט</h3>
            <p className="text-muted-foreground">
              העתק כל תוכן - פוסט, מאמר או רעיון - והדבק בממשק הפשוט שלנו
            </p>
          </Card>

          <Card className="p-8 text-center space-y-4 hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6 text-success" />
            </div>
            <h3 className="text-xl font-semibold">בוחרים עיצוב</h3>
            <p className="text-muted-foreground">
              בחר מבין תבניות עיצוב שמותאמות לרשתות החברתיות
            </p>
          </Card>

          <Card className="p-8 text-center space-y-4 hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <Download className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold">מורידים קרוסלה</h3>
            <p className="text-muted-foreground">
              ייצא את הקרוסלה שלך כתמונות או PDF מוכנות לפרסום
            </p>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 text-center py-[50px]">
        <Card className="max-w-2xl mx-auto p-12 bg-gradient-to-br from-primary/5 to-accent/5 border-2">
          <h3 className="text-3xl font-bold mb-4">מוכנים להתחיל?</h3>
          <p className="text-lg text-muted-foreground mb-6">
        </p>
          <Button size="lg" onClick={handleGetStarted} className="text-lg px-8 py-6">
            צור קרוסלה עכשיו
          </Button>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>© 2025 SlideMint. כל הזכויות שמורות.</p>
        </div>
      </footer>
    </div>;
};
export default Landing;