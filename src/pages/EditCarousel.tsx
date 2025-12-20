import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, Copy } from "lucide-react";
import { debounce } from "lodash";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SlidePreview from "@/components/SlidePreview";
import LinkedInCarouselPreview from "@/components/LinkedInCarouselPreview";
// import RegenerateModal from "@/components/RegenerateModal";
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
  const [aspectRatio, setAspectRatio] = useState<"1:1" | "4:5">("4:5");
  const [accentColor, setAccentColor] = useState("#FFFFFF");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [regenerateModalOpen, setRegenerateModalOpen] = useState(false);
  const [oldSlideData, setOldSlideData] = useState<{ title: string; body: string } | null>(null);
  const [newSlideData, setNewSlideData] = useState<{ title: string; body: string } | null>(null);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
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
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        // Next slide
        const newIndex = Math.min(selectedSlideIndex + 1, slides.length - 1);
        setSelectedSlideIndex(newIndex);
        setEditingSlideIndex(newIndex);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        // Previous slide
        const newIndex = Math.max(selectedSlideIndex - 1, 0);
        setSelectedSlideIndex(newIndex);
        setEditingSlideIndex(newIndex);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedSlideIndex, slides.length]);

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
      setAspectRatio((data.aspect_ratio as "1:1" | "4:5") || '4:5');
      setAccentColor(data.accent_color || (data.chosen_template === 'dark' ? '#FFFFFF' : '#000000'));
    } catch (error) {
      console.error("Error fetching carousel:", error);
      toast({
        title: "Error",
        description: "Couldn't load the carousel",
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
          title: "Saved",
          description: "Changes were saved automatically",
          duration: 2000,
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Couldn't save changes",
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
        title: "Saved successfully!",
        description: "Your changes were saved",
      });
    } catch (error) {
      console.error("Error saving carousel:", error);
      toast({
        title: "Error",
        description: "Couldn't save changes",
        variant: "destructive",
      });
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const { toPng } = await import('html-to-image');
      const JSZip = (await import('jszip')).default;
      const { createRoot } = await import('react-dom/client');
      
      const zip = new JSZip();
      const carouselName = carousel?.carousel_name || "carousel";
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
              textDirection: "ltr",
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
          if (error instanceof Error) {
            console.error(`Error details: ${error.message}`);
            console.error(`Stack: ${error.stack}`);
          }
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
          title: "Some slides failed to export",
          description: "Please try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Exported successfully!",
          description: "The file was downloaded to your computer",
        });
      }
    } catch (error) {
      console.error("Error exporting carousel:", error);
      if (error instanceof Error) {
        console.error(`Error details: ${error.message}`);
        console.error(`Stack: ${error.stack}`);
      }
      toast({
        title: "Export failed",
        description: "Please try again or contact support",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleExportCurrent = async () => {
    setExporting(true);
    let root: any = null;
    let hiddenContainer: HTMLDivElement | null = null;
    try {
      const { toPng } = await import('html-to-image');
      const { createRoot } = await import('react-dom/client');
      const carouselName = carousel?.carousel_name || "carousel";
      
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
          textDirection: "ltr",
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
        title: "Slide exported successfully!",
        description: "The file was downloaded to your computer",
      });
    } catch (error) {
      console.error("Error exporting slide:", error);
      if (error instanceof Error) {
        console.error(`Error details: ${error.message}`);
        console.error(`Stack: ${error.stack}`);
      }
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
        title: "Export failed",
        description: "Please try again or contact support",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteSlide = (index: number) => {
    if (slides.length <= 2) {
      toast({
        title: "Error",
        description: "A carousel must have at least 2 slides",
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
      title: "New slide added",
      description: "You can edit the content now",
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
        title: "Error",
        description: "Couldn't regenerate the slide",
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
        title: "Slide updated successfully",
        description: "The text was regenerated using AI",
      });
    }
  };

  const handleRejectRegeneration = () => {
    setRegenerateModalOpen(false);
    toast({
      title: "Cancelled",
      description: "The slide was kept unchanged",
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
    <div dir="ltr" className="relative min-h-screen overflow-hidden bg-gradient-to-b from-background to-muted">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-28 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-32 right-10 h-[28rem] w-[28rem] rounded-full bg-accent/20 blur-3xl" />
      </div>

      <header className="border-b border-border/60 bg-background/70 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-2xl font-bold bg-gradient-to-l from-accent to-primary bg-clip-text text-transparent">
            SlideMint
          </h1>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/my-carousels")}>
              Back
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-6 max-w-7xl mx-auto" style={{ height: 'calc(100vh - 136px)' }}>
          {/* Slide list - move to the opposite side of the preview */}
          <Card className="w-72 p-4 space-y-3 overflow-y-auto flex-shrink-0 order-2 bg-background/60 backdrop-blur-xl border-border/60 shadow-2xl rounded-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold tracking-tight">Slides</h3>
                <p className="text-xs text-muted-foreground">{slides.length} total</p>
              </div>
              <Button
                onClick={handleAddBlankSlide}
                variant="outline"
                size="sm"
                className="h-8 px-2.5"
              >
                + New
              </Button>
            </div>
            {slides.map((slide, index) => (
              <div
                key={index}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`group p-3 rounded-xl border border-border/60 bg-background/40 cursor-move transition-all duration-normal ease-ios-out motion-safe:hover:-translate-y-px hover:bg-muted/40 ${
                  selectedSlideIndex === index
                    ? "bg-accent/10 border-border ring-2 ring-ring/25"
                    : ""
                } ${draggedIndex === index ? "opacity-50" : ""}`}
                onClick={() => {
                  setSelectedSlideIndex(index);
                  setEditingSlideIndex(index);
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-foreground mb-1">Slide {index + 1}</div>
                    <div className="text-sm font-semibold truncate">{slide.title || "Empty slide"}</div>
                    {slide.body && (
                      <div className="mt-1 text-xs text-muted-foreground truncate">
                        {slide.body}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDuplicateSlide(index);
                      }}
                      className="rounded-md p-1 text-muted-foreground transition-colors duration-normal ease-ios-out hover:text-foreground hover:bg-muted/50"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSlide(index);
                      }}
                      className="rounded-md p-1 text-muted-foreground transition-colors duration-normal ease-ios-out hover:text-destructive hover:bg-muted/50"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </Card>

          {/* Main content area */}
          <div className="flex-1 flex flex-col gap-4 min-w-0 order-1">
            <div className="flex-1 rounded-2xl border border-border/60 bg-background/60 backdrop-blur-xl shadow-2xl overflow-auto">
              <div className="p-5 md:p-6">
                <div id={`slide-preview-${selectedSlideIndex}`} className="w-full flex flex-col items-center gap-4">
                  <LinkedInCarouselPreview
                    slides={slides}
                    template={template}
                    coverStyle={coverStyle}
                    backgroundColor={backgroundColor}
                    textColor={textColor}
                    aspectRatio={aspectRatio}
                    accentColor={accentColor}
                    editingSlideIndex={editingSlideIndex}
                    onEditStart={(slideIndex) => {
                      setSelectedSlideIndex(slideIndex);
                      setEditingSlideIndex(slideIndex);
                    }}
                    onEditEnd={() => {}} // Don't disable editing when clicking away
                    onUpdateSlide={(slideIndex, updates) => {
                      handleUpdateSlide(slideIndex, updates);
                    }}
                  />

                  <div className="w-full max-w-[780px] rounded-xl border border-border/60 bg-background/40 p-3 backdrop-blur-xl">
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <Select value={template} onValueChange={(value: "dark" | "light") => setTemplate(value)}>
                        <SelectTrigger className="w-32" dir="ltr">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent align="end" dir="ltr">
                          <SelectItem value="dark">Dark</SelectItem>
                          <SelectItem value="light">Light</SelectItem>
                        </SelectContent>
                      </Select>
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
                      >
                        <SelectTrigger className="w-40" dir="ltr">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent align="end" dir="ltr">
                          <SelectItem value="minimalist">Minimalist</SelectItem>
                          <SelectItem value="big_number">Big number</SelectItem>
                          <SelectItem value="accent_block">Accent block</SelectItem>
                          <SelectItem value="gradient_overlay">Gradient</SelectItem>
                          <SelectItem value="geometric">Geometric</SelectItem>
                          <SelectItem value="bold_frame">Bold frame</SelectItem>
                        </SelectContent>
                      </Select>
                      <ColorPicker color={backgroundColor} setColor={setBackgroundColor} title="Background" />
                      <ColorPicker color={textColor} setColor={setTextColor} title="Text" />
                      <ColorPicker color={accentColor} setColor={setAccentColor} title="Accent" />
                      <Select value={aspectRatio} onValueChange={(value: "1:1" | "4:5") => setAspectRatio(value)}>
                        <SelectTrigger className="w-28" dir="ltr">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent align="end" dir="ltr">
                          <SelectItem value="1:1">1:1</SelectItem>
                          <SelectItem value="4:5">4:5</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button onClick={handleSave} variant="outline" size="sm" disabled={isSaving}>
                        {isSaving ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          'Save'
                        )}
                      </Button>
                      <Button onClick={() => setExportModalOpen(true)} disabled={exporting} size="sm">
                        Export
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Regenerate Modal - Temporarily hidden */}

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
          <Card className="p-8 text-center bg-background/60 backdrop-blur-xl border-border/60 shadow-2xl rounded-2xl">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-lg font-semibold">Exporting...</p>
            <p className="text-sm text-muted-foreground mt-2">This may take a few seconds</p>
          </Card>
        </div>
      )}
    </div>
  );
};

export default EditCarousel;
