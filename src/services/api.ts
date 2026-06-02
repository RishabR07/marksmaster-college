/**
 * API Service Layer for Supabase Backend
 * Handles all database operations through Supabase client
 */

import { supabase } from "@/integrations/supabase/client";

const withTimeout = async <T>(
  promise: PromiseLike<T>,
  ms: number,
  message = "Request timed out"
): Promise<T> => {
  let timeoutId: number | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), ms);
  });

  try {
    return (await Promise.race([Promise.resolve(promise), timeoutPromise])) as T;
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
};

const signInWithPasswordDirect = async (email: string, password: string) => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: supabaseAnonKey,
        authorization: `Bearer ${supabaseAnonKey}`,
        "content-type": "application/json;charset=UTF-8",
      },
      body: JSON.stringify({ email, password, gotrue_meta_security: {} }),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => ({}))) as Record<string, string | number | object | null | undefined>;

    if (!response.ok) {
      throw new Error(payload.error_description || payload.msg || payload.error || "Invalid login credentials");
    }

    if (!payload.access_token || !payload.refresh_token || !payload.user) {
      throw new Error("Login failed. Please try again.");
    }

    const { error: sessionError } = await supabase.auth.setSession({
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
    });

    if (sessionError) throw sessionError;

    return {
      data: {
        user: payload.user,
        session: {
          access_token: payload.access_token,
          refresh_token: payload.refresh_token,
          expires_in: payload.expires_in,
          expires_at: payload.expires_at,
          token_type: payload.token_type,
          user: payload.user,
        },
      },
      error: null,
    };
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Login timed out. Please check your internet and try again.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

// =====================
// Auth API
// =====================

export const authAPI = {
  register: async (email: string, password: string, fullName: string, role: "admin" | "teacher" | "student" = "student") => {
    try {
      // Sign up user with email verification disabled for dev
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: undefined, // Don't send confirmation email
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Failed to create user");

      // Create user role
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: authData.user.id,
          role,
        });

      if (roleError) throw roleError;

      // Auto-confirm the user via backend function
      try {
        await supabase.functions.invoke("confirm-email", {
          body: { userId: authData.user.id },
        });
      } catch (err) {
        console.error("Failed to confirm email:", err);
        // Don't throw here - user is created, just can't confirm email yet
      }

      return { user: authData.user, role };
    } catch (error: any) {
      throw new Error(error.message || "Registration failed");
    }
  },

  login: async (email: string, password: string) => {
    try {
      const { data, error } = await signInWithPasswordDirect(email, password);

      if (error) throw error;
      if (!data.user) throw new Error("Login failed");

      // Get user role (if missing, default to student)
      const { data: roleData, error: roleError } = await withTimeout(
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.user.id)
          .maybeSingle(),
        10000,
        "Fetching your role timed out. Please try again."
      );

      // If the role query fails for real reasons (RLS, network), surface it
      if (roleError) throw roleError;

      // If role isn't returned due to RLS or timing, fallback to RPC check
      let resolvedRole: "admin" | "teacher" | "student" | null = (roleData?.role as any) || null;

      if (!resolvedRole) {
        try {
          const { data: isAdmin, error: adminErr } = await supabase.rpc("has_role", { _role: "admin", _user_id: data.user.id });
          if (!adminErr && Boolean(isAdmin)) {
            resolvedRole = "admin";
          } else {
            const { data: isTeacher, error: teacherErr } = await supabase.rpc("has_role", { _role: "teacher", _user_id: data.user.id });
            if (!teacherErr && Boolean(isTeacher)) resolvedRole = "teacher";
          }
        } catch (e) {
          // ignore RPC failures and fallback to student
        }
      }

      return {
        user: data.user,
        role: resolvedRole || "student",
        session: data.session,
      };
    } catch (error: any) {
      throw new Error(error.message || "Login failed");
    }
  },

  logout: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  getCurrentUser: async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data?.user || null;
    } catch (error) {
      return null;
    }
  },

  getSession: async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data?.session || null;
  },

  getUserRole: async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;
      return (data?.role as any) || null;
    } catch (error) {
      console.error("Failed to fetch user role:", error);
      return null;
    }
  },

  // Password reset via our custom Email OTP backend functions
  // (sends a 6-digit code, not a magic-link)
  sendOTP: async (email: string) => {
    try {
      const { error } = await supabase.functions.invoke("send-otp", {
        body: { email },
      });

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      throw new Error(error.message || "Failed to send OTP");
    }
  },

  verifyOTP: async (email: string, otp: string, newPassword: string) => {
    try {
      const { error } = await supabase.functions.invoke("verify-otp", {
        body: { email, otp, newPassword },
      });

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      throw new Error(error.message || "OTP verification failed");
    }
  },

  resetPassword: async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      throw new Error(error.message || "Password reset failed");
    }
  },

  changePassword: async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      throw new Error(error.message || "Password change failed");
    }
  },
};

