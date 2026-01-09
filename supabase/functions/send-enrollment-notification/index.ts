import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0'
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EnrollmentNotificationRequest {
  studentEmail: string
  studentName: string
  subjectName: string
  subjectCode: string
  teacherName: string
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Verify authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    
    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    const { studentEmail, studentName, subjectName, subjectCode, teacherName }: EnrollmentNotificationRequest = await req.json()

    console.log(`Sending enrollment notification to ${studentEmail} for ${subjectName}`)

    const GMAIL_APP_PASSWORD = Deno.env.get('GMAIL_APP_PASSWORD')
    if (!GMAIL_APP_PASSWORD) {
      throw new Error('GMAIL_APP_PASSWORD not configured')
    }

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Subject Enrollment Notification</h1>
        <p>Hello ${studentName},</p>
        <p>You have been enrolled in the following subject:</p>
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="color: #555; margin-top: 0;">${subjectName}</h2>
          <p style="color: #666;"><strong>Subject Code:</strong> ${subjectCode}</p>
          <p style="color: #666;"><strong>Teacher:</strong> ${teacherName}</p>
        </div>
        <p>You can now view this subject and your marks in your student dashboard.</p>
        <p style="margin-top: 30px;">Best regards,<br>KPT Management Team</p>
      </div>
    `;

    await sendEmailWithGmail(studentEmail, `You've been enrolled in ${subjectName}`, emailHtml);
    console.log('Enrollment notification sent successfully to:', studentEmail);

    return new Response(
      JSON.stringify({ success: true, messageId: 'gmail-sent' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error: any) {
    console.error('Error sending enrollment notification:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
