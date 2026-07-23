import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
