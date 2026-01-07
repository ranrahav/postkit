import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Types - Simplified for Post24
// ─────────────────────────────────────────────────────────────────────────────

interface RequestBody {
  text: string;
  is_idea: boolean; // true if < 25 words, false if full post
  generate_visuals_only?: boolean; // new flag for complete posts
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
  original_post?: string; // The original post when generate_visuals_only is true
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

const SYSTEM_MESSAGE = `You are Post24, a world-class LinkedIn Content Strategist and Ghostwriter.
Your goal is to create highly engaging, viral-potential LinkedIn content that stops the scroll.

LANGUAGE CRITICAL RULE:
- You MUST detect the input language and respond in the EXACT SAME LANGUAGE.
- If the input is in Hebrew, all generated posts, summary sentences, quotes, and slide content MUST BE IN HEBREW.
- If the input is in English, respond in English.
- NEVER translate Hebrew input to English.

STYLE GUIDELINES:
- Tone: Professional yet conversational, authoritative but accessible.
- Hooks: Start with a powerful "hook" that creates curiosity or states a bold truth.
- Structure: Use short sentences and plenty of white space for readability.
- Engagement: Use rhetorical questions or clear calls-to-action (CTA).
- Formatting: Use bullet points for lists.
- Emojis: Use 2-3 relevant emojis per post to add visual personality (don't overdo it).
- Hashtags: Include 3 relevant hashtags at the end.

OUTPUT: ALWAYS respond with valid JSON only.`;

const OPENAI_TIMEOUT_MS = 30000;

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
    generate_visuals_only: body.generate_visuals_only ?? false,
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

function buildPromptForVisualsOnly(text: string): string {
  return `TASK: Create visual carousel content from this complete post. DO NOT modify or rewrite the post text.

STRICT LANGUAGE RULE: The input post is in ${isHebrew(text) ? 'HEBREW' : 'ENGLISH'}. You MUST generate all visual content in ${isHebrew(text) ? 'HEBREW' : 'ENGLISH'}.

INPUT POST (DO NOT CHANGE):
"${text}"

Create ONLY the visual components for a carousel based on this post:

1. VISUALS (FOR CAROUSEL):
   - summary_sentence: A "Title" or "Big Idea" for the first slide (max 12 words).
   - quote: A powerful quotable line extracted from or inspired by the post.
   - stats_slides: 5-8 slides. Each slide MUST have:
     - stat: A punchy header or key takeaway (max 7 words).
     - context: 1-2 engaging sentences that explain the takeaway or provide a "how-to".

IMPORTANT: Do NOT generate post versions. The post is already complete and should not be modified.

OUTPUT FORMAT (JSON ONLY):
{
  "visuals": {
    "summary_sentence": "...",
    "quote": "...",
    "stats_slides": [
      { "index": 1, "stat": "...", "context": "..." }
    ]
  }
}`;
}

function buildPromptForIdea(text: string): string {
  return `TASK: Create premium LinkedIn content from this idea/topic: "${text}"

STRICT LANGUAGE RULE: The input is in ${isHebrew(text) ? 'HEBREW' : 'ENGLISH'}. You MUST generate all content in ${isHebrew(text) ? 'HEBREW' : 'ENGLISH'}.

1. THREE POST VERSIONS:
   - short: ~50 words. Punchy, direct, great for quick engagement.
   - medium: ~120 words. The "Standard" LinkedIn post. Includes a hook, body with 3-4 bullet points, and a CTA.
   - long: ~250 words. Thought leadership style. Deep dive with context, examples, and a strong conclusion.

2. VISUALS (FOR CAROUSEL):
   - summary_sentence: A "Title" or "Big Idea" for the first slide (max 12 words).
   - quote: A powerful, original-sounding quote related to the topic.
   - stats_slides: 5-8 slides. Each slide MUST have:
     - stat: A punchy header or key takeaway (max 7 words).
     - context: 1-2 engaging sentences that explain the takeaway or provide a "how-to".

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
}`;
}

function buildPromptForFullPost(text: string): string {
  return `TASK: Transform this LinkedIn post into a visual carousel and optimized versions.

STRICT LANGUAGE RULE: The input post is in ${isHebrew(text) ? 'HEBREW' : 'ENGLISH'}. You MUST generate all content in ${isHebrew(text) ? 'HEBREW' : 'ENGLISH'}.

INPUT POST:
"${text}"

1. THREE POST VERSIONS:
   - short: A punchy summary of the original post (~50 words).
   - medium: An optimized version of the original post with better formatting (~120 words).
   - long: An expanded version of the original post with more depth (~250 words).

2. VISUALS (FOR CAROUSEL):
   - summary_sentence: A "Title" or "Big Idea" for the first slide (max 12 words).
   - quote: A powerful quotable line from the post or related to it.
   - stats_slides: 5-8 slides. Each slide MUST have:
     - stat: A punchy header or key takeaway (max 7 words).
     - context: 1-2 engaging sentences that explain the takeaway.

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
}`;
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
        model: "gpt-4o",
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
      let prompt: string;
      let aiResponse: any;
      
      if (body.generate_visuals_only) {
        // Only generate visuals, no post modifications
        prompt = buildPromptForVisualsOnly(body.text);
        aiResponse = await callOpenAI(prompt);
        
        if (!aiResponse || !aiResponse.visuals) {
          throw new Error("AI response was incomplete for visuals-only generation");
        }
        
        result = {
          visuals: aiResponse.visuals,
          display_post: body.text, // Use original post as-is
          original_post: body.text, // Preserve original for reference
        };
      } else {
        // Regular generation with post optimization
        prompt = body.is_idea 
          ? buildPromptForIdea(body.text)
          : buildPromptForFullPost(body.text);
        
        aiResponse = await callOpenAI(prompt);
        
        if (!aiResponse || (!aiResponse.posts && body.is_idea) || !aiResponse.visuals) {
          throw new Error("AI response was incomplete");
        }

        result = {
          posts: aiResponse.posts,
          visuals: aiResponse.visuals,
          display_post: aiResponse.posts?.medium || (body.is_idea ? body.text : body.text),
        };
      }
    } catch (aiError: any) {
      console.error("❌ OpenAI failed:", aiError);
      throw new Error(`OpenAI failed to generate content: ${aiError.message || 'Please try again with a clearer topic.'}`);
    }

    console.log("✅ Returning result:", {
      hasPosts: !!result.posts,
      displayPostLength: result.display_post.length,
      statsCount: result.visuals.stats_slides.length,
      generateVisualsOnly: body.generate_visuals_only,
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