// =====================
// Students API
// =====================

export const studentsAPI = {
  create: async (data: { student_user_id: string; roll_number: string; department?: string; semester?: number }) => {
    const { error, data: result } = await supabase
      .from("students")
      .insert([data])
      .select();
    if (error) throw error;
    return result?.[0];
  },

  getAll: async () => {
    const { data, error } = await supabase
      .from("students")
      .select("*");
    if (error) throw error;
    return data || [];
  },

  getById: async (id: string) => {
    const { data, error } = await supabase
      .from("students")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data;
  },

  getByUserId: async (userId: string) => {
    const { data, error } = await supabase
      .from("students")
      .select("*")
      .eq("student_user_id", userId)
      .single();
    if (error) throw error;
    return data;
  },

  update: async (id: string, data: Record<string, any>) => {
    const { error, data: result } = await supabase
      .from("students")
      .update(data)
      .eq("id", id)
      .select();
    if (error) throw error;
    return result?.[0];
  },

  delete: async (id: string) => {
    const { error } = await supabase
      .from("students")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },
};

// =====================
// Attendance API
// =====================

export const attendanceAPI = {
  create: async (data: { student_id: string; subject_id: string; status: string; marked_by: string; remarks?: string }) => {
    const { error, data: result } = await supabase
      .from("attendance")
      .insert([data])
      .select();
    if (error) throw error;
    return result?.[0];
  },

  getAll: async (filters?: Record<string, any>) => {
    let query = supabase.from("attendance").select("*");
    
    if (filters?.student_id) {
      query = query.eq("student_id", filters.student_id);
    }
    if (filters?.subject_id) {
      query = query.eq("subject_id", filters.subject_id);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  getByStudentAndSubject: async (studentId: string, subjectId: string) => {
    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .eq("student_id", studentId)
      .eq("subject_id", subjectId);
    if (error) throw error;
    return data || [];
  },

  update: async (id: string, data: Record<string, any>) => {
    const { error, data: result } = await supabase
      .from("attendance")
      .update(data)
      .eq("id", id)
      .select();
    if (error) throw error;
    return result?.[0];
  },

  delete: async (id: string) => {
    const { error } = await supabase
      .from("attendance")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },

  bulkCreate: async (records: any[]) => {
    const { error, data } = await supabase
      .from("attendance")
      .insert(records)
      .select();
    if (error) throw error;
    return data || [];
  },
};

// =====================
// Events API
// =====================

export const eventsAPI = {
  create: async (data: { title: string; description?: string; event_date: string; event_time?: string; location?: string; image_url?: string; branch?: string; year_of_studying?: number; created_by: string }) => {
    const { error, data: result } = await supabase
      .from("events")
      .insert([data])
      .select();
    if (error) throw error;
    return result?.[0];
  },

  getAll: async () => {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("event_date", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  getById: async (id: string) => {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data;
  },

  update: async (id: string, data: Record<string, any>) => {
    const { error, data: result } = await supabase
      .from("events")
      .update(data)
      .eq("id", id)
      .select();
    if (error) throw error;
    return result?.[0];
  },

  delete: async (id: string) => {
    const { error } = await supabase
      .from("events")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },
};

// =====================
// Subjects API
// =====================

export const subjectsAPI = {
  create: async (data: { subject_name: string; subject_code: string; teacher_id: string }) => {
    const { error, data: result } = await supabase
      .from("subjects")
      .insert([data])
      .select();
    if (error) throw error;
    return result?.[0];
  },

  getAll: async (filters?: Record<string, any>) => {
    let query = supabase.from("subjects").select("*");
    
    if (filters?.teacher_id) {
      query = query.eq("teacher_id", filters.teacher_id);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  getById: async (id: string) => {
    const { data, error } = await supabase
      .from("subjects")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data;
  },

  update: async (id: string, data: Record<string, any>) => {
    const { error, data: result } = await supabase
      .from("subjects")
      .update(data)
      .eq("id", id)
      .select();
    if (error) throw error;
    return result?.[0];
  },

  delete: async (id: string) => {
    const { error } = await supabase
      .from("subjects")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },
};

// =====================
// Marks API
// =====================

export const marksAPI = {
  create: async (data: { student_id: string; subject_id: string; marks: number; max_marks?: number; assessment_type: string; assessment_date?: string }) => {
    const { error, data: result } = await supabase
      .from("marks")
      .insert([data])
      .select();
    if (error) throw error;
    return result?.[0];
  },

  getAll: async (filters?: Record<string, any>) => {
    let query = supabase.from("marks").select("*");
    
    if (filters?.student_id) {
      query = query.eq("student_id", filters.student_id);
    }
    if (filters?.subject_id) {
      query = query.eq("subject_id", filters.subject_id);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  getByStudentAndSubject: async (studentId: string, subjectId: string) => {
    const { data, error } = await supabase
      .from("marks")
      .select("*")
      .eq("student_id", studentId)
      .eq("subject_id", subjectId);
    if (error) throw error;
    return data || [];
  },

  update: async (id: string, data: Record<string, any>) => {
    const { error, data: result } = await supabase
      .from("marks")
      .update(data)
      .eq("id", id)
      .select();
    if (error) throw error;
    return result?.[0];
  },

  bulkUpsert: async (records: any[]) => {
    const { error, data } = await supabase
      .from("marks")
      .upsert(records, { onConflict: "student_id,subject_id" })
      .select();
    if (error) throw error;
    return data || [];
  },

  delete: async (id: string) => {
    const { error } = await supabase
      .from("marks")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },
};

// =====================
// IA Marks API
// =====================

export const iaMarksAPI = {
  create: async (data: any) => {
    const { error, data: result } = await supabase
      .from("ia_marks")
      .insert([data])
      .select();
    if (error) throw error;
    return result?.[0];
  },

  getByStudentAndSubject: async (studentId: string, subjectId: string) => {
    const { data, error } = await supabase
      .from("ia_marks")
      .select("*")
      .eq("student_id", studentId)
      .eq("subject_id", subjectId)
      .single();
    if (error) throw error;
    return data;
  },

  update: async (id: string, data: Record<string, any>) => {
    const { error, data: result } = await supabase
      .from("ia_marks")
      .update(data)
      .eq("id", id)
      .select();
    if (error) throw error;
    return result?.[0];
  },

  getAll: async (filters?: Record<string, any>) => {
    let query = supabase.from("ia_marks").select("*");
    
    if (filters?.student_id) {
      query = query.eq("student_id", filters.student_id);
    }
    if (filters?.subject_id) {
      query = query.eq("subject_id", filters.subject_id);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  delete: async (id: string) => {
    const { error } = await supabase
      .from("ia_marks")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },
};

// =====================
// Enrollments API
// =====================

export const enrollmentsAPI = {
  create: async (data: { student_id: string; subject_id: string }) => {
    const { error, data: result } = await supabase
      .from("enrollments")
      .insert([data])
      .select();
    if (error) throw error;
    return result?.[0];
  },

  getAll: async (filters?: Record<string, any>) => {
    let query = supabase
      .from("enrollments")
      .select("*, student:students(*), subject:subjects(*)");
    
    if (filters?.student_id) {
      query = query.eq("student_id", filters.student_id);
    }
    if (filters?.subject_id) {
      query = query.eq("subject_id", filters.subject_id);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  getBySubject: async (subjectId: string) => {
    const { data, error } = await supabase
      .from("enrollments")
      .select("*, student:students(*)")
      .eq("subject_id", subjectId);
    if (error) throw error;
    return data || [];
  },

  delete: async (id: string) => {
    const { error } = await supabase
      .from("enrollments")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },

  bulkCreate: async (records: any[]) => {
    const { error, data } = await supabase
      .from("enrollments")
      .insert(records)
      .select();
    if (error) throw error;
    return data || [];
  },
};

// =====================
// Announcements API
// =====================

export const announcementsAPI = {
  create: async (data: { title: string; content: string; priority?: string; created_by: string }) => {
    const { error, data: result } = await supabase
      .from("announcements")
      .insert([data])
      .select();
    if (error) throw error;
    return result?.[0];
  },

  getAll: async () => {
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  update: async (id: string, data: Record<string, any>) => {
    const { error, data: result } = await supabase
      .from("announcements")
      .update(data)
      .eq("id", id)
      .select();
    if (error) throw error;
    return result?.[0];
  },

  delete: async (id: string) => {
    const { error } = await supabase
      .from("announcements")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },
};

// =====================
// Storage API
// =====================

export const storageAPI = {
  uploadEventImage: async (file: File, fileName: string) => {
    const { error, data } = await supabase.storage
      .from("event-images")
      .upload(`${fileName}`, file);
    
    if (error) throw error;
    
    const { data: urlData } = supabase.storage
      .from("event-images")
      .getPublicUrl(data.path);
    
    return urlData.publicUrl;
  },

  deleteEventImage: async (filePath: string) => {
    const { error } = await supabase.storage
      .from("event-images")
      .remove([filePath]);
    
    if (error) throw error;
  },
};

// =====================
// Profiles API
// =====================

export const profilesAPI = {
  get: async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (error) throw error;
    return data;
  },

  update: async (userId: string, data: Record<string, any>) => {
    const { error, data: result } = await supabase
      .from("profiles")
      .update(data)
      .eq("id", userId)
      .select();
    if (error) throw error;
    return result?.[0];
  },

  getAll: async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*");
    if (error) throw error;
    return data || [];
  },
};

// =====================
// User Roles API
// =====================

export const userRolesAPI = {
  getRole: async (userId: string) => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();
    if (error) throw error;
    return data?.role || null;
  },

  setRole: async (userId: string, role: string) => {
    const { error, data } = await supabase
      .from("user_roles")
      .upsert(
        { user_id: userId, role },
        { onConflict: "user_id" }
      )
      .select();
    if (error) throw error;
    return data?.[0];
  },

  getAllRoles: async () => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("*");
    if (error) throw error;
    return data || [];
  },
};

// =====================
// Utility Functions
// =====================

export const isAuthenticated = async (): Promise<boolean> => {
  const session = await authAPI.getSession();
  return !!session;
};

export const getCurrentSession = async () => {
  return await authAPI.getSession();
};

export default {
  authAPI,
  studentsAPI,
  attendanceAPI,
  eventsAPI,
  subjectsAPI,
  marksAPI,
  iaMarksAPI,
  enrollmentsAPI,
  announcementsAPI,
  storageAPI,
  profilesAPI,
  userRolesAPI,
  isAuthenticated,
  getCurrentSession,
};
