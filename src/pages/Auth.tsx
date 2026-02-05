import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { authAPI } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { GraduationCap, ArrowLeft } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";


type ForgotPasswordStep = "email" | "otp" | "newPassword";

const OTP_EXPIRY_SECONDS = 600; // 10 minutes

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
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
      await authAPI.sendOTP(forgotEmail);
      toast.success("If the email exists, you'll receive an OTP shortly.");
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
      const result = await authAPI.verifyOTP(forgotEmail, otpValue);
      
      if (result.error) {
        throw new Error(result.error);
      }

      // If OTP verified, reset password
      await authAPI.resetPassword(forgotEmail, newPassword);

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
      const result = await authAPI.login(loginEmail, loginPassword);

      // Decode JWT to get user role
      const userInfo = await authAPI.getCurrentUser();
      const role = userInfo?.role || "student";

      if (role === "admin") {
        navigate("/admin");
      } else if (role === "teacher") {
        navigate("/teacher");
      } else {
        navigate("/student");
      }
      
      toast.success("Login successful!");
    } catch (error: any) {
      toast.error(error.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };
  // Forgot Password UI
  if (showForgotPassword) {
    return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/80 to-accent opacity-90" />
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/40 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent/40 rounded-full blur-3xl" />
        <Card className="relative z-10 w-full max-w-md shadow-[var(--shadow-xl)] backdrop-blur-xl bg-white/90 dark:bg-black/40 border border-white/30">
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
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/80 to-accent opacity-90" />
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/40 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent/40 rounded-full blur-3xl" />
      <Card className="relative z-10 w-full max-w-md shadow-[var(--shadow-xl)] backdrop-blur-xl bg-white/90 dark:bg-black/40 border border-white/30">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-2">
            <GraduationCap className="h-10 w-10 md:h-12 md:w-12 text-primary" />
          </div>
          <CardTitle className="text-xl md:text-2xl font-bold">KPT Student Portal</CardTitle>
          <CardDescription className="text-sm">Manage and view data</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                placeholder="rishab@gmail.com"
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
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
