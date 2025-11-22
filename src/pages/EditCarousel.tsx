import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Download, Trash2, Copy } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SlidePreview from "@/components/SlidePreview";

interface Slide {
  index: number;
  title: string;
  body: string;
}

const EditCarousel = () => {
  const { id } = useParams();
  const [carousel, setCarousel] = useState<any>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(0);
  const [template, setTemplate] = useState<"dark" | "light">("dark");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchCarousel();
  }, [id]);

  const fetchCarousel = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("carousels")
        .select("*")
        .eq("id", id)
        .eq("user_id", session.user.id)
        .single();

      if (error) throw error;
      
      setCarousel(data);
      const parsedSlides = typeof data.slides === 'string' ? JSON.parse(data.slides) : data.slides;
      setSlides(parsedSlides as Slide[]);
      setTemplate(data.chosen_template as "dark" | "light");
    } catch (error) {
      console.error("Error fetching carousel:", error);
      toast({
        title: "שגיאה",
        description: "לא ניתן לטעון את הקרוסלה",
        variant: "destructive",
      });
      navigate("/my-carousels");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const { error } = await supabase
        .from("carousels")
        .update({
          slides: slides as any,
          chosen_template: template,
        })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "נשמר בהצלחה!",
        description: "השינויים נשמרו",
      });
    } catch (error) {
      console.error("Error saving carousel:", error);
      toast({
        title: "שגיאה",
        description: "לא ניתן לשמור את השינויים",
        variant: "destructive",
      });
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("export-carousel", {
        body: {
          carouselId: id,
          slides,
          template,
        },
      });

      if (error) throw error;

      toast({
        title: "מייצא קרוסלה...",
        description: "זה עשוי לקחת כמה שניות",
      });

      // In a real implementation, we would handle the download here
      console.log("Export data:", data);
    } catch (error) {
      console.error("Error exporting carousel:", error);
      toast({
        title: "שגיאה",
        description: "אירעה שגיאה בייצוא הקרוסלה",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteSlide = (index: number) => {
    if (slides.length <= 2) {
      toast({
        title: "שגיאה",
        description: "קרוסלה חייבת להכיל לפחות 2 שקופיות",
        variant: "destructive",
      });
      return;
    }

    const newSlides = slides.filter((_, i) => i !== index);
    setSlides(newSlides.map((slide, i) => ({ ...slide, index: i })));
    if (selectedSlideIndex >= newSlides.length) {
      setSelectedSlideIndex(newSlides.length - 1);
    }
  };

  const handleDuplicateSlide = (index: number) => {
    const slideToDuplicate = slides[index];
    const newSlides = [
      ...slides.slice(0, index + 1),
      { ...slideToDuplicate, index: index + 1 },
      ...slides.slice(index + 1),
    ];
    setSlides(newSlides.map((slide, i) => ({ ...slide, index: i })));
  };

  const updateSlide = (field: "title" | "body", value: string) => {
    const newSlides = [...slides];
    newSlides[selectedSlideIndex] = {
      ...newSlides[selectedSlideIndex],
      [field]: value,
    };
    setSlides(newSlides);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const selectedSlide = slides[selectedSlideIndex];

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-background to-muted">
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold bg-gradient-to-l from-accent to-primary bg-clip-text text-transparent">
            SlideMint
          </h1>
          <div className="flex gap-2">
            <Select value={template} onValueChange={(value: "dark" | "light") => setTemplate(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dark">תבנית כהה</SelectItem>
                <SelectItem value="light">תבנית בהירה</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSave} variant="outline">
              שמור
            </Button>
            <Button onClick={handleExport} disabled={exporting}>
              {exporting ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  מייצא...
                </>
              ) : (
                <>
                  <Download className="ml-2 h-4 w-4" />
                  ייצא
                </>
              )}
            </Button>
            <Button variant="ghost" onClick={() => navigate("/my-carousels")}>
              חזרה
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-12 gap-6 max-w-7xl mx-auto">
          {/* Sidebar - Slides list */}
          <Card className="md:col-span-3 p-4 space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto">
            <h3 className="font-semibold mb-4">שקופיות ({slides.length})</h3>
            {slides.map((slide, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedSlideIndex === index
                    ? "bg-accent/10 border-accent"
                    : "hover:bg-muted"
                }`}
                onClick={() => setSelectedSlideIndex(index)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-foreground mb-1">שקופית {index + 1}</div>
                    <div className="text-sm font-medium truncate">{slide.title}</div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDuplicateSlide(index);
                      }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSlide(index);
                      }}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </Card>

          {/* Main area - Editor and preview */}
          <div className="md:col-span-9 space-y-6">
            {/* Preview */}
            <Card className="p-6">
              <SlidePreview
                slide={selectedSlide}
                template={template}
                slideNumber={selectedSlideIndex + 1}
                totalSlides={slides.length}
              />
            </Card>

            {/* Editor */}
            <Card className="p-6 space-y-4">
              <h3 className="text-lg font-semibold">עריכת שקופית {selectedSlideIndex + 1}</h3>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">כותרת</label>
                <Input
                  value={selectedSlide.title}
                  onChange={(e) => updateSlide("title", e.target.value)}
                  placeholder="כותרת השקופית"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">תוכן</label>
                <Textarea
                  value={selectedSlide.body}
                  onChange={(e) => updateSlide("body", e.target.value)}
                  placeholder="תוכן השקופית"
                  className="min-h-[150px] resize-none"
                />
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditCarousel;
