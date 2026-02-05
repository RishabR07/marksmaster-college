/**
 * API Service Layer for Express Backend
 * Handles all HTTP requests to the Express/MongoDB backend
 */

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// =====================
// Helper Functions
// =====================

const getAuthToken = (): string | null => {
  return localStorage.getItem("authToken");
};

const setAuthToken = (token: string) => {
  localStorage.setItem("authToken", token);
};

const clearAuthToken = () => {
  localStorage.removeItem("authToken");
};

const getHeaders = (includeAuth = true): Record<string, string> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (includeAuth) {
    const token = getAuthToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  return headers;
};

const handleResponse = async (response: Response) => {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.msg || data.error || "An error occurred");
  }

  return data;
};

// =====================
// Auth API
// =====================

export const authAPI = {
  register: async (name: string, email: string, password: string, role: string = "student") => {
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: "POST",
      headers: getHeaders(false),
      body: JSON.stringify({ name, email, password, role }),
    });
    const data = await handleResponse(response);
    if (data.token) {
      setAuthToken(data.token);
    }
    return data;
  },

  login: async (email: string, password: string) => {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: getHeaders(false),
      body: JSON.stringify({ email, password }),
    });
    const data = await handleResponse(response);
    if (data.token) {
      setAuthToken(data.token);
    }
    return data;
  },

  logout: () => {
    clearAuthToken();
  },

  getCurrentUser: async () => {
    const token = getAuthToken();
    if (!token) return null;

    // Decode JWT to get user info (without verifying signature)
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.user;
    } catch (error) {
      clearAuthToken();
      return null;
    }
  },

  getUserRole: async (userId: string): Promise<string | null> => {
    try {
      const response = await fetch(`${API_URL}/api/auth/user/${userId}`, {
        method: "GET",
        headers: getHeaders(true),
      });
      const data = await handleResponse(response);
      return data.role || null;
    } catch (error) {
      console.error("Failed to fetch user role:", error);
      return null;
    }
  },

  sendOTP: async (email: string) => {
    const response = await fetch(`${API_URL}/api/auth/send-otp`, {
      method: "POST",
      headers: getHeaders(false),
      body: JSON.stringify({ email }),
    });
    return await handleResponse(response);
  },

  verifyOTP: async (email: string, otp: string) => {
    const response = await fetch(`${API_URL}/api/auth/verify-otp`, {
      method: "POST",
      headers: getHeaders(false),
      body: JSON.stringify({ email, otp }),
    });
    const data = await handleResponse(response);
    if (data.token) {
      setAuthToken(data.token);
    }
    return data;
  },

  resetPassword: async (email: string, newPassword: string, token?: string) => {
    const response = await fetch(`${API_URL}/api/auth/reset-password`, {
      method: "POST",
      headers: getHeaders(!!token),
      body: JSON.stringify({ email, newPassword, token }),
    });
    return await handleResponse(response);
  },

  changePassword: async (userId: string, currentPassword: string, newPassword: string) => {
    const response = await fetch(`${API_URL}/api/auth/change-password`, {
      method: "POST",
      headers: getHeaders(true),
      body: JSON.stringify({ userId, currentPassword, newPassword }),
    });
    return await handleResponse(response);
  },
};

// =====================
// Students API
// =====================

export const studentsAPI = {
  create: async (name: string, roll: string, cls: string, email: string) => {
    const response = await fetch(`${API_URL}/api/students`, {
      method: "POST",
      headers: getHeaders(true),
      body: JSON.stringify({ name, roll, class: cls, email }),
    });
    return await handleResponse(response);
  },

  getAll: async () => {
    const response = await fetch(`${API_URL}/api/students`, {
      method: "GET",
      headers: getHeaders(true),
    });
    return await handleResponse(response);
  },

  getById: async (id: string) => {
    const response = await fetch(`${API_URL}/api/students/${id}`, {
      method: "GET",
      headers: getHeaders(true),
    });
    return await handleResponse(response);
  },

  update: async (id: string, data: Record<string, any>) => {
    const response = await fetch(`${API_URL}/api/students/${id}`, {
      method: "PUT",
      headers: getHeaders(true),
      body: JSON.stringify(data),
    });
    return await handleResponse(response);
  },

  delete: async (id: string) => {
    const response = await fetch(`${API_URL}/api/students/${id}`, {
      method: "DELETE",
      headers: getHeaders(true),
    });
    return await handleResponse(response);
  },
};

