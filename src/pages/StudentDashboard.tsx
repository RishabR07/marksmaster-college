import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { LogOut, GraduationCap, Award } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Mark {
  id: string;
  marks: number;
  max_marks: number;
  assessment_type: string;
  assessment_date: string;
  subjects: {
    subject_name: string;
    subject_code: string;
    profiles: { full_name: string };
  };
}

const StudentDashboard = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [marks, setMarks] = useState<Mark[]>([]);
  const [studentInfo, setStudentInfo] = useState<any>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchStudentInfo();
      fetchMarks();
    }
  }, [user]);

  const fetchStudentInfo = async () => {
    const { data, error } = await supabase
      .from("students")
      .select("id, roll_number, department, student_user_id")
      .eq("student_user_id", user?.id)
      .single();

    if (error) {
      toast.error("Failed to fetch student information");
      return;
    }

    if (data) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", data.student_user_id)
        .single();

      setStudentInfo({
        ...data,
        profiles: {
          full_name: profileData?.full_name || "Unknown"
        }
      });
    }
  };

  const fetchMarks = async () => {
    // First get student ID
    const { data: studentData } = await supabase
      .from("students")
      .select("id")
      .eq("student_user_id", user?.id)
      .single();

    if (!studentData) return;

    const { data, error } = await supabase
      .from("marks")
      .select(`
        id,
        marks,
        max_marks,
        assessment_type,
        assessment_date,
        subjects(
          subject_name,
          subject_code,
          teacher_id
        )
      `)
      .eq("student_id", studentData.id)
      .order("assessment_date", { ascending: false });

    if (error) {
      toast.error("Failed to fetch marks");
      return;
    }

    // Fetch teacher profiles separately
    if (data) {
      const teacherIds = [...new Set(data.map(m => m.subjects.teacher_id))];
      const { data: teacherProfiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", teacherIds);

      const profileMap = new Map(teacherProfiles?.map(p => [p.id, p.full_name]));

      const marksWithTeachers = data.map(mark => ({
        ...mark,
        subjects: {
          ...mark.subjects,
          profiles: {
            full_name: profileMap.get(mark.subjects.teacher_id) || "Unknown"
          }
        }
      }));

      setMarks(marksWithTeachers);
    }
  };

  const getPercentage = (marks: number, maxMarks: number) => {
    return ((marks / maxMarks) * 100).toFixed(2);
  };

  const getGrade = (percentage: number) => {
    if (percentage >= 90) return "A+";
    if (percentage >= 80) return "A";
    if (percentage >= 70) return "B+";
    if (percentage >= 60) return "B";
    if (percentage >= 50) return "C";
    return "F";
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-[var(--shadow-sm)]">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Student Dashboard</h1>
          </div>
          <Button variant="outline" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {studentInfo && (
          <Card className="shadow-[var(--shadow-md)]" style={{ background: "var(--gradient-card)" }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" />
                Student Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-semibold">{studentInfo.profiles.full_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Roll Number</p>
                <p className="font-semibold">{studentInfo.roll_number}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Department</p>
                <p className="font-semibold">{studentInfo.department}</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-[var(--shadow-md)]">
          <CardHeader>
            <CardTitle>Assessment Marks</CardTitle>
            <CardDescription>View your marks across all subjects</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {marks.map((mark) => {
                const percentage = parseFloat(getPercentage(mark.marks, mark.max_marks));
                const grade = getGrade(percentage);
                
                return (
                  <Card key={mark.id} className="shadow-[var(--shadow-sm)]">
                    <CardContent className="pt-6">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <h3 className="font-semibold text-lg">
                            {mark.subjects.subject_name}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {mark.subjects.subject_code} • {mark.assessment_type}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Teacher: {mark.subjects.profiles.full_name}
                          </p>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-center">
                            <p className="text-2xl font-bold text-primary">
                              {mark.marks}/{mark.max_marks}
                            </p>
                            <p className="text-sm text-muted-foreground">Marks</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-accent">
                              {percentage}%
                            </p>
                            <p className="text-sm text-muted-foreground">Percentage</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-success">
                              {grade}
                            </p>
                            <p className="text-sm text-muted-foreground">Grade</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            {marks.length === 0 && (
              <p className="text-muted-foreground text-center py-8">
                No marks available yet
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default StudentDashboard;
