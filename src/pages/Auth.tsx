import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { GraduationCap, ArrowLeft } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { ThemeToggle } from "@/components/ThemeToggle";

type ForgotPasswordStep = "email" | "otp" | "newPassword";

const OTP_EXPIRY_SECONDS = 600; // 10 minutes

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Signup state
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupFullName, setSignupFullName] = useState("");
  const [signupRole, setSignupRole] = useState<"teacher" | "student">("student");
  const [rollNumber, setRollNumber] = useState("");
  const [department, setDepartment] = useState("");

  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState<ForgotPasswordStep>("email");
  const [forgotEmail, setForgotEmail] = useState("");
  const [otpValue, setOtpValue] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  
  // OTP Timer state
  const [otpTimeRemaining, setOtpTimeRemaining] = useState(OTP_EXPIRY_SECONDS);
  const [otpTimerActive, setOtpTimerActive] = useState(false);

  // OTP Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (otpTimerActive && otpTimeRemaining > 0) {
      interval = setInterval(() => {
        setOtpTimeRemaining((prev) => prev - 1);
      }, 1000);
    } else if (otpTimeRemaining === 0) {
      setOtpTimerActive(false);
    }

    return () => clearInterval(interval);
  }, [otpTimerActive, otpTimeRemaining]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSendOTP = async () => {
    if (!forgotEmail) {
      toast.error("Please enter your email address");
      return;
    }

    setForgotLoading(true);

    try {
      const response = await supabase.functions.invoke("send-otp", {
        body: { email: forgotEmail },
      });

      if (response.error) throw response.error;

      toast.success("OTP sent to your email!");
      setForgotStep("otp");
      setOtpTimeRemaining(OTP_EXPIRY_SECONDS);
      setOtpTimerActive(true);
    } catch (error: any) {
      toast.error(error.message || "Failed to send OTP");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setOtpValue("");
    await handleSendOTP();
  };

  const handleVerifyAndResetPassword = async () => {
    if (otpValue.length !== 6) {
      toast.error("Please enter the complete 6-digit OTP");
      return;
    }

    if (otpTimeRemaining === 0) {
      toast.error("OTP has expired. Please request a new one.");
      return;
    }

    if (!newPassword || !confirmPassword) {
      toast.error("Please enter your new password");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setForgotLoading(true);

    try {
      const response = await supabase.functions.invoke("verify-otp", {
        body: { 
          email: forgotEmail, 
          otp: otpValue,
          newPassword: newPassword 
        },
      });

      if (response.error) throw response.error;

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast.success("Password reset successfully! Please login with your new password.");
      resetForgotPasswordState();
    } catch (error: any) {
      toast.error(error.message || "Failed to reset password");
    } finally {
      setForgotLoading(false);
    }
  };

  const resetForgotPasswordState = () => {
    setShowForgotPassword(false);
    setForgotStep("email");
    setForgotEmail("");
    setOtpValue("");
    setNewPassword("");
    setConfirmPassword("");
    setOtpTimerActive(false);
    setOtpTimeRemaining(OTP_EXPIRY_SECONDS);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (error) throw error;

      if (data.user) {
        const { data: roleData, error: roleError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.user.id)
          .maybeSingle();

        if (roleError) {
          console.error("Error fetching role:", roleError);
          toast.error("Could not determine user role");
          return;
        }

        if (!roleData) {
          toast.error("No role assigned to this user. Please contact support.");
          return;
        }

        if (roleData.role === "admin") {
          navigate("/admin");
        } else if (roleData.role === "teacher") {
          navigate("/teacher");
        } else {
          navigate("/student");
        }
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: signupEmail,
        password: signupPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: signupFullName,
          },
        },
      });

      if (error) throw error;

      if (data.user) {
        // Insert user role
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({ user_id: data.user.id, role: signupRole });

        if (roleError) throw roleError;

        // If student, create student record
        if (signupRole === "student") {
          const { error: studentError } = await supabase
            .from("students")
            .insert({
              student_user_id: data.user.id,
              roll_number: rollNumber,
              department: department,
            });

          if (studentError) throw studentError;
        }

        toast.success("Account created successfully! Please log in.");
        setIsLogin(true);
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password UI
  if (showForgotPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--gradient-hero)" }}>
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <Card className="w-full max-w-md shadow-[var(--shadow-xl)]">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-2">
              <GraduationCap className="h-10 w-10 md:h-12 md:w-12 text-primary" />
            </div>
            <CardTitle className="text-xl md:text-2xl font-bold">Reset Password</CardTitle>
            <CardDescription className="text-sm">
              {forgotStep === "email" && "Enter your email to receive an OTP"}
              {forgotStep === "otp" && "Enter the 6-digit OTP sent to your email"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={resetForgotPasswordState}
              className="mb-2"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Login
            </Button>

            {forgotStep === "email" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgot-email">Email</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="name@college.edu"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                  />
                </div>
                <Button 
                  onClick={handleSendOTP} 
                  className="w-full" 
                  disabled={forgotLoading}
                >
                  {forgotLoading ? "Sending OTP..." : "Send OTP"}
                </Button>
              </div>
            )}

            {forgotStep === "otp" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Enter OTP</Label>
                  <div className="flex justify-center">
                    <InputOTP
                      maxLength={6}
                      value={otpValue}
                      onChange={(value) => setOtpValue(value)}
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  {/* OTP Timer */}
                  <div className="text-center mt-3">
                    {otpTimeRemaining > 0 ? (
                      <p className={`text-sm font-medium ${otpTimeRemaining <= 60 ? 'text-destructive' : 'text-muted-foreground'}`}>
                        OTP expires in: <span className="font-bold">{formatTime(otpTimeRemaining)}</span>
                      </p>
                    ) : (
                      <p className="text-sm text-destructive font-medium">
                        OTP has expired. Please request a new one.
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                <Button 
                  onClick={handleVerifyAndResetPassword} 
                  className="w-full" 
                  disabled={forgotLoading || otpTimeRemaining === 0}
                >
                  {forgotLoading ? "Resetting..." : "Reset Password"}
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={handleResendOTP} 
                  className="w-full"
                  disabled={forgotLoading}
                >
                  Resend OTP
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--gradient-hero)" }}>
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md shadow-[var(--shadow-xl)]">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-2">
            <GraduationCap className="h-10 w-10 md:h-12 md:w-12 text-primary" />
          </div>
          <CardTitle className="text-xl md:text-2xl font-bold">College Assessment System</CardTitle>
          <CardDescription className="text-sm">Manage and view internal assessment marks</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={isLogin ? "login" : "signup"} onValueChange={(v) => setIsLogin(v === "login")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="name@college.edu"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="login-password">Password</Label>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotEmail(loginEmail);
                        setShowForgotPassword(true);
                      }}
                      className="text-sm text-primary hover:underline"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <Input
                    id="login-password"
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Logging in..." : "Login"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full Name</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="John Doe"
                    value={signupFullName}
                    onChange={(e) => setSignupFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="name@college.edu"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <div className="flex gap-4">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="role"
                        value="student"
                        checked={signupRole === "student"}
                        onChange={(e) => setSignupRole(e.target.value as "student")}
                        className="accent-primary"
                      />
                      <span>Student</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="role"
                        value="teacher"
                        checked={signupRole === "teacher"}
                        onChange={(e) => setSignupRole(e.target.value as "teacher")}
                        className="accent-primary"
                      />
                      <span>Teacher</span>
                    </label>
                  </div>
                </div>
                {signupRole === "student" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="roll-number">Roll Number</Label>
                      <Input
                        id="roll-number"
                        type="text"
                        placeholder="CS2021001"
                        value={rollNumber}
                        onChange={(e) => setRollNumber(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="department">Department</Label>
                      <Input
                        id="department"
                        type="text"
                        placeholder="Computer Science"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        required
                      />
                    </div>
                  </>
                )}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating account..." : "Sign Up"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
