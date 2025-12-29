import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash, Trash2, Plus, Search, Download, Edit, Copy, X, ChevronLeft, ChevronRight, Palette, GripVertical, MoreVertical } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { debounce } from "lodash";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
  text_evolution?: {
    current: 'awareness' | 'discussion' | 'storytelling';
    versions: {
      awareness?: string;
      discussion?: string;
      storytelling?: string;
    };
  } | null;
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
  
  // Independent indexing for each visual category
  const [visualSlideIndexes, setVisualSlideIndexes] = useState<{[key: string]: {
    carousel: number;
    photo: number;
    video: number;
  }}>({});
  
  // Helper functions for independent visual indexing
  const getVisualIndex = (carouselId: string, visualType: 'carousel' | 'photo' | 'video'): number => {
    return visualSlideIndexes[carouselId]?.[visualType] || 0;
  };
  
  const setVisualIndex = (carouselId: string, visualType: 'carousel' | 'photo' | 'video', index: number) => {
    setVisualSlideIndexes(prev => ({
      ...prev,
      [carouselId]: {
        ...prev[carouselId],
        [visualType]: index
      }
    }));
  };
  
  const getMaxIndex = (visualType: 'carousel' | 'photo' | 'video'): number => {
    switch (visualType) {
      case 'carousel':
        return selectedCarousel ? Math.max(0, parseSlides(selectedCarousel.slides).length - 1) : 0;
      case 'photo':
        return 2; // Assuming 3 photos (0, 1, 2)
      case 'video':
        return 1; // Assuming 2 videos (0, 1)
      default:
        return 0;
    }
  };
  
  const navigateVisualSlide = (carouselId: string, visualType: 'carousel' | 'photo' | 'video', direction: number) => {
    const currentIndex = getVisualIndex(carouselId, visualType);
    const maxIndex = getMaxIndex(visualType);
    const newIndex = Math.max(0, Math.min(currentIndex + direction, maxIndex));
    setVisualIndex(carouselId, visualType, newIndex);
  };
  
  const [isNewUser, setIsNewUser] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  
  // Create modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newCarouselText, setNewCarouselText] = useState("");
  const [creatingCarousel, setCreatingCarousel] = useState(false);
  const [creatingCarouselPhase, setCreatingCarouselPhase] = useState("Working on your idea");
  
  // Text expansion state
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());
  
  // Post evolution state
  const [postTextEvolution, setPostTextEvolution] = useState<{[key: string]: {
    current: 'awareness' | 'discussion' | 'storytelling';
    versions: {
      awareness?: string;
      discussion?: string;
      storytelling?: string;
    };
  }}>({});
  
  const [postVisualEvolution, setPostVisualEvolution] = useState<{[key: string]: 'carousel' | 'photo' | 'video'}>({});
  
  // Loading state for text evolution
  const [isEvolvingText, setIsEvolvingText] = useState(false);
  
  // Handle text evolution with OpenAI generation and database storage
  const handleTextEvolution = async (carouselId: string, targetType: 'discussion' | 'storytelling') => {
    const evolution = postTextEvolution[carouselId] || { current: 'awareness', versions: {} };
    
    // Check if we already have this version cached
    if (evolution.versions[targetType]) {
      // Use cached version
      setPostTextEvolution(prev => ({
        ...prev,
        [carouselId]: {
          ...evolution,
          current: targetType
        }
      }));
      return;
    }
    
    // Set loading state
    setIsEvolvingText(true);
    
    // Generate new version using the working Supabase Edge Function
    try {
      const originalContent = selectedCarousel.post_content;
      if (!originalContent) return;
      
      let prompt: string;
      
      if (targetType === 'discussion') {
        prompt = `Create a discussion-style social media post of exactly 20-25 words. Make it conversational and end with a question.

Topic: ${originalContent}

Requirements:
- Exactly 20-25 words
- Conversational tone
- End with a question
- Engaging and thought-provoking

Create a single slide with this exact post content as the body.`;
      } else {
        prompt = `Create a thought leadership post of 150-250 words for LinkedIn. Make it professional and insightful.

Topic: ${originalContent}

Requirements:
- 150-250 words
- Professional tone
- Valuable insights
- Well-structured paragraphs
- Actionable takeaways

Create a single slide with this exact post content as the body.`;
      }
      
      // Use the working generate-slides function
      const { data, error } = await supabase.functions.invoke("generate-slides", {
        body: {
          text: prompt,
          style: "Professional",
          language: "en",
          content_type: "full_post",
          content_purpose: "thought_leadership",
        },
      });

      if (error) throw error;

      // Extract the generated content from the slide body
      let generatedContent = data?.slides?.[0]?.body?.trim();
      
      // Clean up and validate the content
      if (generatedContent) {
        // Remove any slide formatting or quotes
        generatedContent = generatedContent
          .replace(/^["']|["']$/g, '') // Remove surrounding quotes
          .replace(/^(Slide|Slide \d+|Body):?\s*/i, '') // Remove slide prefixes
          .trim();
        
        // For discussion posts, ensure word count is close to target
        if (targetType === 'discussion') {
          const wordCount = generatedContent.split(/\s+/).length;
          if (wordCount < 15 || wordCount > 35) {
            // Fallback if word count is way off
            const words = originalContent.split(' ').slice(0, 8).join(' ');
            generatedContent = `${words}? What are your thoughts on this?`;
          }
        }
        
        // For storytelling posts, ensure reasonable length
        if (targetType === 'storytelling') {
          const wordCount = generatedContent.split(/\s+/).length;
          if (wordCount < 100) {
            // Fallback if too short
            generatedContent = `${originalContent}

This topic deserves deeper exploration. From my perspective, the key insights involve understanding both the immediate implications and long-term impact. When we consider the broader context, it becomes clear that this represents a significant opportunity for growth and innovation.

The question is: how can we best leverage this understanding to create meaningful change? By approaching this strategically, we can unlock new possibilities and drive sustainable progress.

What's your experience with this topic? I'd love to hear your insights and learn from different perspectives.`;
          }
        }
      }
      
      if (generatedContent) {
        // Update local state
        const newEvolution = {
          ...evolution,
          current: targetType,
          versions: {
            ...evolution.versions,
            [targetType]: generatedContent,
            awareness: evolution.versions.awareness || originalContent
          }
        };
        
        setPostTextEvolution(prev => ({
          ...prev,
          [carouselId]: newEvolution
        }));
        
        // Skip database save for now since column doesn't exist
        console.log('Text evolution updated locally (database save skipped)');
      }
    } catch (error) {
      console.error('Error generating text variation:', error);
      // Fallback to simple text transformation
      const originalContent = selectedCarousel.post_content || '';
      
      let fallbackContent: string;
      if (targetType === 'discussion') {
        const words = originalContent.split(' ').slice(0, 8).join(' ');
        fallbackContent = `${words}? What are your thoughts on this?`;
      } else {
        fallbackContent = `${originalContent}

This topic deserves deeper exploration. From my perspective, the key insights involve understanding both the immediate implications and long-term impact. When we consider the broader context, it becomes clear that this represents a significant opportunity for growth and innovation.

The question is: how can we best leverage this understanding to create meaningful change? By approaching this strategically, we can unlock new possibilities and drive sustainable progress.

What's your experience with this topic? I'd love to hear your insights and learn from different perspectives.`;
      }
      
      const newEvolution = {
        ...evolution,
        current: targetType,
        versions: {
          ...evolution.versions,
          [targetType]: fallbackContent,
          awareness: evolution.versions.awareness || originalContent
        }
      };
      
      setPostTextEvolution(prev => ({
        ...prev,
        [carouselId]: newEvolution
      }));
    } finally {
      setIsEvolvingText(false);
    }
  };
  
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

// Function to detect topic type and generate appropriate content
const detectTopicType = (text: string): 'person' | 'concept' | 'general' => {
  const lowerText = text.toLowerCase();
  
  // Check if it's about a person (name detection)
  const personIndicators = [
    'who is', 'about', 'want to know more about', 'tell me about',
    'biography', 'career', 'life of', 'story of'
  ];
  
  // Check for common name patterns (simple heuristic)
  const hasNamePattern = /\b[A-Z][a-z]+ [A-Z][a-z]+\b/.test(text) || 
                         /\b(max|lewis|charles|fernando|sebastian|kimi|michael|ayrton)\b/i.test(text);
  
  if (personIndicators.some(indicator => lowerText.includes(indicator)) || hasNamePattern) {
    return 'person';
  }
  
  // Check if it's about a business concept
  const conceptIndicators = [
    'strategy', 'leadership', 'management', 'marketing', 'sales',
    'productivity', 'innovation', 'digital', 'technology', 'business'
  ];
  
  if (conceptIndicators.some(indicator => lowerText.includes(indicator))) {
    return 'concept';
  }
  
  return 'general';
};

// Function to generate concise post based on topic type (25-75 words)
const generateConcisePost = (topic: string): string => {
  const topicType = detectTopicType(topic);
  const cleanTopic = topic.replace(/^(i want to know more about|tell me about|who is|about)\s+/i, '').trim();
  
  if (topicType === 'person') {
    // Generate content about a person (25-75 words)
    return `Let's explore the remarkable journey of ${cleanTopic}. This individual has made significant contributions that have inspired and influenced many in their field. Their story demonstrates exceptional dedication and perseverance. What aspects of ${cleanTopic}'s journey do you find most inspiring?`;
  }
  
  if (topicType === 'concept') {
    // Generate content about a business concept (25-75 words)
    return `${cleanTopic} has become increasingly important in today's professional landscape. Understanding its core principles can transform how we approach modern challenges and opportunities. The key benefits include improved efficiency, strategic thinking, and better outcomes. How have you encountered ${cleanTopic} in your work?`;
  }
  
  // Generate general content (25-75 words)
  return `Exploring ${cleanTopic} opens up fascinating possibilities for growth and learning. This topic offers valuable insights that can benefit both personal and professional development. The opportunity lies in understanding different perspectives and approaches. What's your experience with ${cleanTopic}? I'm curious to hear your thoughts.`;
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
    setCreatingCarouselPhase("Working on your idea");
    
    // Start loading phase progression
    const phaseTimeout1 = setTimeout(() => {
      setCreatingCarouselPhase("Creating the post");
    }, 1000);
    
    const phaseTimeout2 = setTimeout(() => {
      setCreatingCarouselPhase("Creating a carousel");
    }, 2000);
    
    try {
      const language = detectLanguage(newCarouselText);
      const wordCount = newCarouselText.trim().split(/\s+/).filter(word => word.length > 0).length;
      
      // Smart content processing
      let finalPostContent: string;
      let contentType: "topic_idea" | "full_post";
      let processedText: string;
      
      if (wordCount < 25) {
        // Short text: develop into a post of 25-75 words
        contentType = "topic_idea";
        // Generate a concise post from the description (25-75 words)
        finalPostContent = generateConcisePost(newCarouselText);
        // Send the generated post to the API to create essence slides
        processedText = finalPostContent;
      } else {
        // Long text: use as is and create essence slides
        contentType = "full_post";
        processedText = newCarouselText;
        finalPostContent = newCarouselText;
      }
      
      // Prepare the request
      const requestBody = {
        text: processedText,
        style: "Professional",
        language,
        content_type: contentType,
        content_purpose: "thought_leadership",
      };
      
      const { data, error } = await supabase.functions.invoke("generate-slides", {
        body: requestBody,
      });

      if (error) throw error;

      // Create essence slides
      let essenceSlides: any[];
      essenceSlides = data.slides && data.slides.length > 0 ? data.slides : createEssenceSlidesFromPost(finalPostContent, "Professional");

      const { data: carousel, error: insertError } = await supabase
        .from("carousels")
        .insert({
          user_id: user.id,
          original_text: processedText,
          slides: essenceSlides,  // These are essence slides
          chosen_template: "dark",
          cover_style: "minimalist",
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
        setStoredContentType(firstCarousel.id, contentType);
        
        selectCarousel({
          ...firstCarousel,
          slides: parseSlides(firstCarousel.slides),
          content_type: contentType,
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
      // Clear timeouts if they haven't fired yet
      clearTimeout(phaseTimeout1);
      clearTimeout(phaseTimeout2);
      setCreatingCarousel(false);
      setCreatingCarouselPhase("Working on your idea");
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
    <div dir="rtl" className="relative min-h-screen overflow-hidden bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 md:px-6 py-4 flex items-center justify-between h-[53px]">
        {/* Left side - Sign out at extreme edge */}
        <Button 
          variant="ghost" 
          onClick={handleSignOut}
          className="h-9 px-4 rounded-lg text-sm font-medium text-muted-foreground/80 hover:text-foreground hover:bg-background/60 transition-all duration-300 ease-out border border-border/30 hover:border-border/50 shadow-sm"
        > 
          Sign Out
        </Button>
        
        {/* Center - Mobile title (hidden on desktop) */}
        <div className="md:hidden flex items-center justify-center flex-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center shadow-lg shadow-primary/30">
              <Palette className="h-4 w-4 text-white/95" />
            </div>
            <h1 className="text-lg font-bold tracking-tight text-primary">
              Post24
            </h1>
          </div>
        </div>
        
        {/* Center - Empty space for gap + feed (desktop only) */}
        <div className="hidden md:flex flex-1"></div>
        
        {/* Right side - Logo positioned above Posts title */}
        <div className="hidden md:flex w-[280px] flex-shrink-0 items-center gap-3 justify-end">
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
        </div>
      </header>

      <div className="flex h-[calc(100vh-53px)] overflow-hidden justify-center">
        <div className="flex gap-4 max-w-7xl w-full px-4 md:px-6 justify-center">
          {/* Main Content Area - Vertical Feed View */}
          <div className="w-full lg:max-w-2xl flex flex-col min-w-0 overflow-hidden">
            {/* Preview Area - Vertical Feed */}
            <div className="flex-1 overflow-auto scrollbar-hide py-4" id="posts-feed-container">
              {/* Compact New Post Input at Top of Feed */}
              <div className="mb-4">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="space-y-3">
                    <Textarea
                      placeholder="Start here with an idea or a post"
                      value={newCarouselText}
                      onChange={(e) => setNewCarouselText(e.target.value)}
                      className="border-gray-200 bg-gray-50 focus:bg-white focus:border-gray-300 transition-all duration-200 text-sm resize-none min-h-[40px] max-h-[200px] overflow-hidden"
                      style={{ direction: 'ltr' }}
                      disabled={creatingCarousel}
                      rows={1}
                      onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = 'auto';
                        target.style.height = `${target.scrollHeight}px`;
                      }}
                    />
                    <Button
                      onClick={handleCreateCarousel}
                      disabled={creatingCarousel || !newCarouselText.trim()}
                      className="w-full h-10 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all duration-200 font-medium text-sm"
                    >
                      {creatingCarousel ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {creatingCarouselPhase}
                        </>
                      ) : (
                        "Hit Me"
                      )}
                    </Button>
                  </div>
                </div>
              </div>
              
              {filteredCarousels.length > 0 ? (
                <div className="w-full space-y-4">
                  {filteredCarousels.map((carousel) => {
                    const isSelected = selectedCarousel?.id === carousel.id;
                    return (
                      <div 
                        key={carousel.id}
                        id={`post-${carousel.id}`}
                        className={`transition-all duration-300 rounded-lg ${
                          isSelected ? 'ring-1 ring-blue-400/30 shadow-lg shadow-blue-500/10 bg-blue-50/20' : ''
                        }`}
                        onClick={() => selectCarousel(carousel)}
                      >
                        {/* Single Unified Post View - LinkedIn-style */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden w-full cursor-pointer hover:shadow-md transition-shadow">
                                                
                        {/* Text Section */}
                        <div className="px-6 py-5">
                          <div className="text-gray-900 leading-relaxed whitespace-pre-wrap text-base" style={{ textAlign: 'left', direction: 'ltr' }}>
                            {(() => {
                              const evolution = postTextEvolution[carousel.id] || { current: 'awareness', versions: {} };
                              const postContent = evolution.versions[evolution.current] || carousel.post_content || "No post content available.";
                              const isExpanded = expandedPosts.has(carousel.id);
                              
                              if (postContent === "No post content available.") {
                                return (
                                  <>
                                    <span className="text-gray-400">No post content available.</span>
                                  </>
                                );
                              }
                              
                              const paragraphs = postContent.split('\n\n').filter(p => p.trim());
                              
                              if (paragraphs.length <= 2 || isExpanded) {
                                return (
                                  <>
                                    {paragraphs.map((paragraph, index) => (
                                      <span key={index}>
                                        {paragraph}
                                        {index < paragraphs.length - 1 && '\n\n'}
                                      </span>
                                    ))}
                                  </>
                                );
                              } else {
                                const visibleParagraphs = paragraphs.slice(0, 2);
                                const hiddenParagraphs = paragraphs.slice(2);
                                
                                return (
                                  <>
                                    {visibleParagraphs.map((paragraph, index) => (
                                      <span key={index}>
                                        {paragraph}
                                        {index < visibleParagraphs.length - 1 && '\n\n'}
                                      </span>
                                    ))}
                                    <span 
                                      className="text-gray-400 cursor-pointer hover:text-gray-600 inline-block"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setExpandedPosts(prev => new Set([...prev, carousel.id]));
                                      }}
                                    >
                                      {' ...Show more'}
                                    </span>
                                  </>
                                );
                              }
                            })() as React.ReactNode}
                          </div>
                        </div>
                        
                        {/* Text Directional Hints - Only for selected post */}
                        {isSelected && carousel.post_content && carousel.post_content !== "No post content available." && (
                          <div className="px-6 pb-3">
                            <div className="flex justify-between items-center text-sm font-medium">
                              <div 
                                className="cursor-pointer text-blue-500 hover:text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-all duration-200 flex items-center gap-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const current = postTextEvolution[carousel.id]?.current || 'awareness';
                                  if (current === 'discussion') {
                                    setPostTextEvolution(prev => ({
                                      ...prev,
                                      [carousel.id]: {
                                        current: 'awareness',
                                        versions: prev[carousel.id]?.versions || {}
                                      }
                                    }));
                                  } else if (current === 'awareness') {
                                    if (!isEvolvingText) {
                                      handleTextEvolution(carousel.id, 'storytelling');
                                    }
                                  }
                                }}
                              >
                                {(postTextEvolution[carousel.id]?.current || 'awareness') === 'awareness' || 
                                 (postTextEvolution[carousel.id]?.current || 'awareness') === 'discussion' ? 'Longer post →' : ''}
                              </div>
                              <div 
                                className="cursor-pointer text-blue-500 hover:text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-all duration-200 flex items-center gap-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const current = postTextEvolution[carousel.id]?.current || 'awareness';
                                  if (current === 'storytelling') {
                                    setPostTextEvolution(prev => ({
                                      ...prev,
                                      [carousel.id]: {
                                        current: 'awareness',
                                        versions: prev[carousel.id]?.versions || {}
                                      }
                                    }));
                                  } else if (current === 'awareness') {
                                    if (!isEvolvingText) {
                                      handleTextEvolution(carousel.id, 'discussion');
                                    }
                                  }
                                }}
                              >
                                {(postTextEvolution[carousel.id]?.current || 'awareness') === 'awareness' || 
                                 (postTextEvolution[carousel.id]?.current || 'awareness') === 'storytelling' ? '← Shorter post' : ''}
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* Visual Section - Carousel with Navigation */}
                        <div className="px-6 pb-6">
                            <div className="flex justify-center items-center gap-3">
                              {/* Right Arrow - Now on left side */}
                              <div className="w-8 flex justify-center">
                                {(() => {
                                  const currentVisual = postVisualEvolution[carousel.id] || 'photo';
                                  const currentIndex = getVisualIndex(carousel.id, currentVisual);
                                  const maxIndex = getMaxIndex(currentVisual);
                                  
                                  return maxIndex > 0 && currentIndex < maxIndex && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigateVisualSlide(carousel.id, currentVisual, 1);
                                      }}
                                      className="bg-gray-100/80 hover:bg-gray-200/80 rounded-full p-1.5 transition-all duration-200 ease-out"
                                    >
                                      <ChevronRight className="w-4 h-4 text-gray-500" />
                                    </button>
                                  );
                                })() as React.ReactNode}
                              </div>
                              
                              {/* Visual Content */}
                              <div className="w-full max-w-md relative">
                                {(() => {
                                  const currentVisual = postVisualEvolution[carousel.id] || 'photo';
                                  
                                  if (currentVisual === 'photo') {
                                    // Photo placeholder with index
                                    const photoIndex = getVisualIndex(carousel.id, 'photo');
                                    const photoLabels = ['Photo 1', 'Photo 2', 'Photo 3'];
                                    const photoEmojis = ['🏞️', '🎨', '📸'];
                                    
                                    return (
                                      <div className="relative bg-gray-200 rounded-lg overflow-hidden" style={{ aspectRatio: '5/4' }}>
                                        <div className="h-full flex items-center justify-center">
                                          <div className="text-center">
                                            <div className="w-16 h-16 bg-gray-300 rounded-full mx-auto mb-2 flex items-center justify-center">
                                              <span className="text-gray-500 text-2xl">{photoEmojis[photoIndex] || '📷'}</span>
                                            </div>
                                            <p className="text-gray-500 text-sm">{photoLabels[photoIndex] || 'Photo placeholder'}</p>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  } else if (currentVisual === 'video') {
                                    // Video placeholder with index
                                    const videoIndex = getVisualIndex(carousel.id, 'video');
                                    const videoLabels = ['Video 1', 'Video 2'];
                                    const videoEmojis = ['🎬', '🎥'];
                                    
                                    return (
                                      <div className="relative bg-gray-200 rounded-lg overflow-hidden" style={{ aspectRatio: '5/4' }}>
                                        <div className="h-full flex items-center justify-center">
                                          <div className="text-center">
                                            <div className="w-16 h-16 bg-gray-300 rounded-full mx-auto mb-2 flex items-center justify-center">
                                              <span className="text-gray-500 text-2xl">{videoEmojis[videoIndex] || '▶️'}</span>
                                            </div>
                                            <p className="text-gray-500 text-sm">{videoLabels[videoIndex] || 'Video placeholder'}</p>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  } else {
                                    // Default carousel
                                    return (
                                      <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '5/4' }}>
                                        {/* Show current slide */}
                                        {(() => {
                                  const currentVisual = postVisualEvolution[carousel.id] || 'photo';
                                  const currentIndex = getVisualIndex(carousel.id, currentVisual);
                                  
                                  if (currentVisual === 'carousel' && parseSlides(carousel.slides).length > 0) {
                                    return (
                                      <div className="h-full flex items-center justify-center p-8">
                                        <div className="text-center" style={{ textAlign: 'left', direction: 'ltr' }}>
                                          <h3 className="text-xl font-bold mb-4" style={{ 
                                            color: '#FFFFFF',
                                            backgroundColor: '#000000',
                                            textAlign: 'left'
                                          }}>
                                            {parseSlides(carousel.slides)[currentIndex]?.title || "Untitled"}
                                          </h3>
                                          <p className="text-base leading-relaxed" style={{ 
                                            color: '#FFFFFF',
                                            backgroundColor: '#000000',
                                            textAlign: 'left'
                                          }}>
                                            {parseSlides(carousel.slides)[currentIndex]?.body || ""}
                                          </p>
                                        </div>
                                      </div>
                                    );
                                  }
                                  
                                  return null;
                                })() as React.ReactNode}
                                        
                                        {/* Slide Counter - Bottom Left */}
                                        {(() => {
                                          const currentVisual = postVisualEvolution[carousel.id] || 'photo';
                                          const currentIndex = getVisualIndex(carousel.id, currentVisual);
                                          const maxIndex = getMaxIndex(currentVisual);
                                          
                                          return maxIndex > 0 && (
                                            <div className="absolute bottom-4 left-4 text-white/60 text-xs font-medium">
                                              {currentIndex + 1}/{maxIndex + 1}
                                            </div>
                                          );
                                        })() as React.ReactNode}
                                      </div>
                                    );
                                  }
                                })()}
                              </div>
                              
                              {/* Left Arrow - Now on right side */}
                              <div className="w-8 flex justify-center">
                                {(() => {
                                  const currentVisual = postVisualEvolution[carousel.id] || 'photo';
                                  const currentIndex = getVisualIndex(carousel.id, currentVisual);
                                  
                                  return currentIndex > 0 && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigateVisualSlide(carousel.id, currentVisual, -1);
                                      }}
                                      className="bg-gray-100/80 hover:bg-gray-200/80 rounded-full p-1.5 transition-all duration-200 ease-out"
                                    >
                                      <ChevronRight className="w-4 h-4 text-gray-500 rotate-180" />
                                    </button>
                                  );
                                })() as React.ReactNode}
                              </div>
                            </div>
                            
                            {/* Visual Evolution Controls - iOS6 Glass Effect */}
                            <div className="flex justify-center gap-2 mt-4">
                              <button 
                                className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 backdrop-blur-sm ${
                                  (postVisualEvolution[carousel.id] || 'photo') === 'video' 
                                    ? 'bg-gray-900/10 text-gray-900 border border-gray-200/50' 
                                    : 'bg-white/60 text-gray-600 border border-gray-200/30 hover:bg-white/80 hover:text-gray-800'
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPostVisualEvolution(prev => ({
                                    ...prev,
                                    [carousel.id]: 'video'
                                  }));
                                }}
                              >
                                Video
                              </button>
                              <button 
                                className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 backdrop-blur-sm ${
                                  (postVisualEvolution[carousel.id] || 'photo') === 'photo' 
                                    ? 'bg-gray-900/10 text-gray-900 border border-gray-200/50' 
                                    : 'bg-white/60 text-gray-600 border border-gray-200/30 hover:bg-white/80 hover:text-gray-800'
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPostVisualEvolution(prev => ({
                                    ...prev,
                                    [carousel.id]: 'photo'
                                  }));
                                }}
                              >
                                Photo
                              </button>
                              <button 
                                className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 backdrop-blur-sm ${
                                  (postVisualEvolution[carousel.id] || 'photo') === 'carousel' 
                                    ? 'bg-gray-900/10 text-gray-900 border border-gray-200/50' 
                                    : 'bg-white/60 text-gray-600 border border-gray-200/30 hover:bg-white/80 hover:text-gray-800'
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPostVisualEvolution(prev => ({
                                    ...prev,
                                    [carousel.id]: 'carousel'
                                  }));
                                }}
                              >
                                Carousel
                              </button>
                            </div>
                        </div>
                      </div>
                    </div>
                  );
                  })}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center space-y-4">
                    <h3 className="text-xl font-semibold">No posts yet</h3>
                    <p className="text-muted-foreground">
                      Create your first post to get started
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

        {/* Posts Panel - Aligned with Post Height */}
          <div dir="ltr" className="hidden lg:block w-[280px] flex-shrink-0 overflow-hidden">
            <div className="h-full flex flex-col py-4">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">
                <div className="p-4 border-b border-gray-100 text-left">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Posts</h2>
                  <span className="text-sm text-gray-500 font-medium">
                    {profile?.carousel_count || 0}/10
                  </span>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search Post"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-10 rounded-lg border-gray-200 bg-gray-50 focus:bg-white focus:border-gray-300 transition-all duration-200 text-sm"
                  />
                </div>
              </div>

              {/* Carousel List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin">
            {filteredCarousels.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No carousels found</p>
              </div>
            ) : (
              filteredCarousels.map((carousel, index) => {
                const firstSlide = parseSlides(carousel.slides)[0];
                const isWelcomeCarousel = carousel.id === 'welcome-carousel';
                
                return (
                  <div
                    key={carousel.id}
                    className={`relative group cursor-pointer transition-all duration-200 ${
                      selectedCarousel?.id === carousel.id 
                        ? 'ring-2 ring-blue-500 bg-blue-50' 
                        : 'hover:bg-gray-50'
                    } rounded-lg p-3 border border-gray-200`}
                    onClick={() => {
                      selectCarousel(carousel);
                      // Scroll to the post in the feed
                      setTimeout(() => {
                        const postElement = document.getElementById(`post-${carousel.id}`);
                        if (postElement) {
                          postElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                      }, 100);
                    }}
                    draggable
                    onDragStart={(e) => handleCarouselDragStart(e, index)}
                    onDragOver={(e) => handleCarouselDragOver(e, index)}
                    onDragLeave={handleCarouselDragLeave}
                    onDrop={(e) => handleCarouselDrop(e, index)}
                    onDragEnd={handleCarouselDragEnd}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1 flex-shrink-0">
                        {!isWelcomeCarousel && selectedCarousel?.id === carousel.id && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 rounded-lg hover:bg-muted/50"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
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
                      <div className="flex gap-1 flex-shrink-0">
                        {!isWelcomeCarousel && (
                          <div className="text-muted-foreground cursor-grab active:cursor-grabbing">
                            <GripVertical className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
            </div>
          </div>
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
          <Card className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto bg-background/60 backdrop-blur-xl border-border/40 shadow-2xl rounded-3xl" dir="ltr">
            <div className="p-10 space-y-8">
              {/* Quiet Anchor */}
              <div className="text-center">
                <h2 className="text-xl font-medium text-foreground/90 tracking-tight">
                  New post
                </h2>
              </div>

              {/* Close Button */}
              <div className="flex justify-end absolute top-6 right-6">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCreateModalOpen(false)}
                  className="h-10 w-10 rounded-full hover:bg-muted/50 transition-all duration-normal ease-ios-out"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Content Input */}
              <div className="space-y-6">
                <div className="relative">
                  <Textarea
                    placeholder="Start with a rough idea. We'll turn it into a finished post."
                    value={newCarouselText}
                    onChange={(e) => setNewCarouselText(e.target.value)}
                    className="min-h-[280px] text-lg resize-none bg-background/50 border-border/20 rounded-3xl px-8 py-7 transition-all duration-normal ease-ios-out focus:bg-background/60 focus:border-primary/30 focus:ring-2 focus:ring-primary/5 shadow-inner focus:shadow-lg placeholder:text-muted-foreground/50"
                    disabled={creatingCarousel}
                  />
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-4">
                <Button
                  onClick={handleCreateCarousel}
                  disabled={creatingCarousel || !newCarouselText.trim()}
                  className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-normal ease-ios-out shadow-lg hover:shadow-xl motion-safe:hover:scale-[1.02] text-base font-semibold px-8"
                >
                  {creatingCarousel ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      {creatingCarouselPhase}
                    </>
                  ) : (
                    "Turn this into a post"
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
