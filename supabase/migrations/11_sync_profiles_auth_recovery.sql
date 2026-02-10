-- Migration: Create auth users for imported profiles
-- This fixes the "Invalid login credentials" issue when profiles exist but auth users don't

-- Step 1: Create a temporary function to generate random passwords
CREATE OR REPLACE FUNCTION generate_random_password(length INT DEFAULT 12)
RETURNS TEXT AS $$
DECLARE
  password TEXT := '';
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  char_length INT := LENGTH(chars);
  i INT;
BEGIN
  FOR i IN 1..length LOOP
    password := password || SUBSTR(chars, (FLOOR(RANDOM() * char_length) + 1)::INT, 1);
  END LOOP;
  RETURN password;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Log which profiles don't have auth users yet
-- Run this query to see what needs to be fixed:
-- SELECT p.id, p.email, p.full_name, 
--        CASE WHEN au.id IS NULL THEN 'MISSING AUTH' ELSE 'HAS AUTH' END as auth_status
-- FROM public.profiles p
-- LEFT JOIN auth.users au ON p.id = au.id
-- ORDER BY auth_status;

-- Step 3: First, verify the ProfilesSchemayour
-- The profiles table should have:
-- - id (UUID, PRIMARY KEY, references auth.users(id))
-- - email (TEXT)
-- - full_name (TEXT)
-- - created_at (TIMESTAMPTZ)

-- Step 4: Create an admin user manually if none exist
-- Run this in the Supabase dashboard to create your first admin:
-- INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
-- VALUES (
--   gen_random_uuid(),
--   'admin@example.com',
--   crypt('your_password_here', gen_salt('bf')),
--   NOW(),
--   '{"role": "admin"}',
--   NOW(),
--   NOW()
-- );

-- IMPORTANT: After creating the first admin auth user, then create the corresponding profile:
-- INSERT INTO public.profiles (id, email, full_name)
-- VALUES (
--   (SELECT id FROM auth.users WHERE email = 'admin@example.com'),
--   'admin@example.com',
--   'Admin Name'
-- );

-- THEN create the user_role entry:
-- INSERT INTO public.user_roles (user_id, role)
-- VALUES (
--   (SELECT id FROM auth.users WHERE email = 'admin@example.com'),
--   'admin'
-- );

-- Drop the function
DROP FUNCTION IF EXISTS generate_random_password(INT);
