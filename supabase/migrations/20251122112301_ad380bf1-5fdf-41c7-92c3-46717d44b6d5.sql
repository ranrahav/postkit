-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  carousel_count INTEGER DEFAULT 0 NOT NULL,
  CONSTRAINT carousel_count_non_negative CHECK (carousel_count >= 0)
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create carousels table
CREATE TABLE public.carousels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  original_text TEXT NOT NULL,
  slides JSONB NOT NULL DEFAULT '[]'::jsonb,
  chosen_template TEXT NOT NULL DEFAULT 'dark',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  CONSTRAINT valid_template CHECK (chosen_template IN ('dark', 'light'))
);

-- Enable RLS on carousels
ALTER TABLE public.carousels ENABLE ROW LEVEL SECURITY;

-- Carousels policies
CREATE POLICY "Users can view own carousels"
  ON public.carousels FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own carousels"
  ON public.carousels FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own carousels"
  ON public.carousels FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own carousels"
  ON public.carousels FOR DELETE
  USING (auth.uid() = user_id);

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Trigger for updated_at on carousels
CREATE TRIGGER on_carousel_updated
  BEFORE UPDATE ON public.carousels
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();