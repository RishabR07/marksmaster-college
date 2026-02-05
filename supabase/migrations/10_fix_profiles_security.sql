-- Fix: PUBLIC_DATA_EXPOSURE - Restrict profiles table SELECT to authenticated users only
-- Drop the overly permissive policy that exposes all emails publicly
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create a new policy that only allows authenticated users to view profiles
CREATE POLICY "Authenticated users can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() IS NOT NULL);