import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import axios from 'axios';

export const useAuthStore = create(
    persist(
        (set, get) => ({
            user: null,
            token: null,
            branchName: 'luna branch',
            initialized: false,
            posSessionActive: false, // tracks whether POS session is active
            setBranchName: (branchName) => set({ branchName }),
            setPosSessionActive: (active) => set({ posSessionActive: active }),
            resolveBranchName: async (user) => {
                // 1. Check active_branch (set via /api/select-branch and returned by /api/me)
                if (user?.active_branch?.name) return String(user.active_branch.name).toLowerCase();
                // 2. Check branch relationship
                if (user?.branch?.name) return String(user.branch.name).toLowerCase();
                if (user?.branch_name) return String(user.branch_name).toLowerCase();
                // 3. Check branch_id against branches list
                if (user?.branch_id != null) {
                    const branches = Array.isArray(user?.branches) ? user.branches : [];
                    const found = branches.find((b) => Number(b?.id) === Number(user.branch_id));
                    if (found?.name) return String(found.name).toLowerCase();
                }
                return 'luna branch';
            },
            login: async (email, password, intendedBranchKey) => {
                try {
                    const response = await axios.post('/api/login', { email, password });
                    const { user, access_token, available_branches } = response.data;
                    axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

                    // If staff user, try to select the correct branch based on intendedBranchKey (from UI selection)
                    let branchName = await useAuthStore.getState().resolveBranchName(user);
                    if (user?.role === 'staff' && Array.isArray(available_branches) && available_branches.length > 0) {
                        const emailPrefix = String(email || '').trim().toLowerCase().split('@')[0] || '';
                        const branchSearchString = String(intendedBranchKey || emailPrefix).toLowerCase().replace(' branch', '');
                        const matchedBranch = available_branches.find(
                            (b) => String(b?.name || '').toLowerCase().includes(branchSearchString)
                        );
                        const selectedBranch = matchedBranch || available_branches[0];
                        if (selectedBranch?.id) {
                            try {
                                const branchRes = await axios.post('/api/select-branch', { branch_id: selectedBranch.id });
                                if (branchRes.data?.branch?.name) {
                                    branchName = String(branchRes.data.branch.name).toLowerCase();
                                }
                            } catch (branchErr) {
                                console.warn('Branch selection failed, using default:', branchErr);
                            }
                        }
                    }

                    const posSessionActive = user?.role === 'staff';
                    set({ user, token: access_token, branchName, initialized: true, posSessionActive });
                    return user;
                } catch (error) {
                    console.error('Login error details:', {
                        message: error.message,
                        response: error.response?.data,
                        status: error.response?.status
                    });
                    throw error;
                }
            },
            logout: async () => {
                try {
                    await axios.post('/api/logout');
                } catch {
                }
                set({ user: null, token: null, posSessionActive: false, initialized: true });
                delete axios.defaults.headers.common['Authorization'];
            },
            clear: () => {
                set({ user: null, token: null, posSessionActive: false, initialized: true });
                delete axios.defaults.headers.common['Authorization'];
            },
            init: async () => {
                const state = useAuthStore.getState();
                if (state.token) {
                    axios.defaults.headers.common['Authorization'] = `Bearer ${state.token}`;
                    try {
                        const meRes = await axios.get('/api/me');
                        const branchName = await useAuthStore.getState().resolveBranchName(meRes.data);
                        const posSessionActive = meRes.data?.role === 'staff' ? state.posSessionActive : false;
                        set({ user: meRes.data, branchName, posSessionActive, initialized: true });
                    } catch {
                        set({ user: null, token: null, posSessionActive: false, initialized: true });
                        delete axios.defaults.headers.common['Authorization'];
                    }
                    return;
                }
                set({ initialized: true });
            }
        }),
        {
            name: 'auth-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                token: state.token,
                branchName: state.branchName,
                posSessionActive: state.posSessionActive,
            }),
            onRehydrateStorage: () => (state) => {
                if (state?.token) {
                    axios.defaults.headers.common['Authorization'] = `Bearer ${state.token}`;
                }
            },
        }
    )
);
