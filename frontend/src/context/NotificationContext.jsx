import { createContext, useState, useEffect, useCallback } from 'react';

export const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem('truthguard_notifications');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeToast, setActiveToast] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem('truthguard_notifications', JSON.stringify(notifications.slice(0, 50)));
    } catch (err) {
      console.error("Failed to save notifications to localStorage", err);
    }
  }, [notifications]);

  const addNotification = useCallback((title, message, resultData = null) => {
    const newNotif = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
      title: title || 'Threat Analysis Ready',
      message: message || 'Scan results have been processed successfully.',
      resultData,
      timestamp: new Date().toISOString(),
      isRead: false
    };

    setNotifications(prev => [newNotif, ...prev]);
    setActiveToast(newNotif);

    // Auto-dismiss toast after 4.5 seconds
    setTimeout(() => {
      setActiveToast(prev => (prev?.id === newNotif.id ? null : prev));
    }, 4500);
  }, []);

  const markAsRead = useCallback((id) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setActiveToast(null);
  }, []);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        activeToast,
        setActiveToast,
        addNotification,
        markAsRead,
        markAllAsRead,
        clearNotifications
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
