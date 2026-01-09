import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Use listUsers with email filter instead of getUserByEmail
    const { data: usersData, error: userError } = await supabase.auth.admin.listUsers();
    
    if (userError) {
      console.error("Error listing users:", userError);
      return new Response(JSON.stringify({ message: "If the email exists, an OTP has been sent" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const user = usersData.users.find(u => u.email?.toLowerCase() === email.toLowerCase());

    // Security: always return success message
    if (!user) {
      console.log("User not found for email:", email);
      return new Response(JSON.stringify({ message: "If the email exists, an OTP has been sent" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Cleanup old OTPs for this email
    await supabase
      .from("password_reset_otps")
      .delete()
      .eq("email", email.toLowerCase())
      .eq("used", false);

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Store OTP in plain text in otp_code column
    const { error: insertError } = await supabase.from("password_reset_otps").insert({
      email: email.toLowerCase(),
      otp_code: otp,
      expires_at: expiresAt,
    });

    if (insertError) {
      console.error("Error inserting OTP:", insertError);
      throw new Error("Failed to store OTP");
    }

    // Send email to the user's actual email address
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured");
      throw new Error("Email service not configured");
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "KPT Portal <noreply@marksmaster.com>",
        to: [user.email], // Send to the user's actual email
        subject: "Password Reset OTP - KPT Student Portal",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #3b82f6;">KPT Student Portal</h2>
            <h3>Password Reset Request</h3>
            <p>Your One-Time Password (OTP) for password reset is:</p>
            <div style="background: linear-gradient(135deg, #3b82f6, #06b6d4); color: white; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px;">${otp}</span>
            </div>
            <p style="color: #666;">This OTP is valid for <strong>10 minutes</strong>.</p>
            <p style="color: #666;">If you didn't request this password reset, please ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="color: #999; font-size: 12px;">KPT Student Portal - Academic Management System</p>
          </div>
        `,
      }),
    });

    // IMPORTANT: do not leak whether an email exists. Always return a generic success message.
    // If email provider rejects the request, log it for debugging.
    if (!emailResponse.ok) {
      const errorBody = await emailResponse.text();
      console.error("Resend email failed:", emailResponse.status, errorBody);
      return new Response(JSON.stringify({ message: "If the email exists, an OTP has been sent" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const emailResult = await emailResponse.json();
    console.log("Email sent to:", user.email, "Result:", emailResult);

    return new Response(JSON.stringify({ message: "If the email exists, an OTP has been sent" }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (err: any) {
    console.error("send-otp error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
