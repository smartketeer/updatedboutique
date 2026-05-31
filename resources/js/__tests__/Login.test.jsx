import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from '../views/Login';

vi.mock('../store/authStore', () => ({
    useAuthStore: (selector) =>
        selector({
            login: vi.fn(),
            branchName: 'luna branch',
            user: null,
            token: null,
            initialized: true,
            init: vi.fn(),
        }),
}));

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => vi.fn(),
    };
});

describe('Login', () => {
    it('renders the sign in form', () => {
        render(
            <MemoryRouter>
                <Login />
            </MemoryRouter>
        );

        expect(screen.getByRole('heading', { name: /welcome back/i })).toBeVisible();
        expect(screen.getByLabelText(/email/i)).toBeVisible();
        expect(screen.getByLabelText(/password/i)).toBeVisible();
        expect(screen.getByRole('button', { name: /sign in/i })).toBeVisible();
    });
});
