-- Add is_complete_post column to track when user marks post as complete
ALTER TABLE public.carousels
ADD COLUMN is_complete_post BOOLEAN DEFAULT FALSE;

-- Add comment to describe the new column
COMMENT ON COLUMN public.carousels.is_complete_post IS 'Flag to indicate if user marked post as complete and no text generation should occur';
