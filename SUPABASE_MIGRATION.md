# Complete Supabase Migration Guide

This guide helps you migrate the KPT Student Portal to your own Supabase project.

## Your Supabase Project Details
- **Project URL**: `https://ljbnvddxoxtozvuymedg.supabase.co`
- **Project ID**: `ljbnvddxoxtozvuymedg`

---

## Step 1: Run the SQL Schema

Go to your Supabase Dashboard → SQL Editor → New Query → Paste the following SQL and run it:

```sql
-- =====================================================
-- KPT STUDENT PORTAL - COMPLETE DATABASE SCHEMA
-- =====================================================

-- 1. Create ENUM types
CREATE TYPE public.user_role AS ENUM ('admin', 'teacher', 'student');
CREATE TYPE public.attendance_status AS ENUM ('present', 'absent', 'late', 'excused');

-- 2. Create Tables

-- Profiles table (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Students table
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  roll_number TEXT NOT NULL UNIQUE,
  department TEXT,
  semester INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Subjects table
CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_name TEXT NOT NULL,
  subject_code TEXT NOT NULL,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enrollments table
CREATE TABLE public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, subject_id)
);

-- Attendance table
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status attendance_status NOT NULL DEFAULT 'present',
  marked_by UUID NOT NULL REFERENCES auth.users(id),
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Marks table
CREATE TABLE public.marks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  marks NUMERIC NOT NULL,
  max_marks NUMERIC NOT NULL DEFAULT 100,
  assessment_type TEXT NOT NULL,
  assessment_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, subject_id, assessment_type)
);

-- IA Marks table
CREATE TABLE public.ia_marks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  ia1 NUMERIC DEFAULT 0,
  ia2 NUMERIC DEFAULT 0,
  ia3 NUMERIC DEFAULT 0,
  ia4 NUMERIC DEFAULT 0,
  ia5 NUMERIC DEFAULT 0,
  course_completion NUMERIC DEFAULT 0,
  activity_submission NUMERIC DEFAULT 0,
  synopsis_submission NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, subject_id)
);

-- Events table
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  event_time TIME,
  location TEXT,
  image_url TEXT,
  branch TEXT,
  year_of_studying INTEGER,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Announcements table
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority TEXT DEFAULT 'normal',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Password Reset OTPs table
CREATE TABLE public.password_reset_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create Functions

-- Function to check user role (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role user_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Function to handle new user signup (creates profile automatically)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    NEW.email
  );
  RETURN NEW;
END;
$$;

-- 4. Create Triggers

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Triggers for updated_at
CREATE TRIGGER update_attendance_updated_at
  BEFORE UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_marks_updated_at
  BEFORE UPDATE ON public.marks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_ia_marks_updated_at
  BEFORE UPDATE ON public.ia_marks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 5. Enable Row Level Security (RLS)

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ia_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_otps ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS Policies

-- PROFILES POLICIES
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- USER_ROLES POLICIES
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all user roles" ON public.user_roles FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert user roles" ON public.user_roles FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update user roles" ON public.user_roles FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete user roles" ON public.user_roles FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- STUDENTS POLICIES
CREATE POLICY "Anyone can view students" ON public.students FOR SELECT USING (true);
CREATE POLICY "Admins can insert students" ON public.students FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update students" ON public.students FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete students" ON public.students FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- SUBJECTS POLICIES
CREATE POLICY "Anyone can view subjects" ON public.subjects FOR SELECT USING (true);
CREATE POLICY "Teachers can create subjects" ON public.subjects FOR INSERT WITH CHECK (has_role(auth.uid(), 'teacher') AND auth.uid() = teacher_id);
CREATE POLICY "Teachers can update own subjects" ON public.subjects FOR UPDATE USING (has_role(auth.uid(), 'teacher') AND auth.uid() = teacher_id);
CREATE POLICY "Teachers can delete own subjects" ON public.subjects FOR DELETE USING (has_role(auth.uid(), 'teacher') AND auth.uid() = teacher_id);

-- ENROLLMENTS POLICIES
CREATE POLICY "Anyone can view enrollments" ON public.enrollments FOR SELECT USING (true);
CREATE POLICY "Teachers can enroll students in their subjects" ON public.enrollments FOR INSERT 
  WITH CHECK (has_role(auth.uid(), 'teacher') AND EXISTS (
    SELECT 1 FROM public.subjects WHERE id = subject_id AND teacher_id = auth.uid()
  ));
CREATE POLICY "Teachers can remove enrollments from their subjects" ON public.enrollments FOR DELETE 
  USING (has_role(auth.uid(), 'teacher') AND EXISTS (
    SELECT 1 FROM public.subjects WHERE id = subject_id AND teacher_id = auth.uid()
  ));

-- ATTENDANCE POLICIES
CREATE POLICY "Students can view own attendance" ON public.attendance FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.student_user_id = auth.uid()));
CREATE POLICY "Teachers can view subject attendance" ON public.attendance FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.subjects sub WHERE sub.id = subject_id AND sub.teacher_id = auth.uid()));
CREATE POLICY "Admins can view all attendance" ON public.attendance FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Teachers can mark attendance" ON public.attendance FOR INSERT 
  WITH CHECK (
    has_role(auth.uid(), 'teacher') 
    AND marked_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.subjects sub WHERE sub.id = subject_id AND sub.teacher_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.enrollments e WHERE e.student_id = attendance.student_id AND e.subject_id = attendance.subject_id)
  );
CREATE POLICY "Teachers can update attendance" ON public.attendance FOR UPDATE 
  USING (has_role(auth.uid(), 'teacher') AND EXISTS (SELECT 1 FROM public.subjects sub WHERE sub.id = subject_id AND sub.teacher_id = auth.uid()));
CREATE POLICY "Admins can insert attendance" ON public.attendance FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update attendance" ON public.attendance FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete attendance" ON public.attendance FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- MARKS POLICIES
CREATE POLICY "Students can view own marks" ON public.marks FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.student_user_id = auth.uid()));
CREATE POLICY "Teachers can view subject marks" ON public.marks FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.subjects sub WHERE sub.id = subject_id AND sub.teacher_id = auth.uid()));
CREATE POLICY "Admins can view all marks" ON public.marks FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Teachers can insert marks" ON public.marks FOR INSERT 
  WITH CHECK (has_role(auth.uid(), 'teacher') AND EXISTS (SELECT 1 FROM public.subjects WHERE id = subject_id AND teacher_id = auth.uid()));
CREATE POLICY "Teachers can update marks" ON public.marks FOR UPDATE 
  USING (has_role(auth.uid(), 'teacher') AND EXISTS (SELECT 1 FROM public.subjects WHERE id = subject_id AND teacher_id = auth.uid()));

-- IA_MARKS POLICIES
CREATE POLICY "Students can view own IA marks" ON public.ia_marks FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.students WHERE id = student_id AND student_user_id = auth.uid()));
CREATE POLICY "Teachers can view IA marks for their subjects" ON public.ia_marks FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.subjects WHERE id = subject_id AND teacher_id = auth.uid()));
CREATE POLICY "Teachers can insert IA marks" ON public.ia_marks FOR INSERT 
  WITH CHECK (has_role(auth.uid(), 'teacher') AND EXISTS (SELECT 1 FROM public.subjects WHERE id = subject_id AND teacher_id = auth.uid()));
CREATE POLICY "Teachers can update IA marks" ON public.ia_marks FOR UPDATE 
  USING (has_role(auth.uid(), 'teacher') AND EXISTS (SELECT 1 FROM public.subjects WHERE id = subject_id AND teacher_id = auth.uid()));

-- EVENTS POLICIES
CREATE POLICY "Anyone can view events" ON public.events FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create events" ON public.events FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update own events" ON public.events FOR UPDATE USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can delete own events" ON public.events FOR DELETE USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'));

-- ANNOUNCEMENTS POLICIES
CREATE POLICY "Anyone can view announcements" ON public.announcements FOR SELECT USING (true);
CREATE POLICY "Admins and teachers can create announcements" ON public.announcements FOR INSERT 
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'teacher'));
CREATE POLICY "Users can update own announcements" ON public.announcements FOR UPDATE 
  USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can delete own announcements" ON public.announcements FOR DELETE 
  USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'));

-- PASSWORD_RESET_OTPS POLICIES (service role only access)
CREATE POLICY "Service role only" ON public.password_reset_otps FOR ALL USING (false);

-- 7. Create Storage Bucket for Event Images
INSERT INTO storage.buckets (id, name, public) VALUES ('event-images', 'event-images', true);

-- Storage policies
CREATE POLICY "Public can view event images" ON storage.objects FOR SELECT USING (bucket_id = 'event-images');
CREATE POLICY "Authenticated users can upload event images" ON storage.objects FOR INSERT 
  WITH CHECK (bucket_id = 'event-images' AND auth.role() = 'authenticated');
CREATE POLICY "Users can update their own event images" ON storage.objects FOR UPDATE 
  USING (bucket_id = 'event-images' AND auth.role() = 'authenticated');
CREATE POLICY "Users can delete their own event images" ON storage.objects FOR DELETE 
  USING (bucket_id = 'event-images' AND auth.role() = 'authenticated');
```

