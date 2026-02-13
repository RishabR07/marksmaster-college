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
import { Calendar, Check, X, Download, Loader2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { savePdfDocument } from "@/lib/pdfDownload";

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
}

type AttendanceStatus = "present" | "absent" | "late" | "excused";

interface TeacherAttendanceProps {
  userId: string;
}

export const TeacherAttendance = ({ userId }: TeacherAttendanceProps) => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudent[]>([]);
  const [attendanceDate, setAttendanceDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [attendanceRecords, setAttendanceRecords] = useState<Map<string, AttendanceRecord>>(new Map());
  const [pendingAttendance, setPendingAttendance] = useState<Map<string, AttendanceStatus>>(new Map());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reportFromDate, setReportFromDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [reportToDate, setReportToDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [generatingReport, setGeneratingReport] = useState(false);

  /* ---------------- FETCH DATA ---------------- */

  useEffect(() => {
    fetchSubjects();
  }, [userId]);

  useEffect(() => {
    if (selectedSubject) fetchEnrolledStudents();
  }, [selectedSubject]);

  useEffect(() => {
    if (selectedSubject && attendanceDate) fetchAttendanceForDate();
  }, [selectedSubject, attendanceDate]);

  const fetchSubjects = async () => {
    const { data, error } = await supabase
      .from("subjects")
      .select("*")
      .eq("teacher_id", userId);

    if (error) toast.error("Failed to fetch subjects");
    else setSubjects(data || []);
  };

  const generateDateRangeReport = async () => {
    if (!selectedSubject) {
      toast.error("Please select a subject first");
      return;
    }

    if (!reportFromDate || !reportToDate) {
      toast.error("Please select both from and to dates");
      return;
    }

    const fromDate = new Date(reportFromDate);
    const toDate = new Date(reportToDate);

    if (fromDate > toDate) {
      toast.error("From date must be before to date");
      return;
    }

    setGeneratingReport(true);

    try {
      const subject = subjects.find(s => s.id === selectedSubject);
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF();

      const margin = 10;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const contentWidth = pageWidth - margin * 2;
      const tableRowHeight = 4.5;
      const headerRowHeight = 6;

      // fetch attendance for the date range
      const { data: attendanceData, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("subject_id", selectedSubject)
        .gte("attendance_date", reportFromDate)
        .lte("attendance_date", reportToDate);

      if (error) throw error;

      // aggregate per student
      const aggregatedStats = enrolledStudents.map(student => {
        const records = attendanceData?.filter(a => a.student_id === student.id) || [];
        const present = records.filter(r => r.status === "present" || r.status === "late").length;
        const absent = records.filter(r => r.status === "absent").length;
        const total = present + absent;
        const percentage = total > 0 ? ((present / total) * 100).toFixed(1) : "0.0";
        return {
          rollNumber: student.roll_number,
          name: student.profiles.full_name,
          department: student.department,
          present,
          absent,
          total,
          percentage
        };
      });

      // PDF layout
      const columns = ["Roll", "Name", "Dept", "Present", "Absent", "Total", "Percentage(%)"];
      const colPercents = [11, 32, 9, 11, 11, 14, 12];
      const colWidths = colPercents.map(p => (p / 100) * contentWidth);

      // Title and info
      let yPosition = margin;
      doc.setFontSize(13);
      doc.setFont(undefined, "bold");
      doc.text(
        `Attendance Report - ${subject?.subject_name} (${subject?.subject_code})`,
        margin,
        yPosition
      );
      yPosition += 6;
      doc.setFontSize(9);
      doc.setFont(undefined, "normal");
      doc.text(
        `Period: ${format(fromDate, "dd MMM yyyy")} — ${format(toDate, "dd MMM yyyy")}`,
        margin,
        yPosition
      );
      yPosition += 6;

      // draw header
      doc.setFillColor(200, 200, 200);
      doc.setTextColor(0, 0, 0);
      let xPos = margin;
      columns.forEach((col, i) => {
        doc.rect(xPos, yPosition, colWidths[i], headerRowHeight);
        doc.setFontSize(7);
        doc.setFont(undefined, "bold");
        doc.text(col, xPos + colWidths[i] / 2, yPosition + 3.6, { align: "center" });
        xPos += colWidths[i];
      });
      yPosition += headerRowHeight;

      // draw rows
      const sorted = [...aggregatedStats].sort((a, b) => a.rollNumber.localeCompare(b.rollNumber));
      doc.setFont(undefined, "normal");
      doc.setFontSize(7);

      const drawHeader = () => {
        doc.addPage();
        yPosition = margin + 3;
        doc.setFillColor(200, 200, 200);
        xPos = margin;
        columns.forEach((col, i) => {
          doc.rect(xPos, yPosition, colWidths[i], headerRowHeight);
          doc.setFontSize(7);
          doc.setFont(undefined, "bold");
          doc.text(col, xPos + colWidths[i] / 2, yPosition + 3.6, { align: "center" });
          xPos += colWidths[i];
        });
        yPosition += headerRowHeight;
        doc.setFont(undefined, "normal");
      };

      sorted.forEach(row => {
        if (yPosition > pageHeight - margin - 15) drawHeader();

        xPos = margin;
        const cells = [
          row.rollNumber,
          row.name,
          row.department.substring(0, 3),
          row.present.toString(),
          row.absent.toString(),
          row.total.toString(),
          row.percentage
        ];

        cells.forEach((cell, i) => {
          doc.setDrawColor(0);
          doc.rect(xPos, yPosition, colWidths[i], tableRowHeight);
          const cellCenterX = xPos + colWidths[i] / 2;
          const cellCenterY = yPosition + tableRowHeight / 2 + 0.8;
          const align = i <= 2 ? "left" : "center";
          const textX = align === "left" ? xPos + 1 : cellCenterX;
          doc.text(String(cell), textX, cellCenterY, { align, maxWidth: colWidths[i] - 2 });
          xPos += colWidths[i];
        });

        yPosition += tableRowHeight;
      });

      const result = await savePdfDocument(
        doc,
        `attendance_${subject?.subject_code}_${reportFromDate}_to_${reportToDate}.pdf`
      );
      toast.success(
        result === "shared"
          ? "Report ready to share/save"
          : "Report downloaded successfully"
      );
    } catch (error: any) {
      toast.error("Failed to generate report: " + error.message);
    } finally {
      setGeneratingReport(false);
    }
  };

  const fetchEnrolledStudents = async () => {
    setLoading(true);

    const { data: enrollmentRows, error: enrollmentError } = await supabase
      .from("enrollments")
      .select("student_id")
      .eq("subject_id", selectedSubject);

    if (enrollmentError) {
      toast.error("Failed to fetch students");
      setLoading(false);
      return;
    }

    const studentIds = (enrollmentRows || []).map((e: any) => e.student_id);
    if (studentIds.length === 0) {
      setEnrolledStudents([]);
      setLoading(false);
      return;
    }

    const { data: studentsData, error: studentsError } = await supabase
      .from("students")
      .select("id, roll_number, department, student_user_id")
      .in("id", studentIds);

    if (studentsError) {
      toast.error("Failed to fetch students");
      setLoading(false);
      return;
    }

    const userIds = (studentsData || []).map((s: any) => s.student_user_id);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]));
    const studentsMap = new Map((studentsData || []).map((s: any) => [s.id, s]));

    setEnrolledStudents(
      studentIds
        .map((studentId: string) => {
          const student = studentsMap.get(studentId);
          if (!student) return null;

          return {
            id: student.id,
            roll_number: student.roll_number,
            department: student.department,
            student_user_id: student.student_user_id,
            profiles: { full_name: profileMap.get(student.student_user_id) || "Unknown" }
          };
        })
        .filter(Boolean) as EnrolledStudent[]
    );

    setLoading(false);
  };

  const fetchAttendanceForDate = async () => {
    const { data } = await supabase
      .from("attendance")
      .select("*")
      .eq("subject_id", selectedSubject)
      .eq("attendance_date", attendanceDate);

    const map = new Map<string, AttendanceRecord>();
    data?.forEach((r: any) => map.set(r.student_id, r));
    setAttendanceRecords(map);
    setPendingAttendance(new Map());
  };

  /* ---------------- ATTENDANCE ACTIONS ---------------- */

  const handleAttendanceChange = (studentId: string, status: AttendanceStatus) => {
    setPendingAttendance(prev => new Map(prev).set(studentId, status));
  };

  const getStudentStatus = (studentId: string): AttendanceStatus | null =>
    pendingAttendance.get(studentId) || attendanceRecords.get(studentId)?.status || null;

  const saveAttendance = async () => {
    if (pendingAttendance.size === 0) return toast.info("No changes");

    setSaving(true);

    const rows = Array.from(pendingAttendance.entries()).map(([student_id, status]) => ({
      student_id,
      subject_id: selectedSubject,
      attendance_date: attendanceDate,
      status,
      marked_by: userId
    }));

    const { error } = await supabase
      .from("attendance")
      .upsert(rows, { onConflict: "student_id,subject_id,attendance_date" });

    if (error) toast.error("Failed to save attendance");
    else {
      toast.success("Attendance saved");
      fetchAttendanceForDate();
    }

    setSaving(false);
  };

  /* ---------------- PDF REPORT ---------------- */


  /* ---------------- UI ---------------- */

  const badge = (s: AttendanceStatus | null) =>
    s === "present" ? <Badge className="bg-green-500">Present</Badge> :
    s === "absent" ? <Badge variant="destructive">Absent</Badge> :
    <Badge variant="outline">Not Marked</Badge>;

  return (
    <div className="space-y-6">
      {/* MARK ATTENDANCE */}
     <Card>
  <CardHeader>
    <CardTitle className="flex gap-2"><Calendar /> Mark Attendance</CardTitle>
    <CardDescription>Select subject and date</CardDescription>
  </CardHeader>

  <CardContent className="grid md:grid-cols-3 gap-4 items-end">
    <div>
      <Label>Subject</Label>
      <Select value={selectedSubject} onValueChange={setSelectedSubject}>
        <SelectTrigger>
          <SelectValue placeholder="Select subject" />
        </SelectTrigger>
        <SelectContent>
          {subjects.map(s => (
            <SelectItem key={s.id} value={s.id}>
              {s.subject_name} ({s.subject_code})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>

    <div>
      <Label>Date</Label>
      <Input
        type="date"
        value={attendanceDate}
        onChange={e => setAttendanceDate(e.target.value)}
      />
    </div>

    <Button onClick={saveAttendance} disabled={saving}>
      {saving && <Loader2 className="animate-spin mr-2" />}
      Save Attendance
    </Button>
  </CardContent>
</Card>

      {/* STUDENT TABLE */}
      <Card>
        <CardHeader>
          <CardTitle>Enrolled Students</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <Loader2 className="animate-spin" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Roll</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Dept</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrolledStudents.map(s => (
                  <TableRow key={s.id}>
                    <TableCell>{s.roll_number}</TableCell>
                    <TableCell>{s.profiles.full_name}</TableCell>
                    <TableCell>{s.department}</TableCell>
                    <TableCell>{badge(getStudentStatus(s.id))}</TableCell>
                    <TableCell className="flex gap-1">
                      <Button size="sm" onClick={() => handleAttendanceChange(s.id, "present")}><Check /></Button>
                      <Button size="sm" onClick={() => handleAttendanceChange(s.id, "absent")}><X /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* REPORT */}
      <Card>
        <CardHeader>
          <CardTitle className="flex gap-2"><Download /> Generate Report</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <Label>From Date</Label>
              <Input type="date" value={reportFromDate} onChange={e => setReportFromDate(e.target.value)} />
            </div>
            <div>
              <Label>To Date</Label>
              <Input type="date" value={reportToDate} onChange={e => setReportToDate(e.target.value)} />
            </div>
            <Button onClick={generateDateRangeReport} disabled={generatingReport}>
              {generatingReport && <Loader2 className="animate-spin mr-2" />}
              Download PDF
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
