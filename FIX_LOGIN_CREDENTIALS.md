# Fix: Invalid Login Credentials After Lovable Import

## Problem
You've imported user profiles from Lovable into Supabase, but you're getting "Invalid login credentials" when trying to login. This happens because:

- ✅ User profiles exist in the `profiles` table
- ❌ Auth users do NOT exist in Supabase Auth (`auth.users` table)

Supabase requires users to exist in **both** places to login.

---

## Solution 1: Create Auth Users via Supabase Dashboard (Recommended for Testing)

### Step 1: Go to Supabase Dashboard
1. Navigate to: https://app.supabase.com
2. Select your project
3. Go to **SQL Editor** → **New Query**

### Step 2: Create Your First Admin User

Copy and paste this SQL:

```sql
-- Create admin in auth system
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  raw_app_meta_data,
  created_at,
  updated_at,
  last_sign_in_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  is_super_admin,
  deleted_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@example.com',
  crypt('Admin@123', gen_salt('bf')),
  NOW(),
  json_build_object('full_name', 'Admin User'),
  '{}',
  NOW(),
  NOW(),
  NULL,
  '',
  '',
  '',
  '',
  FALSE,
  NULL
) RETURNING id;
```

⚠️ **Replace `admin@example.com` and `Admin@123` with your credentials**

### Step 3: Copy the Returned User ID

The query will return a UUID. Copy it (looks like: `a123b456-c789-d012-e345-f678g901h234`)

### Step 4: Create Profile Entry

Paste this (replace the UUID with yours from Step 3):

```sql
INSERT INTO public.profiles (id, email, full_name)
VALUES (
  'PASTE_YOUR_UUID_HERE',
  'admin@example.com',
  'Admin User'
);
```

### Step 5: Create User Role

Paste this (replace the UUID again):

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES (
  'PASTE_YOUR_UUID_HERE',
  'admin'
);
```

### Step 6: Test Login

Now you should be able to login with:
- **Email**: admin@example.com
- **Password**: Admin@123

---

## Solution 2: Create Auth Users for All Imported Profiles (Bulk)

If you have many imported profiles and want to create auth users for all of them:

### Step 1: Find All Profiles Without Auth Users

In Supabase SQL Editor, run:

```sql
SELECT 
  p.id,
  p.email,
  p.full_name,
  CASE WHEN au.id IS NULL THEN 'NEEDS AUTH' ELSE 'ALREADY HAS AUTH' END as status
FROM public.profiles p
LEFT JOIN auth.users au ON p.id = au.id
ORDER BY status DESC;
```

This shows which profiles need auth users created.

### Step 2: Generate Passwords for Missing Users

For each profile that needs auth, run this to create a temporary password and auth user:

```sql
-- Get a profile without auth user
WITH profile_to_sync AS (
  SELECT p.id, p.email, p.full_name
  FROM public.profiles p
  LEFT JOIN auth.users au ON p.id = au.id
  WHERE au.id IS NULL
  ORDER BY p.created_at
  LIMIT 1
)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  raw_app_meta_data,
  created_at,
  updated_at
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  pts.id,
  'authenticated',
  'authenticated',
  pts.email,
  crypt('TempPassword123!', gen_salt('bf')),
  NOW(),
  json_build_object('full_name', pts.full_name),
  '{}',
  NOW(),
  NOW()
FROM profile_to_sync pts
RETURNING email;
```

Then check if a user_roles entry exists:

```sql
-- For the email you just created, add a role if missing
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'student'
FROM auth.users
WHERE email = 'PASTE_EMAIL_HERE'
AND id NOT IN (SELECT user_id FROM public.user_roles);
```

### Step 3: Repeat for All Profiles

Run the queries above multiple times, replacing the email each time, until all profiles have auth users.

---

## Solution 3: Use the Sync Function (When Admin Can Login)

Once you have at least one admin authenticated:

1. Deploy the `supabase/functions/sync-profiles-to-auth` function
2. Go to Supabase → Functions → sync-profiles-to-auth
3. Invoke it with header: `X-Recovery-Key: your-recovery-key`

---

## Verify Your Fix

After creating auth users, verify with this query:

```sql
SELECT 
  p.id,
  p.email,
  p.full_name,
  ur.role,
  CASE WHEN au.id IS NOT NULL THEN '✓ Ready to Login' ELSE '✗ Missing Auth' END as login_status
FROM public.profiles p
LEFT JOIN auth.users au ON p.id = au.id
LEFT JOIN public.user_roles ur ON p.id = ur.user_id
ORDER BY p.created_at;
```

---

## Quick Reference: Default Passwords

Use these formats for temporary passwords (users can reset via "Forgot Password"):

- Format: `TempPassword123!` (must include uppercase, lowercase, number, special char)
- For admin: `Admin@123`
- For teachers: `Teacher@123`
- For students: `Student@123`

---

## Common Issues

### "Column encrypted_password does not exist"
You need to use `crypt()` function. This is standard in PostgreSQL with pgcrypto extension enabled in Supabase.

### Can't reset if profiles already exist
If profiles already exist, you cannot use the normal signup flow. You MUST create auth users manually using the SQL above, then they can use forgot password.

### Email not confirmed
The `email_confirmed_at` field is set to `NOW()` to auto-confirm emails so they can login immediately.

---

## Next Steps

1. Create at least one admin user to access the system
2. Have the admin use the bulk import function to create users from CSV
3. Or manually create remaining users one by one using the SQL above