---

## Step 2: Create Your First Admin User

After running the SQL above, create a user in Supabase Authentication:

1. Go to **Authentication** → **Users** → **Add User**
2. Enter your email and password
3. After user is created, run this SQL to make them an admin:

```sql
-- Replace 'your-user-id-here' with the actual UUID from the Users table
INSERT INTO public.user_roles (user_id, role) 
VALUES ('your-user-id-here', 'admin');
```

---

## Step 3: Configure Edge Functions Secrets

Go to **Project Settings** → **Edge Functions** → **Secrets** and add:

| Secret Name | Value |
|-------------|-------|
| `GMAIL_APP_PASSWORD` | Your Gmail App Password (not regular password) |

### How to Get Gmail App Password:
1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable 2-Factor Authentication
3. Go to App Passwords
4. Create new app password for "Mail"
5. Copy the 16-character password

---

## Step 4: Deploy Edge Functions

Install Supabase CLI and deploy functions:

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref ljbnvddxoxtozvuymedg

# Deploy functions
supabase functions deploy send-otp
supabase functions deploy verify-otp
supabase functions deploy send-enrollment-notification
supabase functions deploy send-marks-notification
```

---

## Step 5: Update Environment Variables

When you deploy this app (Vercel/Netlify), set these environment variables:

```env
VITE_SUPABASE_URL=https://ljbnvddxoxtozvuymedg.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqYm52ZGR4b3h0b3p2dXltZWRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMDM2ODksImV4cCI6MjA4NTg3OTY4OX0.sTKt_R3mssEjvD679sDShLkaS-c61PzH6MyAqrHF4QM
VITE_SUPABASE_PROJECT_ID=ljbnvddxoxtozvuymedg
```

---

## Step 6: Update Supabase Client File

After exporting to GitHub, update `src/integrations/supabase/client.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ljbnvddxoxtozvuymedg.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqYm52ZGR4b3h0b3p2dXltZWRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMDM2ODksImV4cCI6MjA4NTg3OTY4OX0.sTKt_R3mssEjvD679sDShLkaS-c61PzH6MyAqrHF4QM";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

---

## Step 7: Export Project to GitHub

In Lovable:
1. Click **Settings** (gear icon)
2. Go to **Git** tab
3. Click **Connect to GitHub**
4. Create a new repository

Then deploy to Vercel or Netlify with the environment variables from Step 5.

---

## Summary Checklist

- [ ] Run SQL schema in Supabase SQL Editor
- [ ] Create admin user and assign role
- [ ] Add GMAIL_APP_PASSWORD secret
- [ ] Deploy Edge Functions via CLI
- [ ] Export project to GitHub
- [ ] Update Supabase client with new credentials
- [ ] Deploy to Vercel/Netlify with env variables

---

**Your Supabase Dashboard**: https://supabase.com/dashboard/project/ljbnvddxoxtozvuymedg
