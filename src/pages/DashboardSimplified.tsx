import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, Search, Download, ChevronLeft, ChevronRight, ArrowUp, Palette, MoreVertical } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// ─────────────────────────────────────────────────────────────────────────────
// Types - Simplified
// ─────────────────────────────────────────────────────────────────────────────

interface PostVersions {
  short: string;
  medium: string;
  long: string;
}

interface StatSlide {
  index: number;
  stat: string;
  context: string;
}

interface Visuals {
  summary_sentence: string;
  quote: string;
  stats_slides: StatSlide[];
}

interface Post {
  id: string;
  user_id: string;
  input_text: string;
  is_idea: boolean;
  posts?: PostVersions;
  current_version: 'short' | 'medium' | 'long' | 'original';
  visuals: Visuals;
  created_at: string;
  updated_at: string;
}

type VisualType = 'summary' | 'quote' | 'carousel';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const isHebrew = (text: string): boolean => {
  if (!text) return false;
  const hebrewChars = text.match(/[\u0590-\u05FF]/g) || [];
  const totalChars = text.replace(/\s/g, '').length;
  return totalChars > 0 && hebrewChars.length / totalChars > 0.3;
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Core state
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Input state
  const [inputText, setInputText] = useState("");
  const [creating, setCreating] = useState(false);
  
  // Visual navigation state per post
  const [visualTypes, setVisualTypes] = useState<Record<string, VisualType>>({});
  const [carouselIndexes, setCarouselIndexes] = useState<Record<string, number>>({});
  
  // Search
  const [searchQuery, setSearchQuery] = useState("");

  // ─────────────────────────────────────────────────────────────────────────
  // Auth & Data Loading
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    setUser(session.user);
    await fetchProfile(session.user.id);
    await fetchPosts(session.user.id);
  };

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    setProfile(data);
  };

  const fetchPosts = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("carousels")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Transform old carousel data to new Post format
      const transformedPosts: Post[] = (data || []).map((item: any) => {
        // Try to parse stored visuals or create defaults
        let visuals: Visuals;
        try {
          visuals = item.visuals ? JSON.parse(item.visuals) : {
            summary_sentence: item.carousel_name || "Key insight",
            quote: `"${(item.original_text || "").substring(0, 80)}..."`,
            stats_slides: parseOldSlides(item.slides),
          };
        } catch {
          visuals = {
            summary_sentence: item.carousel_name || "Key insight",
            quote: `"${(item.original_text || "").substring(0, 80)}..."`,
            stats_slides: parseOldSlides(item.slides),
          };
        }

        return {
          id: item.id,
          user_id: item.user_id,
          input_text: item.original_text || "",
          is_idea: (item.original_text || "").split(/\s+/).length < 25,
          posts: item.posts ? JSON.parse(item.posts) : undefined,
          current_version: 'medium' as const,
          visuals,
          created_at: item.created_at,
          updated_at: item.updated_at,
        };
      });
      
      setPosts(transformedPosts);
      if (transformedPosts.length > 0 && !selectedPost) {
        setSelectedPost(transformedPosts[0]);
      }
    } catch (error) {
      console.error("Error fetching posts:", error);
      toast({
        title: "Error",
        description: "Couldn't load posts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Helper to convert old slides format to stats_slides
  const parseOldSlides = (slides: any): StatSlide[] => {
    if (!slides) return [];
    try {
      const parsed = typeof slides === 'string' ? JSON.parse(slides) : slides;
      if (!Array.isArray(parsed)) return [];
      return parsed.map((s: any, i: number) => ({
        index: i + 1,
        stat: s.title || `Point ${i + 1}`,
        context: s.body || "",
      }));
    } catch {
      return [];
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Post Creation
  // ─────────────────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!inputText.trim() || !user) return;
    
    if (profile && profile.carousel_count >= 10) {
      toast({
        title: "Limit reached",
        description: "You've reached the free limit of 10 posts.",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    
    try {
      // Call the simplified edge function
      const { data, error } = await supabase.functions.invoke("generate-slides", {
        body: { text: inputText },
      });

      if (error) throw error;

      // Save to database
      const { data: newPost, error: insertError } = await supabase
        .from("carousels")
        .insert({
          user_id: user.id,
          original_text: inputText,
          carousel_name: data.visuals?.summary_sentence || inputText.substring(0, 50),
          slides: JSON.stringify(data.visuals?.stats_slides || []),
          chosen_template: "dark",
          cover_style: "minimalist",
          background_color: "#000000",
          text_color: "#FFFFFF",
          accent_color: "#FFFFFF",
          aspect_ratio: "4:5",
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Update profile count
      await supabase
        .from("profiles")
        .update({ carousel_count: (profile?.carousel_count || 0) + 1 })
        .eq("id", user.id);
      
      setProfile((prev: any) => ({ ...prev, carousel_count: (prev?.carousel_count || 0) + 1 }));

      // Create Post object
      const post: Post = {
        id: newPost.id,
        user_id: newPost.user_id,
        input_text: inputText,
        is_idea: inputText.split(/\s+/).length < 25,
        posts: data.posts,
        current_version: 'medium',
        visuals: data.visuals,
        created_at: newPost.created_at,
        updated_at: newPost.updated_at,
      };

      setPosts([post, ...posts]);
      setSelectedPost(post);
      setInputText("");
      
      toast({ title: "Post created!" });
    } catch (error) {
      console.error("Error creating post:", error);
      toast({
        title: "Error",
        description: "Couldn't create post. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Post Actions
  // ─────────────────────────────────────────────────────────────────────────

  const handleDelete = async (postId: string) => {
    if (!confirm("Delete this post?")) return;
    
    try {
      await supabase.from("carousels").delete().eq("id", postId);
      
      if (profile) {
        await supabase
          .from("profiles")
          .update({ carousel_count: Math.max(0, profile.carousel_count - 1) })
          .eq("id", profile.id);
        setProfile({ ...profile, carousel_count: Math.max(0, profile.carousel_count - 1) });
      }

      const remaining = posts.filter(p => p.id !== postId);
      setPosts(remaining);
      
      if (selectedPost?.id === postId) {
        setSelectedPost(remaining[0] || null);
      }
      
      toast({ title: "Deleted" });
    } catch (error) {
      toast({ title: "Error", description: "Couldn't delete", variant: "destructive" });
    }
  };

  const handleVersionChange = (postId: string, direction: 'shorter' | 'longer') => {
    const post = posts.find(p => p.id === postId);
    if (!post?.posts) return;
    
    const versions: Array<'short' | 'medium' | 'long'> = ['short', 'medium', 'long'];
    const currentIdx = versions.indexOf(post.current_version as any);
    const newIdx = direction === 'shorter' 
      ? Math.max(0, currentIdx - 1)
      : Math.min(2, currentIdx + 1);
    
    const updatedPost = { ...post, current_version: versions[newIdx] };
    setPosts(posts.map(p => p.id === postId ? updatedPost : p));
    if (selectedPost?.id === postId) {
      setSelectedPost(updatedPost);
    }
  };

  const getDisplayText = (post: Post): string => {
    if (!post.posts) return post.input_text;
    return post.posts[post.current_version as keyof PostVersions] || post.input_text;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Visual Navigation
  // ─────────────────────────────────────────────────────────────────────────

  const getVisualType = (postId: string): VisualType => visualTypes[postId] || 'summary';
  
  const setVisualType = (postId: string, type: VisualType) => {
    setVisualTypes(prev => ({ ...prev, [postId]: type }));
  };

  const getCarouselIndex = (postId: string): number => carouselIndexes[postId] || 0;
  
  const navigateCarousel = (postId: string, direction: number, maxIndex: number) => {
    const current = getCarouselIndex(postId);
    const newIndex = Math.max(0, Math.min(current + direction, maxIndex));
    setCarouselIndexes(prev => ({ ...prev, [postId]: newIndex }));
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Sign Out
  // ─────────────────────────────────────────────────────────────────────────

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Filtered Posts
  // ─────────────────────────────────────────────────────────────────────────

  const filteredPosts = posts.filter(post =>
    post.input_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
    post.visuals.summary_sentence.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <Button variant="ghost" onClick={handleSignOut} className="text-gray-500 hover:text-gray-700">
          Sign Out
        </Button>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
            <Palette className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Post24</h1>
        </div>
      </header>

      <div className="flex h-[calc(100vh-65px)] overflow-hidden justify-center">
        <div className="flex gap-4 max-w-7xl w-full px-4 md:px-6 justify-center">
          {/* Posts Panel - Floating next to feed */}
          <div className="hidden lg:block w-[280px] flex-shrink-0 overflow-hidden">
            <div className="h-full flex flex-col py-4">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">
                <div className="p-4 border-b border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">Posts</h2>
                    <span className="text-sm text-gray-500 font-medium">{profile?.carousel_count || 0}/10</span>
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

                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {filteredPosts.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500">No posts found</p>
                    </div>
                  ) : (
                    filteredPosts.map((post) => (
                      <div
                        key={post.id}
                        className={`relative group cursor-pointer transition-all duration-200 rounded-lg overflow-hidden ${
                          selectedPost?.id === post.id
                            ? 'bg-white/80 backdrop-blur-sm shadow-lg'
                            : 'hover:bg-gray-50'
                        }`}
                        onClick={() => {
                          setSelectedPost(post);
                          setTimeout(() => {
                            const postElement = document.getElementById(`post-${post.id}`);
                            if (postElement) {
                              postElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                          }, 100);
                        }}
                      >
                        {/* Selection border overlay */}
                        {selectedPost?.id === post.id && (
                          <div className="absolute inset-0 border-2 border-gray-400 rounded-lg pointer-events-none z-10" />
                        )}
                        <div className={`relative p-3 border transition-all duration-200 ${
                          selectedPost?.id === post.id
                            ? 'border-white/20'
                            : 'border-gray-200'
                        }`}>
                        <div className="flex items-center gap-3">
                          <div className="flex gap-1 flex-shrink-0">
                            {selectedPost?.id === post.id && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 rounded-lg hover:bg-gray-100"
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
                                      handleDelete(post.id);
                                    }}
                                    className="rounded-lg cursor-pointer text-red-600"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm mb-1 truncate">
                              {post.visuals.summary_sentence || post.input_text.substring(0, 40)}
                            </h3>
                            <p className="text-xs text-gray-500">
                              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Main Feed */}
          <div className="w-full lg:max-w-2xl flex flex-col min-w-0 overflow-hidden">
            <div className="flex-1 overflow-auto py-4 scrollbar-hide">
              <div className="space-y-4">
            {/* Input Box */}
            <Card className="p-6">
              <div className="relative">
                <Textarea
                  placeholder="Start with an idea or paste a full post..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="min-h-[80px] resize-none border-gray-200 text-base leading-relaxed pr-14"
                  disabled={creating}
                />
                <Button
                  onClick={handleCreate}
                  disabled={creating || !inputText.trim()}
                  className="absolute bottom-3 right-3 h-8 w-8 rounded-full bg-gray-900 hover:bg-gray-800 p-0 flex items-center justify-center"
                >
                  {creating ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <span className="text-white text-sm font-medium">→</span>}
                </Button>
              </div>
            </Card>

            {/* Posts Feed */}
            {filteredPosts.map((post) => {
              const isSelected = selectedPost?.id === post.id;
              const visualType = getVisualType(post.id);
              const carouselIndex = getCarouselIndex(post.id);
              const maxCarouselIndex = Math.max(0, (post.visuals.stats_slides?.length || 1) - 1);
              
              return (
                <div 
                  key={post.id}
                  id={`post-${post.id}`}
                  className={`relative cursor-pointer transition-all duration-300 rounded-lg overflow-hidden ${
                    isSelected 
                      ? 'bg-white/70 backdrop-blur-sm shadow-xl' 
                      : 'hover:shadow-md hover:bg-white/50'
                  }`}
                  onClick={() => setSelectedPost(post)}
                >
                  {/* Selection border overlay */}
                  {isSelected && (
                    <div className="absolute inset-0 border-2 border-gray-400 rounded-lg pointer-events-none z-10" />
                  )}
                  <Card className={`relative transition-all duration-300 border-0 m-1 ${
                    isSelected 
                      ? 'shadow-none' 
                      : ''
                  }`}>
                  {/* Post Text */}
                  <div className="p-6">
                    <p 
                      className="text-gray-900 whitespace-pre-wrap leading-relaxed"
                      dir={isHebrew(getDisplayText(post)) ? 'rtl' : 'ltr'}
                      style={{ textAlign: isHebrew(getDisplayText(post)) ? 'right' : 'left' }}
                    >
                      {getDisplayText(post)}
                    </p>
                    
                    {/* Version Controls - show for selected posts with versions OR for all ideas */}
                    {isSelected && (post.posts || post.is_idea) && (
                      <div className="flex justify-between mt-4 text-sm font-medium">
                        <button
                          className="cursor-pointer text-blue-500 hover:text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-all duration-200"
                          onClick={(e) => { e.stopPropagation(); handleVersionChange(post.id, 'shorter'); }}
                        >
                          {post.current_version !== 'short' ? '← Shorter post' : ''}
                        </button>
                        <button
                          className="cursor-pointer text-blue-500 hover:text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-all duration-200"
                          onClick={(e) => { e.stopPropagation(); handleVersionChange(post.id, 'longer'); }}
                        >
                          {post.current_version !== 'long' ? 'Longer post →' : ''}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Visual Preview */}
                  <div className="px-6 pb-6">
                    <div className="flex items-center gap-3">
                      {/* Left Arrow */}
                      <div className="w-8">
                        {visualType === 'carousel' && carouselIndex > 0 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); navigateCarousel(post.id, -1, maxCarouselIndex); }}
                            className="p-1.5 rounded-full bg-gray-100 hover:bg-gray-200"
                          >
                            <ChevronLeft className="w-4 h-4 text-gray-500" />
                          </button>
                        )}
                      </div>

                      {/* Visual Content */}
                      <div className="flex-1 bg-gray-900 rounded-lg overflow-hidden relative" style={{ aspectRatio: '5/4' }}>
                        <div 
                          className="h-full flex items-center justify-center p-8 text-white"
                          dir={isHebrew(post.visuals.summary_sentence) ? 'rtl' : 'ltr'}
                        >
                          {visualType === 'summary' && (
                            <p className="text-2xl font-bold text-center">
                              {post.visuals.summary_sentence}
                            </p>
                          )}
                          {visualType === 'quote' && (
                            <p className="text-xl italic text-center">
                              {post.visuals.quote}
                            </p>
                          )}
                          {visualType === 'carousel' && post.visuals.stats_slides?.[carouselIndex] && (
                            <div className="text-center">
                              <p className="text-3xl font-bold mb-4">
                                {post.visuals.stats_slides[carouselIndex].stat}
                              </p>
                              <p className="text-lg opacity-80">
                                {post.visuals.stats_slides[carouselIndex].context}
                              </p>
                            </div>
                          )}
                        </div>
                        {/* Slide counter for carousel */}
                        {visualType === 'carousel' && post.visuals.stats_slides?.length > 0 && (
                          <p className="absolute bottom-4 left-4 text-sm text-white/60">
                            {carouselIndex + 1}/{post.visuals.stats_slides.length}
                          </p>
                        )}
                      </div>

                      {/* Right Arrow */}
                      <div className="w-8">
                        {visualType === 'carousel' && carouselIndex < maxCarouselIndex && (
                          <button
                            onClick={(e) => { e.stopPropagation(); navigateCarousel(post.id, 1, maxCarouselIndex); }}
                            className="p-1.5 rounded-full bg-gray-100 hover:bg-gray-200"
                          >
                            <ChevronRight className="w-4 h-4 text-gray-500" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Visual Type Selector */}
                    <div className="flex justify-center gap-2 mt-4">
                      {(['summary', 'quote', 'carousel'] as VisualType[]).map((type) => (
                        <button
                          key={type}
                          className={`px-4 py-2 text-sm rounded-full transition-all ${
                            visualType === type
                              ? 'bg-gray-900 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                          onClick={(e) => { e.stopPropagation(); setVisualType(post.id, type); }}
                        >
                          {type === 'summary' ? 'Summary' : type === 'quote' ? 'Quote' : 'Carousel'}
                        </button>
                      ))}
                    </div>
                  </div>
                  </Card>
                </div>
              );
            })}

            {filteredPosts.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg font-medium">No posts yet</p>
                <p className="text-sm mt-1">Create your first post above</p>
              </div>
            )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Dashboard;
