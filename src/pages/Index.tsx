import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, BookOpen, Users } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const Index = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user && userRole) {
      if (userRole === "teacher") {
        navigate("/teacher");
      } else if (userRole === "student") {
        navigate("/student");
      }
    }
  }, [user, userRole, loading, navigate]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="flex-1" style={{ background: "var(--gradient-hero)" }}>
        <div className="container mx-auto px-4 py-8 md:py-16">
          <div className="text-center mb-8 md:mb-12">
            <div className="flex justify-center mb-4 md:mb-6">
              <GraduationCap className="h-14 w-14 md:h-20 md:w-20 text-primary-foreground" />
            </div>
            <h1 className="text-3xl md:text-5xl font-bold text-primary-foreground mb-3 md:mb-4">
              College Assessment System
            </h1>
            <p className="text-base md:text-xl text-primary-foreground/90 max-w-2xl mx-auto px-4">
              A modern platform for managing internal assessment marks efficiently
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 max-w-4xl mx-auto">
            <Card className="shadow-[var(--shadow-xl)] hover:shadow-2xl transition-shadow">
              <CardHeader className="text-center pb-4">
                <div className="flex justify-center mb-3 md:mb-4">
                  <BookOpen className="h-10 w-10 md:h-12 md:w-12 text-primary" />
                </div>
                <CardTitle className="text-xl md:text-2xl">For Teachers</CardTitle>
                <CardDescription className="text-sm">Manage subjects and student assessments</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>✓ Create and manage subjects</li>
                  <li>✓ Add student records</li>
                  <li>✓ Enter and update marks</li>
                  <li>✓ Track student performance</li>
                </ul>
                <Button className="w-full" onClick={() => navigate("/auth")}>
                  Get Started as Teacher
                </Button>
              </CardContent>
            </Card>

            <Card className="shadow-[var(--shadow-xl)] hover:shadow-2xl transition-shadow">
              <CardHeader className="text-center pb-4">
                <div className="flex justify-center mb-3 md:mb-4">
                  <Users className="h-10 w-10 md:h-12 md:w-12 text-primary" />
                </div>
                <CardTitle className="text-xl md:text-2xl">For Students</CardTitle>
                <CardDescription className="text-sm">View your assessment marks and grades</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>✓ View all your marks</li>
                  <li>✓ Track assessment history</li>
                  <li>✓ See grades and percentages</li>
                  <li>✓ Monitor your progress</li>
                </ul>
                <Button className="w-full" onClick={() => navigate("/auth")}>
                  Get Started as Student
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
