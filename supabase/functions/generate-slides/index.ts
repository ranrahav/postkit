import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Define types for better type safety
interface RequestBody {
  text: string;
  style?: string;
  language?: string;
  content_type?: string;
  content_purpose?: string;
}

interface Slide {
  index: number;
  title: string;
  body: string;
}

interface ResponseData {
  slides: Slide[];
  generated_post?: string;
}

// Define allowed origins
const allowedOrigins = [
  'http://localhost:8080',
  'http://localhost:8083',
  'https://postkit-five.vercel.app',
  'https://postkit-git-main-ranrahavs-projects.vercel.app',
  'https://post24beta.vercel.app',
  'https://postkit-*.vercel.app' // This is a wildcard for Vercel preview deployments
];

// Function to get CORS headers
const getCorsHeaders = (origin: string) => {
  // Check if the origin is in the allowed list
  const isAllowed = allowedOrigins.some(allowedOrigin => 
    allowedOrigin.includes('*') 
      ? origin.match(new RegExp('^' + allowedOrigin.replace('*', '.*') + '$'))
      : origin === allowedOrigin
  );

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : allowedOrigins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400', // 24 hours
  };
};

serve(async (req: Request) => {
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('origin') || '';
    return new Response(null, { 
      headers: getCorsHeaders(origin)
    });
  }

  try {
    const { text, style = 'Professional', language = 'he', content_type = 'full_post', content_purpose = 'thought_leadership' }: RequestBody = await req.json();

    if (!text || text.trim().length === 0) {
      const origin = req.headers.get('origin') || '';
      return new Response(
        JSON.stringify({ error: 'Text is required' }),
        { 
          status: 400, 
          headers: { 
            ...getCorsHeaders(origin), 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    let result: ResponseData;
    try {
      result = await generateSlidesWithOpenAI(text, style, language, content_type, content_purpose);
    } catch (aiError) {
      console.error('OpenAI generation failed, falling back to heuristic:', aiError);
      const slides = generateSlidesHeuristic(text);
      result = { slides, generated_post: content_type === 'topic_idea' ? generatePostFromTopic(text, content_purpose) : text };
    }

    const origin = req.headers.get('origin') || '';
    return new Response(
      JSON.stringify(result),
      { headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating slides:', error);
    const origin = req.headers.get('origin') || '';
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' } }
    );
  }
});

async function generateSlidesWithOpenAI(text: string, style: string, language: string, content_type: string, content_purpose: string): Promise<ResponseData> {
  // Use global Deno for environment variables (Deno-specific)
  const OPENAI_API_KEY = (globalThis as any).Deno?.env.get('OPENAI_API_KEY');
  
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  let prompt;
  let responseFormat;

  if (content_type === 'topic_idea') {
    // For topic/idea: generate full post and essence slides based on content purpose
    let wordCountInstruction = '';
    let postDescription = '';
    
    switch (content_purpose) {
      case 'awareness':
        wordCountInstruction = '120-180 words total';
        postDescription = 'engaging B2B LinkedIn post';
        break;
      case 'thought_leadership':
        wordCountInstruction = '120-180 words total';
        postDescription = 'engaging B2B LinkedIn post';
        break;
      case 'opinion':
        wordCountInstruction = '120-180 words total';
        postDescription = 'engaging B2B LinkedIn post';
        break;
      default:
        wordCountInstruction = '120-180 words total';
        postDescription = 'engaging B2B LinkedIn post';
    }
    
    prompt = `You are SlideMint, an AI model specialized in transforming topics and ideas into LinkedIn posts and carousel slides.

TASK  
Given the following topic or idea (1-2 sentences), generate a ${postDescription} (${wordCountInstruction}) and create 6-8 carousel slides showing the essence of that post.

REQUIREMENTS  
1. Output JSON only. No explanations.  

**POST GENERATION:**
2. Write an engaging LinkedIn post about the following subject using these guidelines:
   - Target a professional LinkedIn audience
   - Start with a strong hook in the first 1–2 lines
   - Keep the tone confident, insightful, and conversational
   - Provide a clear takeaway or lesson
   - Use short paragraphs for readability
   - Avoid emojis and hashtags unless explicitly requested
   - End with a thoughtful question or call to action to drive engagement
   - Length: 120–180 words

**SLIDE GENERATION:**
3. Then create 6-8 essence slides that capture ONLY the key points - keep slide text very concise (1-2 short sentences per slide).
4. Each slide must have:  
   - "index": number  
   - "title": a short, punchy LinkedIn-style headline  
   - "body": 1-3 short sentences maximum
5. The tone must fit the user-selected style:  
   - "Professional": clear, concise, business tone  
   - "Storytelling": emotionally engaging narrative  
   - "Educational": structured, helpful, logical  
   - "List / Tips": direct bullets with strong clarity  
6. If the text is Hebrew, output Hebrew. If English, output English.  
7. First slide must introduce the main concept.  
8. Last slide must include a call-to-action or key takeaway.

CRITICAL: The post must follow the B2B LinkedIn content writer guidelines (120-180 words), while the slides must contain ONLY the essence - very concise key points.

OUTPUT FORMAT  
{
  "generated_post": "Complete LinkedIn post here (120-180 words)...",
  "slides": [
     { "index": 1, "title": "...", "body": "..." },
     { "index": 2, "title": "...", "body": "..." }
  ]
}

USER SELECTED STYLE: ${style}
DETECTED LANGUAGE: ${language}
CONTENT PURPOSE: ${content_purpose} (${wordCountInstruction})

USER TOPIC/IDEA  
${text}`;
  } else {
    // For full post: create essence slides from existing post
    prompt = `You are SlideMint, an AI model specialized in transforming long LinkedIn posts into high-quality carousel slides showing the essence.

TASK  
Given the following full LinkedIn post, transform it into 6-12 carousel slides that capture the essence and key points.

REQUIREMENTS  
1. Output JSON only. No explanations.  
2. Each slide must have:  
   - "index": number  
   - "title": a short, punchy LinkedIn-style headline  
   - "body": 1-3 short sentences maximum
3. The tone must fit the user-selected style:  
   - "Professional": clear, concise, business tone  
   - "Storytelling": emotionally engaging narrative  
   - "Educational": structured, helpful, logical  
   - "List / Tips": direct bullets with strong clarity  
4. Extract ONLY the most important insights and make them scannable. Keep text very concise.
5. If the text is Hebrew, output Hebrew. If English, output English.  
6. First slide must mention the main idea.  
7. Last slide must include a short closing message or call-to-action.

OUTPUT FORMAT  
{
  "slides": [
     { "index": 1, "title": "...", "body": "..." },
     { "index": 2, "title": "...", "body": "..." }
  ]
}

USER SELECTED STYLE: ${style}
DETECTED LANGUAGE: ${language}

USER FULL POST  
${text}`;
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini', // Using the cost-effective model
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: text }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI API error:', response.status, errorText);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  
  if (!content) {
    throw new Error('No content in AI response');
  }

  const parsed = JSON.parse(content);
  
  if (content_type === 'topic_idea') {
    return { 
      slides: parsed.slides || [], 
      generated_post: parsed.generated_post || generatePostFromTopic(text, content_purpose)
    } as ResponseData;
  } else {
    return { 
      slides: parsed.slides || [],
      generated_post: text // For full post, return original text
    } as ResponseData;
  }
}

// Fallback heuristic function
function generateSlidesHeuristic(text: string): Slide[] {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const slideCount = Math.min(12, Math.max(6, Math.ceil(sentences.length / 2)));
  const sentencesPerSlide = Math.ceil(sentences.length / slideCount);
  const slides: Slide[] = [];
  for (let i = 0; i < slideCount; i++) {
    const startIdx = i * sentencesPerSlide;
    const endIdx = Math.min(startIdx + sentencesPerSlide, sentences.length);
    const slideContent = sentences.slice(startIdx, endIdx).join('. ').trim();
    const words = slideContent.split(' ');
    const titleWords = words.slice(0, Math.min(5, words.length));
    const title = titleWords.join(' ') + (titleWords.length < words.length ? '...' : '');
    const body = words.slice(titleWords.length).join(' ').trim() || slideContent;
    slides.push({
      index: i,
      title: title || `שקופית ${i + 1}`,
      body: body.substring(0, 300)
    });
  }
  return slides;
}

// Fallback function to generate a basic post from topic
function generatePostFromTopic(topic: string, contentPurpose: string): string {
  // Simple heuristic to expand a topic into a basic LinkedIn post based on content purpose
  let sentences: string[] = [];
  
  switch (contentPurpose) {
    case 'awareness':
      // 25-75 words (short, concise awareness post)
      sentences = [
        `Discover the latest insights about ${topic}. This emerging trend is transforming how we work and live.`,
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
}
