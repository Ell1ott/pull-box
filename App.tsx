
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, useNavigate, useParams, Navigate } from 'react-router-dom';
import { User, PullBox } from './types';
import { STORAGE_KEYS, DEFAULT_EXPIRY_DAYS, GOOGLE_DRIVE_SCOPES } from './constants';
import { GoogleDriveService } from './services/googleDrive';
import { supabase } from './services/supabaseClient';
import type { Session } from '@supabase/supabase-js';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Gallery from './components/Gallery';
import Uploader from './components/Uploader';
import { Camera, ShieldCheck, HardDrive, LogIn, Loader2, AlertCircle } from 'lucide-react';

const AuthPage: React.FC = () => {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getRedirectUri = () => {
    const envUrl = (import.meta as any).env?.VITE_PUBLIC_SITE_URL || (import.meta as any).env?.VITE_SITE_URL;
    if (envUrl) {
      try {
        return new URL(envUrl).toString();
      } catch {
        return envUrl;
      }
    }
    return `${window.location.origin}${window.location.pathname}`;
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setIsAuthenticating(true);
    
    const redirectUri = getRedirectUri();
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUri,
        scopes: GOOGLE_DRIVE_SCOPES,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (authError) {
      setError(authError.message);
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F2F2F7] flex flex-col items-center justify-center p-6 font-sans selection:bg-blue-100">
      <div className="max-w-sm w-full bg-white rounded-[32px] shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-10 text-center animate-in zoom-in-95 duration-500">
        <div className="w-20 h-20 bg-indigo-600 rounded-[22px] shadow-lg shadow-indigo-200 flex items-center justify-center mx-auto mb-6 transform hover:scale-105 transition-transform duration-300">
          <Camera className="w-10 h-10 text-white" />
        </div>
        
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">ImageJar</h1>
        <p className="text-gray-500 font-medium leading-relaxed mb-8">
          The premium way to collect photos directly into your Google Drive.
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 rounded-2xl flex items-start space-x-3 text-left">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="text-sm text-red-700 font-medium">
              <p>{error}</p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={handleGoogleLogin}
            disabled={isAuthenticating}
            className="w-full h-14 bg-[#007AFF] text-white text-[17px] font-bold rounded-2xl hover:bg-[#0062CC] transition-all shadow-md active:scale-[0.98] flex items-center justify-center space-x-3 disabled:opacity-70"
          >
            {isAuthenticating ? <Loader2 className="w-6 h-6 animate-spin" /> : <LogIn className="w-5 h-5" />}
            <span>Sign in with Google</span>
          </button>
        </div>

        <div className="pt-8 mt-4 border-t border-gray-100 flex items-center justify-center space-x-6 text-[13px] text-gray-400 font-medium">
          <div className="flex items-center space-x-1.5">
            <HardDrive className="w-3.5 h-3.5" />
            <span>Google Drive™ Storage</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Private & Secure</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const MainAppContent: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.USER);
    return saved ? JSON.parse(saved) : null;
  });

  const [boxes, setBoxes] = useState<PullBox[]>([]);
  const [boxesLoading, setBoxesLoading] = useState(false);

  const [driveService, setDriveService] = useState<GoogleDriveService | null>(null);
  const [isLoadingToken, setIsLoadingToken] = useState(true);

  const mapPullBox = (row: any): PullBox => {
    return {
      id: row.id,
      ownerId: row.owner_id,
      name: row.name,
      driveFolderId: row.drive_folder_id,
      linkCode: row.link_code,
      createdAt: Date.parse(row.created_at),
      expiresAt: Date.parse(row.expires_at),
      photoCount: row.photo_count ?? 0,
    };
  };

  const generateLinkCode = () => Math.random().toString(36).substr(2, 6).toUpperCase();

  const isLikelyJwt = (token?: string | null) => {
    if (!token) return false;
    return token.split('.').length === 3 || token.startsWith('eyJ');
  };

  const buildUserFromSession = (session: Session, existingToken?: string): User => {
    const metadata = session.user.user_metadata || {};
    const name = metadata.full_name || metadata.name || metadata.user_name || session.user.email || 'User';
    const photoUrl = metadata.avatar_url || metadata.picture;
    const providerToken = session.provider_token;
    const accessToken = providerToken || (existingToken && !isLikelyJwt(existingToken) ? existingToken : undefined);
    const tokenSource = providerToken ? 'provider' : (accessToken ? 'stored' : 'none');
    console.log('[auth] token source', { source: tokenSource });

    return {
      id: session.user.id,
      name,
      email: session.user.email || '',
      accessToken,
      photoUrl,
    };
  };

  const persistGoogleToken = async (session: Session) => {
    const providerToken = session.provider_token;
    if (!providerToken) return;

    const payload: Record<string, unknown> = {
      user_id: session.user.id,
      provider: 'google',
      access_token: providerToken,
      expires_at: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
    };

    if (session.provider_refresh_token) {
      payload.refresh_token = session.provider_refresh_token;
    }

    await supabase
      .from('user_oauth_tokens')
      .upsert(payload, { onConflict: 'user_id,provider' });
  };

  const fetchUserGoogleToken = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_oauth_tokens')
      .select('access_token, expires_at')
      .eq('user_id', userId)
      .eq('provider', 'google')
      .single();

    if (error) {
      console.warn('[auth] token fetch failed', { message: error.message });
      return null;
    }

    if (!data?.access_token) {
      console.warn('[auth] token missing in db');
      return null;
    }

    console.log('[auth] token fetched from db', { expiresAt: data.expires_at });
    return data.access_token as string;
  };

  const refreshGoogleAccessToken = async (): Promise<string | null> => {
    const { data, error } = await supabase.functions.invoke('drive-token', { method: 'POST' });
    if (error) {
      console.warn('[auth] refresh token failed', { message: error.message });
      return null;
    }
    const token = (data as { accessToken?: string } | null)?.accessToken || null;
    if (token) {
      setUser((prev) => (prev ? { ...prev, accessToken: token } : prev));
    }
    return token;
  };

  useEffect(() => {
    let isMounted = true;

    const initSession = async () => {
      setIsLoadingToken(true);
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Failed to get Supabase session', error);
      }
      if (isMounted) {
        if (data.session) {
          const baseUser = buildUserFromSession(data.session, user?.accessToken);
          setUser(baseUser);
          persistGoogleToken(data.session).catch((err) => console.error('Failed to persist token', err));
          fetchUserGoogleToken(data.session.user.id).then((token) => {
            if (!token) return;
            setUser((prev) => (prev ? { ...prev, accessToken: token } : prev));
          });
        } else {
          setUser(null);
        }
        setIsLoadingToken(false);
      }
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        const baseUser = buildUserFromSession(session, user?.accessToken);
        setUser(baseUser);
        persistGoogleToken(session).catch((err) => console.error('Failed to persist token', err));
        fetchUserGoogleToken(session.user.id).then((token) => {
          if (!token) return;
          setUser((prev) => (prev ? { ...prev, accessToken: token } : prev));
        });
      } else {
        setUser(null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user?.accessToken) {
      setDriveService(new GoogleDriveService(user.accessToken, refreshGoogleAccessToken));
    } else {
      setDriveService(null);
    }
  }, [user]);

  useEffect(() => {
    if (user) localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_KEYS.USER);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setBoxes([]);
      return;
    }

    const fetchBoxes = async () => {
      setBoxesLoading(true);
      const { data, error } = await supabase
        .from('pull_boxes')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to load Pull-Boxes', error);
        setBoxes([]);
      } else {
        setBoxes((data || []).map(mapPullBox));
      }
      setBoxesLoading(false);
    };

    fetchBoxes();
  }, [user]);

  const navigate = useNavigate();

  const handleCreateBox = async (name: string) => {
    if (!driveService || !user) return;
    try {
      const folder = await driveService.createFolder(name);
      const expiresAt = new Date(Date.now() + (DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000));
      let createdBox: PullBox | null = null;

      for (let i = 0; i < 3; i += 1) {
        const linkCode = generateLinkCode();
        const { data, error } = await supabase
          .from('pull_boxes')
          .insert({
            owner_id: user.id,
            name,
            drive_folder_id: folder.id,
            link_code: linkCode,
            expires_at: expiresAt.toISOString(),
          })
          .select()
          .single();

        if (!error && data) {
          createdBox = mapPullBox(data);
          break;
        }

        if (error && error.code !== '23505') {
          throw error;
        }
      }

      if (!createdBox) {
        throw new Error('Failed to create Pull-Box. Please try again.');
      }

      setBoxes([createdBox, ...boxes]);
    } catch (err) {
      alert('Failed to create folder. If your session expired, please logout and login again.');
    }
  };

  const handleDeleteBox = async (id: string) => {
    if (!user) return;
    const { error } = await supabase
      .from('pull_boxes')
      .delete()
      .eq('id', id)
      .eq('owner_id', user.id);

    if (error) {
      alert('Delete failed. Please try again.');
      return;
    }
    setBoxes(boxes.filter(b => b.id !== id));
  };

  const onLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    navigate('/');
  };

  if (isLoadingToken) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
        <p className="text-gray-600 font-medium">Finalizing secure connection...</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={
        user ? (
          <Layout user={user} onLogout={onLogout}>
            <Dashboard 
              user={user} 
              boxes={boxes} 
              onCreateBox={handleCreateBox} 
              onDeleteBox={handleDeleteBox}
              onViewBox={(id) => navigate(`/jar-admin/${id}`)}
            />
          </Layout>
        ) : (
          <AuthPage />
        )
      } />
      <Route path="/jar-admin/:id" element={
        user && driveService ? (
          <Layout user={user} onLogout={onLogout}>
            <AdminWrapper boxes={boxes} loading={boxesLoading} driveService={driveService} navigate={navigate} />
          </Layout>
        ) : (
          <Navigate to="/" />
        )
      } />
      <Route path="/jar/:code" element={
        <PublicUploaderWrapper boxes={boxes} />
      } />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

