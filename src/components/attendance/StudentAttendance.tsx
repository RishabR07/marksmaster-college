import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Calendar, Check, X, Clock, AlertCircle, TrendingUp, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface Subject {
  id: string;
  subject_name: string;
  subject_code: string;
  teacher_name: string;
}

interface AttendanceRecord {
  id: string;
  attendance_date: string;
  status: "present" | "absent" | "late" | "excused";
  remarks: string | null;
  subject_name: string;
  subject_code: string;
}

interface AttendanceStats {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  percentage: number;
}

interface StudentAttendanceProps {
  studentId: string;
}

export const StudentAttendance = ({ studentId }: StudentAttendanceProps) => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>("all");
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<AttendanceStats>({ total: 0, present: 0, absent: 0, late: 0, excused: 0, percentage: 0 });
  const [loading, setLoading] = useState(true);
  const [studentDbId, setStudentDbId] = useState<string | null>(null);

  useEffect(() => {
    fetchStudentDbId();
  }, [studentId]);

  useEffect(() => {
    if (studentDbId) {
      fetchEnrolledSubjects();
    }
  }, [studentDbId]);

  useEffect(() => {
    if (studentDbId) {
      fetchAttendance();
    }
  }, [studentDbId, selectedSubject]);

  const fetchStudentDbId = async () => {
    const { data, error } = await supabase
      .from("students")
      .select("id")
      .eq("student_user_id", studentId)
      .maybeSingle();

    if (error) {
      toast.error("Failed to fetch student info");
      return;
    }

    if (data) {
      setStudentDbId(data.id);
    }
  };

  const fetchEnrolledSubjects = async () => {
    if (!studentDbId) return;

    const { data, error } = await supabase
      .from("enrollments")
      .select(`
        subject_id,
        subjects!inner(
          id,
          subject_name,
          subject_code,
          teacher_id
        )
      `)
      .eq("student_id", studentDbId);

    if (error) {
      toast.error("Failed to fetch enrolled subjects");
      return;
    }

    if (data) {
      const teacherIds = data.map((e: any) => e.subjects.teacher_id);
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", teacherIds);

      const profileMap = new Map(profilesData?.map(p => [p.id, p.full_name]));

      const subjectsList = data.map((enrollment: any) => ({
        id: enrollment.subjects.id,
        subject_name: enrollment.subjects.subject_name,
        subject_code: enrollment.subjects.subject_code,
        teacher_name: profileMap.get(enrollment.subjects.teacher_id) || "Unknown"
      }));

      setSubjects(subjectsList);
    }
  };

  const fetchAttendance = async () => {
    if (!studentDbId) return;
    setLoading(true);

    let query = supabase
      .from("attendance")
      .select(`
        id,
        attendance_date,
        status,
        remarks,
        subjects!inner(
          subject_name,
          subject_code
        )
      `)
      .eq("student_id", studentDbId)
      .order("attendance_date", { ascending: false });

    if (selectedSubject !== "all") {
      query = query.eq("subject_id", selectedSubject);
    }

    const { data, error } = await query;

    if (error) {
      toast.error("Failed to fetch attendance");
      setLoading(false);
      return;
    }

    const records = data?.map((record: any) => ({
      id: record.id,
      attendance_date: record.attendance_date,
      status: record.status,
      remarks: record.remarks,
      subject_name: record.subjects.subject_name,
      subject_code: record.subjects.subject_code
    })) || [];

    setAttendanceRecords(records);
    calculateStats(records);
    setLoading(false);
  };

  const calculateStats = (records: AttendanceRecord[]) => {
    const total = records.length;
    const present = records.filter(r => r.status === "present").length;
    const absent = records.filter(r => r.status === "absent").length;
    const late = records.filter(r => r.status === "late").length;
    const excused = records.filter(r => r.status === "excused").length;
    const percentage = total > 0 ? ((present + late) / total) * 100 : 0;

    setStats({ total, present, absent, late, excused, percentage });
  };

  const getStatusBadge = (status: string) => {
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
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPercentageColor = (percentage: number) => {
    if (percentage >= 75) return "text-green-600";
    if (percentage >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 75) return "bg-green-500";
    if (percentage >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="shadow-[var(--shadow-sm)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Attendance Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${getPercentageColor(stats.percentage)}`}>
              {stats.percentage.toFixed(1)}%
            </div>
            <Progress 
              value={stats.percentage} 
              className="mt-2 h-2" 
            />
          </CardContent>
        </Card>
        
        <Card className="shadow-[var(--shadow-sm)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              Present
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.present}</div>
            <p className="text-xs text-muted-foreground">days</p>
          </CardContent>
        </Card>

        <Card className="shadow-[var(--shadow-sm)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <X className="h-4 w-4 text-red-500" />
              Absent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{stats.absent}</div>
            <p className="text-xs text-muted-foreground">days</p>
          </CardContent>
        </Card>

        <Card className="shadow-[var(--shadow-sm)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              Late / Excused
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">{stats.late + stats.excused}</div>
            <p className="text-xs text-muted-foreground">days</p>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Records */}
      <Card className="shadow-[var(--shadow-md)]">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Attendance History
              </CardTitle>
              <CardDescription>View your attendance records by subject</CardDescription>
            </div>
            <div className="w-full md:w-64">
              <Label className="sr-only">Filter by Subject</Label>
              <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                <SelectTrigger>
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
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : attendanceRecords.length === 0 ? (
            <div className="text-center py-8">
              <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No attendance records found</p>
              <p className="text-sm text-muted-foreground">Your attendance will appear here once marked by your teachers</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendanceRecords.map(record => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">
                      {format(new Date(record.attendance_date), "EEE, MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      {record.subject_name}
                      <span className="text-muted-foreground ml-2">({record.subject_code})</span>
                    </TableCell>
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {record.remarks || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Subject-wise Summary */}
      {subjects.length > 0 && (
        <Card className="shadow-[var(--shadow-md)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Subject-wise Attendance
            </CardTitle>
            <CardDescription>Your attendance percentage by subject</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {subjects.map(subject => {
                const subjectRecords = attendanceRecords.filter(
                  r => r.subject_code === subject.subject_code || selectedSubject === "all"
                ).filter(r => r.subject_code === subject.subject_code);
                const total = subjectRecords.length;
                const present = subjectRecords.filter(r => r.status === "present" || r.status === "late").length;
                const percentage = total > 0 ? (present / total) * 100 : 0;

                return (
                  <div key={subject.id} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-medium">{subject.subject_name}</span>
                        <span className="text-muted-foreground ml-2">({subject.subject_code})</span>
                      </div>
                      <span className={`font-bold ${getPercentageColor(percentage)}`}>
                        {total > 0 ? `${percentage.toFixed(1)}%` : "N/A"}
                      </span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      Teacher: {subject.teacher_name} • {present}/{total} classes attended
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
