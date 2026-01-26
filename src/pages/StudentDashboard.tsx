import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { LogOut, GraduationCap, Award, FileText, Calendar, CalendarDays, Megaphone, ClipboardList, Menu, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { StudentAttendance } from "@/components/attendance/StudentAttendance";
import { StudentEventsManager } from "@/components/events/StudentEventsManager";
import { AnnouncementsList } from "@/components/events/AnnouncementsList";
import { StudentIAMarks } from "@/components/attendance/StudentIAMarks";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";


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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
      .maybeSingle();

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
    const { data: studentData } = await supabase
      .from("students")
      .select("id")
      .eq("student_user_id", user?.id)
      .maybeSingle();

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
      {/* Hero Header */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-indigo-600 to-purple-700 opacity-90" />
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-purple-500/40 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-blue-500/40 rounded-full blur-3xl" />
        
        <div className="relative container mx-auto px-4 py-4 md:py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-6 w-6 md:h-8 md:w-8 text-white" />
              <h1 className="text-lg md:text-2xl font-bold text-white">Student Dashboard</h1>
            </div>
            
            <div className="hidden md:flex gap-2">
              <ChangePasswordDialog />
              <Button variant="secondary" onClick={signOut} className="bg-white/20 hover:bg-white/30 text-white border-white/30">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>

            {/* Mobile Actions */}
            <div className="flex md:hidden items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-white hover:bg-white/20"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden mt-3 pb-3 flex flex-col gap-2 border-t border-white/20 pt-3">
              <ChangePasswordDialog />
              <Button variant="secondary" onClick={signOut} className="w-full bg-white/20 hover:bg-white/30 text-white border-white/30">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          )}
        </div>
      </header>

      <main className="relative overflow-hidden min-h-[calc(100vh-120px)]">
        {/* Background gradient effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-indigo-500/5 to-purple-500/5" />
        <div className="absolute -top-48 -right-48 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-48 -left-48 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        
        <div className="relative container mx-auto px-4 py-4 md:py-8 space-y-4 md:space-y-6">
        {studentInfo && (
          <Card className="shadow-[var(--shadow-md)] bg-white dark:bg-slate-900 border border-white dark:border-white/10">
            <CardHeader className="pb-3 md:pb-6">
              <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                <Award className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                Student Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 p-4">
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">Name</p>
                <p className="font-semibold text-sm md:text-base">{studentInfo.profiles.full_name}</p>
              </div>
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">Roll Number</p>
                <p className="font-semibold text-sm md:text-base">{studentInfo.roll_number}</p>
              </div>
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">Department</p>
                <p className="font-semibold text-sm md:text-base">{studentInfo.department}</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="marks" className="space-y-4 md:space-y-6">
          <TabsList className="w-full flex flex-wrap gap-1 h-auto p-1">
            <TabsTrigger value="marks" className="flex-1 min-w-[80px] text-xs md:text-sm">
              <FileText className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Marks</span>
              <span className="sm:hidden">Marks</span>
            </TabsTrigger>
            <TabsTrigger value="ia-marks" className="flex-1 min-w-[80px] text-xs md:text-sm">
              <ClipboardList className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">IA Marks</span>
              <span className="sm:hidden">IA</span>
            </TabsTrigger>
            <TabsTrigger value="attendance" className="flex-1 min-w-[80px] text-xs md:text-sm">
              <Calendar className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Attendance</span>
              <span className="sm:hidden">Attend</span>
            </TabsTrigger>
            <TabsTrigger value="events" className="flex-1 min-w-[80px] text-xs md:text-sm">
              <CalendarDays className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Events</span>
              <span className="sm:hidden">Events</span>
            </TabsTrigger>
            <TabsTrigger value="announcements" className="flex-1 min-w-[80px] text-xs md:text-sm">
              <Megaphone className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Announcements</span>
              <span className="sm:hidden">News</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="marks">
            <Card className="shadow-[var(--shadow-md)] bg-white dark:bg-slate-900 border border-white dark:border-white/10">
              <CardHeader className="pb-3 md:pb-6">
                <CardTitle className="text-lg md:text-xl">Assessment Marks</CardTitle>
                <CardDescription className="text-sm">View your marks across all subjects</CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-3 md:space-y-4">
                  {marks.map((mark) => {
                    const percentage = parseFloat(getPercentage(mark.marks, mark.max_marks));
                    const grade = getGrade(percentage);
                    
                    return (
                      <Card key={mark.id} className="shadow-[var(--shadow-sm)] bg-white dark:bg-slate-800 border border-white dark:border-white/10">
                        <CardContent className="pt-4 md:pt-6 p-4">
                          <div className="flex flex-col gap-3 md:gap-4">
                            <div className="space-y-1">
                              <h3 className="font-semibold text-base md:text-lg">{mark.subjects.subject_name}</h3>
                              <p className="text-xs md:text-sm text-muted-foreground">
                                {mark.subjects.subject_code} • {mark.assessment_type}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Teacher: {mark.subjects.profiles.full_name}
                              </p>
                            </div>
                            <div className="flex items-center justify-between md:justify-start gap-4 md:gap-6">
                              <div className="text-center">
                                <p className="text-lg md:text-2xl font-bold text-primary">{mark.marks}/{mark.max_marks}</p>
                                <p className="text-xs md:text-sm text-muted-foreground">Marks</p>
                              </div>
                              <div className="text-center">
                                <p className="text-lg md:text-2xl font-bold text-accent">{percentage}%</p>
                                <p className="text-xs md:text-sm text-muted-foreground">Percentage</p>
                              </div>
                              <div className="text-center">
                                <p className="text-lg md:text-2xl font-bold text-success">{grade}</p>
                                <p className="text-xs md:text-sm text-muted-foreground">Grade</p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
                {marks.length === 0 && (
                  <p className="text-muted-foreground text-center py-8 text-sm">No marks available yet</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ia-marks">
            <Card className="shadow-[var(--shadow-md)] bg-white dark:bg-slate-900 border border-white dark:border-white/10">
              <CardHeader className="pb-3 md:pb-6">
                <CardTitle className="text-lg md:text-xl">IA Marks (Final Year)</CardTitle>
                <CardDescription className="text-sm">View your Internal Assessment marks - Total: 240 marks</CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                {user && <StudentIAMarks studentUserId={user.id} />}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="attendance">
            {user && <StudentAttendance studentId={user.id} />}
          </TabsContent>

          <TabsContent value="events">
            <Card className="shadow-[var(--shadow-md)] bg-white dark:bg-slate-900 border border-white dark:border-white/10">
              <CardHeader className="pb-3 md:pb-6">
                <CardTitle className="text-lg md:text-xl">Our Events</CardTitle>
                <CardDescription className="text-sm">Share and view college events</CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                {user && <StudentEventsManager userId={user.id} />}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="announcements">
            <Card className="shadow-[var(--shadow-md)] bg-white dark:bg-slate-900 border border-white dark:border-white/10">
              <CardHeader className="pb-3 md:pb-6">
                <CardTitle className="text-lg md:text-xl">Announcements</CardTitle>
                <CardDescription className="text-sm">Important notices and updates</CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                <AnnouncementsList />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        </div>
      </main>
    </div>
  );
};

export default StudentDashboard;
