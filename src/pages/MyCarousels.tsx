import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Edit, Download, Trash2, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";

const MyCarousels = () => {
  const [carousels, setCarousels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();
      
      setProfile(profileData);

      const { data, error } = await supabase
        .from("carousels")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCarousels(data || []);
    } catch (error) {
      console.error("Error fetching carousels:", error);
      toast({
        title: "שגיאה",
        description: "לא ניתן לטעון את הקרוסלות",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("האם אתה בטוח שברצונך למחוק קרוסלה זו?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("carousels")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setCarousels(carousels.filter(c => c.id !== id));
      
      if (profile) {
        await supabase
          .from("profiles")
          .update({ carousel_count: Math.max(0, profile.carousel_count - 1) })
          .eq("id", profile.id);
      }

      toast({
        title: "נמחק בהצלחה",
        description: "הקרוסלה נמחקה",
      });
    } catch (error) {
      console.error("Error deleting carousel:", error);
      toast({
        title: "שגיאה",
        description: "לא ניתן למחוק את הקרוסלה",
        variant: "destructive",
      });
    }
  };

  const handleExport = async (carousel: any) => {
    try {
      toast({
        title: "מייצא קרוסלה...",
        description: "זה עשוי לקחת כמה שניות",
      });

      // Dynamic imports
      const { toPng } = await import('html-to-image');
      const JSZip = (await import('jszip')).default;
      
      const zip = new JSZip();
      const slides = typeof carousel.slides === 'string' ? JSON.parse(carousel.slides) : carousel.slides;
      
      // Base logical size for rendering (export will be upscaled via pixelRatio)
      const baseWidth = 540; // will become 1080 with pixelRatio: 2
      const baseHeight = carousel.aspect_ratio === '4:5' ? 675 : 540;
      
      // Create temporary container for rendering (acts as parent only)
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.top = '0px';
      container.style.left = '-9999px';
      document.body.appendChild(container);

      // Export each slide
      for (let i = 0; i < slides.length; i++) {
        let root: any = null;
        let slideContainer: HTMLDivElement | null = null;
        try {
          // Import SlidePreview and React dynamically
          const { default: SlidePreview } = await import('@/components/SlidePreview');
          const { createRoot } = await import('react-dom/client');
          
          // Create fresh container for each slide at base logical size
          slideContainer = document.createElement('div');
          slideContainer.style.position = 'fixed';
          slideContainer.style.left = '-9999px';
          slideContainer.style.width = `${baseWidth}px`;
          slideContainer.style.height = `${baseHeight}px`;
          slideContainer.style.fontSize = '16px';
          slideContainer.style.fontFamily = 'system-ui, -apple-system, sans-serif';
          container.appendChild(slideContainer);
          
          root = createRoot(slideContainer);
          root.render(React.createElement(SlidePreview, {
              slide: slides[i],
              template: carousel.chosen_template,
              coverStyle: carousel.cover_style || "minimalist",
              backgroundColor: carousel.background_color,
              textColor: carousel.text_color,
              aspectRatio: carousel.aspect_ratio,
              accentColor: carousel.accent_color,
              slideIndex: i,
              isEditing: false,
              onEditStart: () => {},
              onEditEnd: () => {},
              onUpdateSlide: () => {},
              slideNumber: i + 1,
              totalSlides: slides.length,
              showSlideNumber: false,
            })
          );

          // Wait for render
          await new Promise(resolve => setTimeout(resolve, 200));

          const dataUrl = await toPng(slideContainer.firstChild as HTMLElement, {
            pixelRatio: 2,
          });
          
          const response = await fetch(dataUrl);
          const blob = await response.blob();
          const carouselName = carousel.carousel_name || "carousel";
          zip.file(`${carouselName}-slide-${i + 1}.png`, blob);
          
          root.unmount();
          if (slideContainer.parentNode) {
            try {
              document.body.removeChild(slideContainer);
            } catch (e) {
              console.error(`Error removing slide container: ${e.message}`, e.stack);
            }
          }
        } catch (error) {
          console.error(`Error exporting slide ${i + 1}:`, error.message, error.stack);
          // Cleanup on error
          if (root) {
            try {
              root.unmount();
            } catch (e) {
              console.error(`Error unmounting root: ${e.message}`, e.stack);
            }
          }
          if (slideContainer && slideContainer.parentNode) {
            try {
              document.body.removeChild(slideContainer);
            } catch (e) {
              console.error(`Error removing slide container: ${e.message}`, e.stack);
            }
          }
        }
      }
      
      if (container.parentNode) {
        document.body.removeChild(container);
      }
      
      // Generate ZIP
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      
      const carouselName = carousel.carousel_name || "carousel";
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${carouselName}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "הקרוסלה יוצאה בהצלחה!",
        description: "הקובץ הורד למחשב שלך",
      });
    } catch (error) {
      console.error("Error exporting carousel:", error);
      toast({
        title: "תקלה ביצוא",
        description: "נסו שוב או פנו לתמיכה",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-background to-muted">
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold bg-gradient-to-l from-accent to-primary bg-clip-text text-transparent">
            SlideMint
          </h1>
          <div className="flex gap-2">
            <Button onClick={() => navigate("/create")}>
              <Plus className="ml-2 h-4 w-4" />
              קרוסלה חדשה
            </Button>
            <Button variant="ghost" onClick={() => navigate("/")}>
              דף הבית
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-3xl font-bold">הקרוסלות שלי</h2>
              <p className="text-muted-foreground mt-1">
                {carousels.length} קרוסלות
                {profile && ` • ${profile.carousel_count}/10 שנוצרו`}
              </p>
            </div>
          </div>

          {profile && profile.carousel_count >= 8 && (
            <Card className="p-4 bg-accent/5 border-accent">
              <p className="text-sm">
                הגעת כמעט למכסה החינמית ({profile.carousel_count}/10). בהמשך נוסיף תוכנית Pro.
              </p>
            </Card>
          )}

          {carousels.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="space-y-4">
                <h3 className="text-xl font-semibold">עדיין לא יצרת קרוסלות</h3>
                <p className="text-muted-foreground">
                  התחל ליצור את הקרוסלה הראשונה שלך
                </p>
                <Button onClick={() => navigate("/create")}>
                  <Plus className="ml-2 h-4 w-4" />
                  צור קרוסלה חדשה
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4">
              {carousels.map((carousel) => {
                const firstSlide = carousel.slides[0];
                return (
                  <Card key={carousel.id} className="p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold truncate mb-1">
                          {firstSlide?.title || "ללא כותרת"}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {carousel.slides.length} שקופיות •{" "}
                          {carousel.chosen_template === "dark" ? "תבנית כהה" : "תבנית בהירה"} •{" "}
                          נוצר{" "}
                          {formatDistanceToNow(new Date(carousel.created_at), {
                            addSuffix: true,
                            locale: he,
                          })}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/edit/${carousel.id}`)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleExport(carousel)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(carousel.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyCarousels;
