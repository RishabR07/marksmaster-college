import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface UserImportData {
  email: string
  full_name: string
  role: 'admin' | 'teacher' | 'student'
  roll_number?: string
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

    // Verify the requesting user is an admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    
    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (roleError || !roleData || roleData.role !== 'admin') {
      throw new Error('User is not an admin')
    }

    const { users } = await req.json() as { users: UserImportData[] }

    if (!users || !Array.isArray(users) || users.length === 0) {
      throw new Error('Invalid users data')
    }

    console.log(`Processing ${users.length} users for bulk import`)

    const results = {
      success: [] as string[],
      failed: [] as { email: string; error: string }[]
    }

    for (const userData of users) {
      try {
        // Validate required fields
        if (!userData.email || !userData.full_name || !userData.role) {
          throw new Error('Missing required fields: email, full_name, or role')
        }

        // Validate student-specific fields
        if (userData.role === 'student' && !userData.roll_number) {
          throw new Error('Students must have a roll_number')
        }

        // Create auth user with a temporary password
        const tempPassword = Math.random().toString(36).slice(-12) + 'A1!'
        
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: userData.email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            full_name: userData.full_name
          }
        })

        if (authError) {
          throw new Error(`Auth creation failed: ${authError.message}`)
        }

        if (!authData.user) {
          throw new Error('User creation returned no user data')
        }

        console.log(`Created auth user: ${userData.email}`)

        // Create profile entry
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .insert({
            id: authData.user.id,
            email: userData.email,
            full_name: userData.full_name
          })

        if (profileError) {
          console.error(`Profile creation failed for ${userData.email}:`, profileError)
          // Continue anyway as the trigger might have created it
        }

        // Create user role entry
        const { error: roleInsertError } = await supabaseAdmin
          .from('user_roles')
          .insert({
            user_id: authData.user.id,
            role: userData.role
          })

        if (roleInsertError) {
          throw new Error(`Role assignment failed: ${roleInsertError.message}`)
        }

        // If student, create student record
        if (userData.role === 'student') {
          const { error: studentError } = await supabaseAdmin
            .from('students')
            .insert({
              student_user_id: authData.user.id,
              roll_number: userData.roll_number!,
              department: userData.department || null,
              semester: userData.semester || null
            })

          if (studentError) {
            throw new Error(`Student record creation failed: ${studentError.message}`)
          }
        }

        results.success.push(userData.email)
        console.log(`Successfully processed user: ${userData.email}`)

      } catch (error: any) {
        console.error(`Failed to process user ${userData.email}:`, error)
        results.failed.push({
          email: userData.email,
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
