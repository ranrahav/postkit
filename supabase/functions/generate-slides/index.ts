import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, style = 'Professional', language = 'he' } = await req.json();

    if (!text || text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Try AI generation first, fallback to heuristic on error
    let slides;
    try {
      slides = await generateSlidesWithAI(text, style, language);
    } catch (aiError) {
      console.error('AI generation failed, falling back to heuristic:', aiError);
      slides = generateSlidesHeuristic(text);
    }

    return new Response(
      JSON.stringify({ slides }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating slides:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// AI-powered slide generation using Gemini via Lovable AI Gateway
async function generateSlidesWithAI(text: string, style: string, language: string) {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY not configured');
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
6. If the text is Hebrew, output Hebrew.  
   If English, output English.  
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

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Lovable AI error:', response.status, errorText);
    throw new Error(`AI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  
  if (!content) {
    throw new Error('No content in AI response');
  }

  // Extract JSON from markdown code blocks if present
  let jsonStr = content;
  const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  const parsed = JSON.parse(jsonStr);
  return parsed.slides || [];
}

// Fallback heuristic function - splits text into slides
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
