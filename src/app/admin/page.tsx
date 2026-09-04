'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../services/api';
import {
  MdLockOutline, MdEmail, MdLock, MdVisibility, MdVisibilityOff,
} from 'react-icons/md';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail]                     = useState('');
  const [password, setPassword]               = useState('');
  const [obscurePassword, setObscurePassword] = useState(true);
  const [isLoading, setIsLoading]             = useState(false);
  const [error, setError]                     = useState('');

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    try {
      // 1. Login (stores token)
      await api.login(email.trim(), password);

      // 2. Fetch full profile directly to determine role
      const profile = await api.getMyProfile();

      // 3. Check for admin role flexibly
      const roles = Array.isArray(profile.roles) ? (profile.roles as string[]) : [];
      const role = (profile.role as string) || '';
      const isAdmin =
        role.toLowerCase() === 'admin' ||
        roles.some((r) => r.toLowerCase() === 'admin');

      if (isAdmin) {
        // Ensure role is stored for future requests
        await api.fetchAndStoreUserRole();
        router.replace('/admin/dashboard');
      } else {
        setError('Access denied. Admin privileges required.');
        api.clearToken();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid credentials';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main style={styles.container}>
      <div style={styles.card}>
        <div style={styles.iconBox}>
          <MdLockOutline size={28} color="#0504AA" />
        </div>
        <h1 style={styles.title}>Admin Access</h1>
        <p style={styles.subtitle}>Enter your admin credentials to continue.</p>

        <form onSubmit={handleLogin} style={styles.form}>
          {/* Email */}
          <div style={styles.inputWrapper}>
            <MdEmail size={20} color="#888" style={styles.inputIcon} />
            <input
              type="text"
              placeholder="Email or Phone"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={styles.input}
            />
          </div>

          {/* Password */}
          <div style={styles.inputWrapper}>
            <MdLock size={20} color="#888" style={styles.inputIcon} />
            <input
              type={obscurePassword ? 'password' : 'text'}
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ ...styles.input, paddingRight: 48 }}
            />
            <button
              type="button"
              onClick={() => setObscurePassword(p => !p)}
              style={styles.eyeBtn}
              aria-label={obscurePassword ? 'Show password' : 'Hide password'}
            >
              {obscurePassword ? <MdVisibility size={22} color="#666" /> : <MdVisibilityOff size={22} color="#666" />}
            </button>
          </div>

          <button type="submit" disabled={isLoading} style={{ ...styles.submitBtn, opacity: isLoading ? 0.7 : 1 }}>
            {isLoading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        {error && <div style={styles.error}>{error}</div>}
        <p style={styles.footerText}>This page is not publicly accessible.</p>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container:    { display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh', backgroundColor:'#F8FAFC', padding:24 },
  card:         { width:'100%', maxWidth:400, backgroundColor:'#fff', borderRadius:24, padding:32, boxShadow:'0 8px 32px rgba(0,0,0,0.05)', textAlign:'center' },
  iconBox:      { display:'inline-flex', justifyContent:'center', alignItems:'center', width:56, height:56, backgroundColor:'rgba(5,4,170,0.1)', borderRadius:12, marginBottom:24 },
  title:        { fontSize:24, fontWeight:700, color:'#1A1A1A', margin:0 },
  subtitle:     { color:'#888', fontSize:14, marginBottom:32 },
  form:         { display:'flex', flexDirection:'column', gap:16 },
  inputWrapper: { position:'relative' },
  inputIcon:    { position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' },
  input:        {
    width: '100%',
    boxSizing: 'border-box',
    padding: '12px 14px 12px 40px',
    borderRadius: 12,
    border: '1px solid #E0E0E0',
    fontSize: 14,
    outline: 'none',
    backgroundColor: '#fff',
    color: '#1A1A1A',
  },
  eyeBtn:       { position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', padding:4 },
  submitBtn:    { padding:16, backgroundColor:'#0504AA', color:'#fff', border:'none', borderRadius:12, fontSize:16, fontWeight:'bold', cursor:'pointer', marginTop:4 },
  error:        { marginTop:16, padding:12, backgroundColor:'#ffebee', color:'#c62828', borderRadius:8, fontSize:14 },
  footerText:   { marginTop:24, fontSize:12, color:'#aaa' },
};