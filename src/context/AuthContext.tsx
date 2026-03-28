import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase';

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

async function notifyNewEmployer(companyName: string, email: string) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    fetch(`${FUNCTIONS_URL}/notify-new-employer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ companyName, email }),
    }).catch(() => {});
  } catch {
    // Silently fail — notification is best-effort
  }
}

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
  // Supabase JS v2.64+ runs these callbacks inside an internal auth lock;
  // any supabase.from() call tries to re-acquire that lock → deadlock → every
  // query in the app hangs forever.
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

  // Step 2: Fetch employer info in a SEPARATE effect, outside the auth lock.
  useEffect(() => {
    if (loading) return; // wait for auth to initialise first
    if (!user) return;

    const pendingCompany = localStorage.getItem('pending_company_name');
    const pendingEmail = localStorage.getItem('pending_employer_email');
    if (pendingCompany) {
      localStorage.removeItem('pending_company_name');
      localStorage.removeItem('pending_employer_email');
      console.log('[AuthContext] Creating employer record for:', pendingCompany);
      supabase
        .from('employers')
        .insert({ user_id: user.id, company_name: pendingCompany, email: pendingEmail || user.email })
        .then(({ error }) => {
          if (error) {
            console.error('[AuthContext] Employer insert failed:', error.message);
            fetchEmployerInfo(user.id);
            return;
          }
          console.log('[AuthContext] Employer created, sending notification');
          setCompanyName(pendingCompany);
          setIsAdmin(false);
          setIsApproved(false);
          notifyNewEmployer(pendingCompany, pendingEmail || user.email || '');
        });
    } else {
      fetchEmployerInfo(user.id);
    }
  }, [user?.id, loading]);

  async function signUp(email: string, password: string, company: string): Promise<string | null> {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return error.message;
    if (data.session) {
      const { error: insertError } = await supabase
        .from('employers')
        .insert({ user_id: data.user!.id, company_name: company, email });
      if (insertError) return insertError.message;
      setCompanyName(company);
      notifyNewEmployer(company, email);
    } else if (data.user) {
      localStorage.setItem('pending_company_name', company);
      localStorage.setItem('pending_employer_email', email);
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
