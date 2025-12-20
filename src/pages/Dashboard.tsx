import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, Plus, Search, Download, Edit, Copy, X, ChevronLeft, ChevronRight, Palette, GripVertical, MoreHorizontal } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { debounce } from "lodash";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import SlidePreview from "@/components/SlidePreview";
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
  content_type?: "topic_idea" | "full_post" | null;
  post_content?: string | null;
  created_at: string;
  updated_at: string;
  // Additional fields from database
  user_id?: string;
  original_text?: string;
}

// Welcome carousel content for new users
const welcomeCarousel: Carousel = {
  id: 'welcome-carousel',
  carousel_name: 'Welcome to Post24',
  slides: [
    {
      index: 0,
      title: 'Welcome to Post24',
      body: 'Your visual content creation platform for stunning LinkedIn carousels. Let us show you around!'
    },
    {
      index: 1,
      title: 'Create Your First Carousel',
      body: 'Click "New Carousel" in the right panel to start. Choose your content type and we\'ll structure it into beautiful slides.'
    },
    {
      index: 2,
      title: 'Customize Your Design',
      body: 'Use the bottom panel to adjust colors, templates, styles, and aspect ratios. Make your carousel uniquely yours!'
    },
    {
      index: 3,
      title: 'Edit Individual Slides',
      body: 'Click any slide in the center to edit its content directly. Add, duplicate, or remove slides as needed.'
    },
    {
      index: 4,
      title: 'Edit Post Content',
      body: 'Use the middle panel to view and edit your original post content. Changes are automatically saved!'
    },
    {
      index: 5,
      title: 'Export & Share',
      body: 'Ready to share? Export your carousel as PNG images and post directly to LinkedIn or other platforms.'
    },
    {
      index: 6,
      title: 'You\'re Ready!',
      body: 'Start creating amazing visual content. Your audience will love the professional carousels you can make with Post24!'
    }
  ],
  chosen_template: 'dark',
  cover_style: 'gradient_overlay',
  background_color: '#000000',
  text_color: '#FFFFFF',
  accent_color: '#3B82F6',
  aspect_ratio: '4:5',
  content_type: 'full_post',
  post_content: 'Welcome to Post24 - Your visual content creation platform for stunning LinkedIn carousels. Create professional carousels with our easy-to-use interface, customize designs, and export high-quality images ready for social media.',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

// Function to detect if text is primarily Hebrew (RTL) or English (LTR)
const detectTextDirection = (text: string): "ltr" | "rtl" => {
  if (!text || text.trim() === '') return "ltr";
  
  // Count Hebrew characters (Unicode range for Hebrew)
  const hebrewChars = text.match(/[\u0590-\u05FF]/g) || [];
  const totalChars = text.replace(/\s/g, '').length; // Remove spaces from count
  
  // If more than 30% of non-space characters are Hebrew, use RTL
  const hebrewRatio = totalChars > 0 ? hebrewChars.length / totalChars : 0;
  return hebrewRatio > 0.3 ? "rtl" : "ltr";
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // State management
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [carousels, setCarousels] = useState<Carousel[]>([]);
  const [selectedCarousel, setSelectedCarousel] = useState<Carousel | null>(null);
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(0);
  const [isNewUser, setIsNewUser] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  
  // Create modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newCarouselStyle, setNewCarouselStyle] = useState("Professional");
  const [newCarouselContentPurpose, setNewCarouselContentPurpose] = useState("thought_leadership");
  const [newCarouselContentType, setNewCarouselContentType] = useState<"topic_idea" | "full_post">("topic_idea");
  const [newCarouselText, setNewCarouselText] = useState("");
  const [newCarouselCoverStyle, setNewCarouselCoverStyle] = useState<"minimalist" | "big_number" | "accent_block" | "gradient_overlay" | "geometric" | "bold_frame">("minimalist");
  const [creatingCarousel, setCreatingCarousel] = useState(false);
  
  // Rename dialog state
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renamingCarousel, setRenamingCarousel] = useState<Carousel | null>(null);
  const [newPostName, setNewPostName] = useState("");
  
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
  const [draggedCarouselIndex, setDraggedCarouselIndex] = useState<number | null>(null);
  const [dragOverCarouselIndex, setDragOverCarouselIndex] = useState<number | null>(null);
  
  // Text panel collapse state
  const [isTextPanelCollapsed, setIsTextPanelCollapsed] = useState(false);
  
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

  // Carousel drag and drop handlers
  const handleCarouselDragStart = (e: React.DragEvent, index: number) => {
    setDraggedCarouselIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleCarouselDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCarouselIndex(index);
  };

  const handleCarouselDragLeave = () => {
    setDragOverCarouselIndex(null);
  };

  const handleCarouselDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    setDragOverCarouselIndex(null);
    
    if (draggedCarouselIndex === null || draggedCarouselIndex === dropIndex) return;
    
    const newCarousels = [...filteredCarousels];
    const draggedCarousel = newCarousels[draggedCarouselIndex];
    
    // Remove from old position
    newCarousels.splice(draggedCarouselIndex, 1);
    
    // Insert at new position
    const adjustedDropIndex = draggedCarouselIndex < dropIndex ? dropIndex - 1 : dropIndex;
    newCarousels.splice(adjustedDropIndex, 0, draggedCarousel);
    
    // Update state
    setCarousels(newCarousels);
    setDraggedCarouselIndex(null);
    
    // Update selected carousel if needed
    if (selectedCarousel && selectedCarousel.id === draggedCarousel.id) {
      selectCarousel(draggedCarousel);
    }
  };

  const handleCarouselDragEnd = () => {
    setDraggedCarouselIndex(null);
    setDragOverCarouselIndex(null);
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
    console.log("🔄 fetchCarousels called - reloading data from server");
    console.trace("Stack trace for fetchCarousels call:");
    try {
      const { data, error } = await supabase
        .from("carousels")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Parse slides for each carousel and add default values for new fields
      const parsedCarousels = data.map((carousel: any) => {
        // Try to get post content and type from localStorage first (for newly created carousels)
        const storedPostContent = getStoredPostContent(carousel.id);
        const storedContentType = getStoredContentType(carousel.id);
        
        console.log(`🔍 Loading carousel ${carousel.id}:`, {
          hasStoredPostContent: !!storedPostContent,
          hasStoredContentType: !!storedContentType,
          hasDbPostContent: !!carousel.post_content,
          originalTextLength: carousel.original_text?.length || 0,
          storedContentType: storedContentType,
          dbContentType: carousel.content_type
        });
        
        // For existing carousels that don't have post_content in DB, we need to determine what to show
        let postContent: string;
        let contentType: "topic_idea" | "full_post";
        
        if (storedPostContent) {
          // Use stored content from localStorage (newly created carousels)
          postContent = storedPostContent;
          contentType = storedContentType || "topic_idea";
          console.log(`✅ Using localStorage for carousel ${carousel.id}: ${postContent.substring(0, 50)}...`);
        } else if (carousel.post_content) {
          // New carousels with post_content field in DB
          postContent = carousel.post_content;
          contentType = carousel.content_type || "topic_idea";
          console.log(`✅ Using DB post_content for carousel ${carousel.id}: ${postContent.substring(0, 50)}...`);
        } else {
          // Existing carousels - use original_text as post content and default to full_post
          postContent = carousel.original_text || "";
          contentType = "full_post"; // Default existing carousels to full_post type
          console.log(`⚠️ Using original_text for carousel ${carousel.id}: ${postContent.substring(0, 50)}...`);
        }
        
        console.log(`📝 Final post content for carousel ${carousel.id}:`, {
          contentType,
          postContentLength: postContent.length,
          preview: postContent.substring(0, 100) + (postContent.length > 100 ? '...' : '')
        });
        
        return {
          ...carousel,
          slides: parseSlides(carousel.slides),
          content_type: contentType,
          post_content: postContent,
        };
      });
      
      // Check if user is new (no carousels) and add welcome carousel
      const isUserNew = parsedCarousels.length === 0;
      setIsNewUser(isUserNew);
      
      let finalCarousels = parsedCarousels;
      if (isUserNew) {
        // Add welcome carousel at the beginning
        finalCarousels = [welcomeCarousel, ...parsedCarousels];
        console.log("🎉 New user detected, adding welcome carousel");
      }
      
      setCarousels(finalCarousels);
      console.log("📦 Carousels reloaded from server:", finalCarousels.length);
      
      // Only select first carousel if no carousel is currently selected
      if (finalCarousels && finalCarousels.length > 0 && !selectedCarousel) {
        console.log("🎯 No carousel selected, selecting first one");
        selectCarousel(finalCarousels[0]);
      } else if (selectedCarousel) {
        console.log("🎯 Preserving currently selected carousel:", selectedCarousel.id);
        // Find the updated version of the currently selected carousel
        const updatedSelectedCarousel = finalCarousels.find(c => c.id === selectedCarousel.id);
        if (updatedSelectedCarousel) {
          selectCarousel(updatedSelectedCarousel);
        }
      }
    } catch (error) {
      console.error("Error fetching carousels:", error);
      toast({
        title: "Error",
        description: "Couldn't load carousels",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const selectCarousel = (carousel: Carousel) => {
    // Prevent unnecessary re-selection if it's the same carousel
    if (selectedCarousel && selectedCarousel.id === carousel.id) {
      console.log("🎯 selectCarousel skipped - same carousel already selected:", carousel.id);
      return;
    }
    
    console.log("🎯 selectCarousel called with:", carousel.id);
    
    // Check if we have fresh post content in localStorage for this carousel
    const storedPostContent = getStoredPostContent(carousel.id);
    const storedContentType = getStoredContentType(carousel.id);
    
    // If we have stored data, use it to update the carousel object
    if (storedPostContent) {
      carousel.post_content = storedPostContent;
      carousel.content_type = storedContentType || carousel.content_type;
      console.log("🔄 Updated carousel with localStorage data:", {
        postContentLength: storedPostContent.length,
        contentType: storedContentType
      });
    }
    
    console.log("📝 Loading carousel design:", {
      chosen_template: carousel.chosen_template,
      cover_style: carousel.cover_style,
      background_color: carousel.background_color,
      text_color: carousel.text_color,
      aspect_ratio: carousel.aspect_ratio,
      accent_color: carousel.accent_color,
      content_type: carousel.content_type,
      post_content_length: carousel.post_content?.length || 0,
      post_content_preview: carousel.post_content?.substring(0, 100) + (carousel.post_content?.length > 100 ? '...' : ''),
    });
    
    setSelectedCarousel(carousel);
    // Start with slide 0 (first slide)
    setSelectedSlideIndex(0);
    
    // Load the carousel's design into local state
    setTemplate((carousel.chosen_template as "dark" | "light") || "dark");
    setCoverStyle((carousel.cover_style as any) || "minimalist");
    setBackgroundColor(carousel.background_color || "#000000");
    setTextColor(carousel.text_color || "#FFFFFF");
    setAccentColor(carousel.accent_color || "#FFFFFF");
    setAspectRatio((carousel.aspect_ratio as "1:1" | "4:5") || "4:5");
    
    console.log("✅ Carousel selected successfully, post content should now be visible in the panel");
    
    // Auto-scroll to the first slide after component renders
    setTimeout(() => {
      scrollToSlide(0);
    }, 100);
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
    const slide = container.querySelector(`[data-slide-index="${index}"]`) as HTMLElement | null;
    if (!slide) return;

    const containerRect = container.getBoundingClientRect();
    const slideRect = slide.getBoundingClientRect();
    const delta = (slideRect.left - containerRect.left) - (containerRect.width - slideRect.width) / 2;

    container.scrollBy({
      left: delta,
      behavior: 'smooth',
    });
  };

  useEffect(() => {
    if (!selectedCarousel) return;
    const id = requestAnimationFrame(() => scrollToSlide(selectedSlideIndex));
    return () => cancelAnimationFrame(id);
  }, [selectedCarousel?.id, selectedSlideIndex]);

  const detectLanguage = (text: string): string => {
    const hebrewChars = text.match(/[\u0590-\u05FF]/g);
    return hebrewChars && hebrewChars.length > text.length * 0.3 ? 'he' : 'en';
  };

  // Client-side storage for post content (temporary until database schema is updated)
const getStoredPostContent = (carouselId: string): string | null => {
  try {
    const stored = localStorage.getItem(`post_content_${carouselId}`);
    console.log(`📖 Reading post_content for ${carouselId}:`, stored ? `Found (${stored.length} chars)` : 'Not found');
    return stored;
  } catch (error) {
    console.error('Error reading from localStorage:', error);
    return null;
  }
};

const setStoredPostContent = (carouselId: string, content: string): void => {
  try {
    localStorage.setItem(`post_content_${carouselId}`, content);
    console.log(`💾 Saving post_content for ${carouselId}:`, `Saved (${content.length} chars)`);
  } catch (error) {
    console.error('Error writing to localStorage:', error);
  }
};

const getStoredContentType = (carouselId: string): "topic_idea" | "full_post" | null => {
  try {
    const stored = localStorage.getItem(`content_type_${carouselId}`);
    console.log(`📖 Reading content_type for ${carouselId}:`, stored || 'Not found');
    return stored as "topic_idea" | "full_post" | null;
  } catch (error) {
    console.error('Error reading from localStorage:', error);
    return null;
  }
};

const setStoredContentType = (carouselId: string, contentType: "topic_idea" | "full_post"): void => {
  try {
    localStorage.setItem(`content_type_${carouselId}`, contentType);
    console.log(`💾 Saving content_type for ${carouselId}:`, contentType);
  } catch (error) {
    console.error('Error writing to localStorage:', error);
  }
};

// Temporary frontend function to generate post content from topic/idea
const generatePostFromTopicFrontend = (topic: string, contentPurpose: string): string => {
  let sentences: string[] = [];
  
  switch (contentPurpose) {
    case 'awareness':
      // 25-75 words (short, concise awareness post)
      sentences = [
        `Discover the latest insights about ${topic}. This emerging trend is transforming how we work and live in today's digital landscape.`,
        `Key benefits include improved efficiency, enhanced collaboration, and sustainable growth opportunities.`,
        `Stay ahead of the curve by understanding these developments now. What's your take on ${topic}?`
      ];
      break;
      
    case 'thought_leadership':
      // 100-300 words (comprehensive thought leadership post)
      sentences = [
        `I've been thinking a lot about ${topic} lately, and I wanted to share some insights with my network.`,
        `The importance of ${topic} cannot be overstated in today's rapidly evolving landscape. As we navigate through unprecedented changes, understanding this concept becomes crucial for sustainable growth and innovation.`,
        `Here are some key points to consider:\n\n• First, ${topic} impacts our daily lives in ways we might not immediately recognize. From decision-making processes to long-term strategic planning, its influence is pervasive.\n• Second, understanding ${topic} better can help us make more informed decisions. The data shows that organizations embracing these principles see 40% better outcomes.\n• Finally, the future of ${topic} holds exciting possibilities that we should all be aware of. Emerging technologies and methodologies are opening doors we never thought possible.`,
        `The journey of mastering ${topic} is ongoing, and each step brings new opportunities for growth and learning. I've seen firsthand how teams transform when they embrace these principles.`,
        `What are your thoughts on ${topic}? I'd love to hear your perspectives and experiences in the comments below. Let's start a meaningful conversation and learn from each other's insights.`
      ];
      break;
      
    case 'opinion':
      // <20 words (very short opinion/conversation starter)
      sentences = [
        `${topic} is overrated. Here's why we need to rethink everything.`
      ];
      break;
      
    default:
      // Default to thought leadership
      sentences = [
        `I've been thinking a lot about ${topic} lately, and I wanted to share some insights with my network.`,
        `The importance of ${topic} cannot be overstated in today's rapidly evolving landscape.`,
        `Here are some key points to consider:\n\n• First, ${topic} impacts our daily lives in ways we might not immediately recognize.\n• Second, understanding ${topic} better can help us make more informed decisions.\n• Finally, the future of ${topic} holds exciting possibilities that we should all be aware of.`,
        `What are your thoughts on ${topic}? I'd love to hear your perspectives and experiences in the comments below.`,
        `Let's start a meaningful conversation about ${topic} and learn from each other's insights.`
      ];
  }
  
  return sentences.join('\n\n');
};

// Temporary frontend function to create essence slides from full post
const createEssenceSlidesFromPost = (postText: string, style: string): any[] => {
  const sentences = postText.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const slideCount = Math.min(8, Math.max(6, Math.ceil(sentences.length / 3)));
  const sentencesPerSlide = Math.ceil(sentences.length / slideCount);
  const slides = [];
  
  for (let i = 0; i < slideCount; i++) {
    const startIdx = i * sentencesPerSlide;
    const endIdx = Math.min(startIdx + sentencesPerSlide, sentences.length);
    const slideContent = sentences.slice(startIdx, endIdx).join('. ').trim();
    const words = slideContent.split(' ');
    const titleWords = words.slice(0, Math.min(5, words.length));
    const title = titleWords.join(' ') + (titleWords.length < words.length ? '...' : '');
    const body = words.slice(titleWords.length).join(' ').trim() || slideContent;
    
    slides.push({
      index: i + 1,
      title: title || `Key Point ${i + 1}`,
      body: body.length > 150 ? body.substring(0, 150) + '...' : body
    });
  }
  
  return slides;
};

const handleCreateCarousel = async () => {
    if (!newCarouselText.trim()) {
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

    setCreatingCarousel(true);
    try {
      const language = detectLanguage(newCarouselText);
      
      // Prepare the request based on content type
      const requestBody = {
        text: newCarouselText,
        style: newCarouselStyle,
        language,
        content_type: newCarouselContentType,
        content_purpose: newCarouselContentPurpose,
      };
      
      const { data, error } = await supabase.functions.invoke("generate-slides", {
        body: requestBody,
      });

      if (error) throw error;

      // Temporary frontend logic until backend is deployed
      let finalPostContent: string;
      let essenceSlides: any[];

      if (newCarouselContentType === "topic_idea") {
        // For topic/idea: generate full post and create essence slides
        finalPostContent = data.generated_post || generatePostFromTopicFrontend(newCarouselText, newCarouselContentPurpose);
        // Use the slides from backend if they exist, otherwise create essence from generated post
        essenceSlides = data.slides && data.slides.length > 0 ? data.slides : createEssenceSlidesFromPost(finalPostContent, newCarouselStyle);
      } else {
        // For full post: use user's text and create essence slides
        finalPostContent = newCarouselText;
        // Use the slides from backend if they exist, otherwise create essence from user post
        essenceSlides = data.slides && data.slides.length > 0 ? data.slides : createEssenceSlidesFromPost(finalPostContent, newCarouselStyle);
      }

      const { data: carousel, error: insertError } = await supabase
        .from("carousels")
        .insert({
          user_id: user.id,
          original_text: newCarouselText,
          slides: essenceSlides,  // These are essence slides
          chosen_template: "dark",
          cover_style: newCarouselCoverStyle,
          carousel_name: essenceSlides[0]?.title || "Untitled Carousel",
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
      
      // Update local profile state immediately
      setProfile(prev => ({ ...prev, carousel_count: (prev?.carousel_count || 0) + 1 }));

      toast({
        title: "Carousel created successfully!",
      });

      // Refresh carousels and select the new one
      await fetchCarousels(user.id);
      setCreateModalOpen(false);
      setNewCarouselText("");
      
      // Find and select the new carousel with post content
      const updatedCarousels = await supabase
        .from("carousels")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      
      if (updatedCarousels.data && updatedCarousels.data.length > 0) {
        await fetchCarousels(user.id);
        const firstCarousel = updatedCarousels.data[0];
        
        // Save post content and type to localStorage for persistence
        setStoredPostContent(firstCarousel.id, finalPostContent);
        setStoredContentType(firstCarousel.id, newCarouselContentType);
        
        selectCarousel({
          ...firstCarousel,
          slides: parseSlides(firstCarousel.slides),
          content_type: newCarouselContentType,
          post_content: finalPostContent,  // Use the full post content
        });
      }
    } catch (error: any) {
      console.error("Error generating carousel:", error);
      toast({
        title: "Error",
        description: "Something went wrong while creating the carousel. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCreatingCarousel(false);
    }
  };

  const handleDeleteCarousel = async (id: string) => {
    if (!confirm("Are you sure you want to delete this carousel?")) {
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
        
        // Update local profile state immediately
        setProfile({ ...profile, carousel_count: Math.max(0, profile.carousel_count - 1) });
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
        title: "Deleted successfully",
        description: "The carousel has been deleted",
      });
    } catch (error) {
      console.error("Error deleting carousel:", error);
      toast({
        title: "Error",
        description: "Could not delete the carousel",
        variant: "destructive",
      });
    }
  };

  const handleDuplicateCarousel = async (carousel: Carousel) => {
    if (!user || !profile || profile.carousel_count >= 10) {
      toast({
        title: "Cannot duplicate post",
        description: "You've reached the maximum limit of 10 posts. Please delete some posts first.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Get the current post content and content type from localStorage if available
      const storedPostContent = getStoredPostContent(carousel.id);
      const storedContentType = getStoredContentType(carousel.id);
      const currentPostContent = storedPostContent || carousel.post_content || carousel.original_text || "";
      const currentContentType = storedContentType || carousel.content_type || "full_post";
      
      // Create a new carousel with duplicated content
      const newCarousel = {
        user_id: user.id,
        original_text: carousel.original_text || currentPostContent,
        slides: carousel.slides,
        chosen_template: carousel.chosen_template || "dark",
        cover_style: carousel.cover_style,
        carousel_name: (() => {
          const firstSlide = parseSlides(carousel.slides)[0];
          return firstSlide?.title || "Untitled Carousel";
        })(),
        background_color: carousel.background_color || "#000000",
        text_color: carousel.text_color || "#FFFFFF",
        accent_color: carousel.accent_color || "#FFFFFF",
        aspect_ratio: carousel.aspect_ratio || "4:5",
      };

      const { data: createdCarousel, error } = await supabase
        .from("carousels")
        .insert(newCarousel)
        .select()
        .single();

      if (error) throw error;

      // Store the post content and content type in localStorage for the duplicated carousel
      setStoredPostContent(createdCarousel.id, currentPostContent);
      setStoredContentType(createdCarousel.id, currentContentType);

      // Update profile carousel count
      await supabase
        .from("profiles")
        .update({ carousel_count: profile.carousel_count + 1 })
        .eq("id", profile.id);

      setProfile({ ...profile, carousel_count: profile.carousel_count + 1 });

      // Add to local state with post content
      const duplicatedCarousel = {
        ...createdCarousel,
        post_content: currentPostContent,
        content_type: currentContentType,
      };
      setCarousels([duplicatedCarousel, ...carousels]);

      toast({
        title: "Success",
        description: "Post duplicated successfully",
      });
    } catch (error: any) {
      console.error("Error duplicating carousel:", error);
      toast({
        title: "Error",
        description: "Something went wrong while duplicating the post. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleRenameCarousel = (carousel: Carousel) => {
    const firstSlide = parseSlides(carousel.slides)[0];
    const currentTitle = firstSlide?.title || "Untitled Post";
    
    setRenamingCarousel(carousel);
    setNewPostName(currentTitle);
    setRenameModalOpen(true);
  };

  const handleConfirmRename = async () => {
    if (!renamingCarousel || !newPostName.trim()) return;
    
    try {
      // Update the first slide's title
      const updatedSlides = [...parseSlides(renamingCarousel.slides)];
      if (updatedSlides.length > 0) {
        updatedSlides[0] = { ...updatedSlides[0], title: newPostName.trim() };
      }
      
      // Update carousel in database
      const { error } = await supabase
        .from("carousels")
        .update({ 
          slides: updatedSlides as any,
          carousel_name: newPostName.trim()
        })
        .eq("id", renamingCarousel.id);
      
      if (error) throw error;
      
      // Update local state
      const updatedCarousel = { ...renamingCarousel, slides: updatedSlides };
      setCarousels(carousels.map(c => c.id === renamingCarousel.id ? updatedCarousel : c));
      
      if (selectedCarousel?.id === renamingCarousel.id) {
        setSelectedCarousel(updatedCarousel);
      }
      
      toast({
        title: "Success",
        description: "Post renamed successfully",
      });
      
      // Close dialog
      setRenameModalOpen(false);
      setRenamingCarousel(null);
      setNewPostName("");
    } catch (error: any) {
      console.error("Error renaming carousel:", error);
      toast({
        title: "Error",
        description: "Something went wrong while renaming the post. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      setCarousels([]);
      setSelectedCarousel(null);
      navigate("/");
    } catch (error) {
      console.error("Error signing out:", error);
      // Still navigate even if sign out fails
      navigate("/");
    }
  };

  // Single, clean function to update design properties
  const updateDesignProperty = async (property: string, value: any) => {
    if (!selectedCarousel) {
      console.log("No selected carousel - change ignored");
      return;
    }
    
    console.log(`🎨 Updating ${property} to:`, value);
    
    // Create updated carousel with the new property
    const updatedCarousel = {
      ...selectedCarousel,
      [property]: value,
    };
    
    // Update local state immediately
    setSelectedCarousel(updatedCarousel);
    setCarousels(carousels.map(c => c.id === selectedCarousel.id ? updatedCarousel : c));
    
    // Save post content to localStorage for persistence
    if (property === 'post_content') {
      setStoredPostContent(selectedCarousel.id, value);
    }
    if (property === 'content_type') {
      setStoredContentType(selectedCarousel.id, value);
    }
    
    // Only save to database for fields that exist in the schema
    // Skip content_type and post_content for now as they don't exist in the database yet
    if (property === 'content_type' || property === 'post_content') {
      console.log(`⏭️ Skipping database save for ${property} (field not in schema yet)`);
      return;
    }
    
    // Save to database
    try {
      const { error } = await supabase
        .from("carousels")
        .update({
          [property]: value,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedCarousel.id);
        
      if (error) throw error;
      console.log(`✅ ${property} saved successfully`);
    } catch (error) {
      console.error(`❌ Failed to save ${property}:`, error);
      toast({
        title: "Error",
        description: `Couldn't save ${property}`,
        variant: "destructive",
      });
    }
  };

  const handleTemplateChange = async (newTemplate: "dark" | "light") => {
    if (!selectedCarousel) return;
    
    console.log("🎨 Template change:", newTemplate);
    
    // Define color swaps based on template
    const newBackgroundColor = newTemplate === "dark" ? "#000000" : "#FFFFFF";
    const newTextColor = newTemplate === "dark" ? "#FFFFFF" : "#000000";
    
    // Update local state immediately (preserve accent color)
    setTemplate(newTemplate);
    setBackgroundColor(newBackgroundColor);
    setTextColor(newTextColor);
    // Don't change accentColor - keep it as is
    
    // Create updated carousel with swapped colors but preserve other properties
    const updatedCarousel = {
      ...selectedCarousel,
      chosen_template: newTemplate,
      background_color: newBackgroundColor,
      text_color: newTextColor,
      // Preserve all other properties unchanged
      cover_style: selectedCarousel.cover_style,
      accent_color: selectedCarousel.accent_color,
      aspect_ratio: selectedCarousel.aspect_ratio,
    };
    
    // Update carousel state and save
    setSelectedCarousel(updatedCarousel);
    setCarousels(carousels.map(c => c.id === selectedCarousel.id ? updatedCarousel : c));
    
    // Save to database
    try {
      const { error } = await supabase
        .from("carousels")
        .update({
          chosen_template: newTemplate,
          background_color: newBackgroundColor,
          text_color: newTextColor,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedCarousel.id);
        
      if (error) throw error;
      console.log("✅ Template and colors saved successfully");
    } catch (error) {
      console.error("❌ Failed to save template and colors:", error);
      toast({
        title: "Error",
        description: "Couldn't save the template",
        variant: "destructive",
      });
    }
  };

  const handleCoverStyleChange = (newCoverStyle: typeof coverStyle) => {
    setCoverStyle(newCoverStyle);
    updateDesignProperty('cover_style', newCoverStyle);
  };

  const handleBackgroundColorChange = (newColor: string) => {
    setBackgroundColor(newColor);
    updateDesignProperty('background_color', newColor);
  };

  const handleTextColorChange = (newColor: string) => {
    setTextColor(newColor);
    updateDesignProperty('text_color', newColor);
  };

  const handleAccentColorChange = (newColor: string) => {
    setAccentColor(newColor);
    updateDesignProperty('accent_color', newColor);
  };

  const handleAspectRatioChange = (newAspectRatio: "1:1" | "4:5") => {
    setAspectRatio(newAspectRatio);
    updateDesignProperty('aspect_ratio', newAspectRatio);
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
            chosen_template: carousel.chosen_template,
            cover_style: carousel.cover_style,
            background_color: carousel.background_color,
            text_color: carousel.text_color,
            aspect_ratio: carousel.aspect_ratio,
            accent_color: carousel.accent_color,
            updated_at: new Date().toISOString(),
          })
          .eq("id", carousel.id);

        console.log("Design changes saved:", {
          chosen_template: carousel.chosen_template,
          cover_style: carousel.cover_style,
          background_color: carousel.background_color,
          text_color: carousel.text_color,
          aspect_ratio: carousel.aspect_ratio,
          accent_color: carousel.accent_color,
          updated_at: new Date().toISOString(),
        });

      // Changes saved silently - no toast notification
    } catch (error) {
      toast({
        title: "Error",
        description: "Couldn't save changes",
        variant: "destructive",
      });
    }
  }, 1000),
  [selectedCarousel, toast]
);

  const handleAddNewSlide = () => {
    if (!selectedCarousel) return;
    if (selectedCarousel.id === "welcome-carousel") return;

    const slides = parseSlides(selectedCarousel.slides);
    const newSlide: Slide = {
      index: slides.length,
      title: "New Title",
      body: "New content",
    };

    const updatedSlides = [...slides, newSlide];
    const updatedCarousel = { ...selectedCarousel, slides: updatedSlides };

    setSelectedCarousel(updatedCarousel);
    setCarousels(carousels.map((c) => (c.id === selectedCarousel.id ? updatedCarousel : c)));
    setSelectedSlideIndex(slides.length);

    setTimeout(() => {
      scrollToSlide(slides.length);
    }, 100);

    debouncedSave(updatedCarousel);

    toast({
      title: "New slide added",
      description: "The slide was added successfully",
    });
  };

  const handleDeleteSlide = (index: number) => {
    if (!selectedCarousel) return;
    if (selectedCarousel.id === "welcome-carousel") return;

    const slides = parseSlides(selectedCarousel.slides);
    if (slides.length <= 2) {
      toast({
        title: "Error",
        description: "A carousel must have at least 2 slides",
        variant: "destructive",
      });
      return;
    }

    const newSlides = slides.filter((_, i) => i !== index);
    const updatedCarousel = {
      ...selectedCarousel,
      slides: newSlides.map((slide, i) => ({ ...slide, index: i })),
    };

    setSelectedCarousel(updatedCarousel);
    setCarousels(carousels.map((c) => (c.id === selectedCarousel.id ? updatedCarousel : c)));

    if (selectedSlideIndex >= newSlides.length) {
      setSelectedSlideIndex(newSlides.length - 1);
    }

    debouncedSave(updatedCarousel);
  };

  const handleDuplicateSlide = (index: number) => {
    if (!selectedCarousel) return;
    if (selectedCarousel.id === "welcome-carousel") return;

    const slides = parseSlides(selectedCarousel.slides);
    const slideToDuplicate = slides[index];
    const newSlides = [
      ...slides.slice(0, index + 1),
      { ...slideToDuplicate, index: index + 1 },
      ...slides.slice(index + 1),
    ];

    const updatedCarousel = {
      ...selectedCarousel,
      slides: newSlides.map((slide, i) => ({ ...slide, index: i })),
    };

    setSelectedCarousel(updatedCarousel);
    setCarousels(carousels.map((c) => (c.id === selectedCarousel.id ? updatedCarousel : c)));
    debouncedSave(updatedCarousel);
  };

  const handleExportCarousel = async (carousel: Carousel) => {
    if (!carousel) return;
    setExporting(true);
    try {
      const { toPng } = await import('html-to-image');
      const JSZip = (await import('jszip')).default;
      const { createRoot } = await import('react-dom/client');

      const zip = new JSZip();
      const carouselName = carousel?.carousel_name || "carousel";
      const slides = parseSlides(carousel.slides);
      let failedSlides = 0;

      // Use the carousel's own settings for export
      const carouselTemplate = (carousel.chosen_template as "dark" | "light") || "dark";
      const carouselCoverStyle = (carousel.cover_style as any) || "minimalist";
      const carouselBackgroundColor = carousel.background_color || "#000000";
      const carouselTextColor = carousel.text_color || "#FFFFFF";
      const carouselAccentColor = carousel.accent_color || "#FFFFFF";
      const carouselAspectRatio = (carousel.aspect_ratio as "1:1" | "4:5") || "4:5";

      // Base logical size for rendering (export will be upscaled via pixelRatio)
      const baseWidth = 540; // will become 1080 with pixelRatio: 2
      const baseHeight = carouselAspectRatio === "4:5" ? 675 : 540; // 4:5 -> 540x675, 1:1 -> 540x540

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
              template: carouselTemplate,
              slideNumber: i + 1,
              totalSlides: slides.length,
              coverStyle: carouselCoverStyle,
              backgroundColor: carouselBackgroundColor,
              textColor: carouselTextColor,
              aspectRatio: carouselAspectRatio,
              accentColor: carouselAccentColor,
              slideIndex: i,
              isEditing: false,
              onEditStart: () => {},
              onEditEnd: () => {},
              onUpdateSlide: () => {},
              showSlideNumber: false,
              textDirection: detectTextDirection(slides[i].title + " " + slides[i].body)
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

      const zipBlob = await zip.generateAsync({ type: "blob" });

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${carouselName}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (failedSlides > 0) {
        toast({
          title: "Some slides couldn't be exported",
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
      toast({
        title: "Export failed",
        description: "Please try again or contact support",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleExportSingleSlide = async (slide: Slide, slideIndex: number, carousel: Carousel) => {
    if (!slide || !carousel) return;
    
    let root: any = null;
    let hiddenContainer: HTMLDivElement | null = null;
    try {
      const { toPng } = await import('html-to-image');
      const { createRoot } = await import('react-dom/client');
      const carouselName = carousel?.carousel_name || "carousel";
      const slides = parseSlides(carousel.slides);
      
      // Use the carousel's own settings for export
      const carouselTemplate = (carousel.chosen_template as "dark" | "light") || "dark";
      const carouselCoverStyle = (carousel.cover_style as any) || "minimalist";
      const carouselBackgroundColor = carousel.background_color || "#000000";
      const carouselTextColor = carousel.text_color || "#FFFFFF";
      const carouselAccentColor = carousel.accent_color || "#FFFFFF";
      const carouselAspectRatio = (carousel.aspect_ratio as "1:1" | "4:5") || "4:5";
      
      // Base logical size for rendering (export will be upscaled via pixelRatio)
      const baseWidth = 540; // will become 1080 with pixelRatio: 2
      const baseHeight = carouselAspectRatio === "4:5" ? 675 : 540;
      
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
          slide: slide,
          template: carouselTemplate,
          slideNumber: slideIndex + 1,
          totalSlides: slides.length,
          coverStyle: carouselCoverStyle,
          backgroundColor: carouselBackgroundColor,
          textColor: carouselTextColor,
          aspectRatio: carouselAspectRatio,
          accentColor: carouselAccentColor,
          slideIndex: slideIndex,
          isEditing: false,
          onEditStart: () => {},
          onEditEnd: () => {},
          onUpdateSlide: () => {},
          showSlideNumber: false,
          textDirection: detectTextDirection(slide.title + " " + slide.body)
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
      a.download = `${carouselName}-slide-${slideIndex + 1}.png`;
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
    }
  };

  // Filter carousels based on search
  const filteredCarousels = carousels.filter(carousel =>
    carousel.carousel_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    parseSlides(carousel.slides).some(slide => 
      slide.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      slide.body.toLowerCase().includes(searchQuery.toLowerCase())
    )
  ).sort((a, b) => {
    // Put welcome carousel at the bottom
    if (a.id === 'welcome-carousel') return 1;
    if (b.id === 'welcome-carousel') return -1;
    return 0;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div dir="rtl" className="relative min-h-screen overflow-hidden bg-gradient-to-b from-background to-muted">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-28 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-32 right-10 h-[28rem] w-[28rem] rounded-full bg-accent/20 blur-3xl" />
      </div>
      {/* Header */}
      <header dir="ltr" className="border-b border-border/40 bg-background/80 backdrop-blur-2xl sticky top-0 z-50 shadow-sm">
        <div className="flex items-center justify-between px-6 py-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center shadow-lg shadow-primary/30 ring-1 ring-border/30 backdrop-blur-sm">
              <Palette className="h-5 w-5 text-white/95" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-bold tracking-tight text-primary">
                Post24
              </h1>
            </div>
          </div>
          <Button 
            variant="ghost" 
            onClick={handleSignOut}
            className="h-9 px-4 rounded-lg text-sm font-medium text-muted-foreground/80 hover:text-foreground hover:bg-background/60 transition-all duration-300 ease-out border border-border/30 hover:border-border/50 shadow-sm"
          > 
            Sign Out
          </Button>
        </div>
      </header>

      <div className="flex h-[calc(100vh-53px)] overflow-hidden">
        {/* Bottom Editing Panel */}
        <div dir="ltr" className="w-[320px] flex-shrink-0 border-l border-border/20 bg-[#F3F4F6]/95 backdrop-blur-lg flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
            <div className="flex flex-col gap-4" style={{ marginTop: '60px' }}>
              {/* Template Selection */}
              <div className="flex flex-col space-y-2">
                <label className="text-sm font-semibold text-foreground/90">Template</label>
                <Select
                  value={selectedCarousel ? selectedCarousel.chosen_template || "dark" : "dark"}
                  onValueChange={handleTemplateChange}
                  disabled={!selectedCarousel}
                >
                  <SelectTrigger dir="ltr" className="w-full h-9 rounded-lg border-border/40 bg-background/60 backdrop-blur-sm focus:bg-background/80 focus:border-primary/50 transition-all duration-300 ease-out">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end" dir="ltr" className="border-border/40 bg-background/80 backdrop-blur-xl w-[200px]">
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Background Color */}
              <div className="flex flex-col space-y-2">
                <label className="text-sm font-semibold text-foreground/90">Background</label>
                <ColorPicker
                  color={selectedCarousel ? selectedCarousel.background_color || "#000000" : "#000000"}
                  setColor={handleBackgroundColorChange}
                  title="Background"
                  disabled={!selectedCarousel}
                  showLabel={false}
                />
              </div>

              {/* Text Color */}
              <div className="flex flex-col space-y-2">
                <label className="text-sm font-semibold text-foreground/90">Text</label>
                <ColorPicker
                  color={selectedCarousel ? selectedCarousel.text_color || "#FFFFFF" : "#FFFFFF"}
                  setColor={handleTextColorChange}
                  title="Text"
                  disabled={!selectedCarousel}
                  showLabel={false}
                />
              </div>

              {/* Design Style Selection */}
              <div className="flex flex-col space-y-2">
                <label className="text-sm font-semibold text-foreground/90">Style</label>
                <Select
                  value={selectedCarousel ? selectedCarousel.cover_style || "minimalist" : "minimalist"}
                  onValueChange={handleCoverStyleChange}
                  disabled={!selectedCarousel}
                >
                  <SelectTrigger dir="ltr" className="w-full h-9 rounded-lg border-border/40 bg-background/60 backdrop-blur-sm focus:bg-background/80 focus:border-primary/50 transition-all duration-300 ease-out">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end" dir="ltr" className="border-border/40 bg-background/80 backdrop-blur-xl w-[200px]">
                    <SelectItem value="minimalist">Minimalist</SelectItem>
                    <SelectItem value="big_number">Big Number</SelectItem>
                    <SelectItem value="accent_block">Accent Block</SelectItem>
                    <SelectItem value="gradient_overlay">Gradient</SelectItem>
                    <SelectItem value="geometric">Geometric</SelectItem>
                    <SelectItem value="bold_frame">Bold Frame</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Accent Color */}
              <div className="flex flex-col space-y-2">
                <label className="text-sm font-semibold text-foreground/90">Accent</label>
                <ColorPicker
                  color={selectedCarousel ? selectedCarousel.accent_color || "#FFFFFF" : "#FFFFFF"}
                  setColor={handleAccentColorChange}
                  title="Accent"
                  disabled={!selectedCarousel}
                  showLabel={false}
                />
              </div>

              {/* Aspect Ratio */}
              <div className="flex flex-col space-y-2">
                <label className="text-sm font-semibold text-foreground/90">Aspect Ratio</label>
                <Select
                  value={selectedCarousel ? selectedCarousel.aspect_ratio || "4:5" : "4:5"}
                  onValueChange={handleAspectRatioChange}
                  disabled={!selectedCarousel}
                >
                  <SelectTrigger dir="ltr" className="w-full h-9 rounded-lg border-border/40 bg-background/60 backdrop-blur-sm focus:bg-background/80 focus:border-primary/50 transition-all duration-300 ease-out">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end" dir="ltr" className="border-border/40 bg-background/80 backdrop-blur-xl w-[200px]">
                    <SelectItem value="1:1">1:1 (Square)</SelectItem>
                    <SelectItem value="4:5">4:5 (Portrait)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area - Slide Previews */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#C0C0C0]/80 backdrop-blur-xs overflow-hidden">
          {/* Preview Area */}
          <div className="flex-1 p-4 overflow-auto scrollbar-thin">
            {selectedCarousel ? (
              <div className="h-full flex flex-col">
                {/* Horizontal Slides Container */}
                <div className="flex-1 relative">
                  <div
                    ref={slidesContainerRef}
                    dir="ltr"
                    className="h-full flex items-center gap-4 overflow-x-auto overflow-y-hidden pb-4 px-16 scroll-px-16 scrollbar-hide"
                    style={{ scrollBehavior: 'smooth', msOverflowStyle: 'none', scrollbarWidth: 'none' }}
                  >
                    {parseSlides(selectedCarousel.slides).map((slide, index) => {
                      const visualSlideNumber = index + 1; // 1, 2, 3... based on actual position
                      const isActive = selectedSlideIndex === index;
                      return (
                      <div
                        key={index}
                        data-slide-index={index}
                        className={`flex-shrink-0 relative transition-all duration-slow ease-ios-out cursor-pointer ${
                          isActive 
                            ? "scale-120 opacity-100 z-10" 
                            : "scale-100 opacity-60 hover:opacity-80"
                        } ${draggedSlideIndex === index ? "opacity-50 cursor-grabbing" : ""} ${
                          dragOverSlideIndex === index ? "ring-2 ring-ring/60 ring-offset-2 ring-offset-background" : ""
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
                        <div className={`${isActive ? 'w-[580px] h-[calc(100vh-240px)] max-h-[820px]' : 'w-[400px] h-[calc(100vh-300px)] max-h-[600px]'}`}>
                          <SlidePreview
                            slide={slide}
                            template={selectedCarousel ? (selectedCarousel.chosen_template as "dark" | "light") || "dark" : "dark"}
                            slideNumber={visualSlideNumber}
                            totalSlides={parseSlides(selectedCarousel.slides).length}
                            coverStyle={selectedCarousel ? (selectedCarousel.cover_style as "minimalist" | "big_number" | "accent_block" | "gradient_overlay" | "geometric" | "bold_frame") || "minimalist" : "minimalist"}
                            backgroundColor={selectedCarousel ? selectedCarousel.background_color || "#000000" : "#000000"}
                            textColor={selectedCarousel ? selectedCarousel.text_color || "#FFFFFF" : "#FFFFFF"}
                            aspectRatio={selectedCarousel ? (selectedCarousel.aspect_ratio as "1:1" | "4:5") || "4:5" : "4:5"}
                            accentColor={selectedCarousel ? selectedCarousel.accent_color || "#FFFFFF" : "#FFFFFF"}
                            slideIndex={index}
                            isEditing={isActive && selectedCarousel?.id !== 'welcome-carousel'}
                            onEditStart={() => selectedCarousel?.id !== 'welcome-carousel' && setSelectedSlideIndex(index)}
                            onEditEnd={() => {}}
                            onUpdateSlide={(updates) => selectedCarousel?.id !== 'welcome-carousel' && handleUpdateSlide(index, updates)}
                            showSlideNumber={false}
                            textDirection={detectTextDirection(slide.title + " " + slide.body)}
                          />
                          {/* Slide count below the slide */}
                          <div className="text-center mt-2 text-sm font-medium text-muted-foreground">
                            {visualSlideNumber}/{parseSlides(selectedCarousel.slides).length}
                          </div>
                        </div>
                        
                        {/* Slide Actions */}
                        {isActive && selectedCarousel?.id !== 'welcome-carousel' && (
                          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1">
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleExportSingleSlide(slide, index, selectedCarousel);
                              }}
                              disabled={exporting}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDuplicateSlide(index);
                              }}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSlide(index);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                    })}

                    {/* Add New Slide Button */}
                    {selectedCarousel?.id !== 'welcome-carousel' && (
                      <div className="flex-shrink-0">
                        <button
                          onClick={handleAddNewSlide}
                          className="w-[400px] h-[calc(100vh-300px)] max-h-[600px] rounded-lg border-2 border-dashed border-border bg-card/20 flex items-center justify-center transition-all duration-normal ease-ios-out hover:border-ring/40 hover:bg-card/40 group"
                        >
                          <div className="text-center">
                            <Plus className="w-12 h-12 mx-auto mb-2 text-muted-foreground group-hover:text-foreground transition-colors duration-normal ease-ios-out" />
                            <p className="text-muted-foreground group-hover:text-foreground/80 transition-colors duration-normal ease-ios-out">Add New Slide</p>
                          </div>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Navigation Arrows */}
                  {parseSlides(selectedCarousel.slides).length > 1 && (
                    <>
                      {selectedSlideIndex < parseSlides(selectedCarousel.slides).length - 1 && (
                        <button
                          onClick={() => navigateSlide(1)}
                          className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-background/90 hover:bg-background rounded-full p-2 shadow-lg border border-border transition-all duration-normal ease-ios-out motion-safe:hover:scale-105 z-30"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      )}
                      {selectedSlideIndex > 0 && (
                        <button
                          onClick={() => navigateSlide(-1)}
                          className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-background/90 hover:bg-background rounded-full p-2 shadow-lg border border-border transition-all duration-normal ease-ios-out motion-safe:hover:scale-105 z-30"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center space-y-4">
                  <h3 className="text-xl font-semibold">Select a carousel to edit</h3>
                  <p className="text-muted-foreground">
                    Choose a carousel from the list or create a new one to get started
                  </p>
                  <Button onClick={() => setCreateModalOpen(true)}>
                    <Plus className="ml-2 h-4 w-4" />
                    New Post
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Post Content Panel */}
        <div className={`${isTextPanelCollapsed ? 'w-12' : 'w-[400px]'} flex-shrink-0 border-r border-border/20 bg-[#FAFAFB]/90 backdrop-blur-sm flex flex-col overflow-hidden transition-all duration-300 ease-in-out`}>
          {selectedCarousel ? (
            <div className="flex flex-col overflow-hidden">
              {/* Panel Header with Toggle */}
              <div className="flex items-center justify-end p-3 border-b border-border/20 bg-[#FAFAFB]/80">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsTextPanelCollapsed(!isTextPanelCollapsed)}
                  className="h-8 w-8 p-0 hover:bg-background/60"
                >
                  {isTextPanelCollapsed ? (
                    <span className="text-sm font-bold">«</span>
                  ) : (
                    <span className="text-sm font-bold">»</span>
                  )}
                </Button>
              </div>
              
              {/* Continuous Post Content Area - aligned with first post name */}
              {!isTextPanelCollapsed && (
                <div className="flex-1 overflow-y-auto scrollbar-thin" dir="ltr">
                  {/* Push down to align with post titles - add top margin to match posts panel header height */}
                  <div style={{ marginTop: '120px' }}>
                    <div className="px-3">
                      <h3 className="font-semibold text-base mb-1 text-foreground/95">{(() => {
                          const firstSlide = parseSlides(selectedCarousel.slides)[0];
                          return firstSlide?.title || "Untitled Post";
                        })()}</h3>
                      <div className="flex gap-2 text-xs text-muted-foreground/70 mb-3">
                        <span>{selectedCarousel.content_type === "topic_idea" ? "Generated by Post24" : "Generated by you"}</span>
                        <span>•</span>
                        <span>{(selectedCarousel.post_content || "").trim().split(/\s+/).filter(word => word.length > 0).length} words</span>
                      </div>
                    </div>
                    <div className="px-3 pb-3">
                      <Textarea
                        value={selectedCarousel.post_content || ""}
                        onChange={(e) => {
                          const updatedCarousel = { ...selectedCarousel, post_content: e.target.value };
                          setSelectedCarousel(updatedCarousel);
                          setCarousels(carousels.map(c => c.id === selectedCarousel.id ? updatedCarousel : c));
                          
                          // Save to database
                          updateDesignProperty('post_content', e.target.value);
                        }}
                        placeholder={selectedCarousel.content_type === "topic_idea" 
                          ? "Enter your topic or idea here..." 
                          : "Enter your full post content here..."}
                        className="w-full resize-none border-border/40 bg-[#FFFFFF] focus:bg-[#FFFFFF] focus:border-primary/50 transition-all duration-300 ease-out rounded-xl text-sm leading-relaxed"
                        style={{ textAlign: 'left', direction: 'ltr', minHeight: '800px' }}
                        dir="ltr"
                        disabled={selectedCarousel?.id === 'welcome-carousel'}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* Panel Header with Toggle */}
              <div className="flex items-center justify-end p-3 border-b border-border/20 bg-[#FAFAFB]/80">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsTextPanelCollapsed(!isTextPanelCollapsed)}
                  className="h-8 w-8 p-0 hover:bg-background/60"
                >
                  {isTextPanelCollapsed ? (
                    <span className="text-sm font-bold">«</span>
                  ) : (
                    <span className="text-sm font-bold">»</span>
                  )}
                </Button>
              </div>
              
              {!isTextPanelCollapsed && (
                <div className="h-full flex items-center justify-center p-4">
                  <div className="text-center space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Select a carousel to view and edit its post content
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Panel - Carousel List */}
        <div dir="ltr" className="w-[320px] flex-shrink-0 border-l border-border/20 bg-[#F3F4F6]/95 backdrop-blur-md flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border/30 bg-[#F3F4F6]/60 backdrop-blur-sm text-left" dir="ltr">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[#111827]/90">Posts</h2>
              <span className="text-sm text-[#6B7280]/70 font-medium">
                {profile?.carousel_count || 0}/10
              </span>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
              <Input
                placeholder="Search Post"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 rounded-xl border-border/40 bg-background/60 backdrop-blur-sm focus:bg-background/80 focus:border-primary/50 transition-all duration-300 ease-out text-sm"
              />
            </div>
            <Button
              onClick={() => setCreateModalOpen(true)}
              className="w-full mt-3 h-11 rounded-xl bg-primary/90 hover:bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 ease-out font-medium text-sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Post
            </Button>
          </div>

          
          {/* Carousel List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin">
            {filteredCarousels.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">No carousels found</p>
                <Button
                  onClick={() => setCreateModalOpen(true)}
                  variant="outline"
                  size="sm"
                >
                  <Plus className="ml-2 h-4 w-4" />
                  Create First Post
                </Button>
              </div>
            ) : (
              filteredCarousels.map((carousel, index) => {
                const firstSlide = parseSlides(carousel.slides)[0];
                const isWelcomeCarousel = carousel.id === 'welcome-carousel';
                return (
                  <Card
                    key={carousel.id}
                    className={`mx-3 my-2 p-4 cursor-pointer transition-all duration-300 ease-out border-border/40 bg-[#FAFAFB]/80 backdrop-blur-sm hover:bg-[#FAFAFB] hover:shadow-md hover:shadow-slate-200/60 hover:border-border/60 ${selectedCarousel?.id === carousel.id ? "ring-2 ring-primary/50 bg-[#FAFAFB] border-primary/40 shadow-md shadow-primary/10" : ""} ${isWelcomeCarousel && selectedCarousel?.id !== carousel.id ? 'border-border/30 bg-[#FAFAFB]/70' : ''} ${draggedCarouselIndex === index ? "opacity-50 cursor-grabbing scale-95" : ""} ${dragOverCarouselIndex === index ? "ring-2 ring-primary/50 ring-offset-2 ring-offset-[#F3F4F6]/95 scale-[1.02]" : ""} rounded-xl`}
                    onClick={() => selectCarousel(carousel)}
                    draggable={!isWelcomeCarousel}
                    onDragStart={(e) => !isWelcomeCarousel && handleCarouselDragStart(e, index)}
                    onDragOver={(e) => !isWelcomeCarousel && handleCarouselDragOver(e, index)}
                    onDragLeave={handleCarouselDragLeave}
                    onDrop={(e) => !isWelcomeCarousel && handleCarouselDrop(e, index)}
                    onDragEnd={handleCarouselDragEnd}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="flex gap-1 flex-shrink-0">
                          {!isWelcomeCarousel && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-background/90 backdrop-blur-xl border-border/60 rounded-xl">
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleExportCarousel(carousel);
                                  }}
                                  disabled={exporting}
                                  className="rounded-lg cursor-pointer"
                                >
                                  <Download className="h-4 w-4 mr-2" />
                                  Download
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleRenameCarousel(carousel);
                                  }}
                                  className="rounded-lg cursor-pointer"
                                >
                                  <Edit className="h-4 w-4 mr-2" />
                                  Rename
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleDuplicateCarousel(carousel);
                                  }}
                                  className="rounded-lg cursor-pointer"
                                >
                                  <Copy className="h-4 w-4 mr-2" />
                                  Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleDeleteCarousel(carousel.id);
                                  }}
                                  className="rounded-lg cursor-pointer text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                        <div className="flex-1 min-w-0" style={{ direction: detectTextDirection(firstSlide?.title || "Untitled") }}>
                          <h3 className="font-semibold text-sm mb-1 truncate text-left">
                            {firstSlide?.title || "Untitled"}
                          </h3>
                          <p className="text-xs text-muted-foreground text-left">
                            {parseSlides(carousel.slides).length} slides • {" "}
                            {formatDistanceToNow(new Date(carousel.created_at), {
                              addSuffix: true,
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        {!isWelcomeCarousel && (
                          <div className="text-muted-foreground cursor-grab active:cursor-grabbing">
                            <GripVertical className="h-4 w-4" />
                          </div>
                        )}
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
        <div className="fixed inset-0 bg-background/60 backdrop-blur-xl z-50 flex items-center justify-center p-4">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute -top-32 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
            <div className="absolute -bottom-32 right-10 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
          </div>
          <Card className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-background/70 backdrop-blur-xl border-border/60 shadow-2xl rounded-3xl" dir="ltr">
            <div className="p-8 space-y-8">
              {/* Header */}
              <div className="flex items-center justify-between pb-2">
                <div className="space-y-1">
                  <h2 className="text-3xl font-bold tracking-tight text-foreground">
                    New Post
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Transform your content into a beautiful visual story
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCreateModalOpen(false)}
                  className="h-10 w-10 rounded-full hover:bg-muted/50 transition-all duration-normal ease-ios-out motion-safe:hover:scale-105"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Content Type Section */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-base font-semibold tracking-tight">Content Type</Label>
                  <RadioGroup
                    value={newCarouselContentType}
                    onValueChange={(value) => setNewCarouselContentType(value as "topic_idea" | "full_post")}
                    disabled={creatingCarousel}
                    className="grid grid-cols-1 gap-3"
                  >
                    <div className="group relative rounded-2xl border border-border/60 bg-background/40 p-4 transition-all duration-normal ease-ios-out hover:border-border hover:bg-muted/30 motion-safe:hover:scale-[1.02] cursor-pointer">
                      <div className="flex items-start space-x-3">
                        <RadioGroupItem value="topic_idea" id="topic_idea" className="mt-1" />
                        <div className="flex-1 space-y-1">
                          <label htmlFor="topic_idea" className="text-sm font-semibold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                            Topic or idea
                          </label>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            1-2 sentences about a topic or idea that will be developed into a post. The key messages should be in the carousel slides.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="group relative rounded-2xl border border-border/60 bg-background/40 p-4 transition-all duration-normal ease-ios-out hover:border-border hover:bg-muted/30 motion-safe:hover:scale-[1.02] cursor-pointer">
                      <div className="flex items-start space-x-3">
                        <RadioGroupItem value="full_post" id="full_post" className="mt-1" />
                        <div className="flex-1 space-y-1">
                          <label htmlFor="full_post" className="text-sm font-semibold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                            Full post
                          </label>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            Complete post content. No post development needed - key messages should go directly into carousel slides.
                          </p>
                        </div>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                {/* Content Input */}
                <div className="space-y-2">
                  <Label className="text-base font-semibold tracking-tight">
                    {newCarouselContentType === "topic_idea" ? "Topic or Idea" : "Full Post Content"}
                  </Label>
                  <Textarea
                    placeholder={newCarouselContentType === "topic_idea" 
                      ? "Enter 1-2 sentences describing your topic or idea..." 
                      : "Paste your complete post content here..."}
                    value={newCarouselText}
                    onChange={(e) => setNewCarouselText(e.target.value)}
                    className="min-h-[180px] text-base resize-none bg-background/60 border-border/60 rounded-2xl px-4 py-3 transition-all duration-normal ease-ios-out focus:bg-background/80 focus:border-primary/50"
                    disabled={creatingCarousel}
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {newCarouselText.trim().split(/\s+/).filter(word => word.length > 0).length} words
                    </p>
                    {newCarouselText.trim().split(/\s+/).filter(word => word.length > 0).length > 300 && (
                      <p className="text-xs text-amber-600">
                        Consider keeping content concise for better engagement
                      </p>
                    )}
                  </div>
                </div>

                {/* Settings Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-carousel-content-purpose" className="text-base font-semibold tracking-tight">Content Purpose</Label>
                    <Select
                      value={newCarouselContentPurpose}
                      onValueChange={setNewCarouselContentPurpose}
                      disabled={creatingCarousel}
                    >
                      <SelectTrigger id="new-carousel-content-purpose" className="bg-background/60 border-border/60 rounded-2xl px-4 py-3 transition-all duration-normal ease-ios-out focus:bg-background/80 focus:border-primary/50" dir="ltr">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent align="end" dir="ltr" className="bg-background/90 backdrop-blur-xl border-border/60 rounded-2xl">
                        <SelectItem value="awareness" className="rounded-xl">Awareness → 25–75 words</SelectItem>
                        <SelectItem value="thought_leadership" className="rounded-xl">Thought leadership or storytelling → 100–300 words</SelectItem>
                        <SelectItem value="opinion" className="rounded-xl">Opinion or conversation starter → &lt;20 words</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="new-carousel-style" className="text-base font-semibold tracking-tight">Content Style</Label>
                    <Select value={newCarouselStyle} onValueChange={setNewCarouselStyle} disabled={creatingCarousel}>
                      <SelectTrigger id="new-carousel-style" className="bg-background/60 border-border/60 rounded-2xl px-4 py-3 transition-all duration-normal ease-ios-out focus:bg-background/80 focus:border-primary/50" dir="ltr">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent align="end" dir="ltr" className="bg-background/90 backdrop-blur-xl border-border/60 rounded-2xl">
                        <SelectItem value="Professional" className="rounded-xl">Professional</SelectItem>
                        <SelectItem value="Storytelling" className="rounded-xl">Storytelling</SelectItem>
                        <SelectItem value="Educational" className="rounded-xl">Educational</SelectItem>
                        <SelectItem value="List / Tips" className="rounded-xl">List / Tips</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Cover Style */}
                <div className="space-y-2">
                  <Label htmlFor="new-carousel-cover-style" className="text-base font-semibold tracking-tight">Cover Style</Label>
                  <Select
                    value={newCarouselCoverStyle}
                    onValueChange={(value) =>
                      setNewCarouselCoverStyle(
                        value as "minimalist" | "big_number" | "accent_block" | "gradient_overlay" | "geometric" | "bold_frame",
                      )
                    }
                    disabled={creatingCarousel}
                  >
                    <SelectTrigger id="new-carousel-cover-style" className="bg-background/60 border-border/60 rounded-2xl px-4 py-3 transition-all duration-normal ease-ios-out focus:bg-background/80 focus:border-primary/50" dir="ltr">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="end" dir="ltr" className="bg-background/90 backdrop-blur-xl border-border/60 rounded-2xl">
                      <SelectItem value="minimalist" className="rounded-xl">Minimalist</SelectItem>
                      <SelectItem value="big_number" className="rounded-xl">Big Number</SelectItem>
                      <SelectItem value="accent_block" className="rounded-xl">Accent Block</SelectItem>
                      <SelectItem value="gradient_overlay" className="rounded-xl">Gradient</SelectItem>
                      <SelectItem value="geometric" className="rounded-xl">Geometric</SelectItem>
                      <SelectItem value="bold_frame" className="rounded-xl">Bold Frame</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setCreateModalOpen(false)}
                  disabled={creatingCarousel}
                  className="flex-1 h-12 rounded-2xl border-border/60 bg-background/40 hover:bg-muted/50 transition-all duration-normal ease-ios-out text-base font-medium"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateCarousel}
                  disabled={creatingCarousel || !newCarouselText.trim()}
                  className="flex-1 h-12 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-normal ease-ios-out shadow-lg hover:shadow-xl motion-safe:hover:scale-[1.02] text-base font-medium"
                >
                  {creatingCarousel ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating carousel...
                    </>
                  ) : (
                    "Create New Post"
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Export Loading Overlay */}
      {exporting && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <Card className="p-8 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-lg font-semibold">Exporting...</p>
            <p className="text-sm text-muted-foreground mt-2">This may take a few seconds</p>
          </Card>
        </div>
      )}

      {/* Rename Dialog */}
      <Dialog open={renameModalOpen} onOpenChange={setRenameModalOpen}>
        <DialogContent className="bg-background/95 backdrop-blur-xl border-border/60 rounded-2xl max-w-md mx-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Rename Post</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="post-name" className="text-sm font-medium">
                Post Title
              </Label>
              <Input
                id="post-name"
                value={newPostName}
                onChange={(e) => setNewPostName(e.target.value)}
                placeholder="Enter post title..."
                className="border-border/60 bg-background/40 focus:bg-background/60 transition-all duration-normal ease-ios-out"
                autoFocus
              />
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setRenameModalOpen(false);
                setRenamingCarousel(null);
                setNewPostName("");
              }}
              className="flex-1 h-10 rounded-xl border-border/60 bg-background/40 hover:bg-muted/50 transition-all duration-normal ease-ios-out"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmRename}
              disabled={!newPostName.trim()}
              className="flex-1 h-10 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-normal ease-ios-out shadow-lg hover:shadow-xl motion-safe:hover:scale-[1.02]"
            >
              Rename
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
