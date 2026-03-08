import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Play, Mail, Lock, AlertCircle, Fingerprint } from 'lucide-react';
import { motion } from 'framer-motion';
import { getBiometricStatus, biometricLogin, saveCredentials, type BiometricStatus } from '@/lib/biometric';
import { isNativePlatform } from '@/lib/platform';

const AuthPage = () => {
  const { signIn, signUp } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [bioStatus, setBioStatus] = useState<BiometricStatus | null>(null);
  const [bioLoading, setBioLoading] = useState(false);

  useEffect(() => {
    if (isNativePlatform()) {
      getBiometricStatus().then(setBioStatus);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const { error: authError } = isSignUp
      ? await signUp(email, password)
      : await signIn(email, password);

    if (authError) {
      setError(authError.message);
    } else if (isSignUp) {
      setSuccess('Check your email for a confirmation link!');
    } else if (bioStatus?.available && !bioStatus.hasCredentials) {
      // After successful email/password login, offer to save for biometric
      try {
        await saveCredentials(email, password);
        setBioStatus(prev => prev ? { ...prev, hasCredentials: true } : prev);
      } catch {
        // Non-critical, silently ignore
      }
    }
    setLoading(false);
  };

  const handleBiometricLogin = async () => {
    setError('');
    setBioLoading(true);
    try {
      const { email: storedEmail, password: storedPassword } = await biometricLogin();
      const { error: authError } = await signIn(storedEmail, storedPassword);
      if (authError) {
        setError(authError.message);
      }
    } catch (e: any) {
      if (e?.message?.includes('cancel') || e?.message?.includes('Cancel')) {
        // User cancelled, don't show error
      } else {
        setError('Biometric authentication failed');
      }
    }
    setBioLoading(false);
  };

  const biometricLabel = bioStatus?.biometryType === 'face' ? 'Face ID' : 'Fingerprint';

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
            <Play className="w-6 h-6 text-primary fill-primary" />
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground">StreamVault</h1>
        </div>

        <div className="glass rounded-2xl p-6">
          <h2 className="text-xl font-display font-semibold text-foreground mb-1 text-center">
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </h2>
          <p className="text-sm text-muted-foreground text-center mb-6">
            {isSignUp ? 'Sign up to start streaming' : 'Sign in to continue'}
          </p>

          {/* Biometric login button — shown on native when credentials are stored */}
          {!isSignUp && bioStatus?.available && bioStatus.hasCredentials && (
            <div className="mb-6">
              <Button
                type="button"
                variant="outline"
                onClick={handleBiometricLogin}
                disabled={bioLoading}
                className="w-full h-14 border-primary/30 hover:bg-primary/10 gap-3 text-foreground"
              >
                <Fingerprint className="w-6 h-6 text-primary" />
                <span className="text-base font-medium">
                  {bioLoading ? 'Verifying...' : `Sign in with ${biometricLabel}`}
                </span>
              </Button>
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground uppercase">or use email</span>
                <div className="flex-1 h-px bg-border" />
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="pl-10 bg-secondary border-border text-foreground h-11"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="pl-10 bg-secondary border-border text-foreground h-11"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="w-4 h-4" /> {error}
              </div>
            )}
            {success && (
              <div className="text-sm text-primary">{success}</div>
            )}

            <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-11">
              {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
            </Button>
          </form>

          <p className="text-sm text-muted-foreground text-center mt-4">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button onClick={() => { setIsSignUp(!isSignUp); setError(''); setSuccess(''); }} className="text-primary hover:underline">
              {isSignUp ? 'Sign in' : 'Sign up'}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default AuthPage;
