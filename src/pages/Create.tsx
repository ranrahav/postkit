import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
    <div dir="ltr" className="relative min-h-screen overflow-hidden bg-gradient-to-b from-background to-muted">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-28 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-32 right-10 h-[28rem] w-[28rem] rounded-full bg-accent/20 blur-3xl" />
      </div>

      <header className="border-b border-border/60 bg-background/70 backdrop-blur-xl sticky top-0 z-50">
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

      <div className="container mx-auto px-4 py-10">
        <div className="max-w-4xl mx-auto">
          <Card className="p-8 md:p-10 space-y-8 bg-background/60 backdrop-blur-xl border-border/60 shadow-2xl rounded-2xl">
            <div className="space-y-2">
              <h2 className="text-4xl font-bold tracking-tight">Create a new carousel</h2>
              <p className="text-base text-muted-foreground">
                Paste your text and we'll turn it into a professional carousel
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-12">
              <div className="md:col-span-4">
                <div className="rounded-xl border border-border/60 bg-background/40 p-4 space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold">Settings</h3>
                    <p className="text-xs text-muted-foreground">Tune the tone and cover styling.</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="content-style">Content style</Label>
                    <Select value={style} onValueChange={setStyle} disabled={loading}>
                      <SelectTrigger id="content-style" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Professional">Professional</SelectItem>
                        <SelectItem value="Storytelling">Storytelling</SelectItem>
                        <SelectItem value="Educational">Educational</SelectItem>
                        <SelectItem value="List / Tips">List / Tips</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cover-style">Cover style</Label>
                    <Select
                      value={coverStyle}
                      onValueChange={(value) =>
                        setCoverStyle(
                          value as
                            | "minimalist"
                            | "big_number"
                            | "accent_block"
                            | "gradient_overlay"
                            | "geometric"
                            | "bold_frame",
                        )
                      }
                      disabled={loading}
                    >
                      <SelectTrigger id="cover-style" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minimalist">Minimalist</SelectItem>
                        <SelectItem value="big_number">Big number</SelectItem>
                        <SelectItem value="accent_block">Accent block</SelectItem>
                        <SelectItem value="gradient_overlay">Gradient</SelectItem>
                        <SelectItem value="geometric">Geometric</SelectItem>
                        <SelectItem value="bold_frame">Bold frame</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="md:col-span-8 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="content-text">Content text</Label>
                  <Textarea
                    id="content-text"
                    placeholder="Paste a post, article, or idea here (Hebrew or English)..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className="min-h-[420px] text-base leading-relaxed resize-none"
                    disabled={loading}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex items-center rounded-full border border-border/60 bg-background/40 px-3 py-1 text-xs font-medium text-muted-foreground">
                    {wordCount} words
                  </div>
                  {profile && (
                    <div className="inline-flex items-center rounded-full border border-border/60 bg-background/40 px-3 py-1 text-xs font-medium text-muted-foreground">
                      {profile.carousel_count}/10 carousels
                    </div>
                  )}
                </div>
              </div>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={loading || !text.trim()}
              className="w-full shadow-lg hover:shadow-xl"
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
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Create;
