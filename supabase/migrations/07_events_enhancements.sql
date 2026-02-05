-- Add new columns to events table for student-created events
ALTER TABLE public.events 
ADD COLUMN image_url text,
ADD COLUMN branch text,
ADD COLUMN year_of_studying integer;

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Admins can create events" ON public.events;
DROP POLICY IF EXISTS "Admins can update events" ON public.events;
DROP POLICY IF EXISTS "Admins can delete events" ON public.events;

-- Create new policies allowing teachers and students to create events
CREATE POLICY "Authenticated users can create events"
ON public.events
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

-- Allow users to update their own events, admins can update all
CREATE POLICY "Users can update own events"
ON public.events
FOR UPDATE
USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'::user_role));

-- Allow users to delete their own events, admins can delete all
CREATE POLICY "Users can delete own events"
ON public.events
FOR DELETE
USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'::user_role));

-- Update announcements policies for teachers
DROP POLICY IF EXISTS "Admins can create announcements" ON public.announcements;
DROP POLICY IF EXISTS "Admins can update announcements" ON public.announcements;
DROP POLICY IF EXISTS "Admins can delete announcements" ON public.announcements;

-- Allow admins and teachers to create announcements
CREATE POLICY "Admins and teachers can create announcements"
ON public.announcements
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'teacher'::user_role));

-- Allow admins and announcement creators to update
CREATE POLICY "Users can update own announcements"
ON public.announcements
FOR UPDATE
USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'::user_role));

-- Allow admins and announcement creators to delete
CREATE POLICY "Users can delete own announcements"
ON public.announcements
FOR DELETE
USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'::user_role));