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
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold bg-gradient-to-l from-accent to-primary bg-clip-text text-transparent">
            SlideMint
          </h1>
          <div className="flex gap-2">
            {isLoggedIn ? (
              <>
                <Button variant="ghost" onClick={() => navigate("/dashboard")}>
                  לוח בקרה
                </Button>
                <Button variant="ghost" onClick={handleSignOut}>
                  יציאה
                </Button>
              </>
            ) : (
              <Button variant="ghost" onClick={() => navigate("/auth")}>
                התחברות
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-8 text-center">
        <h1 className="text-6xl md:text-7xl font-bold mb-4 bg-gradient-to-l from-accent to-primary bg-clip-text text-transparent leading-tight">
          צרו קרוסלות LinkedIn מקצועיות בקלות
        </h1>
        <p className="text-2xl text-muted-foreground mb-6 max-w-3xl mx-auto font-medium">
          הדביקו טקסט, בחרו עיצוב, וקבלו קרוסלה מוכנה להורדה תוך שניות
        </p>
        <Button size="lg" onClick={handleGetStarted} className="text-xl px-12 py-7 shadow-lg hover:shadow-xl transition-shadow">
          התחילו חינם
        </Button>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-6">
        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          <Card className="p-6 text-center hover:shadow-lg transition-shadow">
            <div className="mb-3 flex justify-center">
              <FileText className="h-10 w-10 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">הדביקו טקסט</h3>
            <p className="text-muted-foreground text-sm">
              העתיקו את התוכן שלכם והבינה המלאכותית תיצור מבנה קרוסלה מקצועי
            </p>
          </Card>

          <Card className="p-6 text-center hover:shadow-lg transition-shadow">
            <div className="mb-3 flex justify-center">
              <Sparkles className="h-10 w-10 text-accent" />
            </div>
            <h3 className="text-xl font-semibold mb-2">בחרו עיצוב</h3>
            <p className="text-muted-foreground text-sm">
              התאימו אישית את סגנון הקרוסלה, צבעים ותבניות עיצוב
            </p>
          </Card>

          <Card className="p-6 text-center hover:shadow-lg transition-shadow">
            <div className="mb-3 flex justify-center">
              <Download className="h-10 w-10 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">הורידו קרוסלה</h3>
            <p className="text-muted-foreground text-sm">
              ייצאו את הקרוסלה כ-PNG או PDF והעלו ל-LinkedIn
            </p>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-6 text-center">
        <Card className="max-w-3xl mx-auto p-8 bg-gradient-to-br from-primary/10 to-accent/10 border-2 border-primary/20">
          <h2 className="text-3xl font-bold mb-3">מוכנים להתחיל?</h2>
          <p className="text-muted-foreground mb-5 text-lg">
            הצטרפו לאלפי משתמשים שכבר יצרו קרוסלות מרשימות
          </p>
          <Button size="lg" onClick={handleGetStarted} className="text-lg px-10 py-6">
            צרו את הקרוסלה הראשונה שלכם
          </Button>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>© 2024 SlideMint. כל הזכויות שמורות.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
