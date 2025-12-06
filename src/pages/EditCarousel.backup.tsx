import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2 } from "lucide-react";
import { debounce } from "lodash";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SlidePreview from "@/components/SlidePreview";
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
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [editingSlideIndex, setEditingSlideIndex] = useState<number>(0); // Start with first slide editable
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
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
        const newIndex = Math.min(selectedSlideIndex + 1, slides.length - 1);
        setSelectedSlideIndex(newIndex);
        setEditingSlideIndex(newIndex);
      } else if (e.key === "ArrowRight") {
        // Hebrew: previous slide
        const newIndex = Math.max(selectedSlideIndex - 1, 0);
        setSelectedSlideIndex(newIndex);
        setEditingSlideIndex(newIndex);
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
      setAspectRatio((data.aspect_ratio as "1:1" | "4:5") || '1:1');
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

  const saveCarousel = useCallback(async () => {
    if (!id) return;
    
    setIsSaving(true);
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
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error("Error saving carousel:", error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [id, slides, template, coverStyle, backgroundColor, textColor, aspectRatio, accentColor]);

  const debouncedSave = useCallback(
    debounce(async () => {
      try {
        await saveCarousel();
        toast({
          title: "נשמר",
          description: "השינויים נשמרו אוטומטית",
          duration: 2000,
        });
      } catch (error) {
        toast({
          title: "שגיאה",
          description: "לא ניתן לשמור את השינויים",
          variant: "destructive",
        });
      }
    }, 1000),
    [saveCarousel, toast]
  );

  // Auto-save when dependencies change
  useEffect(() => {
    if (id && slides.length > 0) {
      debouncedSave();
    }
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      debouncedSave.cancel();
    };
  }, [id, slides, template, coverStyle, backgroundColor, textColor, aspectRatio, accentColor, debouncedSave]);

  const handleSave = async () => {
    try {
      await saveCarousel();
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

  const handleUpdateSlide = (index: number, updates: Partial<Slide>) => {
    const newSlides = [...slides];
    newSlides[index] = { ...newSlides[index], ...updates };
    setSlides(newSlides);
    
    // Trigger a save after a short delay
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      debouncedSave();
    }, 500);
  };
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

const handleUpdateSlide = (index: number, updates: Partial<Slide>) => {
  const newSlides = [...slides];
  newSlides[index] = { ...newSlides[index], ...updates };
  setSlides(newSlides);
  
  // Trigger a save after a short delay
  if (saveTimeoutRef.current) {
    clearTimeout(saveTimeoutRef.current);
  }
  saveTimeoutRef.current = setTimeout(() => {
    debouncedSave();
  }, 500);
};

const updateSlide = (field: "title" | "body", value: string) => {
  handleUpdateSlide(selectedSlideIndex, { [field]: value });
};

if (loading) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin" />
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
