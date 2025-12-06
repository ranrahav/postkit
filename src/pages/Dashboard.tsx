import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, Plus, Search, Download, Edit, Copy, X, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";
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

interface Carousel {
  id: string;
  carousel_name: string | null;
  slides: Slide[] | string | any; // Can be string or Json from Supabase
  chosen_template: "dark" | "light" | string;
  cover_style: "minimalist" | "big_number" | "accent_block" | "gradient_overlay" | "geometric" | "bold_frame" | string;
  background_color: string | null;
  text_color: string | null;
  accent_color: string | null;
  aspect_ratio: "1:1" | "4:5" | string;
  created_at: string;
  updated_at: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // State management
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [carousels, setCarousels] = useState<Carousel[]>([]);
  const [selectedCarousel, setSelectedCarousel] = useState<Carousel | null>(null);
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  
  // Create modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newCarouselText, setNewCarouselText] = useState("");
  const [newCarouselStyle, setNewCarouselStyle] = useState("Professional");
  const [newCarouselCoverStyle, setNewCarouselCoverStyle] = useState<"minimalist" | "big_number" | "accent_block" | "gradient_overlay" | "geometric" | "bold_frame">("minimalist");
  const [creatingCarousel, setCreatingCarousel] = useState(false);
  
  // Editing state
  const [template, setTemplate] = useState<"dark" | "light">("dark");
  const [coverStyle, setCoverStyle] = useState<"minimalist" | "big_number" | "accent_block" | "gradient_overlay" | "geometric" | "bold_frame">("minimalist");
  const [backgroundColor, setBackgroundColor] = useState("#000000");
  const [textColor, setTextColor] = useState("#FFFFFF");
  const [accentColor, setAccentColor] = useState("#FFFFFF");
  const [aspectRatio, setAspectRatio] = useState<"1:1" | "4:5">("4:5");
  
  // Drag and drop state
  const [draggedSlideIndex, setDraggedSlideIndex] = useState<number | null>(null);
  const [dragOverSlideIndex, setDragOverSlideIndex] = useState<number | null>(null);
  
  // Refs
  const slidesContainerRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedSlideIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverSlideIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverSlideIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    setDragOverSlideIndex(null);
    
    if (draggedSlideIndex === null || draggedSlideIndex === dropIndex) return;
    
    const slides = parseSlides(selectedCarousel.slides);
    const newSlides = [...slides];
    const draggedSlide = newSlides[draggedSlideIndex];
    
    // Remove from old position
    newSlides.splice(draggedSlideIndex, 1);
    
    // Insert at new position
    const adjustedDropIndex = draggedSlideIndex < dropIndex ? dropIndex - 1 : dropIndex;
    newSlides.splice(adjustedDropIndex, 0, draggedSlide);
    
    // Update indices
    const updatedSlides = newSlides.map((slide, i) => ({ ...slide, index: i }));
    const updatedCarousel = { ...selectedCarousel, slides: updatedSlides };
    
    setSelectedCarousel(updatedCarousel);
    setCarousels(carousels.map(c => c.id === selectedCarousel.id ? updatedCarousel : c));
    
    // Update selected slide index if needed
    if (selectedSlideIndex === draggedSlideIndex) {
      setSelectedSlideIndex(adjustedDropIndex);
    } else if (draggedSlideIndex < selectedSlideIndex && dropIndex <= selectedSlideIndex) {
      setSelectedSlideIndex(selectedSlideIndex - 1);
    } else if (draggedSlideIndex > selectedSlideIndex && dropIndex >= selectedSlideIndex) {
      setSelectedSlideIndex(selectedSlideIndex + 1);
    }
    
    debouncedSave(updatedCarousel);
    setDraggedSlideIndex(null);
    
