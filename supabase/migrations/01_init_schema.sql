-- Create enum for user roles
CREATE TYPE public.user_role AS ENUM ('teacher', 'student');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_roles table for role management
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role user_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Create subjects table
CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subject_name TEXT NOT NULL,
  subject_code TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teacher_id, subject_code)
);

-- Create students table
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  roll_number TEXT NOT NULL UNIQUE,
  department TEXT,
  semester INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create marks table
CREATE TABLE public.marks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  marks DECIMAL(5,2) NOT NULL CHECK (marks >= 0 AND marks <= 100),
  max_marks DECIMAL(5,2) NOT NULL DEFAULT 100,
  assessment_type TEXT NOT NULL,
  assessment_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subject_id, student_id, assessment_type)
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marks ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role user_role)
RETURNS BOOLEAN
LANGUAGE SQL
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

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policies for subjects
CREATE POLICY "Anyone can view subjects"
  ON public.subjects FOR SELECT
  USING (true);

CREATE POLICY "Teachers can create subjects"
  ON public.subjects FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'teacher') AND auth.uid() = teacher_id);

CREATE POLICY "Teachers can update own subjects"
  ON public.subjects FOR UPDATE
  USING (public.has_role(auth.uid(), 'teacher') AND auth.uid() = teacher_id);

CREATE POLICY "Teachers can delete own subjects"
  ON public.subjects FOR DELETE
  USING (public.has_role(auth.uid(), 'teacher') AND auth.uid() = teacher_id);

-- RLS Policies for students
CREATE POLICY "Anyone can view students"
  ON public.students FOR SELECT
  USING (true);

CREATE POLICY "Teachers can create student records"
  ON public.students FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'teacher'));

CREATE POLICY "Teachers can update student records"
  ON public.students FOR UPDATE
  USING (public.has_role(auth.uid(), 'teacher'));

-- RLS Policies for marks
CREATE POLICY "Students can view own marks"
  ON public.marks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.students
      WHERE students.id = marks.student_id
      AND students.student_user_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can view marks for their subjects"
  ON public.marks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.subjects
      WHERE subjects.id = marks.subject_id
      AND subjects.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can add marks for their subjects"
  ON public.marks FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'teacher') AND
    EXISTS (
      SELECT 1 FROM public.subjects
      WHERE subjects.id = marks.subject_id
      AND subjects.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can update marks for their subjects"
  ON public.marks FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'teacher') AND
    EXISTS (
      SELECT 1 FROM public.subjects
      WHERE subjects.id = marks.subject_id
      AND subjects.teacher_id = auth.uid()
    )
  );

-- Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_marks_updated_at
  BEFORE UPDATE ON public.marks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Create trigger to create profile on user signup
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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();