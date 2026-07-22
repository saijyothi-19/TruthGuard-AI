import { createContext, useState, useEffect, useCallback } from 'react';
import { 
  getNotifications, 
  createNotificationApi, 
  markNotificationReadApi, 
  markAllNotificationsReadApi, 
  clearNotificationsApi 
} from '../api';

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

  // Sync notifications from backend DB on load
  const syncFromDb = useCallback(async () => {
    try {
      const dbNotifs = await getNotifications();
      if (Array.isArray(dbNotifs) && dbNotifs.length > 0) {
        setNotifications(dbNotifs);
      }
    } catch (e) {
      console.log("Could not sync notifications from DB:", e);
    }
  }, []);

  useEffect(() => {
    syncFromDb();
  }, [syncFromDb]);

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

    // Save to DB asynchronously
    createNotificationApi(newNotif.title, newNotif.message, resultData);

    // Auto-dismiss toast after 4.5 seconds
    setTimeout(() => {
      setActiveToast(prev => (prev?.id === newNotif.id ? null : prev));
    }, 4500);
  }, []);

  const markAsRead = useCallback((id) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
    );
    markNotificationReadApi(id);
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    markAllNotificationsReadApi();
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setActiveToast(null);
    clearNotificationsApi();
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
        clearNotifications,
        syncFromDb
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
