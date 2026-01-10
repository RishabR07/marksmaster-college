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
  <div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
    
    <h1 style="color: #2c2c2c; text-align: center; border-bottom: 2px solid #e0e0e0; padding-bottom: 10px;">
      Subject Enrollment Confirmation
    </h1>
    
    <p style="color: #444; font-size: 15px;">Dear <strong>${studentName}</strong>,</p>
    
    <p style="color: #555; font-size: 14px; line-height: 1.6;">
      We are pleased to inform you that you have been successfully enrolled in the following academic subject as part of your current semester curriculum. This enrollment has been recorded in the academic management system.
    </p>
    
    <div style="background-color: #f7f7f7; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #e0e0e0;">
      <h2 style="color: #333; margin-top: 0; font-size: 18px;">
        ${subjectName}
      </h2>
      <p style="color: #555; font-size: 14px; margin: 6px 0;">
        <strong>Subject Code:</strong> ${subjectCode}
      </p>
      <p style="color: #555; font-size: 14px; margin: 6px 0;">
        <strong>Assigned Faculty:</strong> ${teacherName}
      </p>
    </div>
    
    <p style="color: #555; font-size: 14px; line-height: 1.6;">
      You may now log in to your student dashboard to view the enrolled subject details, track internal assessment marks, monitor attendance, and receive related announcements.
    </p>
    
    <p style="color: #555; font-size: 14px; line-height: 1.6;">
      If you believe there is any discrepancy in the enrollment details or require further assistance, please contact the academic office or your department coordinator at the earliest.
    </p>
    
    <p style="color: #555; font-size: 14px; line-height: 1.6;">
      We wish you success in your academic journey and encourage you to stay engaged with your coursework throughout the semester.
    </p>
    
    <p style="margin-top: 35px; color: #444; font-size: 14px;">
      Warm regards,<br>
      <strong>KPT Academic Management Team</strong><br>
      <span style="color: #777; font-size: 13px;">
        (This is an automated notification. Please do not reply to this email.)
      </span>
    </p>
    
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