const AdminWrapper: React.FC<{ boxes: PullBox[], loading: boolean, driveService: GoogleDriveService, navigate: any }> = ({ boxes, loading, driveService, navigate }) => {
  const { id } = useParams<{ id: string }>();
  const box = boxes.find(b => b.id === id);
  if (!box && loading) return <div className="p-12 text-center">Loading...</div>;
  if (!box) return <div className="p-12 text-center">Not found.</div>;
  return <Gallery box={box} driveService={driveService} onBack={() => navigate('/')} />;
};

const PublicUploaderWrapper: React.FC<{ boxes: PullBox[] }> = ({ boxes }) => {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const [box, setBox] = useState<PullBox | null>(() => boxes.find(b => b.linkCode === code) || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const existing = boxes.find(b => b.linkCode === code);
    if (existing) {
      setBox(existing);
      return;
    }

    if (!code) return;

    const fetchByCode = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('pull_boxes')
        .select('*')
        .eq('link_code', code)
        .single();

      if (!error && data) {
        setBox({
          id: data.id,
          ownerId: data.owner_id,
          name: data.name,
          driveFolderId: data.drive_folder_id,
          linkCode: data.link_code,
          createdAt: Date.parse(data.created_at),
          expiresAt: Date.parse(data.expires_at),
          photoCount: data.photo_count ?? 0,
        });
      }
      setLoading(false);
    };

    fetchByCode();
  }, [boxes, code]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
        <h2 className="text-xl font-semibold text-gray-900">Opening Jar...</h2>
        <p className="text-gray-500 mt-2">Hang tight while we find your folder.</p>
      </div>
    );
  }

  if (!box) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Invalid Link</h2>
        <p className="text-gray-600 mt-2 mb-8 max-w-xs mx-auto">
          This ImageJar link may have expired or doesn't exist. Please check with the owner.
        </p>
        <button 
          onClick={() => navigate('/')}
          className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl"
        >
          Go Home
        </button>
      </div>
    );
  }
  
  return <Uploader box={box} useEdgeUpload />;
};

const App: React.FC = () => (
  <HashRouter>
    <MainAppContent />
  </HashRouter>
);

export default App;