    // Scroll to the selected slide after reordering
    setTimeout(() => {
      scrollToSlide(selectedSlideIndex);
    }, 100);
  };

  const handleDragEnd = () => {
    setDraggedSlideIndex(null);
    setDragOverSlideIndex(null);
  };

  // Helper functions to handle Supabase Json type
  const parseSlides = (slides: Slide[] | string | any): Slide[] => {
    if (Array.isArray(slides)) {
      return slides;
    }
    if (typeof slides === 'string') {
      try {
        return JSON.parse(slides);
      } catch {
        return [];
      }
    }
    // Handle Json type (could be object, number, etc.)
    try {
      const parsed = typeof slides === 'object' ? slides : JSON.parse(String(slides));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const stringifySlides = (slides: Slide[]): string => {
    return JSON.stringify(slides);
  };

  // Initialize
  useEffect(() => {
    checkAuth();
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedCarousel) return;
      
      const slides = parseSlides(selectedCarousel.slides);
      
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        // Next slide
        const newIndex = Math.min(selectedSlideIndex + 1, slides.length - 1);
        setSelectedSlideIndex(newIndex);
        scrollToSlide(newIndex);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        // Previous slide
        const newIndex = Math.max(selectedSlideIndex - 1, 0);
        setSelectedSlideIndex(newIndex);
        scrollToSlide(newIndex);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedCarousel, selectedSlideIndex]);

  // Scroll to first slide when carousel changes
  useEffect(() => {
    if (selectedCarousel && selectedSlideIndex === 0) {
      setTimeout(() => {
        scrollToSlide(0);
      }, 300);
    }
  }, [selectedCarousel]);

  // Template color sync
  useEffect(() => {
    if (template === "dark") {
      setBackgroundColor("#000000");
      setTextColor("#FFFFFF");
      setAccentColor("#FFFFFF");
    } else {
      setBackgroundColor("#FFFFFF");
      setTextColor("#000000");
      setAccentColor("#000000");
    }
  }, [template]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    setUser(session.user);
    await fetchProfile(session.user.id);
    await fetchCarousels(session.user.id);
  };

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    setProfile(data);
  };

  const fetchCarousels = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("carousels")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Parse slides for each carousel
      const parsedCarousels = (data || []).map(carousel => ({
        ...carousel,
        slides: parseSlides(carousel.slides)
      }));
      
      setCarousels(parsedCarousels);
      if (parsedCarousels && parsedCarousels.length > 0) {
        selectCarousel(parsedCarousels[0]);
      }
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

  const selectCarousel = (carousel: Carousel) => {
    setSelectedCarousel(carousel);
    // Start with slide 0 (first slide)
    setSelectedSlideIndex(0);
    setTemplate((carousel.chosen_template as "dark" | "light") || "dark");
    setCoverStyle((carousel.cover_style as any) || "minimalist");
    setBackgroundColor(carousel.background_color || "#000000");
    setTextColor(carousel.text_color || "#FFFFFF");
    setAccentColor(carousel.accent_color || "#FFFFFF");
    setAspectRatio((carousel.aspect_ratio as "1:1" | "4:5") || "4:5");
    
    // Auto-scroll to the first slide after component renders
    setTimeout(() => {
      scrollToSlide(0);
    }, 300);
  };

  const navigateSlide = (direction: number) => {
    if (!selectedCarousel) return;
    const slides = parseSlides(selectedCarousel.slides);
    const newIndex = Math.max(0, Math.min(selectedSlideIndex + direction, slides.length - 1));
    setSelectedSlideIndex(newIndex);
    scrollToSlide(newIndex);
  };

  const scrollToSlide = (index: number) => {
    if (!slidesContainerRef.current || !selectedCarousel) return;
    
    const container = slidesContainerRef.current;
    const slideElements = container.children;
    
    // Since slides are reversed in DOM, we need to find the actual DOM element
    // The first slide (index 0) is the last element in the DOM
    const slides = parseSlides(selectedCarousel.slides);
    const reverseIndex = slides.length - 1 - index;
    
    if (slideElements[reverseIndex]) {
      const slide = slideElements[reverseIndex] as HTMLElement;
      
      // Use scrollIntoView for reliable positioning
      slide.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest'
      });
    }
  };

  const detectLanguage = (text: string): string => {
    const hebrewChars = text.match(/[\u0590-\u05FF]/g);
    return hebrewChars && hebrewChars.length > text.length * 0.3 ? 'he' : 'en';
  };

  const handleCreateCarousel = async () => {
    if (!newCarouselText.trim()) {
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

    setCreatingCarousel(true);
    try {
      const language = detectLanguage(newCarouselText);
      
      const { data, error } = await supabase.functions.invoke("generate-slides", {
        body: { text: newCarouselText, style: newCarouselStyle, language },
      });

      if (error) throw error;

      const { data: carousel, error: insertError } = await supabase
        .from("carousels")
        .insert({
          user_id: user.id,
          original_text: newCarouselText,
          slides: data.slides,
          chosen_template: "dark",
          cover_style: newCarouselCoverStyle,
          carousel_name: data.slides[0]?.title || "קרוסלה ללא שם",
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
        title: "הקרוסלה נוצרה בהצלחה!",
      });

      // Refresh carousels and select the new one
      await fetchCarousels(user.id);
      setCreateModalOpen(false);
      setNewCarouselText("");
      
      // Find and select the new carousel
      const updatedCarousels = await supabase
        .from("carousels")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      
      if (updatedCarousels.data && updatedCarousels.data.length > 0) {
        await fetchCarousels(user.id);
        const firstCarousel = updatedCarousels.data[0];
        selectCarousel(firstCarousel);
      }
    } catch (error: any) {
      console.error("Error generating carousel:", error);
      toast({
        title: "שגיאה",
        description: "אירעה שגיאה ביצירת הקרוסלה, נסה שוב",
        variant: "destructive",
      });
    } finally {
      setCreatingCarousel(false);
    }
  };

  const handleDeleteCarousel = async (id: string) => {
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

      // Reset selection if deleted carousel was selected
      if (selectedCarousel?.id === id) {
        if (carousels.length > 1) {
          const remainingCarousels = carousels.filter(c => c.id !== id);
          selectCarousel(remainingCarousels[0]);
        } else {
          setSelectedCarousel(null);
        }
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

  const handleUpdateSlide = (slideIndex: number, updates: Partial<Slide>) => {
    if (!selectedCarousel) return;
    
    const slides = parseSlides(selectedCarousel.slides);
    const newSlides = [...slides];
    newSlides[slideIndex] = { ...newSlides[slideIndex], ...updates };
    
    const updatedCarousel = { ...selectedCarousel, slides: newSlides };
    setSelectedCarousel(updatedCarousel);
    
    // Update in carousels array
    setCarousels(carousels.map(c => c.id === selectedCarousel.id ? updatedCarousel : c));
    
    // Trigger save
    debouncedSave(updatedCarousel);
  };

  const debouncedSave = useCallback(
    debounce(async (carousel: Carousel) => {
      try {
        await supabase
          .from("carousels")
          .update({
            slides: stringifySlides(carousel.slides),
            chosen_template: template,
            cover_style: coverStyle,
            background_color: backgroundColor,
            text_color: textColor,
            aspect_ratio: aspectRatio,
            accent_color: accentColor,
            updated_at: new Date().toISOString(),
          })
          .eq("id", carousel.id);

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
    [template, coverStyle, backgroundColor, textColor, aspectRatio, accentColor, toast]
  );

  const handleDeleteSlide = (index: number) => {
    if (!selectedCarousel) return;
    
    const slides = parseSlides(selectedCarousel.slides);
    if (slides.length <= 2) {
      toast({
        title: "שגיאה",
        description: "קרוסלה חייבת להכיל לפחות 2 שקופיות",
        variant: "destructive",
      });
      return;
    }

    const newSlides = slides.filter((_, i) => i !== index);
    const updatedCarousel = { ...selectedCarousel, slides: newSlides.map((slide, i) => ({ ...slide, index: i })) };
    setSelectedCarousel(updatedCarousel);
    setCarousels(carousels.map(c => c.id === selectedCarousel.id ? updatedCarousel : c));
    
    if (selectedSlideIndex >= newSlides.length) {
      setSelectedSlideIndex(newSlides.length - 1);
    }
    
    debouncedSave(updatedCarousel);
  };

  const handleDuplicateSlide = (index: number) => {
    if (!selectedCarousel) return;
    
    const slides = parseSlides(selectedCarousel.slides);
    const slideToDuplicate = slides[index];
    const newSlides = [
      ...slides.slice(0, index + 1),
      { ...slideToDuplicate, index: index + 1 },
      ...slides.slice(index + 1),
    ];
    const updatedCarousel = { ...selectedCarousel, slides: newSlides.map((slide, i) => ({ ...slide, index: i })) };
    setSelectedCarousel(updatedCarousel);
    setCarousels(carousels.map(c => c.id === selectedCarousel.id ? updatedCarousel : c));
    debouncedSave(updatedCarousel);
  };

  const handleExport = async () => {
    if (!selectedCarousel) return;
    setExporting(true);
    try {
      const { toPng } = await import('html-to-image');
      const JSZip = (await import('jszip')).default;
      const { createRoot } = await import('react-dom/client');
      
      const zip = new JSZip();
      const carouselName = selectedCarousel?.carousel_name || "carousel";
      const slides = parseSlides(selectedCarousel.slides);
      let failedSlides = 0;
      
      // Base logical size for rendering (export will be upscaled via pixelRatio)
      const baseWidth = 540; // will become 1080 with pixelRatio: 2
      const baseHeight = aspectRatio === "4:5" ? 675 : 540; // 4:5 -> 540x675, 1:1 -> 540x540
      
      for (let i = 0; i < slides.length; i++) {
        let root: any = null;
        let hiddenContainer: HTMLDivElement | null = null;
        try {
          // Create fresh container for each slide at base logical size
          hiddenContainer = document.createElement('div');
          hiddenContainer.style.position = 'fixed';
          hiddenContainer.style.left = '-9999px';
          hiddenContainer.style.top = '0';
          hiddenContainer.style.width = `${baseWidth}px`;
          hiddenContainer.style.height = `${baseHeight}px`;
          hiddenContainer.style.fontSize = '16px';
          hiddenContainer.style.fontFamily = 'system-ui, -apple-system, sans-serif';
          document.body.appendChild(hiddenContainer);
          
          root = createRoot(hiddenContainer);
          
          // Render just the slide without the carousel wrapper
          const React = await import('react');
          root.render(
            React.createElement(SlidePreview, {
              slide: slides[i],
              template: template,
              slideNumber: i + 1,
              totalSlides: slides.length,
              coverStyle: coverStyle,
              backgroundColor: backgroundColor,
              textColor: textColor,
              aspectRatio: aspectRatio,
              accentColor: accentColor,
              slideIndex: i,
              isEditing: false,
              onEditStart: () => {},
              onEditEnd: () => {},
              onUpdateSlide: () => {},
              showSlideNumber: false,
            })
          );
          
          // Wait for render
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // Capture at higher pixel ratio so final PNG is 1080x1350 or 1080x1080
          const dataUrl = await toPng(hiddenContainer.firstChild as HTMLElement, {
            pixelRatio: 2,
          });
          
          const response = await fetch(dataUrl);
          const blob = await response.blob();
          zip.file(`${carouselName}-slide-${i + 1}.png`, blob);
          
          root.unmount();
          if (hiddenContainer.parentNode) {
            document.body.removeChild(hiddenContainer);
          }
        } catch (error) {
          console.error(`Error exporting slide ${i + 1}:`, error);
          failedSlides++;
          // Cleanup on error
          if (root) {
            try {
              root.unmount();
            } catch (e) {
              // Ignore unmount errors
            }
          }
          if (hiddenContainer && hiddenContainer.parentNode) {
            try {
              document.body.removeChild(hiddenContainer);
            } catch (e) {
              // Ignore removal errors
            }
          }
        }
      }
      
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
    if (!selectedCarousel) return;
    setExporting(true);
    let root: any = null;
    let hiddenContainer: HTMLDivElement | null = null;
    try {
      const { toPng } = await import('html-to-image');
      const { createRoot } = await import('react-dom/client');
      const carouselName = selectedCarousel?.carousel_name || "carousel";
      const slides = parseSlides(selectedCarousel.slides);
      
      // Base logical size for rendering (export will be upscaled via pixelRatio)
      const baseWidth = 540; // will become 1080 with pixelRatio: 2
      const baseHeight = aspectRatio === "4:5" ? 675 : 540;
      
      // Create hidden container for rendering the slide at base logical size
      hiddenContainer = document.createElement('div');
      hiddenContainer.style.position = 'fixed';
      hiddenContainer.style.left = '-9999px';
      hiddenContainer.style.top = '0';
      hiddenContainer.style.width = `${baseWidth}px`;
      hiddenContainer.style.height = `${baseHeight}px`;
      hiddenContainer.style.fontSize = '16px';
      hiddenContainer.style.fontFamily = 'system-ui, -apple-system, sans-serif';
      document.body.appendChild(hiddenContainer);
      
      root = createRoot(hiddenContainer);
      
      // Render just the slide without the carousel wrapper
      const React = await import('react');
      root.render(
        React.createElement(SlidePreview, {
          slide: slides[selectedSlideIndex],
          template: template,
          slideNumber: selectedSlideIndex + 1,
          totalSlides: slides.length,
          coverStyle: coverStyle,
          backgroundColor: backgroundColor,
          textColor: textColor,
          aspectRatio: aspectRatio,
          accentColor: accentColor,
          slideIndex: selectedSlideIndex,
          isEditing: false,
          onEditStart: () => {},
          onEditEnd: () => {},
          onUpdateSlide: () => {},
          showSlideNumber: false,
        })
      );
      
      // Wait for render
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Capture at higher pixel ratio so final PNG is 1080x1350 or 1080x1080
      const dataUrl = await toPng(hiddenContainer.firstChild as HTMLElement, {
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
      
      root.unmount();
      if (hiddenContainer.parentNode) {
        document.body.removeChild(hiddenContainer);
      }
      
      toast({
        title: "השקופית יוצאה בהצלחה!",
        description: "הקובץ הורד למחשב שלך",
      });
    } catch (error) {
      console.error("Error exporting slide:", error);
      // Cleanup on error
      if (root) {
        try {
          root.unmount();
        } catch (e) {
          // Ignore unmount errors
        }
      }
      if (hiddenContainer && hiddenContainer.parentNode) {
        try {
          document.body.removeChild(hiddenContainer);
        } catch (e) {
          // Ignore removal errors
        }
      }
      toast({
        title: "תקלה ביצוא",
        description: "נסו שוב או פנו לתמיכה",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  // Filter carousels based on search
  const filteredCarousels = carousels.filter(carousel =>
    carousel.carousel_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    parseSlides(carousel.slides).some(slide => 
      slide.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      slide.body.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center justify-between px-6 py-4">
          <h1 className="text-2xl font-bold bg-gradient-to-l from-accent to-primary bg-clip-text text-transparent">
            SlideMint
          </h1>
          <Button variant="ghost" onClick={() => navigate("/")}>
            יציאה
          </Button>
        </div>
      </header>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Preview Area */}
          <div className="flex-1 p-6 overflow-auto">
            {selectedCarousel ? (
              <div className="h-full flex flex-col">
                {/* Horizontal Slides Container */}
                <div className="flex-1 relative">
                  <div
                    ref={slidesContainerRef}
                    className="h-full flex items-center gap-4 overflow-x-auto overflow-y-hidden pb-4 scrollbar-hide"
                    style={{ scrollBehavior: 'smooth', msOverflowStyle: 'none', scrollbarWidth: 'none' }}
                  >
                    {parseSlides(selectedCarousel.slides).slice().reverse().map((slide, reverseIndex) => {
                      const index = parseSlides(selectedCarousel.slides).length - 1 - reverseIndex;
                      const visualSlideNumber = index + 1; // 1, 2, 3... based on actual position
                      const isActive = selectedSlideIndex === index;
                      return (
                      <div
                        key={index}
                        className={`flex-shrink-0 relative transition-all duration-300 cursor-pointer ${
                          isActive 
                            ? "scale-120 opacity-100 z-10" 
                            : "scale-100 opacity-60 hover:opacity-80"
                        } ${draggedSlideIndex === index ? "opacity-50 cursor-grabbing" : ""} ${
                          dragOverSlideIndex === index ? "ring-2 ring-blue-400 ring-offset-2" : ""
                        }`}
                        onClick={() => {
                          setSelectedSlideIndex(index);
                          scrollToSlide(index);
                        }}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, index)}
                        onDragEnd={handleDragEnd}
                      >
                        <div className={`${isActive ? 'w-[480px] h-[calc(100vh-280px)] max-h-[720px]' : 'w-[400px] h-[calc(100vh-300px)] max-h-[600px]'}`}>
                          <SlidePreview
                            slide={slide}
                            template={template}
                            slideNumber={visualSlideNumber}
                            totalSlides={parseSlides(selectedCarousel.slides).length}
                            coverStyle={coverStyle}
                            backgroundColor={backgroundColor}
                            textColor={textColor}
                            aspectRatio={aspectRatio}
                            accentColor={accentColor}
                            slideIndex={index}
                            isEditing={isActive}
                            onEditStart={() => setSelectedSlideIndex(index)}
                            onEditEnd={() => {}}
                            onUpdateSlide={(updates) => handleUpdateSlide(index, updates)}
                            showSlideNumber={true}
                          />
                        </div>
                        
                        {/* Slide Actions */}
                        {isActive && (
                          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1">
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDuplicateSlide(index);
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSlide(index);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                    })}
                  </div>

                  {/* Navigation Arrows */}
                  {parseSlides(selectedCarousel.slides).length > 1 && (
                    <>
                      <button
                        onClick={() => navigateSlide(1)}
                        className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-background/90 hover:bg-background rounded-full p-2 shadow-lg border border-border transition-all duration-200 hover:scale-110"
                        disabled={selectedSlideIndex === parseSlides(selectedCarousel.slides).length - 1}
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => navigateSlide(-1)}
                        className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-background/90 hover:bg-background rounded-full p-2 shadow-lg border border-border transition-all duration-200 hover:scale-110"
                        disabled={selectedSlideIndex === 0}
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center space-y-4">
                  <h3 className="text-xl font-semibold">בחר קרוסלה לעריכה</h3>
                  <p className="text-muted-foreground">
                    בחר קרוסלה מהרשימה או צור קרוסלה חדשה כדי להתחיל
                  </p>
                  <Button onClick={() => setCreateModalOpen(true)}>
                    <Plus className="ml-2 h-4 w-4" />
                    צור קרוסלה חדשה
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Editing Panel */}
          <div className="border-t bg-background/80 backdrop-blur-sm p-6">
            <div className="max-w-6xl mx-auto">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {/* Template Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">תבנית</label>
                  <Select 
                    value={selectedCarousel ? template : "dark"} 
                    onValueChange={(value: "dark" | "light") => selectedCarousel && setTemplate(value)}
                    disabled={!selectedCarousel}
                  >
                    <SelectTrigger dir="rtl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="end" dir="rtl">
                      <SelectItem value="dark">תבנית כהה</SelectItem>
                      <SelectItem value="light">תבנית בהירה</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Cover Style Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">סגנון כריכה</label>
                  <Select 
                    value={selectedCarousel ? coverStyle : "minimalist"} 
                    onValueChange={(value) => selectedCarousel && setCoverStyle(value as any)}
                    disabled={!selectedCarousel}
                  >
                    <SelectTrigger dir="rtl">
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
                </div>
                
                {/* Background Color */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">רקע</label>
                  <ColorPicker 
                    color={selectedCarousel ? backgroundColor : "#000000"} 
                    setColor={selectedCarousel ? setBackgroundColor : () => {}} 
                    title="שינוי רקע" 
                    disabled={!selectedCarousel}
                  />
                </div>
                
                {/* Text Color */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">טקסט</label>
                  <ColorPicker 
                    color={selectedCarousel ? textColor : "#FFFFFF"} 
                    setColor={selectedCarousel ? setTextColor : () => {}} 
                    title="שינוי טקסט" 
                    disabled={!selectedCarousel}
                  />
                </div>
                
                {/* Accent Color */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">צבע עיצוב</label>
                  <ColorPicker 
                    color={selectedCarousel ? accentColor : "#FFFFFF"} 
                    setColor={selectedCarousel ? setAccentColor : () => {}} 
                    title="שינוי צבע עיצוב" 
                    disabled={!selectedCarousel}
                  />
                </div>
                
                {/* Aspect Ratio */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">יחס גובה-רוחב</label>
                  <Select 
                    value={selectedCarousel ? aspectRatio : "4:5"} 
                    onValueChange={(value: "1:1" | "4:5") => selectedCarousel && setAspectRatio(value)}
                    disabled={!selectedCarousel}
                  >
                    <SelectTrigger dir="rtl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="end" dir="rtl">
                      <SelectItem value="1:1">1:1</SelectItem>
                      <SelectItem value="4:5">4:5</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Export Button */}
              <div className="mt-4 flex justify-end">
                <Button 
                  onClick={handleExport} 
                  disabled={exporting || !selectedCarousel}
                >
                  <Download className="ml-2 h-4 w-4" />
                  ייצא הכל
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Carousel List */}
        <div className="w-[320px] flex-shrink-0 border-r bg-background/50 flex flex-col">
          {/* Search and Add */}
          <div className="p-4 border-b space-y-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="חפש קרוסלה..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
            </div>
            <Button
              onClick={() => setCreateModalOpen(true)}
              className="w-full"
              size="sm"
            >
              <Plus className="ml-2 h-4 w-4" />
              קרוסלה חדשה
            </Button>
          </div>

          {/* Carousel Count */}
          {profile && (
            <div className="px-4 py-2 border-b">
              <div className="text-center">
                <span className="text-sm font-medium">
                  {profile.carousel_count}/10 קרוסלות
                </span>
              </div>
            </div>
          )}

          {/* Carousel List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {filteredCarousels.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">לא נמצאו קרוסלות</p>
                <Button
                  onClick={() => setCreateModalOpen(true)}
                  variant="outline"
                  size="sm"
                >
                  <Plus className="ml-2 h-4 w-4" />
                  צור קרוסלה ראשונה
                </Button>
              </div>
            ) : (
              filteredCarousels.map((carousel) => {
                const firstSlide = parseSlides(carousel.slides)[0];
                return (
                  <Card
                    key={carousel.id}
                    className={`p-3 cursor-pointer transition-all ${
                      selectedCarousel?.id === carousel.id
                        ? "ring-2 ring-accent bg-accent/5"
                        : "hover:bg-muted/50"
                    }`}
                    onClick={() => selectCarousel(carousel)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate text-sm mb-1">
                          {firstSlide?.title || "ללא כותרת"}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {parseSlides(carousel.slides).length} שקופיות •{" "}
                          {formatDistanceToNow(new Date(carousel.created_at), {
                            addSuffix: true,
                            locale: he,
                          })}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCarousel(carousel.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Create Carousel Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">צור קרוסלה חדשה</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCreateModalOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">סגנון תוכן</label>
                  <select
                    value={newCarouselStyle}
                    onChange={(e) => setNewCarouselStyle(e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background"
                    disabled={creatingCarousel}
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
                    value={newCarouselCoverStyle}
                    onChange={(e) => setNewCarouselCoverStyle(e.target.value as any)}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background"
                    disabled={creatingCarousel}
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
                    value={newCarouselText}
                    onChange={(e) => setNewCarouselText(e.target.value)}
                    className="min-h-[200px] text-base resize-none"
                    disabled={creatingCarousel}
                  />
                  <div className="text-sm text-muted-foreground">
                    {newCarouselText.trim().split(/\s+/).filter(word => word.length > 0).length} מילים
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setCreateModalOpen(false)}
                  disabled={creatingCarousel}
                  className="flex-1"
                >
                  ביטול
                </Button>
                <Button
                  onClick={handleCreateCarousel}
                  disabled={creatingCarousel || !newCarouselText.trim()}
                  className="flex-1"
                >
                  {creatingCarousel ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      יוצר קרוסלה...
                    </>
                  ) : (
                    "צור מבנה שקופיות"
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </div>
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

export default Dashboard;
