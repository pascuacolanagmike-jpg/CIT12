import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Mail, Lock, ArrowRight, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';

const LOGO_URL = 'https://cdn.postimage.me/2026/09/24/Gemini_Generated_Image_2jks5w2jks5w2jks.jpeg';

export default function Register() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    const { error } = await signUp(email, password);
    setLoading(false);

    if (error) {
      setError(error);
    } else {
      setSuccess(true);
      setTimeout(() => navigate('/dashboard'), 1500);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-950">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 25% 30%, #10b981 0%, transparent 50%), radial-gradient(circle at 75% 70%, #3b82f6 0%, transparent 50%)',
          }}
        />
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center ring-1 ring-emerald-400/30 overflow-hidden">
              <img
                src={LOGO_URL}
                alt="FaceScholar Logo"
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-2xl font-bold tracking-tight">FaceScholar</span>
          </div>
          <h1 className="text-4xl font-bold leading-tight mb-4">Create Your Account</h1>
          <p className="text-lg text-slate-300 max-w-md leading-relaxed">
            Join FaceScholar to manage student facial recognition data, process image feeds
            in real time, and export records with custom Excel templates.
          </p>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center ring-1 ring-emerald-400/30 overflow-hidden">
              <img
                src={LOGO_URL}
                alt="FaceScholar Logo"
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-xl font-bold text-white">FaceScholar</span>
          </div>

          {/* Card container */}
          <div className="relative rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/80 to-slate-950/60 backdrop-blur-xl p-8 shadow-2xl shadow-black/40">
            {/* subtle top accent line */}
            <div className="absolute inset-x-8 -top-px h-px bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent" />

            <h2 className="text-2xl font-bold text-white mb-2">Create account</h2>
            <p className="text-slate-400 mb-8">Get started with FaceScholar today</p>

            {error && (
              <div className="mb-6 flex items-start gap-3 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="mb-6 flex items-start gap-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-400">
                <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>Account created successfully! Redirecting to dashboard...</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div className="group">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 transition-colors duration-200 group-focus-within:text-emerald-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl bg-slate-900/60 border border-slate-700/70 text-white placeholder-slate-500 pl-11 pr-4 py-3.5 text-sm shadow-inner shadow-black/20 transition-all duration-200 hover:border-slate-600 hover:bg-slate-900/80 focus:outline-none focus:border-emerald-500/70 focus:bg-slate-900 focus:ring-4 focus:ring-emerald-500/15"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="group">
                <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 transition-colors duration-200 group-focus-within:text-emerald-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl bg-slate-900/60 border border-slate-700/70 text-white placeholder-slate-500 pl-11 pr-12 py-3.5 text-sm shadow-inner shadow-black/20 transition-all duration-200 hover:border-slate-600 hover:bg-slate-900/80 focus:outline-none focus:border-emerald-500/70 focus:bg-slate-900 focus:ring-4 focus:ring-emerald-500/15"
                    placeholder="At least 6 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-emerald-400 focus:outline-none transition-colors duration-200"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="group">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 transition-colors duration-200 group-focus-within:text-emerald-400" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-xl bg-slate-900/60 border border-slate-700/70 text-white placeholder-slate-500 pl-11 pr-12 py-3.5 text-sm shadow-inner shadow-black/20 transition-all duration-200 hover:border-slate-600 hover:bg-slate-900/80 focus:outline-none focus:border-emerald-500/70 focus:bg-slate-900 focus:ring-4 focus:ring-emerald-500/15"
                    placeholder="Re-enter password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-emerald-400 focus:outline-none transition-colors duration-200"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3.5 text-sm shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all duration-200 group"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    Create Account
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" />
                  </>
                )}
              </button>
            </form>

            <p className="mt-8 text-center text-sm text-slate-400">
              Already have an account?{' '}
              <Link
                to="/login"
                className="text-emerald-400 hover:text-emerald-300 transition font-medium"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}