import React, { useState } from 'react';
import { Mail, Lock, LogIn, UserPlus } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { Button, toast } from '../components/shared';

export default function AuthPage() {
  const { login, register } = useAuthStore();
  
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (isLogin) {
        await login(email, password);
        toast('خوش آمدید! 🎉');
      } else {
        if (password !== passwordConfirm) {
          toast('رمز عبور و تکرار آن یکسان نیستند!', { icon: '⚠️' });
          setLoading(false);
          return;
        }
        await register(email, password, passwordConfirm);
        toast('ثبت‌نام با موفقیت انجام شد! 🎉');
      }
    } catch (err) {
      console.error(err);
      toast(err.message || 'خطا در ارتباط با سرور. ایمیل یا رمز عبور اشتباه است.', { icon: '❌' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center', 
      minHeight: '100vh', width: '100vw', background: 'var(--bg-app)', padding: 20
    }}>
      <div className="surface" style={{
        width: '100%', maxWidth: 400, padding: 32, borderRadius: 24,
        display: 'flex', flexDirection: 'column', gap: 24,
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        position: 'relative', overflow: 'hidden'
      }}>
        {/* Decorative Top Bar */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 6,
          background: 'linear-gradient(90deg, var(--color-primary-400), var(--color-primary-600))'
        }} />

        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 64, height: 64, borderRadius: 20,
            background: 'rgba(var(--accent-glow-rgb), 0.1)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            margin: '0 auto 16px', color: 'var(--color-primary-400)'
          }}>
            {isLogin ? <LogIn size={32} /> : <UserPlus size={32} />}
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>
            {isLogin ? 'ورود به دستیار' : 'ساخت حساب کاربری'}
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
            {isLogin ? 'برای دسترسی به تسک‌ها و تنظیمات وارد شوید' : 'برای ذخیره ابری اطلاعات خود یک حساب بسازید'}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>ایمیل</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-secondary)' }} />
              <input 
                type="email" 
                className="input" 
                style={{ paddingLeft: 40, width: '100%', direction: 'ltr' }} 
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>رمز عبور</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-secondary)' }} />
              <input 
                type="password" 
                className="input" 
                style={{ paddingLeft: 40, width: '100%', direction: 'ltr' }} 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
          </div>

          {!isLogin && (
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>تکرار رمز عبور</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-secondary)' }} />
                <input 
                  type="password" 
                  className="input" 
                  style={{ paddingLeft: 40, width: '100%', direction: 'ltr' }} 
                  placeholder="••••••••"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
            </div>
          )}

          <Button variant="primary" size="lg" type="submit" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? 'صبر کنید...' : (isLogin ? 'ورود' : 'ثبت نام')}
          </Button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <button 
            type="button" 
            onClick={() => setIsLogin(!isLogin)}
            style={{ 
              background: 'none', border: 'none', color: 'var(--color-primary-400)',
              fontFamily: 'inherit', fontSize: '0.85rem', cursor: 'pointer',
              textDecoration: 'underline', textUnderlineOffset: 4
            }}
          >
            {isLogin ? 'حساب کاربری ندارید؟ ثبت‌نام کنید' : 'قبلاً ثبت‌نام کرده‌اید؟ وارد شوید'}
          </button>
        </div>
      </div>
    </div>
  );
}
