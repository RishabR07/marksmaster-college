import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { LogOut, BookOpen, Users, FileText, Upload, Loader2, Calendar, CalendarDays, Megaphone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { TeacherAttendance } from "@/components/attendance/TeacherAttendance";
import { EventsList } from "@/components/events/EventsList";
import { AnnouncementsList } from "@/components/events/AnnouncementsList";

interface Subject {
  id: string;
  subject_name: string;
  subject_code: string;
}

interface Student {
  id: string;
  roll_number: string;
  department: string;
  student_user_id: string;
  profiles: { full_name: string; email?: string };
}

interface EnrolledStudent extends Student {
  enrollment_id: string;
}

const TeacherDashboard = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudent[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [selectedStudent, setSelectedStudent] = useState<string>("");
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showStudentBulkImport, setShowStudentBulkImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importingStudents, setImportingStudents] = useState(false);
  const [importResults, setImportResults] = useState<{ roll_number: string; action: string }[]>([]);
  const [importErrors, setImportErrors] = useState<{ roll_number: string; error: string }[]>([]);
  const [studentImportResults, setStudentImportResults] = useState<{ email: string; password: string; roll_number: string }[]>([]);
  const [studentImportErrors, setStudentImportErrors] = useState<{ email: string; roll_number: string; error: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const studentFileInputRef = useRef<HTMLInputElement>(null);

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

  const fetchEnrolledStudents = async () => {
    if (!selectedSubject) {
      setEnrolledStudents([]);
      return;
    }

    const { data, error } = await supabase
      .from("enrollments")
      .select(`
        id,
        student_id,
        students!inner(
          id,
          roll_number,
          department,
          student_user_id
        )
      `)
      .eq("subject_id", selectedSubject);

    if (error) {
      toast.error("Failed to fetch enrolled students");
      return;
    }

    if (data) {
      const userIds = data.map((e: any) => e.students.student_user_id);
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      const profileMap = new Map(profilesData?.map(p => [p.id, p.full_name]));

      const enrolled = data.map((enrollment: any) => ({
        enrollment_id: enrollment.id,
        id: enrollment.students.id,
        roll_number: enrollment.students.roll_number,
        department: enrollment.students.department,
        student_user_id: enrollment.students.student_user_id,
        profiles: {
          full_name: profileMap.get(enrollment.students.student_user_id) || "Unknown"
        }
      }));

      setEnrolledStudents(enrolled);
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
      
      // Send marks notification
      try {
        const student = enrolledStudents.find(s => s.id === selectedStudent);
        const subject = subjects.find(s => s.id === selectedSubject);
        const { data: studentProfile } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", student?.student_user_id)
          .single();

        if (student && subject && studentProfile) {
          const { data: session } = await supabase.auth.getSession();
          
          await supabase.functions.invoke('send-marks-notification', {
            body: {
              studentEmail: studentProfile.email,
              studentName: student.profiles.full_name,
              subjectName: subject.subject_name,
              subjectCode: subject.subject_code,
              marks: parseFloat(marks),
              maxMarks: parseFloat(maxMarks),
              assessmentType: assessmentType,
              assessmentDate: new Date().toISOString().split('T')[0]
            },
            headers: {
              Authorization: `Bearer ${session.session?.access_token}`
            }
          });
        }
      } catch (emailError: any) {
        console.error('Failed to send marks notification:', emailError);
      }
    }
  };

  const handleBulkImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error("Please upload a CSV file");
      return;
    }

    if (!selectedSubject) {
      toast.error("Please select a subject first");
      return;
    }

    setImporting(true);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        throw new Error("CSV file must have a header row and at least one data row");
      }

      const headers = lines[0].split(',').map(h => h.trim());
      
      const marks = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const mark: any = {};
        
        headers.forEach((header, index) => {
          if (header === 'marks' || header === 'max_marks') {
            mark[header] = values[index] ? parseFloat(values[index]) : undefined;
          } else {
            mark[header] = values[index] || undefined;
          }
        });
        
        return mark;
      });

      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        throw new Error("Not authenticated");
      }

      const { data, error } = await supabase.functions.invoke('bulk-import-marks', {
        body: { marks, subjectId: selectedSubject },
        headers: {
          Authorization: `Bearer ${session.session.access_token}`
        }
      });

      if (error) throw error;

      const results = data as { success: { roll_number: string; action: string }[]; failed: { roll_number: string; error: string }[] };

      if (results.success.length > 0) {
        toast.success(`Successfully imported ${results.success.length} marks`);
        setImportResults(results.success);
      }

      if (results.failed.length > 0) {
        toast.error(`Failed to import ${results.failed.length} marks. See details below.`);
        setImportErrors(results.failed);
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (error: any) {
      toast.error("Import failed: " + error.message);
      console.error("Bulk import error:", error);
    } finally {
      setImporting(false);
    }
  };

  const handleStudentBulkImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error("Please upload a CSV file");
      return;
    }

    setImportingStudents(true);
    setStudentImportResults([]);
    setStudentImportErrors([]);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        throw new Error("CSV file must have a header row and at least one data row");
      }

      const headers = lines[0].split(',').map(h => h.trim());
      
      const students = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const student: any = {};
        
        headers.forEach((header, index) => {
          if (header === 'semester') {
            student[header] = values[index] ? parseInt(values[index]) : undefined;
          } else {
            student[header] = values[index] || undefined;
          }
        });
        
        return student;
      });

      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        throw new Error("Not authenticated");
      }

      const { data, error } = await supabase.functions.invoke('bulk-import-students', {
        body: { students },
        headers: {
          Authorization: `Bearer ${session.session.access_token}`
        }
      });

      if (error) throw error;

      const results = data as { 
        success: { email: string; password: string; roll_number: string }[]; 
        failed: { email: string; roll_number: string; error: string }[] 
      };

      if (results.success.length > 0) {
        toast.success(`Successfully imported ${results.success.length} students`);
        setStudentImportResults(results.success);
        fetchStudents();
      }

      if (results.failed.length > 0) {
        toast.error(`Failed to import ${results.failed.length} students. See details below.`);
        setStudentImportErrors(results.failed);
      }

      if (studentFileInputRef.current) {
        studentFileInputRef.current.value = '';
      }

    } catch (error: any) {
      toast.error("Import failed: " + error.message);
      console.error("Student bulk import error:", error);
    } finally {
      setImportingStudents(false);
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
          <TabsList className="grid w-full max-w-4xl grid-cols-6">
            <TabsTrigger value="subjects">
              <BookOpen className="h-4 w-4 mr-2" />
              Subjects
            </TabsTrigger>
            <TabsTrigger value="enrollments">
              <Users className="h-4 w-4 mr-2" />
              Enrollments
            </TabsTrigger>
            <TabsTrigger value="marks">
              <FileText className="h-4 w-4 mr-2" />
              Add Marks
            </TabsTrigger>
            <TabsTrigger value="attendance">
              <Calendar className="h-4 w-4 mr-2" />
              Attendance
            </TabsTrigger>
            <TabsTrigger value="events">
              <CalendarDays className="h-4 w-4 mr-2" />
              Events
            </TabsTrigger>
            <TabsTrigger value="announcements">
              <Megaphone className="h-4 w-4 mr-2" />
              Announcements
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

          <TabsContent value="enrollments" className="space-y-6">
            <Card className="shadow-[var(--shadow-md)]">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Manage Enrollments</CardTitle>
                    <CardDescription>Enroll students in your subjects</CardDescription>
                  </div>
                  <Button onClick={() => setShowStudentBulkImport(true)} variant="secondary">
                    <Upload className="mr-2 h-4 w-4" />
                    Bulk Import Students
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="enrollment-subject">Subject</Label>
                      <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Subject" />
                        </SelectTrigger>
                        <SelectContent>
                          {subjects.map((subject) => (
                            <SelectItem key={subject.id} value={subject.id}>
                              {subject.subject_name} ({subject.subject_code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="enrollment-student">Student to Enroll</Label>
                      <Select 
                        value={selectedStudent} 
                        onValueChange={async (studentId) => {
                          if (!selectedSubject) {
                            toast.error("Please select a subject first");
                            return;
                          }
                          
                          const { error } = await supabase
                            .from("enrollments")
                            .insert({
                              student_id: studentId,
                              subject_id: selectedSubject
                            });

                          if (error) {
                            if (error.code === '23505') {
                              toast.error("Student already enrolled in this subject");
                            } else {
                              toast.error(error.message);
                            }
                          } else {
                            toast.success("Student enrolled successfully!");
                            fetchEnrolledStudents();
                            
                            // Send enrollment notification
                            try {
                              const student = students.find(s => s.id === studentId);
                              const subject = subjects.find(s => s.id === selectedSubject);
                              const { data: studentProfile } = await supabase
                                .from("profiles")
                                .select("email")
                                .eq("id", student?.student_user_id)
                                .single();
                              const { data: teacherProfile } = await supabase
                                .from("profiles")
                                .select("full_name")
                                .eq("id", user?.id)
                                .single();

                              if (student && subject && studentProfile && teacherProfile) {
                                const { data: session } = await supabase.auth.getSession();
                                
                                await supabase.functions.invoke('send-enrollment-notification', {
                                  body: {
                                    studentEmail: studentProfile.email,
                                    studentName: student.profiles.full_name,
                                    subjectName: subject.subject_name,
                                    subjectCode: subject.subject_code,
                                    teacherName: teacherProfile.full_name
                                  },
                                  headers: {
                                    Authorization: `Bearer ${session.session?.access_token}`
                                  }
                                });
                              }
                            } catch (emailError: any) {
                              console.error('Failed to send enrollment notification:', emailError);
                            }
                          }
                        }}
                        disabled={!selectedSubject}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select Student" />
                        </SelectTrigger>
                        <SelectContent>
                          {students.map((student) => (
                            <SelectItem key={student.id} value={student.id}>
                              {student.profiles.full_name} ({student.roll_number})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {selectedSubject && (
                    <div className="mt-6">
                      <h3 className="text-lg font-semibold mb-4">
                        Enrolled Students ({enrolledStudents.length})
                      </h3>
                      <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
                        {enrolledStudents.length === 0 ? (
                          <p className="text-muted-foreground text-center py-8">
                            No students enrolled yet
                          </p>
                        ) : (
                          enrolledStudents.map((student) => (
                            <div
                              key={student.id}
                              className="flex justify-between items-center p-4 hover:bg-muted/50"
                            >
                              <div>
                                <p className="font-medium">{student.profiles.full_name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {student.roll_number} | {student.department}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={async () => {
                                  const { error } = await supabase
                                    .from("enrollments")
                                    .delete()
                                    .eq("id", student.enrollment_id);

                                  if (error) {
                                    toast.error(error.message);
                                  } else {
                                    toast.success("Student removed from subject");
                                    fetchEnrolledStudents();
                                  }
                                }}
                              >
                                Remove
                              </Button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="marks" className="space-y-6">
            <Card className="shadow-[var(--shadow-md)]">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Add Marks</CardTitle>
                    <CardDescription>Enter marks for your students</CardDescription>
                  </div>
                  {selectedSubject && (
                    <Button onClick={() => setShowBulkImport(true)} variant="secondary">
                      <Upload className="mr-2 h-4 w-4" />
                      Bulk Import
                    </Button>
                  )}
                </div>
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
                      <Label htmlFor="student">Student {selectedSubject && `(${enrolledStudents.length} enrolled)`}</Label>
                      <select
                        id="student"
                        className="w-full rounded-md border border-input bg-background px-3 py-2"
                        value={selectedStudent}
                        onChange={(e) => setSelectedStudent(e.target.value)}
                        required
                        disabled={!selectedSubject}
                      >
                        <option value="">Select Student</option>
                        {(selectedSubject ? enrolledStudents : students).map((student) => (
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

          <TabsContent value="attendance">
            {user && <TeacherAttendance userId={user.id} />}
          </TabsContent>

          <TabsContent value="events">
            <Card className="shadow-[var(--shadow-md)]">
              <CardHeader>
                <CardTitle>Upcoming Events</CardTitle>
                <CardDescription>Stay updated with college events</CardDescription>
              </CardHeader>
              <CardContent>
                <EventsList />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="announcements">
            <Card className="shadow-[var(--shadow-md)]">
              <CardHeader>
                <CardTitle>Announcements</CardTitle>
                <CardDescription>Important notices and updates</CardDescription>
              </CardHeader>
              <CardContent>
                <AnnouncementsList />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={showBulkImport} onOpenChange={(open) => {
          setShowBulkImport(open);
          if (!open) {
            setImportResults([]);
            setImportErrors([]);
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Bulk Import Marks</DialogTitle>
              <DialogDescription>
                Upload a CSV file to import marks for multiple students at once
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {importResults.length === 0 && importErrors.length === 0 ? (
                <>
                  <Alert>
                    <AlertDescription>
                      <strong>CSV Format:</strong> roll_number,marks,max_marks,assessment_type,assessment_date
                      <br />
                      <strong>Example:</strong> 4NM21CS001,85,100,Mid-term,2024-11-10
                      <br />
                      <strong>Note:</strong> Only enrolled students can receive marks. assessment_date is optional (defaults to today).
                    </AlertDescription>
                  </Alert>
                  {!selectedSubject && (
                    <Alert>
                      <AlertDescription className="text-destructive">
                        Please select a subject from the "Add Marks" tab before importing.
                      </AlertDescription>
                    </Alert>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="csv-file">Select CSV File</Label>
                    <Input
                      id="csv-file"
                      type="file"
                      accept=".csv"
                      ref={fileInputRef}
                      onChange={handleBulkImport}
                      disabled={importing || !selectedSubject}
                    />
                  </div>
                  {importing && (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                      <span>Importing marks...</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-4">
                  {importResults.length > 0 && (
                    <div className="border rounded-lg p-4 space-y-2 max-h-60 overflow-y-auto">
                      <h3 className="font-semibold mb-2 text-green-600">Successfully Imported ({importResults.length})</h3>
                      {importResults.map((result, index) => (
                        <div key={index} className="p-3 bg-green-50 rounded space-y-1 text-sm">
                          <div><strong>Roll Number:</strong> {result.roll_number}</div>
                          <div className="text-muted-foreground"><strong>Action:</strong> {result.action}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {importErrors.length > 0 && (
                    <>
                      <Alert>
                        <AlertDescription className="text-destructive">
                          <strong>Some marks failed to import.</strong> Review errors below.
                        </AlertDescription>
                      </Alert>
                      <div className="border border-destructive rounded-lg p-4 space-y-2 max-h-60 overflow-y-auto">
                        <h3 className="font-semibold mb-2 text-destructive">Import Errors ({importErrors.length})</h3>
                        {importErrors.map((error, index) => (
                          <div key={index} className="p-3 bg-destructive/10 rounded space-y-1 text-sm">
                            <div><strong>Roll Number:</strong> {error.roll_number}</div>
                            <div className="text-destructive"><strong>Error:</strong> {error.error}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showStudentBulkImport} onOpenChange={(open) => {
          setShowStudentBulkImport(open);
          if (!open) {
            setStudentImportResults([]);
            setStudentImportErrors([]);
          }
        }}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Bulk Import Students</DialogTitle>
              <DialogDescription>
                Upload a CSV file to create multiple student accounts at once
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {studentImportResults.length === 0 && studentImportErrors.length === 0 ? (
                <>
                  <Alert>
                    <AlertDescription>
                      <strong>CSV Format:</strong> full_name,email,roll_number,department,semester
                      <br />
                      <strong>Example:</strong> John Doe,john@example.com,4NM21CS001,Computer Science,5
                      <br />
                      <strong>Note:</strong> department and semester are optional. Each student will get a temporary password that will be displayed after import.
                    </AlertDescription>
                  </Alert>
                  <div className="space-y-2">
                    <Label htmlFor="student-csv-file">Select CSV File</Label>
                    <Input
                      id="student-csv-file"
                      type="file"
                      accept=".csv"
                      ref={studentFileInputRef}
                      onChange={handleStudentBulkImport}
                      disabled={importingStudents}
                    />
                  </div>
                  {importingStudents && (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                      <span>Importing students...</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-4">
                  {studentImportResults.length > 0 && (
                    <div className="border rounded-lg p-4 space-y-2 max-h-60 overflow-y-auto">
                      <h3 className="font-semibold mb-2 text-green-600">Successfully Imported ({studentImportResults.length})</h3>
                      <Alert>
                        <AlertDescription className="text-sm">
                          <strong>Important:</strong> Save these temporary passwords! Students should change them on first login.
                        </AlertDescription>
                      </Alert>
                      {studentImportResults.map((result, index) => (
                        <div key={index} className="p-3 bg-green-50 rounded space-y-1 text-sm">
                          <div><strong>Roll Number:</strong> {result.roll_number}</div>
                          <div><strong>Email:</strong> {result.email}</div>
                          <div className="font-mono bg-white p-2 rounded border">
                            <strong>Password:</strong> {result.password}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {studentImportErrors.length > 0 && (
                    <>
                      <Alert>
                        <AlertDescription className="text-destructive">
                          <strong>Some students failed to import.</strong> Review errors below.
                        </AlertDescription>
                      </Alert>
                      <div className="border border-destructive rounded-lg p-4 space-y-2 max-h-60 overflow-y-auto">
                        <h3 className="font-semibold mb-2 text-destructive">Import Errors ({studentImportErrors.length})</h3>
                        {studentImportErrors.map((error, index) => (
                          <div key={index} className="p-3 bg-destructive/10 rounded space-y-1 text-sm">
                            <div><strong>Roll Number:</strong> {error.roll_number}</div>
                            <div><strong>Email:</strong> {error.email}</div>
                            <div className="text-destructive"><strong>Error:</strong> {error.error}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default TeacherDashboard;
