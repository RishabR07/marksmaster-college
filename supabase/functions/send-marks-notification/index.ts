import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0'

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

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: 'KPT Management <onboarding@resend.dev>',
        to: [studentEmail],
        subject: `New Marks Added - ${subjectName}`,
        html: `
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
        `,
      }),
    })

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json()
      throw new Error(`Resend API error: ${JSON.stringify(errorData)}`)
    }

    const emailData = await emailResponse.json()
    console.log('Marks notification sent successfully:', emailData)

    return new Response(
      JSON.stringify({ success: true, messageId: emailData.id }),
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
