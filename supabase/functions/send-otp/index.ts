import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendEmailWithGmail(to: string, subject: string, html: string) {
  const client = new SMTPClient({
    connection: {
      hostname: "smtp.gmail.com",
      port: 465,
      tls: true,
      auth: {
        username: "shettyrishab10@gmail.com",
        password: Deno.env.get("GMAIL_APP_PASSWORD")!,
      },
    },
  });

  try {
    await client.send({
      from: "KPT Portal <shettyrishab10@gmail.com>",
      to: to,
      subject: subject,
      content: "Please view this email in an HTML-capable email client.",
      html: html,
    });
    await client.close();
    return { success: true };
  } catch (error) {
    console.error("Gmail SMTP error:", error);
    await client.close();
    throw error;
  }
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

    // Send email using Gmail SMTP
    const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD");
    if (!GMAIL_APP_PASSWORD) {
      console.error("GMAIL_APP_PASSWORD not configured");
      throw new Error("Email service not configured");
    }

    const emailHtml = `
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
    `;

    try {
      await sendEmailWithGmail(user.email!, "Password Reset OTP - KPT Student Portal", emailHtml);
      console.log("Email sent successfully to:", user.email);
    } catch (emailError) {
      console.error("Failed to send email:", emailError);
      return new Response(JSON.stringify({ message: "If the email exists, an OTP has been sent" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

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