// =====================
// Attendance API
// =====================

export const attendanceAPI = {
  create: async (studentId: string, date: string, status: string, subject?: string) => {
    const response = await fetch(`${API_URL}/api/attendance`, {
      method: "POST",
      headers: getHeaders(true),
      body: JSON.stringify({ student: studentId, date, status, subject }),
    });
    return await handleResponse(response);
  },

  getAll: async (studentId?: string) => {
    let url = `${API_URL}/api/attendance`;
    if (studentId) {
      url += `?student=${studentId}`;
    }
    const response = await fetch(url, {
      method: "GET",
      headers: getHeaders(true),
    });
    return await handleResponse(response);
  },

  update: async (id: string, data: Record<string, any>) => {
    const response = await fetch(`${API_URL}/api/attendance/${id}`, {
      method: "PUT",
      headers: getHeaders(true),
      body: JSON.stringify(data),
    });
    return await handleResponse(response);
  },

  delete: async (id: string) => {
    const response = await fetch(`${API_URL}/api/attendance/${id}`, {
      method: "DELETE",
      headers: getHeaders(true),
    });
    return await handleResponse(response);
  },
};

// =====================
// Events API
// =====================

export const eventsAPI = {
  create: async (data: Record<string, any>) => {
    const response = await fetch(`${API_URL}/api/events`, {
      method: "POST",
      headers: getHeaders(true),
      body: JSON.stringify(data),
    });
    return await handleResponse(response);
  },

  getAll: async () => {
    const response = await fetch(`${API_URL}/api/events`, {
      method: "GET",
      headers: getHeaders(false),
    });
    return await handleResponse(response);
  },

  update: async (id: string, data: Record<string, any>) => {
    const response = await fetch(`${API_URL}/api/events/${id}`, {
      method: "PUT",
      headers: getHeaders(true),
      body: JSON.stringify(data),
    });
    return await handleResponse(response);
  },

  delete: async (id: string) => {
    const response = await fetch(`${API_URL}/api/events/${id}`, {
      method: "DELETE",
      headers: getHeaders(true),
    });
    return await handleResponse(response);
  },
};

// =====================
// Subjects API (if needed in backend)
// =====================

export const subjectsAPI = {
  create: async (data: Record<string, any>) => {
    const response = await fetch(`${API_URL}/api/subjects`, {
      method: "POST",
      headers: getHeaders(true),
      body: JSON.stringify(data),
    });
    return await handleResponse(response);
  },

  getAll: async (teacherId?: string) => {
    let url = `${API_URL}/api/subjects`;
    if (teacherId) {
      url += `?teacher=${teacherId}`;
    }
    const response = await fetch(url, {
      method: "GET",
      headers: getHeaders(true),
    });
    return await handleResponse(response);
  },

  update: async (id: string, data: Record<string, any>) => {
    const response = await fetch(`${API_URL}/api/subjects/${id}`, {
      method: "PUT",
      headers: getHeaders(true),
      body: JSON.stringify(data),
    });
    return await handleResponse(response);
  },

  delete: async (id: string) => {
    const response = await fetch(`${API_URL}/api/subjects/${id}`, {
      method: "DELETE",
      headers: getHeaders(true),
    });
    return await handleResponse(response);
  },
};

// =====================
// Marks API (if needed in backend)
// =====================

