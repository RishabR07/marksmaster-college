-- Create events table
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  event_time TIME,
  location TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create announcements table
CREATE TABLE public.announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority TEXT DEFAULT 'normal',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Events policies
CREATE POLICY "Anyone can view events"
ON public.events
FOR SELECT
USING (true);

CREATE POLICY "Admins can create events"
ON public.events
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can update events"
ON public.events
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can delete events"
ON public.events
FOR DELETE
USING (has_role(auth.uid(), 'admin'::user_role));

-- Announcements policies
CREATE POLICY "Anyone can view announcements"
ON public.announcements
FOR SELECT
USING (true);

CREATE POLICY "Admins can create announcements"
ON public.announcements
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can update announcements"
ON public.announcements
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can delete announcements"
ON public.announcements
FOR DELETE
USING (has_role(auth.uid(), 'admin'::user_role));

-- Add trigger for updated_at
CREATE TRIGGER update_events_updated_at
BEFORE UPDATE ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_announcements_updated_at
BEFORE UPDATE ON public.announcements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();