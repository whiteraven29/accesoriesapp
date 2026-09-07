import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * How long to wait for the initial session before showing the app anyway.
 *
 * `getSession` reads from storage but will attempt a network refresh when the
 * stored token has expired. On a market connection that request can hang, and
 * the previous implementation had no catch and no timeout — so a failed refresh
 * left the app on its loading spinner permanently.
 */
const SESSION_TIMEOUT_MS = 8000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    // Whatever happens — resolve, reject, or hang — stop loading.
    const timer = setTimeout(() => {
      if (active) setLoading(false);
    }, SESSION_TIMEOUT_MS);

    const applySession = (next: Session | null) => {
      if (!active) return;
      setSession(next);
      setUser(next?.user ?? null);
      setLoading(false);
      clearTimeout(timer);
    };

    supabase.auth
      .getSession()
      .then(({ data }) => applySession(data.session))
      .catch(error => {
        console.error('Could not restore session:', error);
        applySession(null);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => applySession(next));

    return () => {
      active = false;
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    // Clear locally first: a shopkeeper with no signal must still be able to
    // sign out of a shared handset.
    setSession(null);
    setUser(null);

    const { error } = await supabase.auth.signOut();
    if (error) console.error('Error signing out:', error);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
