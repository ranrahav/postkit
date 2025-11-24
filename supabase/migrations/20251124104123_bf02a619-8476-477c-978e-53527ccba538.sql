-- Add carousel_name column to carousels table
ALTER TABLE public.carousels
ADD COLUMN carousel_name text;

COMMENT ON COLUMN public.carousels.carousel_name IS 'User-friendly name for the carousel, defaults to first slide title';