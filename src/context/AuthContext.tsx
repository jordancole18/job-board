import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase';

interface AuthState {
  session: Session | null;
  user: User | null;
  companyName: string | null;
  isAdmin: boolean;
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchEmployerInfo(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        const pendingCompany = localStorage.getItem('pending_company_name');
        if (pendingCompany) {
          localStorage.removeItem('pending_company_name');
          await supabase
            .from('employers')
            .insert({ user_id: session.user.id, company_name: pendingCompany });
          setCompanyName(pendingCompany);
          setIsAdmin(false);
        } else {
          fetchEmployerInfo(session.user.id);
        }
      } else {
        setCompanyName(null);
        setIsAdmin(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchEmployerInfo(userId: string) {
    const { data } = await supabase
      .from('employers')
      .select('company_name, is_admin')
      .eq('user_id', userId)
      .single();
    setCompanyName(data?.company_name ?? null);
    setIsAdmin(data?.is_admin ?? false);
  }

  async function signUp(email: string, password: string, company: string): Promise<string | null> {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return error.message;
    if (data.session) {
      const { error: insertError } = await supabase
        .from('employers')
        .insert({ user_id: data.user!.id, company_name: company });
      if (insertError) return insertError.message;
      setCompanyName(company);
    } else if (data.user) {
      localStorage.setItem('pending_company_name', company);
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
  }

  return (
    <AuthContext.Provider value={{ session, user, companyName, isAdmin, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
