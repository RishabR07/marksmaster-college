import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function generateRandomPassword(length: number = 12): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lowercase = 'abcdefghijklmnopqrstuvwxyz'
  const numbers = '0123456789'
  const symbols = '!@#$%^&*'
  const allChars = uppercase + lowercase + numbers + symbols

  let password = ''
  password += uppercase[Math.floor(Math.random() * uppercase.length)]
  password += lowercase[Math.floor(Math.random() * lowercase.length)]
  password += numbers[Math.floor(Math.random() * numbers.length)]
  password += symbols[Math.floor(Math.random() * symbols.length)]

  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)]
  }

  return password.split('').sort(() => Math.random() - 0.5).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // This function needs a special recovery key to be callable without auth
  const recoveryKey = req.headers.get('X-Recovery-Key')
  const expectedKey = Deno.env.get('RECOVERY_KEY')

  if (!recoveryKey || !expectedKey || recoveryKey !== expectedKey) {
    return new Response(
      JSON.stringify({ error: 'Invalid or missing recovery key' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      }
    )
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Get all profiles
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name')

    if (profileError) {
      throw new Error(`Failed to fetch profiles: ${profileError.message}`)
    }

    if (!profiles || profiles.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No profiles found to sync', synced: [] }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    console.log(`Found ${profiles.length} profiles to sync`)

    const results = {
      synced: [] as { email: string; password: string }[],
      skipped: [] as { email: string; reason: string }[],
      failed: [] as { email: string; error: string }[],
    }

    for (const profile of profiles) {
      try {
        // Check if user already exists in auth
        const { data: existingUser, error: checkError } = await supabaseAdmin.auth.admin.listUsers()

        const userExists = existingUser?.users?.some((u) => u.email === profile.email)

        if (userExists) {
          results.skipped.push({
            email: profile.email,
            reason: 'Auth user already exists',
          })
          continue
        }

        // Generate temporary password
        const tempPassword = generateRandomPassword()

        // Create auth user
        const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: profile.email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            full_name: profile.full_name,
          },
        })

        if (createError) {
          throw new Error(`Auth creation failed: ${createError.message}`)
        }

        if (!authData.user) {
          throw new Error('User creation returned no user data')
        }

        // Link the auth user to the profile by updating the profile id
        // The profile should already have the correct id if it was properly imported
        // But we need to ensure the user_roles table has an entry

        // Get the role for this user from user_roles if it exists
        const { data: existingRole } = await supabaseAdmin
          .from('user_roles')
          .select('role')
          .eq('user_id', profile.id)
          .maybeSingle()

        // If no role exists, create one (default to student)
        if (!existingRole) {
          const { error: roleError } = await supabaseAdmin
            .from('user_roles')
            .insert({
              user_id: profile.id,
              role: 'student',
            })

          if (roleError) {
            console.error(`Warning: Failed to create default role for ${profile.email}:`, roleError)
          }
        }

        results.synced.push({
          email: profile.email,
          password: tempPassword,
        })

        console.log(`Synced auth user for: ${profile.email}`)
      } catch (error: any) {
        console.error(`Failed to sync ${profile.email}:`, error)
        results.failed.push({
          email: profile.email,
          error: error.message,
        })
      }
    }

    console.log(
      `Sync completed. Synced: ${results.synced.length}, Skipped: ${results.skipped.length}, Failed: ${results.failed.length}`
    )

    return new Response(
      JSON.stringify({
        message: 'Profile sync completed',
        stats: {
          synced: results.synced.length,
          skipped: results.skipped.length,
          failed: results.failed.length,
        },
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
    console.error('Error in sync-profiles-to-auth:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