export const marksAPI = {
  create: async (data: Record<string, any>) => {
    const response = await fetch(`${API_URL}/api/marks`, {
      method: "POST",
      headers: getHeaders(true),
      body: JSON.stringify(data),
    });
    return await handleResponse(response);
  },

  getAll: async (filters?: Record<string, any>) => {
    let url = `${API_URL}/api/marks`;
    if (filters) {
      const params = new URLSearchParams(filters);
      url += `?${params.toString()}`;
    }
    const response = await fetch(url, {
      method: "GET",
      headers: getHeaders(true),
    });
    return await handleResponse(response);
  },

  update: async (id: string, data: Record<string, any>) => {
    const response = await fetch(`${API_URL}/api/marks/${id}`, {
      method: "PUT",
      headers: getHeaders(true),
      body: JSON.stringify(data),
    });
    return await handleResponse(response);
  },

  upsert: async (data: Record<string, any>) => {
    // Upsert functionality - will insert or update
    const response = await fetch(`${API_URL}/api/marks/upsert`, {
      method: "POST",
      headers: getHeaders(true),
      body: JSON.stringify(data),
    });
    return await handleResponse(response);
  },
};

// =====================
// Enrollments API (if needed in backend)
// =====================

export const enrollmentsAPI = {
  create: async (data: Record<string, any>) => {
    const response = await fetch(`${API_URL}/api/enrollments`, {
      method: "POST",
      headers: getHeaders(true),
      body: JSON.stringify(data),
    });
    return await handleResponse(response);
  },

  getAll: async (filters?: Record<string, any>) => {
    let url = `${API_URL}/api/enrollments`;
    if (filters) {
      const params = new URLSearchParams(filters);
      url += `?${params.toString()}`;
    }
    const response = await fetch(url, {
      method: "GET",
      headers: getHeaders(true),
    });
    return await handleResponse(response);
  },

  update: async (id: string, data: Record<string, any>) => {
    const response = await fetch(`${API_URL}/api/enrollments/${id}`, {
      method: "PUT",
      headers: getHeaders(true),
      body: JSON.stringify(data),
    });
    return await handleResponse(response);
  },

  delete: async (id: string) => {
    const response = await fetch(`${API_URL}/api/enrollments/${id}`, {
      method: "DELETE",
      headers: getHeaders(true),
    });
    return await handleResponse(response);
  },
};

// =====================
// Bulk Operations API
// =====================

export const bulkAPI = {
  importMarks: async (marks: Record<string, any>) => {
    const response = await fetch(`${API_URL}/api/bulk/import-marks`, {
      method: "POST",
      headers: getHeaders(true),
      body: JSON.stringify(marks),
    });
    return await handleResponse(response);
  },

  importStudents: async (students: Record<string, any>) => {
    const response = await fetch(`${API_URL}/api/bulk/import-students`, {
      method: "POST",
      headers: getHeaders(true),
      body: JSON.stringify(students),
    });
    return await handleResponse(response);
  },

  sendMarksNotification: async (data: Record<string, any>) => {
    const response = await fetch(`${API_URL}/api/bulk/send-marks-notification`, {
      method: "POST",
      headers: getHeaders(true),
      body: JSON.stringify(data),
    });
    return await handleResponse(response);
  },

  sendEnrollmentNotification: async (data: Record<string, any>) => {
    const response = await fetch(`${API_URL}/api/bulk/send-enrollment-notification`, {
      method: "POST",
      headers: getHeaders(true),
      body: JSON.stringify(data),
    });
    return await handleResponse(response);
  },
};

// =====================
// Utility Functions
// =====================

export const isAuthenticated = (): boolean => {
  return !!getAuthToken();
};

export const getTokenInfo = () => {
  const token = getAuthToken();
  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return {
      userId: payload.user?.id,
      expiresAt: new Date(payload.exp * 1000),
      user: payload.user,
    };
  } catch (error) {
    return null;
  }
};

export default {
  authAPI,
  studentsAPI,
  attendanceAPI,
  eventsAPI,
  subjectsAPI,
  marksAPI,
  enrollmentsAPI,
  bulkAPI,
  isAuthenticated,
  getTokenInfo,
  getAuthToken,
  setAuthToken,
  clearAuthToken,
};
