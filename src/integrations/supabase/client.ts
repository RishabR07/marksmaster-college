// Supabase client stub - using Express + MongoDB backend instead
// This file exists only for backwards compatibility with existing components

export const supabase = {
  // Stub methods to prevent runtime errors from old code
  from: () => ({
    select: async () => ({ data: null, error: new Error('Using API service instead') }),
    insert: async () => ({ data: null, error: new Error('Using API service instead') }),
    update: async () => ({ data: null, error: new Error('Using API service instead') }),
    delete: async () => ({ data: null, error: new Error('Using API service instead') }),
  }),
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    signOut: async () => ({ error: null }),
  },
  functions: {
    invoke: async () => ({ data: null, error: new Error('Using API service instead') }),
  },
};