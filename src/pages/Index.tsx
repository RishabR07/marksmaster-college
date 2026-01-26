import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GraduationCap, BookOpen, Users } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0 },
};

const Index = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user && userRole) {
      if (userRole === "teacher") navigate("/teacher");
      else if (userRole === "student") navigate("/student");
      else if (userRole === "admin") navigate("/admin");
    }
  }, [user, userRole, loading, navigate]);

  return (
    <div className="min-h-screen flex flex-col bg-background overflow-hidden">
      <Header />

      {/* HERO SECTION */}
      <section className="relative flex-1">
        {/* Blue Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent" />

        {/* Subtle Glow Effects */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/30 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent/30 rounded-full blur-3xl" />

        <div className="relative container mx-auto px-4 py-16 md:py-24">
          {/* HERO CONTENT */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <div className="flex justify-center mb-6">
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ repeat: Infinity, duration: 6 }}
              >
                <GraduationCap className="h-20 w-20 text-primary-foreground drop-shadow-xl" />
              </motion.div>
            </div>

            <h1 className="text-4xl md:text-6xl font-extrabold text-white mb-6 tracking-tight">
              KPT Student Portal
            </h1>

            <p className="text-lg md:text-xl text-white/90 max-w-3xl mx-auto leading-relaxed">
              A next-generation academic management platform for attendance,
              assessments, announcements, and role-based dashboards.
            </p>
          </motion.div>

          {/* ROLE CARDS */}
          <motion.div
            initial="hidden"
            animate="visible"
            transition={{ staggerChildren: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto"
          >
            {/* FACULTY CARD */}
            <motion.div variants={fadeUp}>
              <Card className="relative group backdrop-blur-xl bg-card/95 border border-border shadow-2xl hover:scale-[1.03] transition-all duration-300">
                <CardHeader className="text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/20">
                    <BookOpen className="h-7 w-7 text-primary" />
                  </div>
                  <CardTitle className="text-2xl text-card-foreground">Faculty</CardTitle>
                  <CardDescription>
                    Teaching & academic control panel
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-5">
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>✓ Subject & syllabus management</li>
                    <li>✓ Student enrollment</li>
                    <li>✓ Attendance & IA marks</li>
                    <li>✓ Announcements & events</li>
                    <li>✓ Performance analytics</li>
                  </ul>

                  <Button
                    size="lg"
                    className="w-full shadow-lg"
                    onClick={() => navigate("/auth")}
                  >
                    Login as Faculty
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            {/* STUDENT CARD */}
            <motion.div variants={fadeUp}>
              <Card className="relative group backdrop-blur-xl bg-card/95 border border-border shadow-2xl hover:scale-[1.03] transition-all duration-300">
                <CardHeader className="text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/20">
                    <Users className="h-7 w-7 text-primary" />
                  </div>
                  <CardTitle className="text-2xl text-card-foreground">Students</CardTitle>
                  <CardDescription>
                    Academic progress at a glance
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-5">
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>✓ Subjects & timetable</li>
                    <li>✓ Attendance percentage</li>
                    <li>✓ IA & exam marks</li>
                    <li>✓ Grades & reports</li>
                    <li>✓ Notices & updates</li>
                  </ul>

                  <Button
                    size="lg"
                    className="w-full shadow-lg"
                    onClick={() => navigate("/auth")}
                  >
                    Login as Student
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
