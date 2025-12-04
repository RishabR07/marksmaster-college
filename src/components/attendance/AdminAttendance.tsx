import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Calendar, Download, Users, BookOpen, TrendingUp, Loader2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from "date-fns";

interface Subject {
  id: string;
  subject_name: string;
  subject_code: string;
  teacher_name: string;
}

interface StudentAttendanceSummary {
  studentId: string;
  studentName: string;
  rollNumber: string;
  department: string;
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  percentage: number;
}

interface SubjectSummary {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  teacherName: string;
  totalStudents: number;
  averageAttendance: number;
}

export const AdminAttendance = () => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>("all");
  const [studentSummaries, setStudentSummaries] = useState<StudentAttendanceSummary[]>([]);
  const [subjectSummaries, setSubjectSummaries] = useState<SubjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportMonth, setReportMonth] = useState<string>(format(new Date(), "yyyy-MM"));
  const [generatingReport, setGeneratingReport] = useState(false);
  const [lowAttendanceThreshold] = useState(75);

  useEffect(() => {
    fetchSubjects();
  }, []);

  useEffect(() => {
    fetchAttendanceData();
  }, [selectedSubject, reportMonth]);

  const fetchSubjects = async () => {
    const { data, error } = await supabase
      .from("subjects")
      .select("id, subject_name, subject_code, teacher_id");

    if (error) {
      toast.error("Failed to fetch subjects");
      return;
    }

    if (data) {
      const teacherIds = data.map(s => s.teacher_id);
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", teacherIds);

      const profileMap = new Map(profilesData?.map(p => [p.id, p.full_name]));

      const subjectsList = data.map(subject => ({
        id: subject.id,
        subject_name: subject.subject_name,
        subject_code: subject.subject_code,
        teacher_name: profileMap.get(subject.teacher_id) || "Unknown"
      }));

      setSubjects(subjectsList);
    }
  };

  const fetchAttendanceData = async () => {
    setLoading(true);

    try {
      const [year, month] = reportMonth.split("-").map(Number);
      const startDate = startOfMonth(new Date(year, month - 1));
      const endDate = endOfMonth(new Date(year, month - 1));

      // Fetch all students with their enrollments
      const { data: studentsData, error: studentsError } = await supabase
        .from("students")
        .select(`
          id,
          roll_number,
          department,
          student_user_id,
          enrollments(subject_id)
        `);

      if (studentsError) throw studentsError;

      // Fetch profiles for students
      const studentUserIds = studentsData?.map(s => s.student_user_id) || [];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", studentUserIds);

      const profileMap = new Map(profilesData?.map(p => [p.id, p.full_name]));

      // Fetch attendance data for the month
      let attendanceQuery = supabase
        .from("attendance")
        .select("*")
        .gte("attendance_date", format(startDate, "yyyy-MM-dd"))
        .lte("attendance_date", format(endDate, "yyyy-MM-dd"));

      if (selectedSubject !== "all") {
        attendanceQuery = attendanceQuery.eq("subject_id", selectedSubject);
      }

      const { data: attendanceData, error: attendanceError } = await attendanceQuery;
      if (attendanceError) throw attendanceError;

      // Calculate student summaries
      const summaries: StudentAttendanceSummary[] = (studentsData || []).map(student => {
        let studentAttendance = attendanceData?.filter(a => a.student_id === student.id) || [];
        
        if (selectedSubject !== "all") {
          studentAttendance = studentAttendance.filter(a => a.subject_id === selectedSubject);
        }

        const total = studentAttendance.length;
        const present = studentAttendance.filter(a => a.status === "present").length;
        const absent = studentAttendance.filter(a => a.status === "absent").length;
        const late = studentAttendance.filter(a => a.status === "late").length;
        const excused = studentAttendance.filter(a => a.status === "excused").length;
        const percentage = total > 0 ? ((present + late) / total) * 100 : 0;

        return {
          studentId: student.id,
          studentName: profileMap.get(student.student_user_id) || "Unknown",
          rollNumber: student.roll_number,
          department: student.department || "",
          total,
          present,
          absent,
          late,
          excused,
          percentage
        };
      }).filter(s => s.total > 0).sort((a, b) => a.percentage - b.percentage);

      setStudentSummaries(summaries);

      // Calculate subject summaries
      const subjectSums: SubjectSummary[] = subjects.map(subject => {
        const subjectAttendance = attendanceData?.filter(a => a.subject_id === subject.id) || [];
        const studentIds = new Set(subjectAttendance.map(a => a.student_id));
        
        let totalPercentage = 0;
        studentIds.forEach(studentId => {
          const records = subjectAttendance.filter(a => a.student_id === studentId);
          const present = records.filter(a => a.status === "present" || a.status === "late").length;
          totalPercentage += records.length > 0 ? (present / records.length) * 100 : 0;
        });

        return {
          subjectId: subject.id,
          subjectName: subject.subject_name,
          subjectCode: subject.subject_code,
          teacherName: subject.teacher_name,
          totalStudents: studentIds.size,
          averageAttendance: studentIds.size > 0 ? totalPercentage / studentIds.size : 0
        };
      });

      setSubjectSummaries(subjectSums);
    } catch (error: any) {
      toast.error("Failed to fetch attendance data: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const generateFullReport = async () => {
    setGeneratingReport(true);

    try {
      const [year, month] = reportMonth.split("-").map(Number);
      const startDate = startOfMonth(new Date(year, month - 1));
      const endDate = endOfMonth(new Date(year, month - 1));
      
      const workingDays = eachDayOfInterval({ start: startDate, end: endDate })
        .filter(date => !isWeekend(date));

      // Generate comprehensive CSV
      const csvContent = [
        `Comprehensive Attendance Report`,
        `Month: ${format(startDate, "MMMM yyyy")}`,
        `Generated: ${format(new Date(), "MMMM d, yyyy HH:mm")}`,
        `Total Working Days: ${workingDays.length}`,
        "",
        "=== STUDENT ATTENDANCE SUMMARY ===",
        "Roll Number,Name,Department,Present,Absent,Late,Excused,Total,Percentage,Status",
        ...studentSummaries.map(s => 
          `${s.rollNumber},${s.studentName},${s.department},${s.present},${s.absent},${s.late},${s.excused},${s.total},${s.percentage.toFixed(1)}%,${s.percentage >= lowAttendanceThreshold ? "Good" : "Low Attendance"}`
        ),
        "",
        "=== SUBJECT SUMMARY ===",
        "Subject Code,Subject Name,Teacher,Total Students,Average Attendance",
        ...subjectSummaries.map(s =>
          `${s.subjectCode},${s.subjectName},${s.teacherName},${s.totalStudents},${s.averageAttendance.toFixed(1)}%`
        ),
        "",
        "=== LOW ATTENDANCE ALERTS ===",
        `Students with attendance below ${lowAttendanceThreshold}%:`,
        ...studentSummaries.filter(s => s.percentage < lowAttendanceThreshold).map(s =>
          `${s.rollNumber} - ${s.studentName}: ${s.percentage.toFixed(1)}%`
        )
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `attendance_report_${reportMonth}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success("Report downloaded successfully");
    } catch (error: any) {
      toast.error("Failed to generate report: " + error.message);
    } finally {
      setGeneratingReport(false);
    }
  };

  const getPercentageColor = (percentage: number) => {
    if (percentage >= 75) return "text-green-600";
    if (percentage >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  const lowAttendanceCount = studentSummaries.filter(s => s.percentage < lowAttendanceThreshold).length;
  const averageAttendance = studentSummaries.length > 0 
    ? studentSummaries.reduce((sum, s) => sum + s.percentage, 0) / studentSummaries.length 
    : 0;

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="shadow-[var(--shadow-sm)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Total Students
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{studentSummaries.length}</div>
            <p className="text-xs text-muted-foreground">with attendance records</p>
          </CardContent>
        </Card>
        
        <Card className="shadow-[var(--shadow-sm)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Avg. Attendance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${getPercentageColor(averageAttendance)}`}>
              {averageAttendance.toFixed(1)}%
            </div>
            <Progress value={averageAttendance} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card className="shadow-[var(--shadow-sm)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Active Subjects
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{subjectSummaries.filter(s => s.totalStudents > 0).length}</div>
            <p className="text-xs text-muted-foreground">with attendance data</p>
          </CardContent>
        </Card>

        <Card className="shadow-[var(--shadow-sm)] border-red-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600 flex items-center gap-2">
              Low Attendance Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{lowAttendanceCount}</div>
            <p className="text-xs text-muted-foreground">students below {lowAttendanceThreshold}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Report */}
      <Card className="shadow-[var(--shadow-md)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Attendance Overview
          </CardTitle>
          <CardDescription>Filter and generate reports</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label>Month</Label>
              <Input
                type="month"
                value={reportMonth}
                onChange={(e) => setReportMonth(e.target.value)}
                className="w-48"
              />
            </div>
            <div className="space-y-2">
              <Label>Subject Filter</Label>
              <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="All subjects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {subjects.map(subject => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.subject_name} ({subject.subject_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={generateFullReport} disabled={generatingReport}>
              {generatingReport ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Download Full Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Subject Summary */}
      <Card className="shadow-[var(--shadow-md)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Subject-wise Summary
          </CardTitle>
          <CardDescription>Average attendance by subject for {format(new Date(reportMonth), "MMMM yyyy")}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {subjectSummaries.filter(s => s.totalStudents > 0).map(subject => (
                <div key={subject.subjectId} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-medium">{subject.subjectName}</span>
                      <span className="text-muted-foreground ml-2">({subject.subjectCode})</span>
                    </div>
                    <span className={`font-bold ${getPercentageColor(subject.averageAttendance)}`}>
                      {subject.averageAttendance.toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={subject.averageAttendance} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    Teacher: {subject.teacherName} • {subject.totalStudents} students
                  </p>
                </div>
              ))}
              {subjectSummaries.filter(s => s.totalStudents > 0).length === 0 && (
                <p className="text-muted-foreground text-center py-4">No attendance data for this month</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Student Attendance Table */}
      <Card className="shadow-[var(--shadow-md)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Student Attendance Details
          </CardTitle>
          <CardDescription>
            Sorted by attendance percentage (lowest first) • Students below {lowAttendanceThreshold}% are highlighted
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : studentSummaries.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No attendance records found for this period</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Roll Number</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead className="text-center">Present</TableHead>
                  <TableHead className="text-center">Absent</TableHead>
                  <TableHead className="text-center">Late</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead>Percentage</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {studentSummaries.map(student => (
                  <TableRow 
                    key={student.studentId}
                    className={student.percentage < lowAttendanceThreshold ? "bg-red-50 dark:bg-red-950/20" : ""}
                  >
                    <TableCell className="font-medium">{student.rollNumber}</TableCell>
                    <TableCell>{student.studentName}</TableCell>
                    <TableCell>{student.department}</TableCell>
                    <TableCell className="text-center text-green-600">{student.present}</TableCell>
                    <TableCell className="text-center text-red-600">{student.absent}</TableCell>
                    <TableCell className="text-center text-yellow-600">{student.late}</TableCell>
                    <TableCell className="text-center">{student.total}</TableCell>
                    <TableCell>
                      <span className={`font-bold ${getPercentageColor(student.percentage)}`}>
                        {student.percentage.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell>
                      {student.percentage >= lowAttendanceThreshold ? (
                        <Badge className="bg-green-500">Good</Badge>
                      ) : (
                        <Badge variant="destructive">Low</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
