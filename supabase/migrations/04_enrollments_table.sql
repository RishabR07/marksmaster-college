-- Create enrollments table to link students with subjects
CREATE TABLE public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(student_id, subject_id)
);

-- Enable RLS
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for enrollments
CREATE POLICY "Anyone can view enrollments"
  ON public.enrollments
  FOR SELECT
  USING (true);

CREATE POLICY "Teachers can enroll students in their subjects"
  ON public.enrollments
  FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'teacher'::user_role) AND
    EXISTS (
      SELECT 1 FROM public.subjects
      WHERE subjects.id = subject_id AND subjects.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can remove enrollments from their subjects"
  ON public.enrollments
  FOR DELETE
  USING (
    has_role(auth.uid(), 'teacher'::user_role) AND
    EXISTS (
      SELECT 1 FROM public.subjects
      WHERE subjects.id = subject_id AND subjects.teacher_id = auth.uid()
    )
  );

-- Create index for faster queries
CREATE INDEX idx_enrollments_student_id ON public.enrollments(student_id);
CREATE INDEX idx_enrollments_subject_id ON public.enrollments(subject_id);