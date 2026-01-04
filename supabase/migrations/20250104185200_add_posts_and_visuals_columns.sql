-- Add posts and visuals columns to properly store AI-generated content
ALTER TABLE public.carousels
ADD COLUMN posts JSONB,
ADD COLUMN visuals JSONB;

-- Add comments to describe the new columns
COMMENT ON COLUMN public.carousels.posts IS 'AI-generated post versions: short, medium, long';
COMMENT ON COLUMN public.carousels.visuals IS 'AI-generated visuals: summary_sentence, quote, stats_slides';
