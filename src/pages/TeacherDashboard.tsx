import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { LogOut, BookOpen, Users, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Subject {
  id: string;
  subject_name: string;
  subject_code: string;
}

interface Student {
  id: string;
  roll_number: string;
  department: string;
  profiles: { full_name: string };
}

const TeacherDashboard = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [selectedStudent, setSelectedStudent] = useState<string>("");

  // Form states
  const [subjectName, setSubjectName] = useState("");
  const [subjectCode, setSubjectCode] = useState("");
  const [marks, setMarks] = useState("");
  const [maxMarks, setMaxMarks] = useState("100");
  const [assessmentType, setAssessmentType] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchSubjects();
      fetchStudents();
    }
  }, [user]);

  const fetchSubjects = async () => {
    const { data, error } = await supabase
      .from("subjects")
      .select("*")
      .eq("teacher_id", user?.id);

    if (error) {
      toast.error("Failed to fetch subjects");
    } else {
      setSubjects(data || []);
    }
  };

  const fetchStudents = async () => {
    const { data, error } = await supabase
      .from("students")
      .select("id, roll_number, department, student_user_id");

    if (error) {
      toast.error("Failed to fetch students");
      return;
    }

    if (data) {
      const userIds = data.map(s => s.student_user_id);
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      const profileMap = new Map(profilesData?.map(p => [p.id, p.full_name]));

      const studentsWithProfiles = data.map(student => ({
        ...student,
        profiles: {
          full_name: profileMap.get(student.student_user_id) || "Unknown"
        }
      }));

      setStudents(studentsWithProfiles);
    }
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("subjects").insert({
      teacher_id: user?.id,
      subject_name: subjectName,
      subject_code: subjectCode,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Subject added successfully!");
      setSubjectName("");
      setSubjectCode("");
      fetchSubjects();
    }
  };

  const handleAddMarks = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedSubject || !selectedStudent) {
      toast.error("Please select both subject and student");
      return;
    }

    const { error } = await supabase.from("marks").upsert({
      subject_id: selectedSubject,
      student_id: selectedStudent,
      marks: parseFloat(marks),
      max_marks: parseFloat(maxMarks),
      assessment_type: assessmentType,
    }, {
      onConflict: "subject_id,student_id,assessment_type"
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Marks added successfully!");
      setMarks("");
      setAssessmentType("");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-[var(--shadow-sm)]">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Teacher Dashboard</h1>
          </div>
          <Button variant="outline" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="subjects" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="subjects">
              <BookOpen className="h-4 w-4 mr-2" />
              Subjects
            </TabsTrigger>
            <TabsTrigger value="marks">
              <FileText className="h-4 w-4 mr-2" />
              Add Marks
            </TabsTrigger>
          </TabsList>

          <TabsContent value="subjects" className="space-y-6">
            <Card className="shadow-[var(--shadow-md)]">
              <CardHeader>
                <CardTitle>Add New Subject</CardTitle>
                <CardDescription>Create a new subject to manage assessments</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddSubject} className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="subject-name">Subject Name</Label>
                      <Input
                        id="subject-name"
                        placeholder="Data Structures"
                        value={subjectName}
                        onChange={(e) => setSubjectName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="subject-code">Subject Code</Label>
                      <Input
                        id="subject-code"
                        placeholder="CS301"
                        value={subjectCode}
                        onChange={(e) => setSubjectCode(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <Button type="submit">Add Subject</Button>
                </form>
              </CardContent>
            </Card>

            <Card className="shadow-[var(--shadow-md)]">
              <CardHeader>
                <CardTitle>My Subjects</CardTitle>
                <CardDescription>Subjects you're currently teaching</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {subjects.map((subject) => (
                    <Card key={subject.id} className="shadow-[var(--shadow-sm)]">
                      <CardHeader>
                        <CardTitle className="text-lg">{subject.subject_name}</CardTitle>
                        <CardDescription>{subject.subject_code}</CardDescription>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
                {subjects.length === 0 && (
                  <p className="text-muted-foreground text-center py-8">No subjects added yet</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="marks" className="space-y-6">
            <Card className="shadow-[var(--shadow-md)]">
              <CardHeader>
                <CardTitle>Add Marks</CardTitle>
                <CardDescription>Enter marks for your students</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddMarks} className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="subject">Subject</Label>
                      <select
                        id="subject"
                        className="w-full rounded-md border border-input bg-background px-3 py-2"
                        value={selectedSubject}
                        onChange={(e) => setSelectedSubject(e.target.value)}
                        required
                      >
                        <option value="">Select Subject</option>
                        {subjects.map((subject) => (
                          <option key={subject.id} value={subject.id}>
                            {subject.subject_name} ({subject.subject_code})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="student">Student</Label>
                      <select
                        id="student"
                        className="w-full rounded-md border border-input bg-background px-3 py-2"
                        value={selectedStudent}
                        onChange={(e) => setSelectedStudent(e.target.value)}
                        required
                      >
                        <option value="">Select Student</option>
                        {students.map((student) => (
                          <option key={student.id} value={student.id}>
                            {student.profiles.full_name} ({student.roll_number})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="assessment-type">Assessment Type</Label>
                      <Input
                        id="assessment-type"
                        placeholder="Mid-term / Quiz 1"
                        value={assessmentType}
                        onChange={(e) => setAssessmentType(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="marks">Marks Obtained</Label>
                      <Input
                        id="marks"
                        type="number"
                        step="0.01"
                        placeholder="85"
                        value={marks}
                        onChange={(e) => setMarks(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max-marks">Max Marks</Label>
                      <Input
                        id="max-marks"
                        type="number"
                        step="0.01"
                        value={maxMarks}
                        onChange={(e) => setMaxMarks(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <Button type="submit">Add Marks</Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default TeacherDashboard;
