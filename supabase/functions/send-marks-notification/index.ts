import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0'
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MarksNotificationRequest {
  studentEmail: string
  studentName: string
  subjectName: string
  subjectCode: string
  marks: number
  maxMarks: number
  assessmentType: string
  assessmentDate: string
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

    const { 
      studentEmail, 
      studentName, 
      subjectName, 
      subjectCode, 
      marks, 
      maxMarks, 
      assessmentType,
      assessmentDate 
    }: MarksNotificationRequest = await req.json()

    const percentage = ((marks / maxMarks) * 100).toFixed(2)

    console.log(`Sending marks notification to ${studentEmail} for ${subjectName}`)

    const GMAIL_APP_PASSWORD = Deno.env.get('GMAIL_APP_PASSWORD')
    if (!GMAIL_APP_PASSWORD) {
      throw new Error('GMAIL_APP_PASSWORD not configured')
    }

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">New Assessment Marks</h1>
        <p>Hello ${studentName},</p>
        <p>Your marks have been added for the following assessment:</p>
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="color: #555; margin-top: 0;">${subjectName} (${subjectCode})</h2>
          <p style="color: #666;"><strong>Assessment:</strong> ${assessmentType}</p>
          <p style="color: #666;"><strong>Date:</strong> ${assessmentDate}</p>
          <div style="margin-top: 20px; padding: 15px; background-color: #fff; border-radius: 5px;">
            <p style="font-size: 24px; font-weight: bold; color: #333; margin: 0;">
              ${marks} / ${maxMarks}
            </p>
            <p style="color: #666; margin-top: 10px;">Percentage: ${percentage}%</p>
          </div>
        </div>
        <p>You can view all your marks in your student dashboard.</p>
        <p style="margin-top: 30px;">Best regards,<br>KPT Management Team</p>
      </div>
    `;

    await sendEmailWithGmail(studentEmail, `New Marks Added - ${subjectName}`, emailHtml);
    console.log('Marks notification sent successfully to:', studentEmail);

    return new Response(
      JSON.stringify({ success: true, messageId: 'gmail-sent' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error: any) {
    console.error('Error sending marks notification:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
