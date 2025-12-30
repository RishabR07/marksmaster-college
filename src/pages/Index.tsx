import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  GraduationCap,
  BookOpen,
  Users,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const Index = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user && userRole) {
      if (userRole === "teacher") navigate("/teacher");
      else if (userRole === "student") navigate("/student");
      else if (userRole === "admin") navigate("/admin"); // backend/admin-only access
    }
  }, [user, userRole, loading, navigate]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <div className="flex-1" style={{ background: "var(--gradient-hero)" }}>
        <div className="container mx-auto px-4 py-10 md:py-16">
          
          {/* HERO */}
          <div className="text-center mb-12">
            <div className="flex justify-center mb-6">
              <GraduationCap className="h-16 w-16 md:h-20 md:w-20 text-primary-foreground" />
            </div>
            <h1 className="text-3xl md:text-5xl font-bold text-primary-foreground mb-4">
              KPT Student Portal
            </h1>
            <p className="text-base md:text-xl text-primary-foreground/90 max-w-3xl mx-auto">
              A complete academic management platform for course enrollment,
              attendance tracking, assessments, and role-based access for
              students and faculty.
            </p>
          </div>

          {/* ROLE CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">

            {/* FACULTY */}
            <Card className="shadow-[var(--shadow-xl)] hover:shadow-2xl transition-shadow border border-white dark:border-white/10">
              <CardHeader className="text-center">
                <BookOpen className="h-12 w-12 mx-auto mb-4 text-primary" />
                <CardTitle className="text-2xl">Faculty</CardTitle>
                <CardDescription>
                  Manage subjects, attendance, and assessments
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>✓ Create & manage subjects</li>
                  <li>✓ Enroll students</li>
                  <li>✓ Mark daily attendance</li>
                  <li>✓ Enter IA & assessment marks</li>
                  <li>✓ Publish announcements & events</li>
                </ul>
                <Button className="w-full" onClick={() => navigate("/auth")}>
                  Login as Faculty
                </Button>
              </CardContent>
            </Card>

            {/* STUDENT */}
            <Card className="shadow-[var(--shadow-xl)] hover:shadow-2xl transition-shadow border border-white dark:border-white/10">
              <CardHeader className="text-center">
                <Users className="h-12 w-12 mx-auto mb-4 text-primary" />
                <CardTitle className="text-2xl">Students</CardTitle>
                <CardDescription>
                  Track academics in one place
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>✓ View enrolled subjects</li>
                  <li>✓ Check IA & assessment marks</li>
                  <li>✓ Monitor attendance percentage</li>
                  <li>✓ View grades & performance</li>
                  <li>✓ Receive announcements</li>
                </ul>
                <Button className="w-full" onClick={() => navigate("/auth")}>
                  Login as Student
                </Button>
              </CardContent>
            </Card>

          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Index;
