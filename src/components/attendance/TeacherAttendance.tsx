import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Calendar, Check, X, Clock, AlertCircle, Download, Loader2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from "date-fns";

interface Subject {
  id: string;
  subject_name: string;
  subject_code: string;
}

interface EnrolledStudent {
  id: string;
  roll_number: string;
  department: string;
  student_user_id: string;
  profiles: { full_name: string };
}

interface AttendanceRecord {
  id: string;
  student_id: string;
  status: "present" | "absent" | "late" | "excused";
  remarks: string | null;
}

type AttendanceStatus = "present" | "absent" | "late" | "excused";

interface TeacherAttendanceProps {
  userId: string;
}

export const TeacherAttendance = ({ userId }: TeacherAttendanceProps) => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudent[]>([]);
  const [attendanceDate, setAttendanceDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [attendanceRecords, setAttendanceRecords] = useState<Map<string, AttendanceRecord>>(new Map());
  const [pendingAttendance, setPendingAttendance] = useState<Map<string, AttendanceStatus>>(new Map());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reportMonth, setReportMonth] = useState<string>(format(new Date(), "yyyy-MM"));
  const [generatingReport, setGeneratingReport] = useState(false);

  useEffect(() => {
    fetchSubjects();
  }, [userId]);

  useEffect(() => {
    if (selectedSubject) {
      fetchEnrolledStudents();
    }
  }, [selectedSubject]);

  useEffect(() => {
    if (selectedSubject && attendanceDate) {
      fetchAttendanceForDate();
    }
  }, [selectedSubject, attendanceDate]);

  const fetchSubjects = async () => {
    const { data, error } = await supabase
      .from("subjects")
      .select("*")
      .eq("teacher_id", userId);

    if (error) {
      toast.error("Failed to fetch subjects");
    } else {
      setSubjects(data || []);
    }
  };

  const fetchEnrolledStudents = async () => {
    if (!selectedSubject) return;
    setLoading(true);

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
      setLoading(false);
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
    setLoading(false);
  };

  const fetchAttendanceForDate = async () => {
    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .eq("subject_id", selectedSubject)
      .eq("attendance_date", attendanceDate);

    if (error) {
      toast.error("Failed to fetch attendance");
      return;
    }

    const recordMap = new Map<string, AttendanceRecord>();
    data?.forEach((record: any) => {
      recordMap.set(record.student_id, record);
    });
    setAttendanceRecords(recordMap);
    setPendingAttendance(new Map());
  };

  const handleAttendanceChange = (studentId: string, status: AttendanceStatus) => {
    setPendingAttendance(prev => {
      const newMap = new Map(prev);
      newMap.set(studentId, status);
      return newMap;
    });
  };

  const getStudentStatus = (studentId: string): AttendanceStatus | null => {
    if (pendingAttendance.has(studentId)) {
      return pendingAttendance.get(studentId)!;
    }
    const record = attendanceRecords.get(studentId);
    return record?.status || null;
  };

  const saveAttendance = async () => {
    if (pendingAttendance.size === 0) {
      toast.info("No changes to save");
      return;
    }

    setSaving(true);

    try {
      const attendanceData = Array.from(pendingAttendance.entries()).map(([studentId, status]) => ({
        student_id: studentId,
        subject_id: selectedSubject,
        attendance_date: attendanceDate,
        status,
        marked_by: userId
      }));

      const { error } = await supabase
        .from("attendance")
        .upsert(attendanceData, {
          onConflict: "student_id,subject_id,attendance_date"
        });

      if (error) throw error;

      toast.success(`Attendance saved for ${pendingAttendance.size} student(s)`);
      fetchAttendanceForDate();
    } catch (error: any) {
      toast.error("Failed to save attendance: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const markAllPresent = () => {
    const newPending = new Map<string, AttendanceStatus>();
    enrolledStudents.forEach(student => {
      newPending.set(student.id, "present");
    });
    setPendingAttendance(newPending);
  };

  const markAllAbsent = () => {
    const newPending = new Map<string, AttendanceStatus>();
    enrolledStudents.forEach(student => {
      newPending.set(student.id, "absent");
    });
    setPendingAttendance(newPending);
  };

  const generateReport = async () => {
    if (!selectedSubject) {
      toast.error("Please select a subject first");
      return;
    }

    setGeneratingReport(true);

    try {
      const [year, month] = reportMonth.split("-").map(Number);
      const startDate = startOfMonth(new Date(year, month - 1));
      const endDate = endOfMonth(new Date(year, month - 1));
      
      const workingDays = eachDayOfInterval({ start: startDate, end: endDate })
        .filter(date => !isWeekend(date));

      const { data: attendanceData, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("subject_id", selectedSubject)
        .gte("attendance_date", format(startDate, "yyyy-MM-dd"))
        .lte("attendance_date", format(endDate, "yyyy-MM-dd"));

      if (error) throw error;

      const subject = subjects.find(s => s.id === selectedSubject);
      
      // Calculate attendance for each student
      const studentStats = enrolledStudents.map(student => {
        const studentAttendance = attendanceData?.filter(a => a.student_id === student.id) || [];
        const presentDays = studentAttendance.filter(a => a.status === "present" || a.status === "late").length;
        const totalMarkedDays = studentAttendance.length;
        const percentage = totalMarkedDays > 0 ? ((presentDays / totalMarkedDays) * 100).toFixed(1) : "N/A";
        
        return {
          rollNumber: student.roll_number,
          name: student.profiles.full_name,
          department: student.department,
          presentDays,
          absentDays: studentAttendance.filter(a => a.status === "absent").length,
          lateDays: studentAttendance.filter(a => a.status === "late").length,
          excusedDays: studentAttendance.filter(a => a.status === "excused").length,
          totalMarkedDays,
          percentage
        };
      });

      // Generate CSV
      const csvContent = [
        `Attendance Report - ${subject?.subject_name} (${subject?.subject_code})`,
        `Month: ${format(startDate, "MMMM yyyy")}`,
        `Total Working Days: ${workingDays.length}`,
        "",
        "Roll Number,Name,Department,Present,Absent,Late,Excused,Total Marked,Percentage",
        ...studentStats.map(s => 
          `${s.rollNumber},${s.name},${s.department},${s.presentDays},${s.absentDays},${s.lateDays},${s.excusedDays},${s.totalMarkedDays},${s.percentage}%`
        )
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `attendance_${subject?.subject_code}_${reportMonth}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success("Report downloaded successfully");
    } catch (error: any) {
      toast.error("Failed to generate report: " + error.message);
    } finally {
      setGeneratingReport(false);
    }
  };

  const getStatusBadge = (status: AttendanceStatus | null) => {
    switch (status) {
      case "present":
        return <Badge className="bg-green-500 hover:bg-green-600"><Check className="h-3 w-3 mr-1" />Present</Badge>;
      case "absent":
        return <Badge variant="destructive"><X className="h-3 w-3 mr-1" />Absent</Badge>;
      case "late":
        return <Badge className="bg-yellow-500 hover:bg-yellow-600"><Clock className="h-3 w-3 mr-1" />Late</Badge>;
      case "excused":
        return <Badge variant="secondary"><AlertCircle className="h-3 w-3 mr-1" />Excused</Badge>;
      default:
        return <Badge variant="outline">Not Marked</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-[var(--shadow-md)] border border-white dark:border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Mark Attendance
          </CardTitle>
          <CardDescription>Select a subject and date to mark attendance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Subject</Label>
              <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                <SelectTrigger>
                  <SelectValue placeholder="Select subject" />
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
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={attendanceDate}
                onChange={(e) => setAttendanceDate(e.target.value)}
                max={format(new Date(), "yyyy-MM-dd")}
              />
            </div>
            <div className="space-y-2">
              <Label>Quick Actions</Label>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={markAllPresent} disabled={!selectedSubject}>
                  All Present
                </Button>
                <Button size="sm" variant="outline" onClick={markAllAbsent} disabled={!selectedSubject}>
                  All Absent
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedSubject && (
        <Card className="shadow-[var(--shadow-md)] border border-white dark:border-white/10">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Enrolled Students</CardTitle>
                <CardDescription>
                  {enrolledStudents.length} student(s) enrolled • {format(new Date(attendanceDate), "EEEE, MMMM d, yyyy")}
                </CardDescription>
              </div>
              <Button onClick={saveAttendance} disabled={saving || pendingAttendance.size === 0}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Attendance ({pendingAttendance.size} changes)
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : enrolledStudents.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No students enrolled in this subject</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Roll Number</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enrolledStudents.map(student => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">{student.roll_number}</TableCell>
                      <TableCell>{student.profiles.full_name}</TableCell>
                      <TableCell>{student.department}</TableCell>
                      <TableCell>{getStatusBadge(getStudentStatus(student.id))}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant={getStudentStatus(student.id) === "present" ? "default" : "outline"}
                            className={getStudentStatus(student.id) === "present" ? "bg-green-500 hover:bg-green-600" : ""}
                            onClick={() => handleAttendanceChange(student.id, "present")}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant={getStudentStatus(student.id) === "absent" ? "destructive" : "outline"}
                            onClick={() => handleAttendanceChange(student.id, "absent")}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant={getStudentStatus(student.id) === "late" ? "default" : "outline"}
                            className={getStudentStatus(student.id) === "late" ? "bg-yellow-500 hover:bg-yellow-600" : ""}
                            onClick={() => handleAttendanceChange(student.id, "late")}
                          >
                            <Clock className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant={getStudentStatus(student.id) === "excused" ? "secondary" : "outline"}
                            onClick={() => handleAttendanceChange(student.id, "excused")}
                          >
                            <AlertCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="shadow-[var(--shadow-md)] border border-white dark:border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Generate Report
          </CardTitle>
          <CardDescription>Download monthly attendance report as CSV</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="space-y-2">
              <Label>Month</Label>
              <Input
                type="month"
                value={reportMonth}
                onChange={(e) => setReportMonth(e.target.value)}
              />
            </div>
            <Button onClick={generateReport} disabled={!selectedSubject || generatingReport}>
              {generatingReport && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Download Report
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
