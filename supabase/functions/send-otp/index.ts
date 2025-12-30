import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Check if user exists
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (userError) {
      console.error("Error listing users:", userError);
      return new Response(
        JSON.stringify({ error: "Failed to verify email" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const userExists = userData.users.some(user => user.email === email);
    
    if (!userExists) {
      // Don't reveal if email exists or not for security
      return new Response(
        JSON.stringify({ message: "If the email exists, an OTP has been sent" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Delete any existing unused OTPs for this email
    await supabaseAdmin
      .from("password_reset_otps")
      .delete()
      .eq("email", email)
      .eq("used", false);

    // Generate new OTP
    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    // Store OTP in database
    const { error: insertError } = await supabaseAdmin
      .from("password_reset_otps")
      .insert({
        email,
        otp_code: otpCode,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error("Error storing OTP:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to generate OTP" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Send email with OTP using Resend API directly
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "noreply@marksmaster.com",
        to: [email],
        subject: "Password Reset OTP - KPT Management System",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px 8px 0 0; color: white; text-align: center;">
              <h2 style="margin: 0; font-size: 24px;">Password Reset OTP</h2>
            </div>
            <div style="background-color: #f9f9f9; padding: 30px; border: 1px solid #e0e0e0; border-radius: 0 0 8px 8px;">
              <p style="color: #333; margin-bottom: 20px;">You have requested to reset your password. Use the following OTP code to proceed:</p>
              <div style="background-color: #ffffff; padding: 25px; text-align: center; margin: 25px 0; border-radius: 8px; border: 2px solid #667eea;">
                <h1 style="color: #667eea; font-size: 42px; letter-spacing: 8px; margin: 0; font-weight: bold;">${otpCode}</h1>
              </div>
              <p style="color: #666; text-align: center; font-size: 14px; margin: 20px 0;">This OTP is valid for <strong>10 minutes</strong></p>
              <hr style="border: none; border-top: 1px solid #ddd; margin: 25px 0;">
              <p style="color: #999; font-size: 12px; margin: 0;">
                <strong>Note:</strong> If you did not request this, please ignore this email or contact support immediately.
              </p>
              <p style="color: #999; font-size: 12px; margin-top: 15px;">
                KPT Management Team &copy; ${new Date().getFullYear()}
              </p>
            </div>
          </div>
        `,
      }),
    });

    const responseBody = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error("Resend API Error:", responseBody);
      return new Response(
        JSON.stringify({ 
          error: "Failed to send OTP email",
          details: responseBody.message || "Unknown error"
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("OTP email sent successfully to:", email, "Message ID:", responseBody.id);

    return new Response(
      JSON.stringify({ message: "OTP sent successfully" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-otp function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
