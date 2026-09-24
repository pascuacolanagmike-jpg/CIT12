import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Mail, ArrowRight, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';

const LOGO_URL = 'https://cdn.postimage.me/2026/09/24/Gemini_Generated_Image_2jks5w2jks5w2jks.jpeg';

export default function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await resetPassword(email);
    setLoading(false);
    if (error) {
      setError(error);
    } else {
      setSuccess(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-6 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 justify-center">
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

          <h2 className="text-2xl font-bold text-white mb-2">Reset Password</h2>
          <p className="text-slate-400 mb-6 text-sm">
            Enter your email address and we&apos;ll send you a link to reset your password.
          </p>

          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-6 flex items-start gap-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-400">
              <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>Reset link sent! Check your email inbox.</span>
            </div>
          )}

          {!success && (
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
                    Send Reset Link
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" />
                  </>
                )}
              </button>
            </form>
          )}

          <Link
            to="/login"
            className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}