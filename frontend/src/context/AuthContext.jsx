import { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext();

const decodeToken = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window.atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('truthguard_token');
    if (storedToken) {
      const decoded = decodeToken(storedToken);
      // Validate expiration
      if (decoded && decoded.exp * 1000 > Date.now()) {
        setToken(storedToken);
        setUser({ username: decoded.sub, role: decoded.role || 'user' });
      } else {
        localStorage.removeItem('truthguard_token');
      }
    }
    setLoading(false);
  }, []);

  const login = (accessToken) => {
    localStorage.setItem('truthguard_token', accessToken);
    const decoded = decodeToken(accessToken);
    setToken(accessToken);
    setUser({ 
      username: decoded ? decoded.sub : 'admin', 
      role: decoded ? (decoded.role || 'user') : 'admin' 
    });
  };

  const logout = () => {
    localStorage.removeItem('truthguard_token');
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
