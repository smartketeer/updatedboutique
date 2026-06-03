import './bootstrap';
import '../css/app.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Login from './views/Login';
import Dashboard from './views/Dashboard';
import POSTerminal from './views/POSTerminal';
import Inventory from './views/Inventory';
import Reports from './views/Reports';
import Layout from './layouts/Layout';
import CashierHistory from './views/CashierHistory';
import CashierInventoryManagement from './views/CashierInventoryManagement';
import CashierAccounts from './views/CashierAccounts';
import StockManagement from './views/StockManagement';
import AdminVoidHistory from './views/AdminVoidHistory';
import Settings from './views/Settings';
import AdminSalesHistory from './views/AdminSalesHistory';
import Branches from './views/Branches';
import StyleGuide from './views/StyleGuide';
import { useAuthStore } from './store/authStore';

const RoleRedirect = () => {
    const { token, user, initialized } = useAuthStore();
    if (!initialized) return <div className="p-8 text-[#a6a6a6] animate-pulse">Loading...</div>;
    if (!token || !user) return <Navigate to="/login" replace />;
    if (user?.role === 'admin') return <Navigate to="/admin" replace />;
    if (user?.role === 'staff') return <Navigate to="/cashier/pos" replace />;
    return <Navigate to="/login" replace />;
};

const RequireRole = ({ roles, children }) => {
    const { token, user, initialized } = useAuthStore();
    if (!initialized) return <div className="p-8 text-[#a6a6a6] animate-pulse">Loading...</div>;
    if (!token) return <Navigate to="/login" replace />;
    if (!user) return <Navigate to="/login" replace />;
    if (!roles.includes(user.role)) return <RoleRedirect />;
    return children;
};

/**
 * POS Session Guard — when a staff member has an active POS session,
 * redirect them back to /cashier/pos if they land on an unexpected route.
 */
const PosSessionGuard = ({ children }) => {
    const { user, posSessionActive } = useAuthStore();
    const location = useLocation();

    if (
        user?.role === 'staff' &&
        posSessionActive &&
        !location.pathname.startsWith('/cashier/')
    ) {
        return <Navigate to="/cashier/pos" replace />;
    }

    return children;
};

const App = () => {
    const { token, user, initialized, init } = useAuthStore();

    React.useEffect(() => {
        init();
    }, [init]);

    const isAuthenticated = Boolean(token && user);

    return (
        <BrowserRouter>
            <PosSessionGuard>
                <Routes>
                    <Route
                        path="/login"
                        element={
                            !initialized ? (
                                <div className="p-8 text-[#a6a6a6] animate-pulse">Loading...</div>
                            ) : !isAuthenticated ? (
                                <Login />
                            ) : (
                                <Navigate to="/" replace />
                            )
                        }
                    />
                    <Route path="/" element={<RoleRedirect />} />

                    <Route
                        path="/admin"
                        element={
                            <RequireRole roles={['admin']}>
                                <Layout />
                            </RequireRole>
                        }
                    >
                        <Route index element={<Dashboard />} />
                        <Route path="inventory" element={<Inventory />} />
                        <Route path="stock-management" element={<StockManagement />} />
                        <Route path="cashiers" element={<CashierAccounts />} />
                        <Route path="settings" element={<Settings />} />
                        <Route path="branches" element={<Branches />} />
                        <Route path="reports" element={<Reports />} />
                        <Route path="sales" element={<AdminSalesHistory />} />
                        <Route path="voids" element={<AdminVoidHistory />} />
                        <Route path="style-guide" element={<StyleGuide />} />
                    </Route>

                    <Route
                        path="/cashier"
                        element={
                            <RequireRole roles={['staff']}>
                                <Layout />
                            </RequireRole>
                        }
                    >
                        <Route path="pos" element={<POSTerminal />} />
                        <Route path="history" element={<CashierHistory />} />
                        <Route path="overrides" element={<Navigate to="/cashier/pos" replace />} />
                        <Route path="inventory-management" element={<CashierInventoryManagement />} />
                    </Route>
                </Routes>
            </PosSessionGuard>
        </BrowserRouter>
    );
};

const container = document.getElementById('app');
if (container && !container._reactRootContainer) {
    const root = ReactDOM.createRoot(container);
    root.render(<App />);
    container._reactRootContainer = root;
}
