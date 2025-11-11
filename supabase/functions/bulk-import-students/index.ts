import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface StudentImportData {
  full_name: string
  email: string
  roll_number: string
  department?: string
  semester?: number
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

    // Verify the requesting user is a teacher
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    
    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    // Check if user is teacher
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (roleError || !roleData || roleData.role !== 'teacher') {
      throw new Error('User is not a teacher')
    }

    const { students } = await req.json() as { students: StudentImportData[] }

    if (!students || !Array.isArray(students) || students.length === 0) {
      throw new Error('Invalid students data')
    }

    console.log(`Processing ${students.length} students for bulk import`)

    const results = {
      success: [] as { email: string; password: string; roll_number: string }[],
      failed: [] as { email: string; roll_number: string; error: string }[]
    }

    for (const studentData of students) {
      try {
        // Validate required fields
        if (!studentData.email || !studentData.full_name || !studentData.roll_number) {
          throw new Error('Missing required fields: email, full_name, or roll_number')
        }

        // Check if student with this roll number already exists
        const { data: existingStudent } = await supabaseAdmin
          .from('students')
          .select('id')
          .eq('roll_number', studentData.roll_number)
          .maybeSingle()

        if (existingStudent) {
          throw new Error(`Student with roll number ${studentData.roll_number} already exists`)
        }

        // Create auth user with a temporary password
        const tempPassword = Math.random().toString(36).slice(-12) + 'A1!'
        
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: studentData.email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            full_name: studentData.full_name
          }
        })

        if (authError) {
          throw new Error(`Auth creation failed: ${authError.message}`)
        }

        if (!authData.user) {
          throw new Error('User creation returned no user data')
        }

        console.log(`Created auth user: ${studentData.email}`)

        // Create profile entry (might already exist from trigger)
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .upsert({
            id: authData.user.id,
            email: studentData.email,
            full_name: studentData.full_name
          }, { onConflict: 'id' })

        if (profileError) {
          console.error(`Profile creation failed for ${studentData.email}:`, profileError)
        }

        // Create user role entry
        const { error: roleInsertError } = await supabaseAdmin
          .from('user_roles')
          .insert({
            user_id: authData.user.id,
            role: 'student'
          })

        if (roleInsertError) {
          throw new Error(`Role assignment failed: ${roleInsertError.message}`)
        }

        // Create student record
        const { error: studentError } = await supabaseAdmin
          .from('students')
          .insert({
            student_user_id: authData.user.id,
            roll_number: studentData.roll_number,
            department: studentData.department || null,
            semester: studentData.semester || null
          })

        if (studentError) {
          throw new Error(`Student record creation failed: ${studentError.message}`)
        }

        results.success.push({ 
          email: studentData.email, 
          password: tempPassword,
          roll_number: studentData.roll_number
        })
        console.log(`Successfully processed student: ${studentData.email}`)

      } catch (error: any) {
        console.error(`Failed to process student ${studentData.email}:`, error)
        results.failed.push({
          email: studentData.email,
          roll_number: studentData.roll_number || 'N/A',
          error: error.message
        })
      }
    }

    console.log(`Bulk import completed. Success: ${results.success.length}, Failed: ${results.failed.length}`)

    return new Response(
      JSON.stringify(results),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error: any) {
    console.error('Bulk import error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})
