import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { lunaBranch } from '../config/lunaBranch';
import { roxasBranch } from '../config/roxasBranch';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const login = useAuthStore((state) => state.login);
    const branchName = useAuthStore((state) => state.branchName);

    const branches = [lunaBranch, roxasBranch];
    const [selectedBranch, setSelectedBranch] = useState('');

    const tryAutofillEmail = (branchKey) => {
        // Feature removed as requested; now it only sets the selected branch context.
        setSelectedBranch(branchKey);
    };

    useEffect(() => {
        const prevHtmlOverflow = document.documentElement.style.overflow;
        const prevBodyOverflow = document.body.style.overflow;
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';

        return () => {
            document.documentElement.style.overflow = prevHtmlOverflow;
            document.body.style.overflow = prevBodyOverflow;
        };
    }, []);

    const inferred = useMemo(() => {
        const normalizedInput = String(email || '').trim().toLowerCase();
        if (!normalizedInput) return { ok: false, message: '' };
        
        let localPart = normalizedInput;
        let fullEmail = normalizedInput;
        
        const atCount = (normalizedInput.match(/@/g) || []).length;
        if (atCount > 1) {
            return { ok: false, message: 'Only one @ symbol is allowed.' };
        }
        
        // Prevent special characters to avoid potential injection or invalid inputs
        if (!/^[a-z0-9\.@]+$/.test(normalizedInput)) {
            return { ok: false, message: 'Special characters are not allowed (except . and @).' };
        }
        
        if (!normalizedInput.includes('@')) {
            // Silently append domain if user just typed a username
            fullEmail = `${normalizedInput}@boutique.com`;
        } else {
            localPart = normalizedInput.split('@')[0];
        }

        return { ok: true, localPart, fullEmail };
    }, [email]);

    const isAdminEmail = inferred.ok && inferred.localPart === 'admin';

    const branding = useMemo(() => {
        if (selectedBranch === lunaBranch.key) return lunaBranch;
        if (selectedBranch === roxasBranch.key) return roxasBranch;
        return null;
    }, [selectedBranch]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            if (!inferred.ok) {
                setError(inferred.message || 'Please enter a valid email.');
                setLoading(false);
                return;
            }
            if (!isAdminEmail && !selectedBranch) {
                setError('Please select a branch to continue.');
                setLoading(false);
                return;
            }
            const user = await login(inferred.fullEmail, password, selectedBranch || 'luna');
            // The authStore.login already handles branch selection via /api/select-branch
            // Navigate to the role-appropriate page
            navigate('/');
        } catch (err) {
            const serverEmailError = err.response?.data?.errors?.email?.[0];
            setError(serverEmailError || err.response?.data?.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#dddddd] font-sans selection:bg-[#18181b] selection:text-white relative overflow-hidden">
            {/* Background Decorations */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[#dddddd]/10 blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-pink-500/10 blur-3xl pointer-events-none"></div>

            <div className="w-full max-w-[420px] p-6 sm:p-8 bg-white/80 backdrop-blur-xl rounded-[1.75rem] shadow-2xl border border-white/50 relative z-10 mx-4">
                <div className="text-center mb-6">
                    <div className="flex justify-center mb-4 h-20">
                        {isAdminEmail || !branding ? (
                            <div className="flex items-center justify-center gap-3">
                                <div className="w-16 h-16 rounded-3xl bg-white shadow-lg border border-zinc-100 flex items-center justify-center p-3 animate-in fade-in duration-300">
                                    <img src={lunaBranch.logoSrc} alt="Luna Branch logo" className="w-full h-full object-contain drop-shadow-sm" />
                                </div>
                                <div className="w-16 h-16 rounded-3xl bg-white shadow-lg border border-zinc-100 flex items-center justify-center p-3 animate-in fade-in duration-300">
                                    <img src={roxasBranch.logoSrc} alt="Roxas Branch logo" className="w-full h-full object-contain drop-shadow-sm" />
                                </div>
                            </div>
                        ) : (
                            <div className="w-20 h-20 rounded-3xl bg-white shadow-lg border border-zinc-100 flex items-center justify-center p-3 animate-in zoom-in duration-300">
                                <img src={branding.logoSrc} alt={`${branding.name} logo`} className="w-full h-full object-contain drop-shadow-sm" />
                            </div>
                        )}
                    </div>
                    
                    <h1 className="text-2xl sm:text-3xl font-medium text-[#818181] tracking-tight">Welcome Back</h1>
                    <p className="mt-2 text-sm text-[#a6a6a6] font-medium">Sign in to your Boutique POS account</p>
                </div>
                
                {/* Branch Quick Select */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                    <button
                        type="button"
                        onClick={() => setSelectedBranch(lunaBranch.key)}
                        className={`flex items-center gap-3 p-3 rounded-2xl border transition-all duration-300 ${(!isAdminEmail && selectedBranch === lunaBranch.key) ? 'bg-[#dddddd] border-[#cbcbcb] ring-1 ring-indigo-200 shadow-sm' : 'bg-white border-[#cbcbcb] hover:bg-[#dddddd] hover:border-[#a6a6a6]'}`}
                    >
                        <img src={lunaBranch.logoSrc} alt="Luna Branch" className="w-8 h-8 rounded-xl object-contain bg-white border border-zinc-100 shadow-sm" />
                        <div className="text-left">
                            <div className={`text-[13px] font-medium ${(!isAdminEmail && selectedBranch === lunaBranch.key) ? 'text-indigo-900' : 'text-[#818181]'}`}>Luna</div>
                            <div className={`text-[10px] font-medium ${(!isAdminEmail && selectedBranch === lunaBranch.key) ? 'text-[#a6a6a6]' : 'text-[#a6a6a6]'}`}>Branch</div>
                        </div>
                    </button>
                    <button
                        type="button"
                        onClick={() => setSelectedBranch(roxasBranch.key)}
                        className={`flex items-center gap-3 p-3 rounded-2xl border transition-all duration-300 ${(!isAdminEmail && selectedBranch === roxasBranch.key) ? 'bg-[#dddddd] border-[#cbcbcb] ring-1 ring-indigo-200 shadow-sm' : 'bg-white border-[#cbcbcb] hover:bg-[#dddddd] hover:border-[#a6a6a6]'}`}
                    >
                        <img src={roxasBranch.logoSrc} alt="Roxas Branch" className="w-8 h-8 rounded-xl object-contain bg-white border border-zinc-100 shadow-sm" />
                        <div className="text-left">
                            <div className={`text-[13px] font-medium ${(!isAdminEmail && selectedBranch === roxasBranch.key) ? 'text-indigo-900' : 'text-[#818181]'}`}>Roxas</div>
                            <div className={`text-[10px] font-medium ${(!isAdminEmail && selectedBranch === roxasBranch.key) ? 'text-[#a6a6a6]' : 'text-[#a6a6a6]'}`}>Branch</div>
                        </div>
                    </button>
                </div>

                {error && (
                    <div className="mb-5 p-4 bg-[#dddddd] text-[#818181] text-sm font-semibold rounded-2xl border border-red-100 flex items-center gap-2 animate-in fade-in">
                        <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
                    <div>
                        <label htmlFor="login-email" className="block text-sm font-medium text-[#818181] mb-2">
                            Username or Email
                        </label>
                        <input
                            id="login-email"
                            type="text"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-[#a6a6a6] bg-white text-[#818181] placeholder-[#cbcbcb] focus:outline-none focus:ring-2 focus:ring-[#818181]/50 focus:border-[#818181] transition-all font-medium"
                            placeholder="username"
                            autoComplete="off"
                            required
                        />
                        {!inferred.ok && inferred.message ? (
                            <div className="mt-2 text-xs font-semibold text-red-500">{inferred.message}</div>
                        ) : null}
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label htmlFor="login-password" className="block text-sm font-medium text-[#818181]">
                                Password
                            </label>
                        </div>
                        <input
                            id="login-password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-[#a6a6a6] bg-white text-[#818181] focus:outline-none focus:ring-2 focus:ring-[#818181]/50 focus:border-[#818181] transition-all font-medium tracking-widest"
                            placeholder={'•'.repeat(8)}
                            autoComplete="new-password"
                            required
                        />
                    </div>
                    
                    <div className="pt-1">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 px-4 rounded-xl bg-[#818181] text-white font-medium tracking-wide disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#a6a6a6] transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Authenticating...
                                </span>
                            ) : 'Sign In'}
                        </button>
                    </div>
                </form>

            </div>
        </div>
    );
};

export default Login;
