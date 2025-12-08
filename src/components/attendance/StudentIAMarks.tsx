import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

interface IAMark {
  id: string;
  ia1: number | null;
  ia2: number | null;
  ia3: number | null;
  ia4: number | null;
  ia5: number | null;
  course_completion: number | null;
  activity_submission: number | null;
  synopsis_submission: number | null;
  subjects: {
    subject_name: string;
    subject_code: string;
  };
}

interface StudentIAMarksProps {
  studentUserId: string;
}

export const StudentIAMarks = ({ studentUserId }: StudentIAMarksProps) => {
  const [iaMarks, setIAMarks] = useState<IAMark[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchIAMarks();
  }, [studentUserId]);

  const fetchIAMarks = async () => {
    try {
      // First get the student record
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("id")
        .eq("student_user_id", studentUserId)
        .maybeSingle();

      if (studentError) throw studentError;
      if (!studentData) {
        setLoading(false);
        return;
      }

      // Fetch IA marks for the student
      const { data, error } = await supabase
        .from("ia_marks")
        .select(`
          id,
          ia1,
          ia2,
          ia3,
          ia4,
          ia5,
          course_completion,
          activity_submission,
          synopsis_submission,
          subjects(
            subject_name,
            subject_code
          )
        `)
        .eq("student_id", studentData.id);

      if (error) throw error;
      setIAMarks(data || []);
    } catch (error: any) {
      toast.error("Failed to fetch IA marks");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = (mark: IAMark) => {
    const ia1 = mark.ia1 || 0;
    const ia2 = mark.ia2 || 0;
    const ia3 = mark.ia3 || 0;
    const ia4 = mark.ia4 || 0;
    const ia5 = mark.ia5 || 0;
    const courseCompletion = mark.course_completion || 0;
    const activitySubmission = mark.activity_submission || 0;
    const synopsisSubmission = mark.synopsis_submission || 0;

    return ia1 + ia2 + ia3 + ia4 + ia5 + courseCompletion + activitySubmission + synopsisSubmission;
  };

  const getPercentage = (total: number) => {
    return ((total / 240) * 100).toFixed(1);
  };

  if (loading) {
    return <p className="text-center text-muted-foreground py-4">Loading IA marks...</p>;
  }

  if (iaMarks.length === 0) {
    return <p className="text-center text-muted-foreground py-8">No IA marks available yet</p>;
  }

  return (
    <div className="space-y-4">
      {iaMarks.map((mark) => {
        const total = calculateTotal(mark);
        const percentage = parseFloat(getPercentage(total));

        return (
          <Card key={mark.id} className="shadow-[var(--shadow-sm)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{mark.subjects.subject_name}</CardTitle>
              <CardDescription>{mark.subjects.subject_code}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Internal Assessments */}
              <div className="grid grid-cols-5 gap-2 text-center">
                <div className="p-2 rounded-md bg-muted">
                  <p className="text-xs text-muted-foreground">IA1</p>
                  <p className="font-semibold">{mark.ia1 ?? "-"}/30</p>
                </div>
                <div className="p-2 rounded-md bg-muted">
                  <p className="text-xs text-muted-foreground">IA2</p>
                  <p className="font-semibold">{mark.ia2 ?? "-"}/30</p>
                </div>
                <div className="p-2 rounded-md bg-muted">
                  <p className="text-xs text-muted-foreground">IA3</p>
                  <p className="font-semibold">{mark.ia3 ?? "-"}/30</p>
                </div>
                <div className="p-2 rounded-md bg-muted">
                  <p className="text-xs text-muted-foreground">IA4</p>
                  <p className="font-semibold">{mark.ia4 ?? "-"}/30</p>
                </div>
                <div className="p-2 rounded-md bg-muted">
                  <p className="text-xs text-muted-foreground">IA5</p>
                  <p className="font-semibold">{mark.ia5 ?? "-"}/30</p>
                </div>
              </div>

              {/* Other Components */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-md bg-muted">
                  <p className="text-xs text-muted-foreground">Course Completion</p>
                  <p className="font-semibold">{mark.course_completion ?? "-"}/40</p>
                </div>
                <div className="p-2 rounded-md bg-muted">
                  <p className="text-xs text-muted-foreground">Activity Submission</p>
                  <p className="font-semibold">{mark.activity_submission ?? "-"}/30</p>
                </div>
                <div className="p-2 rounded-md bg-muted">
                  <p className="text-xs text-muted-foreground">Synopsis Submission</p>
                  <p className="font-semibold">{mark.synopsis_submission ?? "-"}/20</p>
                </div>
              </div>

              {/* Total and Progress */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Total: {total}/240</span>
                  <span className="text-sm font-semibold text-primary">{percentage}%</span>
                </div>
                <Progress value={percentage} className="h-2" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
