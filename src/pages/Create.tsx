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
        title: "Error",
        description: "Please enter text to create a carousel",
        variant: "destructive",
      });
      return;
    }

    if (profile && profile.carousel_count >= 10) {
      toast({
        title: "Free limit reached",
        description: "You've reached the free limit. We'll add a Pro plan soon.",
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
          carousel_name: data.slides[0]?.title || "Untitled carousel",
          background_color: "#000000",
          text_color: "#FFFFFF",
          accent_color: "#FFFFFF",
          aspect_ratio: "4:5",
        })
        .select()
        .single();

      if (insertError) throw insertError;

      await supabase
        .from("profiles")
        .update({ carousel_count: (profile?.carousel_count || 0) + 1 })
        .eq("id", user.id);

      toast({
        title: "Carousel created successfully!",
        description: "Redirecting you to the editor...",
      });

      navigate(`/edit/${carousel.id}`);
    } catch (error: any) {
      console.error("Error generating carousel:", error);
      toast({
        title: "Error",
        description: "Something went wrong while creating the carousel. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const wordCount = text.trim().split(/\s+/).filter(word => word.length > 0).length;

  return (
    <div dir="ltr" className="min-h-screen bg-gradient-to-b from-background to-muted">
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold bg-gradient-to-l from-accent to-primary bg-clip-text text-transparent">
            SlideMint
          </h1>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => navigate("/my-carousels")}>
              My carousels
            </Button>
            <Button variant="ghost" onClick={() => navigate("/")}>
              Home
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <Card className="p-8 space-y-6">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold">Create a new carousel</h2>
              <p className="text-muted-foreground">
                Paste your text and we'll turn it into a professional carousel
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Content style</label>
                <select
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background"
                  disabled={loading}
                >
                  <option value="Professional">Professional</option>
                  <option value="Storytelling">Storytelling</option>
                  <option value="Educational">Educational</option>
                  <option value="List / Tips">List / Tips</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Cover style</label>
                <select
                  value={coverStyle}
                  onChange={(e) => setCoverStyle(e.target.value as "minimalist" | "big_number" | "accent_block" | "gradient_overlay" | "geometric" | "bold_frame")}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background"
                  disabled={loading}
                >
                  <option value="minimalist">Minimalist</option>
                  <option value="big_number">Big number</option>
                  <option value="accent_block">Accent block</option>
                  <option value="gradient_overlay">Gradient</option>
                  <option value="geometric">Geometric</option>
                  <option value="bold_frame">Bold frame</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Content text</label>
                <Textarea
                  placeholder="Paste a post, article, or idea here (Hebrew or English)..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="min-h-[400px] text-base resize-none"
                  disabled={loading}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {wordCount} words
                </span>
                {profile && (
                  <span className="text-sm text-muted-foreground">
                    {profile.carousel_count}/10 carousels
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
                    Creating carousel...
                  </>
                ) : (
                  "Create slide structure"
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
