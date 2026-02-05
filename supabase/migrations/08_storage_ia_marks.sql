-- Create event-images storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-images', 'event-images', true);

-- Allow anyone to view images
CREATE POLICY "Anyone can view event images"
ON storage.objects FOR SELECT
USING (bucket_id = 'event-images');

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload event images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'event-images' AND auth.role() = 'authenticated');

-- Allow users to delete their own images
CREATE POLICY "Users can delete own event images"
ON storage.objects FOR DELETE
USING (bucket_id = 'event-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create ia_marks table for final year students
CREATE TABLE public.ia_marks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  ia1 NUMERIC DEFAULT 0 CHECK (ia1 >= 0 AND ia1 <= 30),
  ia2 NUMERIC DEFAULT 0 CHECK (ia2 >= 0 AND ia2 <= 30),
  ia3 NUMERIC DEFAULT 0 CHECK (ia3 >= 0 AND ia3 <= 30),
  ia4 NUMERIC DEFAULT 0 CHECK (ia4 >= 0 AND ia4 <= 30),
  ia5 NUMERIC DEFAULT 0 CHECK (ia5 >= 0 AND ia5 <= 30),
  course_completion NUMERIC DEFAULT 0 CHECK (course_completion >= 0 AND course_completion <= 40),
  activity_submission NUMERIC DEFAULT 0 CHECK (activity_submission >= 0 AND activity_submission <= 30),
  synopsis_submission NUMERIC DEFAULT 0 CHECK (synopsis_submission >= 0 AND synopsis_submission <= 20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(student_id, subject_id)
);

-- Enable RLS
ALTER TABLE public.ia_marks ENABLE ROW LEVEL SECURITY;

-- Teachers can view IA marks for their subjects
CREATE POLICY "Teachers can view IA marks for their subjects"
ON public.ia_marks FOR SELECT
USING (EXISTS (
  SELECT 1 FROM subjects WHERE subjects.id = ia_marks.subject_id AND subjects.teacher_id = auth.uid()
));

-- Teachers can insert IA marks for their subjects
CREATE POLICY "Teachers can insert IA marks"
ON public.ia_marks FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'teacher'::user_role) AND
  EXISTS (SELECT 1 FROM subjects WHERE subjects.id = ia_marks.subject_id AND subjects.teacher_id = auth.uid())
);

-- Teachers can update IA marks for their subjects
CREATE POLICY "Teachers can update IA marks"
ON public.ia_marks FOR UPDATE
USING (
  has_role(auth.uid(), 'teacher'::user_role) AND
  EXISTS (SELECT 1 FROM subjects WHERE subjects.id = ia_marks.subject_id AND subjects.teacher_id = auth.uid())
);

-- Students can view their own IA marks
CREATE POLICY "Students can view own IA marks"
ON public.ia_marks FOR SELECT
USING (EXISTS (
  SELECT 1 FROM students WHERE students.id = ia_marks.student_id AND students.student_user_id = auth.uid()
));

-- Create trigger for updated_at
CREATE TRIGGER update_ia_marks_updated_at
BEFORE UPDATE ON public.ia_marks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();