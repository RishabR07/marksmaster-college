import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // Verify user is a teacher
    const { data: userRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (userRole?.role !== "teacher") {
      throw new Error("Only teachers can import marks");
    }

    const { marks, subjectId } = await req.json();

    if (!marks || !Array.isArray(marks) || marks.length === 0) {
      throw new Error("Marks array is required");
    }

    if (!subjectId) {
      throw new Error("Subject ID is required");
    }

    // Verify teacher owns this subject
    const { data: subject, error: subjectError } = await supabaseAdmin
      .from("subjects")
      .select("id")
      .eq("id", subjectId)
      .eq("teacher_id", user.id)
      .single();

    if (subjectError || !subject) {
      throw new Error("Subject not found or you don't have permission");
    }

    const results: { success: any[], failed: any[] } = {
      success: [],
      failed: []
    };

    for (const mark of marks) {
      try {
        const { roll_number, marks: studentMarks, max_marks, assessment_type, assessment_date } = mark;

        if (!roll_number) {
          results.failed.push({
            roll_number: roll_number || "N/A",
            error: "Roll number is required"
          });
          continue;
        }

        if (!studentMarks && studentMarks !== 0) {
          results.failed.push({
            roll_number,
            error: "Marks value is required"
          });
          continue;
        }

        if (!assessment_type) {
          results.failed.push({
            roll_number,
            error: "Assessment type is required"
          });
          continue;
        }

        // Find student by roll number
        const { data: student, error: studentError } = await supabaseAdmin
          .from("students")
          .select("id")
          .eq("roll_number", roll_number)
          .single();

        if (studentError || !student) {
          results.failed.push({
            roll_number,
            error: "Student not found with this roll number"
          });
          continue;
        }

        // Check if student is enrolled in this subject
        const { data: enrollment } = await supabaseAdmin
          .from("enrollments")
          .select("id")
          .eq("student_id", student.id)
          .eq("subject_id", subjectId)
          .single();

        if (!enrollment) {
          results.failed.push({
            roll_number,
            error: "Student not enrolled in this subject"
          });
          continue;
        }

        // Check if marks already exist for this student, subject, and assessment
        const { data: existingMarks } = await supabaseAdmin
          .from("marks")
          .select("id")
          .eq("student_id", student.id)
          .eq("subject_id", subjectId)
          .eq("assessment_type", assessment_type)
          .maybeSingle();

        if (existingMarks) {
          // Update existing marks
          const { error: updateError } = await supabaseAdmin
            .from("marks")
            .update({
              marks: studentMarks,
              max_marks: max_marks || 100,
              assessment_date: assessment_date || new Date().toISOString().split('T')[0],
              updated_at: new Date().toISOString()
            })
            .eq("id", existingMarks.id);

          if (updateError) {
            results.failed.push({
              roll_number,
              error: `Failed to update marks: ${updateError.message}`
            });
            continue;
          }

          results.success.push({
            roll_number,
            action: "updated"
          });
        } else {
          // Insert new marks
          const { error: insertError } = await supabaseAdmin
            .from("marks")
            .insert({
              student_id: student.id,
              subject_id: subjectId,
              marks: studentMarks,
              max_marks: max_marks || 100,
              assessment_type,
              assessment_date: assessment_date || new Date().toISOString().split('T')[0]
            });

          if (insertError) {
            results.failed.push({
              roll_number,
              error: `Failed to insert marks: ${insertError.message}`
            });
            continue;
          }

          results.success.push({
            roll_number,
            action: "created"
          });
        }
      } catch (error: any) {
        console.error(`Error processing marks for student:`, error);
        results.failed.push({
          roll_number: mark.roll_number || "N/A",
          error: error.message
        });
      }
    }

    console.log(`Bulk marks import completed: ${results.success.length} succeeded, ${results.failed.length} failed`);

    return new Response(
      JSON.stringify(results),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in bulk-import-marks function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
