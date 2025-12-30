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

// Dynamic import for jsPDF
const getJsPDF = async () => {
  const { jsPDF } = await import("jspdf");
  return jsPDF;
};

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
      const PDFClass = await getJsPDF();
      const doc = new PDFClass();
      const [year, month] = reportMonth.split("-").map(Number);
      const startDate = startOfMonth(new Date(year, month - 1));
      const endDate = endOfMonth(new Date(year, month - 1));
      
      const workingDays = eachDayOfInterval({ start: startDate, end: endDate })
        .filter(date => !isWeekend(date));

      // Set up PDF
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - margin * 2;
      let yPosition = margin;

      // Title
      doc.setFontSize(13);
      doc.setFont(undefined, "bold");
      doc.setTextColor(0, 0, 0);
      doc.text("Comprehensive Attendance Report", margin, yPosition);
      yPosition += 5;

      // Report info
      doc.setFontSize(8);
      doc.setFont(undefined, "normal");
      doc.text(`Month: ${format(startDate, "MMMM yyyy")} | Generated: ${format(new Date(), "MMM d, yyyy")} | Working Days: ${workingDays.length}`, margin, yPosition);
      yPosition += 6;

      // Student Summary Section Title
      doc.setFontSize(10);
      doc.setFont(undefined, "bold");
      doc.text("Student Attendance Summary", margin, yPosition);
      yPosition += 4;

      // Student table headers - adjusted for proper fit
      const studentHeaders = ["Roll", "Name", "Dept", "Present", "Absent", "Total", "%"];
      const headerColPercents = [11, 30, 9, 11, 11, 13, 15];
      const headerColWidths = headerColPercents.map(p => (p / 100) * contentWidth);
      const tableRowHeight = 4.5;
      const headerRowHeight = 5;

      // Draw student header row
      doc.setFillColor(200, 200, 200);
      doc.setTextColor(0, 0, 0);
      let xPos = margin;
      studentHeaders.forEach((header, i) => {
        doc.rect(xPos, yPosition, headerColWidths[i], headerRowHeight);
        doc.setFontSize(6.5);
        doc.setFont(undefined, "bold");
        doc.text(header, xPos + headerColWidths[i] / 2, yPosition + 2.8, { align: "center" });
        xPos += headerColWidths[i];
      });
      yPosition += headerRowHeight;

      // Draw student data rows
      doc.setFont(undefined, "normal");
      doc.setTextColor(0, 0, 0);
      const sortedStudents = [...studentSummaries].sort((a, b) => a.rollNumber.localeCompare(b.rollNumber));
      
      sortedStudents.forEach(student => {
        // Page break check
        if (yPosition > pageHeight - margin - 35) {
          doc.addPage();
          yPosition = margin + 3;
          
          // Redraw header
          doc.setFillColor(200, 200, 200);
          xPos = margin;
          studentHeaders.forEach((header, i) => {
            doc.rect(xPos, yPosition, headerColWidths[i], headerRowHeight);
            doc.setFontSize(6.5);
            doc.setFont(undefined, "bold");
            doc.text(header, xPos + headerColWidths[i] / 2, yPosition + 2.8, { align: "center" });
            xPos += headerColWidths[i];
          });
          yPosition += headerRowHeight;
          doc.setFont(undefined, "normal");
        }

        const isLowAttendance = student.percentage < lowAttendanceThreshold;
        if (isLowAttendance) {
          doc.setFillColor(255, 230, 230);
        } else {
          doc.setFillColor(255, 255, 255);
        }

        const rowData = [
          student.rollNumber,
          student.studentName,
          student.department.substring(0, 3),
          student.present.toString(),
          student.absent.toString(),
          student.total.toString(),
          student.percentage.toFixed(1)
        ];

        xPos = margin;
        doc.setTextColor(0, 0, 0);
        rowData.forEach((cell, i) => {
          // Draw border
          doc.setDrawColor(0);
          doc.setLineWidth(0.2);
          doc.rect(xPos, yPosition, headerColWidths[i], tableRowHeight);
          
          // Draw text
          doc.setFontSize(6);
          const cellCenterX = xPos + headerColWidths[i] / 2;
          const cellCenterY = yPosition + tableRowHeight / 2 + 0.8;
          
          // Left align for roll, name, dept; center for others
          const align = i <= 2 ? "left" : "center";
          const textX = align === "left" ? xPos + 1 : cellCenterX;
          
          doc.text(cell, textX, cellCenterY, { align, maxWidth: headerColWidths[i] - 2 });
          xPos += headerColWidths[i];
        });
        yPosition += tableRowHeight;
      });

      // Subject Summary
      yPosition += 5;
      if (yPosition > pageHeight - margin - 35) {
        doc.addPage();
        yPosition = margin;
      }

      doc.setFontSize(10);
      doc.setFont(undefined, "bold");
      doc.setTextColor(0, 0, 0);
      doc.text("Subject-wise Summary", margin, yPosition);
      yPosition += 4;

      // Subject table headers
      const subjectHeaders = ["Code", "Subject", "Teacher", "Students", "Avg %"];
      const subjectColPercents = [12, 35, 25, 14, 14];
      const subjectColWidths = subjectColPercents.map(p => (p / 100) * contentWidth);

      // Draw subject header row
      doc.setFillColor(200, 200, 200);
      xPos = margin;
      subjectHeaders.forEach((header, i) => {
        doc.rect(xPos, yPosition, subjectColWidths[i], headerRowHeight);
        doc.setFontSize(6.5);
        doc.setFont(undefined, "bold");
        doc.text(header, xPos + subjectColWidths[i] / 2, yPosition + 2.8, { align: "center" });
        xPos += subjectColWidths[i];
      });
      yPosition += headerRowHeight;

      // Draw subject data rows
      doc.setFont(undefined, "normal");
      doc.setTextColor(0, 0, 0);
      subjectSummaries.forEach(subject => {
        if (yPosition > pageHeight - margin - 25) {
          doc.addPage();
          yPosition = margin + 3;
          
          // Redraw header
          doc.setFillColor(200, 200, 200);
          xPos = margin;
          subjectHeaders.forEach((header, i) => {
            doc.rect(xPos, yPosition, subjectColWidths[i], headerRowHeight);
            doc.setFontSize(6.5);
            doc.setFont(undefined, "bold");
            doc.text(header, xPos + subjectColWidths[i] / 2, yPosition + 2.8, { align: "center" });
            xPos += subjectColWidths[i];
          });
          yPosition += headerRowHeight;
          doc.setFont(undefined, "normal");
        }

        doc.setFillColor(255, 255, 255);
        doc.setTextColor(0, 0, 0);
        const subjectData = [
          subject.subjectCode,
          subject.subjectName,
          subject.teacherName,
          subject.totalStudents.toString(),
          subject.averageAttendance.toFixed(1)
        ];

        xPos = margin;
        subjectData.forEach((cell, i) => {
          // Draw border
          doc.setDrawColor(0);
          doc.setLineWidth(0.2);
          doc.rect(xPos, yPosition, subjectColWidths[i], tableRowHeight);
          
          // Draw text
          doc.setFontSize(6);
          const cellCenterX = xPos + subjectColWidths[i] / 2;
          const cellCenterY = yPosition + tableRowHeight / 2 + 0.8;
          
          const align = i >= 3 ? "center" : "left";
          const textX = align === "left" ? xPos + 1 : cellCenterX;
          
          doc.text(cell, textX, cellCenterY, { align, maxWidth: subjectColWidths[i] - 2 });
          xPos += subjectColWidths[i];
        });
        yPosition += tableRowHeight;
      });

      // Low Attendance Alerts
      yPosition += 5;
      if (yPosition > pageHeight - margin - 20) {
        doc.addPage();
        yPosition = margin;
      }

      const lowAttendanceStudents = studentSummaries.filter(s => s.percentage < lowAttendanceThreshold);
      if (lowAttendanceStudents.length > 0) {
        doc.setFontSize(10);
        doc.setFont(undefined, "bold");
        doc.setTextColor(200, 0, 0);
        doc.text(`⚠ Low Attendance Alerts (Below ${lowAttendanceThreshold}%)`, margin, yPosition);
        yPosition += 4;

        doc.setFont(undefined, "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(0, 0, 0);
        lowAttendanceStudents.slice(0, 20).forEach(student => {
          if (yPosition > pageHeight - margin - 5) {
            doc.addPage();
            yPosition = margin;
          }
          doc.text(`• ${student.rollNumber} - ${student.studentName}: ${student.percentage.toFixed(1)}%`, margin + 2, yPosition);
          yPosition += 3.5;
        });
      }

      // Save PDF
      doc.save(`attendance_report_${reportMonth}.pdf`);
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
        <Card className="shadow-[var(--shadow-sm)] border border-white dark:border-white/10">
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
        
        <Card className="shadow-[var(--shadow-sm)] border border-white dark:border-white/10">
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

        <Card className="shadow-[var(--shadow-sm)] border border-white dark:border-white/10">
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
      <Card className="shadow-[var(--shadow-md)] border border-white dark:border-white/10">
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
      <Card className="shadow-[var(--shadow-md)] border border-white dark:border-white/10">
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
      <Card className="shadow-[var(--shadow-md)] border border-white dark:border-white/10">
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
                    <TableCell className="max-w-xs break-words">{student.studentName}</TableCell>
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
