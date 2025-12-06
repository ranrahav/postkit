import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Define allowed origins
const allowedOrigins = [
  'http://localhost:8080',
  'http://localhost:8083',
  'https://postkit-five.vercel.app',
  'https://postkit-git-main-ranrahavs-projects.vercel.app',
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

serve(async (req) => {
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('origin') || '';
    return new Response(null, { 
      headers: getCorsHeaders(origin)
    });
  }

  try {
    const { text, style = 'Professional', language = 'he' } = await req.json();

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

    let slides;
    try {
      slides = await generateSlidesWithOpenAI(text, style, language);
    } catch (aiError) {
      console.error('OpenAI generation failed, falling back to heuristic:', aiError);
      slides = generateSlidesHeuristic(text);
    }

    const origin = req.headers.get('origin') || '';
    return new Response(
      JSON.stringify({ slides }),
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

async function generateSlidesWithOpenAI(text: string, style: string, language: string) {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const prompt = `You are SlideMint, an AI model specialized in transforming long Hebrew or English text into high-quality, LinkedIn-ready carousel slides.

TASK  
Given the following long text, transform it into a structured sequence of 6–12 carousel slides.

REQUIREMENTS  
1. Output JSON only. No explanations.  
2. Each slide must have:  
   - "index": number  
   - "title": a short, punchy LinkedIn-style headline  
   - "body": 1–3 short sentences  
3. The tone must fit the user-selected style:  
   - "Professional": clear, concise, business tone  
   - "Storytelling": emotionally engaging narrative  
   - "Educational": structured, helpful, logical  
   - "List / Tips": direct bullets with strong clarity  
4. Simplify the text. Remove filler.  
5. Highlight key insights and make them scannable.  
6. If the text is Hebrew, output Hebrew. If English, output English.  
7. First slide must always mention the main idea.  
8. Last slide must include a short closing message or call-to-action.

OUTPUT FORMAT  
{
  "slides": [
     { "index": 1, "title": "...", "body": "..." },
     { "index": 2, "title": "...", "body": "..." }
  ]
}

USER SELECTED STYLE: ${style}
DETECTED LANGUAGE: ${language}

USER TEXT  
${text}`;

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
  return parsed.slides || [];
}

// Fallback heuristic function
function generateSlidesHeuristic(text: string) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const slideCount = Math.min(12, Math.max(6, Math.ceil(sentences.length / 2)));
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
      index: i,
      title: title || `שקופית ${i + 1}`,
      body: body.substring(0, 300)
    });
  }
  return slides;
}
