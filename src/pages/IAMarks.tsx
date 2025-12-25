import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { LogOut, BookOpen, Save, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Subject {
  id: string;
  subject_name: string;
  subject_code: string;
}

interface EnrolledStudent {
  id: string;
  roll_number: string;
  student_user_id: string;
  profiles: { full_name: string };
}

interface IAMarksData {
  id?: string;
  student_id: string;
  subject_id: string;
  ia1: number;
  ia2: number;
  ia3: number;
  ia4: number;
  ia5: number;
  course_completion: number;
  activity_submission: number;
  synopsis_submission: number;
}

const IAMarks = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudent[]>([]);
  const [marksData, setMarksData] = useState<Record<string, IAMarksData>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchSubjects();
    }
  }, [user]);

  useEffect(() => {
    if (selectedSubject) {
      fetchEnrolledStudents();
    }
  }, [selectedSubject]);

  const fetchSubjects = async () => {
    const { data, error } = await supabase
      .from("subjects")
      .select("*")
      .eq("teacher_id", user?.id);

    if (!error && data) {
      setSubjects(data);
    }
  };

  const fetchEnrolledStudents = async () => {
    if (!selectedSubject) return;

    // Fetch enrolled students (only 3rd year / final year)
    const { data: enrollments, error } = await supabase
      .from("enrollments")
      .select(`
        id,
        student_id,
        students!inner(
          id,
          roll_number,
          student_user_id,
          semester
        )
      `)
      .eq("subject_id", selectedSubject);

    if (error) {
      toast.error("Failed to fetch students");
      return;
    }

    if (enrollments) {
      // Filter for 3rd year students (semester 5 or 6)
      const thirdYearEnrollments = enrollments.filter(
        (e: any) => e.students.semester >= 5 || e.students.semester === null
      );

      const userIds = thirdYearEnrollments.map((e: any) => e.students.student_user_id);
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      const profileMap = new Map(profilesData?.map(p => [p.id, p.full_name]));

      const students = thirdYearEnrollments.map((enrollment: any) => ({
        id: enrollment.students.id,
        roll_number: enrollment.students.roll_number,
        student_user_id: enrollment.students.student_user_id,
        profiles: {
          full_name: profileMap.get(enrollment.students.student_user_id) || "Unknown"
        }
      }));

      setEnrolledStudents(students);

      // Fetch existing IA marks
      const studentIds = students.map(s => s.id);
      const { data: existingMarks } = await supabase
        .from("ia_marks")
        .select("*")
        .eq("subject_id", selectedSubject)
        .in("student_id", studentIds);

      const marksMap: Record<string, IAMarksData> = {};
      students.forEach(student => {
        const existing = existingMarks?.find(m => m.student_id === student.id);
        marksMap[student.id] = existing || {
          student_id: student.id,
          subject_id: selectedSubject,
          ia1: 0,
          ia2: 0,
          ia3: 0,
          ia4: 0,
          ia5: 0,
          course_completion: 0,
          activity_submission: 0,
          synopsis_submission: 0,
        };
      });
      setMarksData(marksMap);
    }
  };

  const updateMark = (studentId: string, field: keyof IAMarksData, value: number) => {
    setMarksData(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value,
      }
    }));
  };

  const calculateTotal = (data: IAMarksData): number => {
    return (
      (data.ia1 || 0) +
      (data.ia2 || 0) +
      (data.ia3 || 0) +
      (data.ia4 || 0) +
      (data.ia5 || 0) +
      (data.course_completion || 0) +
      (data.activity_submission || 0) +
      (data.synopsis_submission || 0)
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const marksToUpsert = Object.values(marksData).map(data => ({
        ...data,
        subject_id: selectedSubject,
      }));

      const { error } = await supabase
        .from("ia_marks")
        .upsert(marksToUpsert, {
          onConflict: "student_id,subject_id"
        });

      if (error) throw error;
      toast.success("IA Marks saved successfully!");
    } catch (error: any) {
      toast.error("Failed to save marks: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/teacher")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">IA Marks - Final Year</h1>
            </div>
          </div>
          <Button variant="outline" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="mb-6 border border-white dark:border-white/10">
          <CardHeader>
            <CardTitle>Internal Assessment Marks</CardTitle>
            <CardDescription>
              Manage IA marks for 3rd year (final year) students. Total: 240 marks
              <br />
              <span className="text-xs">
                IA1-IA5: 30 marks each (150) | Course Completion: 40 | Activity: 30 | Synopsis: 20
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4 mb-6">
              <div className="flex-1 max-w-xs">
                <Label>Select Subject</Label>
                <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map(subject => (
                      <SelectItem key={subject.id} value={subject.id}>
                        {subject.subject_name} ({subject.subject_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedSubject && enrolledStudents.length > 0 && (
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Saving..." : "Save All"}
                </Button>
              )}
            </div>

            {selectedSubject && enrolledStudents.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No 3rd year students enrolled in this subject.
              </div>
            )}

            {selectedSubject && enrolledStudents.length > 0 && (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background">Roll No</TableHead>
                      <TableHead className="sticky left-20 bg-background">Name</TableHead>
                      <TableHead className="text-center">IA1<br/><span className="text-xs font-normal">/30</span></TableHead>
                      <TableHead className="text-center">IA2<br/><span className="text-xs font-normal">/30</span></TableHead>
                      <TableHead className="text-center">IA3<br/><span className="text-xs font-normal">/30</span></TableHead>
                      <TableHead className="text-center">IA4<br/><span className="text-xs font-normal">/30</span></TableHead>
                      <TableHead className="text-center">IA5<br/><span className="text-xs font-normal">/30</span></TableHead>
                      <TableHead className="text-center">Course<br/><span className="text-xs font-normal">/40</span></TableHead>
                      <TableHead className="text-center">Activity<br/><span className="text-xs font-normal">/30</span></TableHead>
                      <TableHead className="text-center">Synopsis<br/><span className="text-xs font-normal">/20</span></TableHead>
                      <TableHead className="text-center font-bold">Total<br/><span className="text-xs font-normal">/240</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {enrolledStudents.map(student => (
                      <TableRow key={student.id}>
                        <TableCell className="sticky left-0 bg-background font-medium">
                          {student.roll_number}
                        </TableCell>
                        <TableCell className="sticky left-20 bg-background">
                          {student.profiles.full_name}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            max="30"
                            className="w-16 text-center"
                            value={marksData[student.id]?.ia1 || ""}
                            onChange={e => updateMark(student.id, "ia1", Math.min(30, Number(e.target.value)))}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            max="30"
                            className="w-16 text-center"
                            value={marksData[student.id]?.ia2 || ""}
                            onChange={e => updateMark(student.id, "ia2", Math.min(30, Number(e.target.value)))}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            max="30"
                            className="w-16 text-center"
                            value={marksData[student.id]?.ia3 || ""}
                            onChange={e => updateMark(student.id, "ia3", Math.min(30, Number(e.target.value)))}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            max="30"
                            className="w-16 text-center"
                            value={marksData[student.id]?.ia4 || ""}
                            onChange={e => updateMark(student.id, "ia4", Math.min(30, Number(e.target.value)))}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            max="30"
                            className="w-16 text-center"
                            value={marksData[student.id]?.ia5 || ""}
                            onChange={e => updateMark(student.id, "ia5", Math.min(30, Number(e.target.value)))}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            max="40"
                            className="w-16 text-center"
                            value={marksData[student.id]?.course_completion || ""}
                            onChange={e => updateMark(student.id, "course_completion", Math.min(40, Number(e.target.value)))}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            max="30"
                            className="w-16 text-center"
                            value={marksData[student.id]?.activity_submission || ""}
                            onChange={e => updateMark(student.id, "activity_submission", Math.min(30, Number(e.target.value)))}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            max="20"
                            className="w-16 text-center"
                            value={marksData[student.id]?.synopsis_submission || ""}
                            onChange={e => updateMark(student.id, "synopsis_submission", Math.min(20, Number(e.target.value)))}
                          />
                        </TableCell>
                        <TableCell className="text-center font-bold">
                          {marksData[student.id] ? calculateTotal(marksData[student.id]) : 0}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default IAMarks;