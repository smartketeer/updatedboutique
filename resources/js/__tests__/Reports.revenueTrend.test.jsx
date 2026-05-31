import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import Reports from '../views/Reports';

const axiosGet = vi.fn();

vi.mock('axios', () => ({
    default: {
        get: (...args) => axiosGet(...args),
    },
}));

const authState = {
    user: { id: 1, name: 'Admin', role: 'admin' },
};

vi.mock('../store/authStore', () => ({
    useAuthStore: (selector) => (typeof selector === 'function' ? selector(authState) : authState),
}));

beforeEach(() => {
    axiosGet.mockReset();
});

afterEach(() => {
    cleanup();
});

describe('Reports revenue trend', () => {
    it('renders a line chart for revenue trend', async () => {
        axiosGet.mockImplementation((url) => {
            if (url === '/api/reports/daily-summary') {
                return Promise.resolve({ data: { total_revenue: 1000, total_transactions: 5, total_discount: 0, date: '2026-05-03' } });
            }
            if (url === '/api/reports/inventory-valuation') {
                return Promise.resolve({ data: { total_valuation: 5000 } });
            }
            if (url === '/api/reports/weekly-revenue') {
                return Promise.resolve({
                    data: {
                        start_date: '2026-04-27',
                        end_date: '2026-05-03',
                        days: [
                            { date: '2026-04-27', total_revenue: 100, total_transactions: 1 },
                            { date: '2026-04-28', total_revenue: 200, total_transactions: 2 },
                            { date: '2026-04-29', total_revenue: 50, total_transactions: 1 },
                            { date: '2026-04-30', total_revenue: 300, total_transactions: 3 },
                            { date: '2026-05-01', total_revenue: 150, total_transactions: 2 },
                        ],
                    },
                });
            }
            if (String(url).startsWith('/api/reports/staff-performance')) {
                return Promise.resolve({ data: [] });
            }
            return Promise.resolve({ data: [] });
        });

        const { container } = render(<Reports />);

        const chart = await screen.findByRole('img', { name: /weekly revenue line chart/i });
        expect(chart).toBeInTheDocument();

        await waitFor(() => {
            const svg = container.querySelector('svg[role="img"]');
            expect(svg).toBeTruthy();
            const circles = svg.querySelectorAll('circle');
            expect(circles.length).toBe(5);
            const path = svg.querySelector('path');
            expect(path).toBeTruthy();
        });
    });
});

