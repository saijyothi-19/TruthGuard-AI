import { useContext, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { NotificationContext } from '../context/NotificationContext';
import { 
  Shield, Sun, Moon, Bell, Menu, X, CheckCheck, Trash2,
  Activity, Zap, FileText, Settings, MessageSquare, ExternalLink, AlertTriangle
} from 'lucide-react';

const Navbar = () => {
  const navigate = useNavigate();
  const { user, logout } = useContext(AuthContext);
  const { 
    notifications, 
    unreadCount, 
    activeToast, 
    setActiveToast, 
    markAsRead, 
    markAllAsRead, 
    clearNotifications 
  } = useContext(NotificationContext);

  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const [currentTab, setCurrentTab] = useState('home');

  const handleMenuTabClick = (tabName) => {
    setCurrentTab(tabName);
    setShowMobileMenu(false);
    navigate('/');
    // Dispatch custom event so Dashboard switches to target tab
    window.dispatchEvent(new CustomEvent('switchDashboardTab', { detail: tabName }));
  };

  return (
    <>
      <nav className="navbar">
        <div className="nav-left flex-center" style={{ gap: '0.75rem', display: 'flex', alignItems: 'center' }}>
          <Link to="/" onClick={() => handleMenuTabClick('home')} className="nav-brand flex-center" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <Shield size={22} style={{ color: 'var(--primary-color)', marginRight: '0.4rem', filter: 'drop-shadow(0 0 6px rgba(99, 102, 241, 0.4))' }} />
            <span className="nav-brand-text" style={{ fontSize: '1.2rem', fontStyle: 'normal', fontWeight: '700' }}>
              TruthGuard AI
            </span>
          </Link>

          {/* Hamburger Menu Button (☰) placed directly beside Logo */}
          <button 
            className="hamburger-btn" 
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            title="Open Navigation Menu"
            style={{ background: 'rgba(99, 102, 241, 0.12)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.3)', padding: '5px 10px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {showMobileMenu ? <X size={18} /> : <Menu size={18} />}
            <span style={{ fontSize: '0.8rem', fontWeight: '600' }}>Menu</span>
          </button>
        </div>

        <div className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Notification Bell Icon (🔔) */}
          {user && (
            <div className="notif-wrapper" style={{ position: 'relative' }}>
              <button 
                className="icon-btn notif-bell-btn" 
                onClick={() => setShowNotifPanel(!showNotifPanel)}
                title="Notifications"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
              </button>

              {/* Notification Dropdown Panel */}
              {showNotifPanel && (
                <div className="notif-dropdown animate-fade">
                  <div className="notif-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Bell size={16} style={{ color: 'var(--primary-color)' }} />
                      <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#f8fafc' }}>Notifications</h4>
                    </div>
                    <div className="notif-actions">
                      <button onClick={markAllAsRead} title="Mark all read" className="text-action-btn">
                        <CheckCheck size={14} /> Read All
                      </button>
                      <button onClick={clearNotifications} title="Clear notifications" className="text-action-btn danger">
                        <Trash2 size={14} /> Clear
                      </button>
                    </div>
                  </div>

                  <div className="notif-list">
                    {notifications.length === 0 ? (
                      <div className="empty-notif">
                        <p>No recent notifications</p>
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div 
                          key={n.id} 
                          className={`notif-item ${!n.isRead ? 'unread' : ''}`}
                          onClick={() => handleNotifClick(n)}
                        >
                          <div className="notif-icon">
                            {n.resultData?.threat_level === 'Red' || n.resultData?.threat_level === 'Dark Red' ? (
                              <AlertTriangle size={16} style={{ color: '#ef4444' }} />
                            ) : (
                              <Zap size={16} style={{ color: '#10b981' }} />
                            )}
                          </div>
                          <div className="notif-content">
                            <h5 className="notif-title">{n.title}</h5>
                            <p className="notif-msg">{n.message}</p>
                            <span className="notif-time">{formatTimeAgo(n.timestamp)}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Dark / Light Theme Toggle */}
          <button 
            onClick={toggleTheme} 
            className="icon-btn"
            title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {theme === 'dark' ? <Sun size={20} style={{ color: '#fbbf24' }} /> : <Moon size={20} style={{ color: '#6366f1' }} />}
          </button>
        </div>
      </nav>

      {/* Responsive Side Navigation Drawer Overlay */}
      {showMobileMenu && (
        <div className="mobile-drawer-overlay animate-fade" onClick={() => setShowMobileMenu(false)}>
          <div className="mobile-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield size={20} style={{ color: 'var(--primary-color)' }} />
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#f8fafc' }}>TruthGuard Navigation</h3>
              </div>
              <button onClick={() => setShowMobileMenu(false)} className="icon-btn">
                <X size={20} />
              </button>
            </div>
            
            <div className="drawer-menu-list">
              <button className={`drawer-item ${currentTab === 'home' ? 'active' : ''}`} onClick={() => handleMenuTabClick('home')}>
                🏠 Home
              </button>
              <button className={`drawer-item ${currentTab === 'overview' ? 'active' : ''}`} onClick={() => handleMenuTabClick('overview')}>
                <Activity size={18} /> Security Analytics
              </button>
              <button className={`drawer-item ${currentTab === 'simulator' ? 'active' : ''}`} onClick={() => handleMenuTabClick('simulator')}>
                <Zap size={18} /> Threat Simulator
              </button>
              <button className={`drawer-item ${currentTab === 'history' ? 'active' : ''}`} onClick={() => handleMenuTabClick('history')}>
                <FileText size={18} /> Audit Logs
              </button>
              <button className={`drawer-item ${currentTab === 'filters' || currentTab === 'rules' ? 'active' : ''}`} onClick={() => handleMenuTabClick('filters')}>
                <Settings size={18} /> Policy Filters
              </button>
              <button className={`drawer-item ${currentTab === 'feedback' ? 'active' : ''}`} onClick={() => handleMenuTabClick('feedback')}>
                <MessageSquare size={18} /> User Feedback
              </button>
              <button className={`drawer-item ${currentTab === 'settings' ? 'active' : ''}`} onClick={() => handleMenuTabClick('settings')}>
                ⚙️ Settings
              </button>
            </div>

            <div className="drawer-footer" style={{ marginTop: 'auto', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              {user ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    Logged in: <strong style={{ color: '#f8fafc' }}>{user.username}</strong>
                  </span>
                  <button onClick={handleLogout} className="logout-btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>
                    Sign Out
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <Link to="/login" onClick={() => setShowMobileMenu(false)} className="primary-btn flex-center w-full" style={{ padding: '0.5rem', textAlign: 'center', textDecoration: 'none' }}>Sign In</Link>
                  <Link to="/register" onClick={() => setShowMobileMenu(false)} className="secondary-btn flex-center w-full" style={{ padding: '0.5rem', textAlign: 'center', textDecoration: 'none', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px' }}>Sign Up</Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Alert Banner */}
      {activeToast && (
        <div 
          className="floating-toast animate-slide-up"
          onClick={() => {
            if (activeToast.resultData) {
              navigate('/');
              window.dispatchEvent(new CustomEvent('openScanReport', { detail: activeToast.resultData }));
            }
            setActiveToast(null);
          }}
        >
          <div className="toast-icon">
            <Zap size={18} style={{ color: '#10b981' }} />
          </div>
          <div className="toast-body">
            <h5 className="toast-title">{activeToast.title}</h5>
            <p className="toast-msg">{activeToast.message}</p>
          </div>
          <button 
            className="toast-close"
            onClick={(e) => {
              e.stopPropagation();
              setActiveToast(null);
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </>
  );
};

export default Navbar;

