import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import App from './App';

describe('App Component', () => {
  it('renders the login page by default (redirected by ProtectedRoute)', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider>
          <NotificationProvider>
            <App />
          </NotificationProvider>
        </AuthProvider>
      </MemoryRouter>
    );
    expect(screen.getAllByText(/Sign In/i)[0]).toBeInTheDocument();
  });

  it('navigates to User Feedback and back to Home cleanly', async () => {
    // Mock user login
    const fakePayload = {
      sub: "testuser",
      role: "user",
      exp: Math.floor(Date.now() / 1000) + 3600
    };
    const base64Payload = btoa(JSON.stringify(fakePayload)).replace(/=/g, '');
    const fakeToken = `header.${base64Payload}.signature`;
    localStorage.setItem('truthguard_token', fakeToken);

    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider>
          <NotificationProvider>
            <App />
          </NotificationProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    // Verify User Home loads
    expect(await screen.findByText(/Welcome to TruthGuard AI/i)).toBeInTheDocument();

    // Click on User Feedback tab
    const feedbackBtn = screen.getByRole('button', { name: /User Feedback/i });
    fireEvent.click(feedbackBtn);

    // Verify User Feedback tab content loads
    expect(await screen.findByText(/Rate our Website/i)).toBeInTheDocument();

    // Click back on Home tab
    const homeBtn = screen.getByRole('button', { name: /Home/i });
    fireEvent.click(homeBtn);

    // Verify User Home loads back successfully
    expect(await screen.findByText(/Welcome to TruthGuard AI/i)).toBeInTheDocument();

    // Clean up storage
    localStorage.removeItem('truthguard_token');
  });
});
