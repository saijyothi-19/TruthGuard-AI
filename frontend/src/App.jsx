import { useEffect, useContext } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import Verify from './pages/Verify';
import ForgotPassword from './pages/ForgotPassword';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthContext } from './context/AuthContext';
import api from './api';
import './index.css';

function App() {
  const { token } = useContext(AuthContext);

  // Set the Bearer header on the axios API instance whenever the token changes
  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete api.defaults.headers.common['Authorization'];
    }
  }, [token]);

  return (
    <div className="app-layout">
      <Navbar />
      <main className="main-content-wrapper">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify" element={<Verify />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          
          {/* Main Dashboard & Deep Link Tab Routes */}
          <Route path="/" element={<ProtectedRoute><Dashboard defaultTab="home" /></ProtectedRoute>} />
          <Route path="/overview" element={<ProtectedRoute><Dashboard defaultTab="overview" /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute><Dashboard defaultTab="overview" /></ProtectedRoute>} />
          <Route path="/simulator" element={<ProtectedRoute><Dashboard defaultTab="simulator" /></ProtectedRoute>} />
          <Route path="/history" element={<ProtectedRoute><Dashboard defaultTab="history" /></ProtectedRoute>} />
          <Route path="/filters" element={<ProtectedRoute><Dashboard defaultTab="filters" /></ProtectedRoute>} />
          <Route path="/rules" element={<ProtectedRoute><Dashboard defaultTab="filters" /></ProtectedRoute>} />
          <Route path="/feedback" element={<ProtectedRoute><Dashboard defaultTab="feedback" /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Dashboard defaultTab="settings" /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard defaultTab="home" /></ProtectedRoute>} />

          {/* Catch-all Wildcard Route */}
          <Route path="*" element={<ProtectedRoute><Dashboard defaultTab="home" /></ProtectedRoute>} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
