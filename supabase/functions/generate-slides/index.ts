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
    const { text } = await req.json();

    if (!text || text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // This is a placeholder implementation that splits text into slides
    // TODO: In production, replace this with a call to Google Gemini 3 API
    // The LLM integration point would be here:
    // 
    // const response = await fetch('https://generativelanguage.googleapis.com/v1/models/gemini-3-pro:generateContent', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'x-goog-api-key': Deno.env.get('GOOGLE_AI_API_KEY')
    //   },
    //   body: JSON.stringify({
    //     contents: [{
    //       parts: [{
    //         text: `Convert the following text into a LinkedIn carousel of 6-12 slides. 
    //                For each slide return JSON with: slideTitle (short, impactful), 
    //                slideBody (1-3 sentences). Text: ${text}`
    //       }]
    //     }]
    //   })
    // });
    
    const slides = generateSlidesHeuristic(text);

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

// Placeholder heuristic function - splits text into slides
// This will be replaced with LLM-based generation
function generateSlidesHeuristic(text: string) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const slideCount = Math.min(12, Math.max(6, Math.ceil(sentences.length / 2)));
  const sentencesPerSlide = Math.ceil(sentences.length / slideCount);
  
  const slides = [];
  
  for (let i = 0; i < slideCount; i++) {
    const startIdx = i * sentencesPerSlide;
    const endIdx = Math.min(startIdx + sentencesPerSlide, sentences.length);
    const slideContent = sentences.slice(startIdx, endIdx).join('. ').trim();
    
    // Extract first few words as title
    const words = slideContent.split(' ');
    const titleWords = words.slice(0, Math.min(5, words.length));
    const title = titleWords.join(' ') + (titleWords.length < words.length ? '...' : '');
    
    // Rest as body
    const body = words.slice(titleWords.length).join(' ').trim() || slideContent;
    
    slides.push({
      index: i,
      title: title || `שקופית ${i + 1}`,
      body: body.substring(0, 300) // Limit body length
    });
  }
  
  return slides;
}
