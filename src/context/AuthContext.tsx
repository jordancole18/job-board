import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase';

interface AuthState {
  session: Session | null;
  user: User | null;
  companyName: string | null;
  isAdmin: boolean;
  isApproved: boolean;
  loading: boolean;
  signUp: (email: string, password: string, companyName: string) => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [loading, setLoading] = useState(true);

  // Step 1: Listen for auth changes — NEVER make DB calls inside this callback.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session?.user) {
        setCompanyName(null);
        setIsAdmin(false);
        setIsApproved(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchEmployerInfo(userId: string) {
    const { data, error } = await supabase
      .from('employers')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Failed to fetch employer info:', error.message, error.code);
    }

    if (data) {
      if (data.is_disabled) {
        await supabase.auth.signOut();
        return;
      }
      setCompanyName(data.company_name ?? null);
      setIsAdmin(data.is_admin ?? false);
      setIsApproved(data.is_approved ?? false);
    }
  }

  // Step 2: When we have a user, ensure their employer record exists, then load it.
  useEffect(() => {
    if (loading) return;
    if (!user) return;

    async function ensureEmployerAndLoad() {
      // Check if employer record already exists
      const { data: existing } = await supabase
        .from('employers')
        .select('id')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (!existing) {
        // No employer record — create one from auth metadata
        const meta = user!.user_metadata;
        const company = meta?.company_name;

        if (company) {
          console.log('[AuthContext] Creating employer record for:', company);
          const { error } = await supabase
            .from('employers')
            .insert({
              user_id: user!.id,
              company_name: company,
              email: user!.email,
            });

          if (error) {
            console.error('[AuthContext] Employer insert failed:', error.message);
          }
        }
      }

      // Now load the employer info
      await fetchEmployerInfo(user!.id);
    }

    ensureEmployerAndLoad();
  }, [user?.id, loading]);

  async function signUp(email: string, password: string, company: string): Promise<string | null> {
    // Store company_name in auth user metadata so it survives email confirmation
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { company_name: company } },
    });
    if (error) return error.message;

    if (data.session) {
      // Immediate session — create employer record now
      const { error: insertError } = await supabase
        .from('employers')
        .insert({ user_id: data.user!.id, company_name: company, email });
      if (insertError) return insertError.message;
      setCompanyName(company);
    } else if (data.user) {
      // Email confirmation required — metadata is stored on the user,
      // employer record will be created when they confirm and the useEffect runs
      return 'check_email';
    }
    return null;
  }

  async function signIn(email: string, password: string): Promise<string | null> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.message;
    return null;
  }

  async function signOut() {
    await supabase.auth.signOut();
    setCompanyName(null);
    setIsAdmin(false);
    setIsApproved(false);
  }

  return (
    <AuthContext.Provider value={{ session, user, companyName, isAdmin, isApproved, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
