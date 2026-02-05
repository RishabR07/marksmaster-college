-- Create enum for attendance status
CREATE TYPE public.attendance_status AS ENUM ('present', 'absent', 'late', 'excused');

-- Create attendance table
CREATE TABLE public.attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status attendance_status NOT NULL DEFAULT 'present',
  marked_by UUID NOT NULL REFERENCES auth.users(id),
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(student_id, subject_id, attendance_date)
);

-- Enable RLS
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Students can view their own attendance
CREATE POLICY "Students can view own attendance" ON public.attendance
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM students s
    WHERE s.id = attendance.student_id
    AND s.student_user_id = auth.uid()
  )
);

-- Teachers can view attendance for their subjects
CREATE POLICY "Teachers can view subject attendance" ON public.attendance
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM subjects sub
    WHERE sub.id = attendance.subject_id
    AND sub.teacher_id = auth.uid()
  )
);

-- Teachers can mark attendance for students enrolled in their subjects
CREATE POLICY "Teachers can mark attendance" ON public.attendance
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'teacher'::user_role) AND
  marked_by = auth.uid() AND
  EXISTS (
    SELECT 1 FROM subjects sub
    WHERE sub.id = attendance.subject_id
    AND sub.teacher_id = auth.uid()
  ) AND
  EXISTS (
    SELECT 1 FROM enrollments e
    WHERE e.student_id = attendance.student_id
    AND e.subject_id = attendance.subject_id
  )
);

-- Teachers can update attendance for their subjects
CREATE POLICY "Teachers can update attendance" ON public.attendance
FOR UPDATE USING (
  has_role(auth.uid(), 'teacher'::user_role) AND
  EXISTS (
    SELECT 1 FROM subjects sub
    WHERE sub.id = attendance.subject_id
    AND sub.teacher_id = auth.uid()
  )
);

-- Admins can view all attendance
CREATE POLICY "Admins can view all attendance" ON public.attendance
FOR SELECT USING (has_role(auth.uid(), 'admin'::user_role));

-- Admins can manage all attendance
CREATE POLICY "Admins can insert attendance" ON public.attendance
FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can update attendance" ON public.attendance
FOR UPDATE USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can delete attendance" ON public.attendance
FOR DELETE USING (has_role(auth.uid(), 'admin'::user_role));

-- Add trigger for updated_at
CREATE TRIGGER update_attendance_updated_at
BEFORE UPDATE ON public.attendance
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Add to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;