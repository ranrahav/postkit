import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, Copy } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SlidePreview from "@/components/SlidePreview";
import RegenerateModal from "@/components/RegenerateModal";
import ExportModal from "@/components/ExportModal";
import ColorPicker from "@/components/ui/color-picker";

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
  const [coverStyle, setCoverStyle] = useState<"minimalist" | "big_number" | "accent_block" | "gradient_overlay" | "geometric" | "bold_frame">("minimalist");
  const [backgroundColor, setBackgroundColor] = useState("#000000");
  const [textColor, setTextColor] = useState("#FFFFFF");
  const [aspectRatio, setAspectRatio] = useState<"1:1" | "4:5">("1:1");
  const [accentColor, setAccentColor] = useState("#FFFFFF");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [regenerateModalOpen, setRegenerateModalOpen] = useState(false);
  const [oldSlideData, setOldSlideData] = useState<{ title: string; body: string } | null>(null);
  const [newSlideData, setNewSlideData] = useState<{ title: string; body: string } | null>(null);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchCarousel();
  }, [id]);

  useEffect(() => {
    if (template === "dark") {
      setBackgroundColor("#000000");
      setTextColor("#FFFFFF");
    } else {
      setBackgroundColor("#FFFFFF");
      setTextColor("#000000");
    }
  }, [template]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        // Hebrew: next slide
        setSelectedSlideIndex((prev) => Math.min(prev + 1, slides.length - 1));
      } else if (e.key === "ArrowRight") {
        // Hebrew: previous slide
        setSelectedSlideIndex((prev) => Math.max(prev - 1, 0));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [slides.length]);

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
      setCoverStyle((data.cover_style || "minimalist") as "minimalist" | "big_number" | "accent_block" | "gradient_overlay" | "geometric" | "bold_frame");
      setBackgroundColor(data.background_color || (data.chosen_template === 'dark' ? '#000000' : '#FFFFFF'));
      setTextColor(data.text_color || (data.chosen_template === 'dark' ? '#FFFFFF' : '#000000'));
      setAspectRatio(data.aspect_ratio || '1:1');
      setAccentColor(data.accent_color || (data.chosen_template === 'dark' ? '#FFFFFF' : '#000000'));
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
          cover_style: coverStyle,
          background_color: backgroundColor,
          text_color: textColor,
          aspect_ratio: aspectRatio,
          accent_color: accentColor,
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
      const { toPng } = await import('html-to-image');
      const JSZip = (await import('jszip')).default;
      
      const zip = new JSZip();
      const carouselName = carousel?.carousel_name || "carousel";
      let failedSlides = 0;
      
      // Create hidden container for rendering all slides
      const hiddenContainer = document.createElement('div');
      hiddenContainer.style.position = 'fixed';
      hiddenContainer.style.left = '-9999px';
      hiddenContainer.style.top = '0';
      document.body.appendChild(hiddenContainer);
      
      for (let i = 0; i < slides.length; i++) {
        try {
          // Clone the current slide preview and render it
          const originalElement = document.getElementById(`slide-preview-${selectedSlideIndex}`);
          if (originalElement) {
            const clonedElement = originalElement.cloneNode(true) as HTMLElement;
            clonedElement.id = `temp-slide-${i}`;
            hiddenContainer.appendChild(clonedElement);
            
            // Update the cloned element with the correct slide data
            const slide = slides[i];
            const titleElement = clonedElement.querySelector('[data-slide-title]');
            const bodyElement = clonedElement.querySelector('[data-slide-body]');
            const numberElement = clonedElement.querySelector('[data-slide-number]');
            
            if (titleElement) titleElement.textContent = slide.title;
            if (bodyElement) bodyElement.textContent = slide.body;
            if (numberElement) numberElement.textContent = `${i + 1}`;
            
            // Wait a bit for render
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const dataUrl = await toPng(clonedElement, {
              width: 1080,
              height: 1080,
              pixelRatio: 2,
            });
            
            const response = await fetch(dataUrl);
            const blob = await response.blob();
            zip.file(`${carouselName}-slide-${i + 1}.png`, blob);
            
            hiddenContainer.removeChild(clonedElement);
          }
        } catch (error) {
          console.error(`Error exporting slide ${i + 1}:`, error);
          failedSlides++;
        }
      }
      
      // Clean up hidden container
      document.body.removeChild(hiddenContainer);
      
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${carouselName}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      if (failedSlides > 0) {
        toast({
          title: "חלק מהשקופיות לא יוצרו",
          description: "נסו שוב.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "הקרוסלה יוצאה בהצלחה!",
          description: "הקובץ הורד למחשב שלך",
        });
      }
    } catch (error) {
      console.error("Error exporting carousel:", error);
      toast({
        title: "תקלה ביצוא",
        description: "נסו שוב או פנו לתמיכה",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleExportCurrent = async () => {
    setExporting(true);
    try {
      const { toPng } = await import('html-to-image');
      const carouselName = carousel?.carousel_name || "carousel";
      
      const slideElement = document.getElementById(`slide-preview-${selectedSlideIndex}`);
      if (slideElement) {
        const dataUrl = await toPng(slideElement, {
          width: 1080,
          height: 1080,
          pixelRatio: 2,
        });
        
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${carouselName}-slide-${selectedSlideIndex + 1}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        toast({
          title: "השקופית יוצאה בהצלחה!",
          description: "הקובץ הורד למחשב שלך",
        });
      }
    } catch (error) {
      console.error("Error exporting slide:", error);
      toast({
        title: "תקלה ביצוא",
        description: "נסו שוב או פנו לתמיכה",
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

  const handleAddBlankSlide = () => {
    const newSlide: Slide = {
      index: slides.length,
      title: "",
      body: "",
    };
    setSlides([...slides, newSlide]);
    setSelectedSlideIndex(slides.length);
    toast({
      title: "שקופית חדשה נוספה",
      description: "ניתן לערוך את התוכן כעת",
    });
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    const newSlides = [...slides];
    const draggedSlide = newSlides[draggedIndex];
    newSlides.splice(draggedIndex, 1);
    newSlides.splice(index, 0, draggedSlide);
    
    setSlides(newSlides.map((slide, i) => ({ ...slide, index: i })));
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const updateSlide = (field: "title" | "body", value: string) => {
    const newSlides = [...slides];
    newSlides[selectedSlideIndex] = {
      ...newSlides[selectedSlideIndex],
      [field]: value,
    };
    setSlides(newSlides);
  };

  const handleRegenerateSlide = async (index: number) => {
    try {
      const slideToRegenerate = slides[index];
      setOldSlideData({ title: slideToRegenerate.title, body: slideToRegenerate.body });
      setRegeneratingIndex(index);
      
      const combinedText = `${slideToRegenerate.title} ${slideToRegenerate.body}`;
      
      const { data, error } = await supabase.functions.invoke("generate-slides", {
        body: { 
          text: combinedText,
          style: "Professional",
          language: "he"
        },
      });

      if (error) throw error;

      if (data.slides && data.slides.length > 0) {
        setNewSlideData({
          title: data.slides[0].title,
          body: data.slides[0].body,
        });
        setRegenerateModalOpen(true);
      }
    } catch (error) {
      console.error("Error regenerating slide:", error);
      toast({
        title: "שגיאה",
        description: "לא ניתן ליצור מחדש את השקופית",
        variant: "destructive",
      });
    }
  };

  const handleAcceptRegeneration = () => {
    if (regeneratingIndex !== null && newSlideData) {
      const newSlides = [...slides];
      newSlides[regeneratingIndex] = {
        ...newSlideData,
        index: regeneratingIndex,
      };
      setSlides(newSlides);
      setRegenerateModalOpen(false);
      toast({
        title: "השקופית עודכנה בהצלחה",
        description: "הטקסט נוצר מחדש באמצעות AI",
      });
    }
  };

  const handleRejectRegeneration = () => {
    setRegenerateModalOpen(false);
    toast({
      title: "בוטל",
      description: "השקופית נשארה ללא שינוי",
    });
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
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-2xl font-bold bg-gradient-to-l from-accent to-primary bg-clip-text text-transparent">
            SlideMint
          </h1>
          <div className="flex gap-2">
            <Select value={template} onValueChange={(value: "dark" | "light") => setTemplate(value)}>
              <SelectTrigger className="w-32" dir="rtl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end" dir="rtl">
                <SelectItem value="dark">תבנית כהה</SelectItem>
                <SelectItem value="light">תבנית בהירה</SelectItem>
              </SelectContent>
            </Select>
            <Select value={coverStyle} onValueChange={(value) => setCoverStyle(value as "minimalist" | "big_number" | "accent_block" | "gradient_overlay" | "geometric" | "bold_frame")}>
              <SelectTrigger className="w-40" dir="rtl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end" dir="rtl">
                <SelectItem value="minimalist">מינימליסטי</SelectItem>
                <SelectItem value="big_number">מספר בולט</SelectItem>
                <SelectItem value="accent_block">אלמנט דקורטיבי</SelectItem>
                <SelectItem value="gradient_overlay">גרדיאנט</SelectItem>
                <SelectItem value="geometric">גיאומטרי</SelectItem>
                <SelectItem value="bold_frame">מסגרת בולטת</SelectItem>
              </SelectContent>
            </Select>
            <ColorPicker color={backgroundColor} setColor={setBackgroundColor} title="שינוי רקע" />
            <ColorPicker color={textColor} setColor={setTextColor} title="שינוי טקסט" />
            <ColorPicker color={accentColor} setColor={setAccentColor} title="שינוי צבע עיצוב" />
            <Select value={aspectRatio} onValueChange={(value: "1:1" | "4:5") => setAspectRatio(value)}>
              <SelectTrigger className="w-28" dir="rtl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end" dir="rtl">
                <SelectItem value="1:1">1:1</SelectItem>
                <SelectItem value="4:5">4:5</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSave} variant="outline" size="sm">
              שמור
            </Button>
            <Button onClick={() => setExportModalOpen(true)} disabled={exporting} size="sm">
              ייצא
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/my-carousels")}>
              חזרה
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-3">
        <div className="flex gap-3 max-w-7xl mx-auto" style={{ height: 'calc(100vh - 120px)' }}>
          {/* Slide list - left side in Hebrew RTL */}
          <Card className="w-64 p-3 space-y-2 overflow-y-auto flex-shrink-0 order-1">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">שקופיות ({slides.length})</h3>
              <Button
                onClick={handleAddBlankSlide}
                variant="outline"
                size="sm"
                className="h-7 px-2"
              >
                + חדשה
              </Button>
            </div>
            {slides.map((slide, index) => (
              <div
                key={index}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`p-2 rounded-lg border cursor-move transition-all ${
                  selectedSlideIndex === index
                    ? "bg-accent/10 border-accent"
                    : "hover:bg-muted"
                } ${draggedIndex === index ? "opacity-50" : ""}`}
                onClick={() => setSelectedSlideIndex(index)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-foreground mb-1">שקופית {index + 1}</div>
                    <div className="text-sm font-medium truncate">{slide.title || "שקופית ריקה"}</div>
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

          {/* Main content area */}
          <div className="flex-1 flex flex-col gap-3 min-w-0 order-2">
            {/* Large slide preview */}
            <div className="flex-shrink-0">
              <div id={`slide-preview-${selectedSlideIndex}`} className="w-full max-w-2xl mx-auto">
                <SlidePreview
                  slide={selectedSlide}
                  template={template}
                  slideNumber={selectedSlideIndex + 1}
                  totalSlides={slides.length}
                  coverStyle={coverStyle}
                  slideIndex={selectedSlideIndex}
                  backgroundColor={backgroundColor}
                  textColor={textColor}
                  aspectRatio={aspectRatio}
                  accentColor={accentColor}
                />
              </div>
            </div>

            {/* Editor panel below preview */}
            <Card className="p-4 space-y-3 overflow-y-auto flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">עריכת שקופית {selectedSlideIndex + 1}</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRegenerateSlide(selectedSlideIndex)}
                >
                  יצירה מחדש עם AI
                </Button>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">כותרת</label>
                  <Textarea
                    value={selectedSlide.title}
                    onChange={(e) => updateSlide("title", e.target.value)}
                    placeholder="כותרת השקופית"
                    className="min-h-[120px] resize-none text-base"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">תוכן</label>
                  <Textarea
                    value={selectedSlide.body}
                    onChange={(e) => updateSlide("body", e.target.value)}
                    placeholder="תוכן השקופית"
                    className="min-h-[120px] resize-none text-base"
                  />
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Regenerate Modal */}
      {oldSlideData && newSlideData && (
        <RegenerateModal
          open={regenerateModalOpen}
          onOpenChange={setRegenerateModalOpen}
          oldSlide={oldSlideData}
          newSlide={newSlideData}
          onAccept={handleAcceptRegeneration}
          onReject={handleRejectRegeneration}
        />
      )}

      {/* Export Modal */}
      <ExportModal
        open={exportModalOpen}
        onOpenChange={setExportModalOpen}
        onExportAll={handleExport}
        onExportCurrent={handleExportCurrent}
      />

      {/* Export Loading Overlay */}
      {exporting && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <Card className="p-8 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-lg font-semibold">מייצא...</p>
            <p className="text-sm text-muted-foreground mt-2">זה עשוי לקחת כמה שניות</p>
          </Card>
        </div>
      )}
    </div>
  );
};

export default EditCarousel;
