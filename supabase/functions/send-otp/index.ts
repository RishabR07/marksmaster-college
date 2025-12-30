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

async function hashOTP(otp: string) {
  const data = new TextEncoder().encode(otp);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
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

    // ✅ Proper user lookup
    const { data: user } = await supabase.auth.admin.getUserByEmail(email);

    // Security: always return success message
    if (!user) {
      return new Response(JSON.stringify({ message: "If the email exists, an OTP has been sent" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Cleanup old OTPs
    await supabase
      .from("password_reset_otps")
      .delete()
      .eq("email", email)
      .eq("used", false);

    const otp = generateOTP();
    const otpHash = await hashOTP(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await supabase.from("password_reset_otps").insert({
      email,
      otp_hash: otpHash,
      expires_at: expiresAt,
    });

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "noreply@marksmaster.com",
        to: [email],
        subject: "Password Reset OTP",
        html: `<h2>Your OTP is <strong>${otp}</strong></h2><p>Valid for 10 minutes.</p>`,
      }),
    });

    return new Response(JSON.stringify({ message: "OTP sent successfully" }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (err: any) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
