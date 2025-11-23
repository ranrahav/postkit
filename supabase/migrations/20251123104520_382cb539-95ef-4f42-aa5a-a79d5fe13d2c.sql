-- Add cover_style column to carousels table
ALTER TABLE public.carousels
ADD COLUMN cover_style text NOT NULL DEFAULT 'minimalist';

COMMENT ON COLUMN public.carousels.cover_style IS 'Cover style for first slide: minimalist, big_number, or accent_block';