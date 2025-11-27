import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FileText } from "lucide-react";

const Create = () => {
  const [text, setText] = useState("");
  const [style, setStyle] = useState("Professional");
  const [coverStyle, setCoverStyle] = useState<"minimalist" | "big_number" | "accent_block" | "gradient_overlay" | "geometric" | "bold_frame">("minimalist");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
        fetchProfile(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
        fetchProfile(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    
    setProfile(data);
  };

  const detectLanguage = (text: string): string => {
    const hebrewChars = text.match(/[\u0590-\u05FF]/g);
    return hebrewChars && hebrewChars.length > text.length * 0.3 ? 'he' : 'en';
  };

  const handleGenerate = async () => {
    if (!text.trim()) {
      toast({
        title: "שגיאה",
        description: "נא להזין טקסט ליצירת קרוסלה",
        variant: "destructive",
      });
      return;
    }

    if (profile && profile.carousel_count >= 10) {
      toast({
        title: "הגעת למכסה החינמית",
        description: "הגעת כמעט למכסה החינמית. בהמשך נוסיף תוכנית Pro.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const language = detectLanguage(text);
      
      const { data, error } = await supabase.functions.invoke("generate-slides", {
        body: { text, style, language },
      });

      if (error) throw error;

      const { data: carousel, error: insertError } = await supabase
        .from("carousels")
        .insert({
          user_id: user.id,
          original_text: text,
          slides: data.slides,
          chosen_template: "dark",
          cover_style: coverStyle,
          carousel_name: data.slides[0]?.title || "קרוסלה ללא שם",
          background_color: "#000000",
          text_color: "#FFFFFF",
          accent_color: "#FFFFFF",
          aspect_ratio: "1:1",
        })
        .select()
        .single();

      if (insertError) throw insertError;

      await supabase
        .from("profiles")
        .update({ carousel_count: (profile?.carousel_count || 0) + 1 })
        .eq("id", user.id);

      toast({
        title: "הקרוסלה נוצרה בהצלחה!",
        description: "מעביר אותך לעריכה...",
      });

      navigate(`/edit/${carousel.id}`);
    } catch (error: any) {
      console.error("Error generating carousel:", error);
      toast({
        title: "שגיאה",
        description: "אירעה שגיאה ביצירת הקרוסלה, נסה שוב",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const wordCount = text.trim().split(/\s+/).filter(word => word.length > 0).length;

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-background to-muted">
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold bg-gradient-to-l from-accent to-primary bg-clip-text text-transparent">
            SlideMint
          </h1>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => navigate("/my-carousels")}>
              הקרוסלות שלי
            </Button>
            <Button variant="ghost" onClick={() => navigate("/")}>
              דף הבית
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <Card className="p-8 space-y-6">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold">יצירת קרוסלה חדשה</h2>
              <p className="text-muted-foreground">
                הדבק את הטקסט שלך ותן לנו להפוך אותו לקרוסלה מקצועית
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">סגנון תוכן</label>
                <select
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background"
                  disabled={loading}
                >
                  <option value="Professional">מקצועי</option>
                  <option value="Storytelling">סיפורי</option>
                  <option value="Educational">חינוכי</option>
                  <option value="List / Tips">רשימה / טיפים</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">סגנון עטיפה</label>
                <select
                  value={coverStyle}
                  onChange={(e) => setCoverStyle(e.target.value as "minimalist" | "big_number" | "accent_block" | "gradient_overlay" | "geometric" | "bold_frame")}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background"
                  disabled={loading}
                >
                  <option value="minimalist">מינימליסטי</option>
                  <option value="big_number">מספר בולט</option>
                  <option value="accent_block">אלמנט דקורטיבי</option>
                  <option value="gradient_overlay">גרדיאנט</option>
                  <option value="geometric">גיאומטרי</option>
                  <option value="bold_frame">מסגרת בולטת</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">טקסט התוכן</label>
                <Textarea
                  placeholder="הדבק כאן פוסט, מאמר או רעיון, בעברית או באנגלית..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="min-h-[400px] text-base resize-none"
                  disabled={loading}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {wordCount} מילים
                </span>
                {profile && (
                  <span className="text-sm text-muted-foreground">
                    {profile.carousel_count}/10 קרוסלות
                  </span>
                )}
              </div>

              <Button
                onClick={handleGenerate}
                disabled={loading || !text.trim()}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                    יוצר קרוסלה...
                  </>
                ) : (
                  "צור מבנה שקופיות"
                )}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Create;
