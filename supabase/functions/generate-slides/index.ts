import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Types - Simplified for Post24
// ─────────────────────────────────────────────────────────────────────────────

interface RequestBody {
  text: string;
  is_idea: boolean; // true if < 25 words, false if full post
}

interface PostVersions {
  short: string;   // ~50 words
  medium: string;  // ~120 words  
  long: string;    // ~250 words
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

interface ResponseData {
  posts?: PostVersions;
  visuals: Visuals;
  display_post: string; // The post to display (medium version or original)
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ALLOWED_ORIGINS = [
  "http://localhost:8080",
  "http://localhost:8083",
  "https://postkit-five.vercel.app",
  "https://postkit-git-main-ranrahavs-projects.vercel.app",
  "https://post24beta.vercel.app",
  "https://postkit-*.vercel.app",
];

const SYSTEM_MESSAGE = `You are Post24, an AI that creates LinkedIn content.
Write for a professional B2B audience.
Be clear, concise, insightful, and practical.
No emojis or hashtags unless requested.
ALWAYS respond with valid JSON only.`;

const OPENAI_TIMEOUT_MS = 30000;

// ─────────────────────────────────────────────────────────────────────────────
// CORS
// ─────────────────────────────────────────────────────────────────────────────

function isOriginAllowed(origin: string): boolean {
  return ALLOWED_ORIGINS.some((allowed) => {
    if (allowed.includes("*")) {
      const pattern = "^" + allowed.replace(/\*/g, ".*") + "$";
      return new RegExp(pattern).test(origin);
    }
    return origin === allowed;
  });
}

function corsHeaders(origin: string): Record<string, string> {
  const allowedOrigin = isOriginAllowed(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Request handling
// ─────────────────────────────────────────────────────────────────────────────

async function parseRequest(req: Request): Promise<RequestBody> {
  const body = await req.json();
  const text = body.text ?? "";
  const wordCount = text.trim().split(/\s+/).filter((w: string) => w.length > 0).length;
  return {
    text,
    is_idea: body.is_idea ?? wordCount < 25,
  };
}

function validateRequest(body: RequestBody): string | null {
  if (!body.text || body.text.trim().length === 0) {
    return "Text is required";
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt builders
// ─────────────────────────────────────────────────────────────────────────────

function buildPromptForIdea(text: string): string {
  return `TASK: Create LinkedIn content from a short idea/topic.

INPUT IDEA: "${text}"

Generate:

1. THREE POST VERSIONS:
   - short: 40-60 words, punchy and direct
   - medium: 100-140 words, balanced depth
   - long: 200-280 words, comprehensive

Each post should:
- Start with a hook
- Be conversational and professional
- End with a question or CTA

2. VISUALS:
   - summary_sentence: One powerful sentence (max 15 words) that captures the core message
   - quote: An inspiring quote related to the topic (max 100 chars)
   - stats_slides: 4-6 slides, each with a stat/insight and brief context

OUTPUT FORMAT (JSON ONLY):
{
  "posts": {
    "short": "...",
    "medium": "...",
    "long": "..."
  },
  "visuals": {
    "summary_sentence": "...",
    "quote": "...",
    "stats_slides": [
      { "index": 1, "stat": "...", "context": "..." }
    ]
  }
}

Match input language (Hebrew/English).`;
}

function buildPromptForFullPost(text: string): string {
  return `TASK: Extract visual content from a LinkedIn post.

INPUT POST:
"${text}"

DO NOT rewrite the post. Extract:

1. VISUALS:
   - summary_sentence: The single most powerful sentence from the post (max 15 words)
   - quote: A quotable line from the post (max 100 chars)
   - stats_slides: 4-6 key points/stats from the post, each with context

OUTPUT FORMAT (JSON ONLY):
{
  "visuals": {
    "summary_sentence": "...",
    "quote": "...",
    "stats_slides": [
      { "index": 1, "stat": "...", "context": "..." }
    ]
  }
}

Match input language.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// OpenAI call
// ─────────────────────────────────────────────────────────────────────────────

async function callOpenAI(userPrompt: string): Promise<unknown> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_MESSAGE },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    return JSON.parse(content);
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fallback generation
// ─────────────────────────────────────────────────────────────────────────────

function fallbackVisuals(text: string): Visuals {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  return {
    summary_sentence: sentences[0]?.trim().substring(0, 100) || "Key insight from this post",
    quote: `"${sentences[0]?.trim().substring(0, 80) || text.substring(0, 80)}..."`,
    stats_slides: sentences.slice(0, 5).map((s, i) => ({
      index: i + 1,
      stat: s.trim().split(" ").slice(0, 5).join(" "),
      context: s.trim(),
    })),
  };
}

function fallbackPosts(topic: string): PostVersions {
  return {
    short: `${topic} is transforming how we work. The key? Understanding its impact on daily decisions. What's your take?`,
    medium: `I've been thinking about ${topic} lately.\n\nThe importance of ${topic} cannot be overstated in today's landscape. It impacts our daily work in ways we might not immediately recognize.\n\nUnderstanding ${topic} better helps us make more informed decisions. The future holds exciting possibilities.\n\nWhat are your thoughts on ${topic}?`,
    long: `I've been thinking about ${topic} lately, and I wanted to share some insights.\n\nThe importance of ${topic} cannot be overstated in today's rapidly evolving landscape. As we navigate through unprecedented changes, understanding this concept becomes crucial for sustainable growth and innovation.\n\nHere are key points to consider:\n\n• ${topic} impacts our daily lives in ways we might not immediately recognize\n• Understanding ${topic} better can help us make more informed decisions\n• The future of ${topic} holds exciting possibilities\n\nThe journey of mastering ${topic} is ongoing, and each step brings new opportunities for growth and learning.\n\nWhat are your thoughts on ${topic}? I'd love to hear your perspectives in the comments.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  try {
    const body = await parseRequest(req);
    const validationError = validateRequest(body);

    if (validationError) {
      return new Response(JSON.stringify({ error: validationError }), {
        status: 400,
        headers,
      });
    }

    console.log("📝 Processing:", { is_idea: body.is_idea, textLength: body.text.length });

    let result: ResponseData;

    try {
      const prompt = body.is_idea 
        ? buildPromptForIdea(body.text)
        : buildPromptForFullPost(body.text);
      
      const aiResponse = await callOpenAI(prompt) as any;
      
      if (body.is_idea) {
        result = {
          posts: aiResponse.posts || fallbackPosts(body.text),
          visuals: aiResponse.visuals || fallbackVisuals(body.text),
          display_post: aiResponse.posts?.medium || body.text,
        };
      } else {
        result = {
          visuals: aiResponse.visuals || fallbackVisuals(body.text),
          display_post: body.text,
        };
      }
    } catch (aiError) {
      console.error("❌ OpenAI failed, using fallback:", aiError);
      
      if (body.is_idea) {
        const posts = fallbackPosts(body.text);
        result = {
          posts,
          visuals: fallbackVisuals(posts.medium),
          display_post: posts.medium,
        };
      } else {
        result = {
          visuals: fallbackVisuals(body.text),
          display_post: body.text,
        };
      }
    }

    console.log("✅ Returning result:", {
      hasPosts: !!result.posts,
      displayPostLength: result.display_post.length,
      statsCount: result.visuals.stats_slides.length,
    });

    return new Response(JSON.stringify(result), { headers });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers }
    );
  }
});
