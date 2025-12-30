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
import { format, startOfMonth, endOfMonth } from "date-fns";

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
  const [reportMonth, setReportMonth] = useState(format(new Date(), "yyyy-MM"));
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

  const fetchEnrolledStudents = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("enrollments")
      .select(`
        students!inner(
          id,
          roll_number,
          department,
          student_user_id
        )
      `)
      .eq("subject_id", selectedSubject);

    if (error) {
      toast.error("Failed to fetch students");
      setLoading(false);
      return;
    }

    const userIds = data.map((e: any) => e.students.student_user_id);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]));

    setEnrolledStudents(
      data.map((e: any) => ({
        id: e.students.id,
        roll_number: e.students.roll_number,
        department: e.students.department,
        student_user_id: e.students.student_user_id,
        profiles: { full_name: profileMap.get(e.students.student_user_id) || "Unknown" }
      }))
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

      const { data: attendanceData, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("subject_id", selectedSubject)
        .gte("attendance_date", format(startDate, "yyyy-MM-dd"))
        .lte("attendance_date", format(endDate, "yyyy-MM-dd"));

      if (error) throw error;

      const subject = subjects.find(s => s.id === selectedSubject);

      // ---- CALCULATE STUDENT STATS ----
      const studentStats = enrolledStudents.map(student => {
        const records = attendanceData?.filter(a => a.student_id === student.id) || [];

        const presentDays = records.filter(
          r => r.status === "present" || r.status === "late"
        ).length;

        const absentDays = records.filter(r => r.status === "absent").length;
        const totalMarkedDays = presentDays + absentDays;

        const percentage =
          totalMarkedDays > 0
            ? ((presentDays / totalMarkedDays) * 100).toFixed(1)
            : "0.0";

        return {
          rollNumber: student.roll_number,
          name: student.profiles.full_name,
          department: student.department,
          presentDays,
          absentDays,
          totalMarkedDays,
          percentage
        };
      });

      // Total working days = max marked days (matches image)
      const totalWorkingDays = Math.max(
        ...studentStats.map(s => s.totalMarkedDays),
        0
      );

      // ---- PDF GENERATION ----
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF();

      const margin = 10;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const contentWidth = pageWidth - margin * 2;
      let yPosition = margin;

      // Title
      doc.setFontSize(13);
      doc.setFont(undefined, "bold");
      doc.setTextColor(0, 0, 0);
      doc.text(
        `Attendance Report - ${subject?.subject_name} (${subject?.subject_code})`,
        margin,
        yPosition
      );
      yPosition += 5;

      // Report info
      doc.setFontSize(8);
      doc.setFont(undefined, "normal");
      doc.text(
        `Month: ${format(startDate, "MMMM yyyy")} | Working Days: ${totalWorkingDays}`,
        margin,
        yPosition
      );
      yPosition += 6;

      // Table headers
      const columns = ["Roll", "Name", "Dept", "Pres", "Abs", "Total", "%"];
      const colPercents = [11, 16, 9, 11, 11, 21, 21];
      const colWidths = colPercents.map(p => (p / 100) * contentWidth);
      const tableRowHeight = 4.5;
      const headerRowHeight = 5;

      // Draw header row
      doc.setFillColor(200, 200, 200);
      doc.setTextColor(0, 0, 0);
      let xPos = margin;
      columns.forEach((col, i) => {
        doc.rect(xPos, yPosition, colWidths[i], headerRowHeight);
        doc.setFontSize(6.5);
        doc.setFont(undefined, "bold");
        doc.text(col, xPos + colWidths[i] / 2, yPosition + 2.8, { align: "center" });
        xPos += colWidths[i];
      });
      yPosition += headerRowHeight;

      // Draw data rows
      doc.setFont(undefined, "normal");
      doc.setTextColor(0, 0, 0);
      const sortedStats = [...studentStats].sort((a, b) => a.rollNumber.localeCompare(b.rollNumber));

      const drawHeaderOnNewPage = () => {
        doc.addPage();
        yPosition = margin + 3;
        
        // Redraw header
        doc.setFillColor(200, 200, 200);
        xPos = margin;
        columns.forEach((col, i) => {
          doc.rect(xPos, yPosition, colWidths[i], headerRowHeight);
          doc.setFontSize(6.5);
          doc.setFont(undefined, "bold");
          doc.text(col, xPos + colWidths[i] / 2, yPosition + 2.8, { align: "center" });
          xPos += colWidths[i];
        });
        yPosition += headerRowHeight;
        doc.setFont(undefined, "normal");
      };

      sortedStats.forEach(student => {
        // Page break check
        if (yPosition > pageHeight - margin - 25) {
          drawHeaderOnNewPage();
        }

        doc.setFillColor(255, 255, 255);
        doc.setTextColor(0, 0, 0);
        const rowData = [
          student.rollNumber,
          student.name.substring(0, 13),
          student.department.substring(0, 3),
          student.presentDays.toString(),
          student.absentDays.toString(),
          student.totalMarkedDays.toString(),
          student.percentage
        ];

        xPos = margin;
        rowData.forEach((cell, i) => {
          // Draw border
          doc.setDrawColor(0);
          doc.setLineWidth(0.2);
          doc.rect(xPos, yPosition, colWidths[i], tableRowHeight);
          
          // Draw text
          doc.setFontSize(6);
          const cellCenterX = xPos + colWidths[i] / 2;
          const cellCenterY = yPosition + tableRowHeight / 2 + 0.8;
          
          // Left align for roll, name, dept; center for others
          const align = i <= 2 ? "left" : "center";
          const textX = align === "left" ? xPos + 1 : cellCenterX;
          
          doc.text(cell, textX, cellCenterY, { align, maxWidth: colWidths[i] - 2 });
          xPos += colWidths[i];
        });
        yPosition += tableRowHeight;
      });

      doc.save(`attendance_${subject?.subject_code}_${reportMonth}.pdf`);
      toast.success("Report downloaded successfully");
    } catch (error: any) {
      toast.error("Failed to generate report: " + error.message);
    } finally {
      setGeneratingReport(false);
    }
  };

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
        <CardContent className="flex gap-4">
          <Input type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)} />
          <Button onClick={generateReport} disabled={generatingReport}>
            {generatingReport && <Loader2 className="animate-spin mr-2" />}
            Download PDF
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
