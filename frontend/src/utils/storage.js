/**
 * Safe local storage utility to prevent SecurityErrors in private/incognito modes
 * or when cookies and local storage access is restricted.
 */
export const safeLocalStorage = {
  getItem: (key) => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn(`safeLocalStorage.getItem failed for key: ${key}`, e);
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn(`safeLocalStorage.setItem failed for key: ${key}`, e);
    }
  },
  removeItem: (key) => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`safeLocalStorage.removeItem failed for key: ${key}`, e);
    }
  },
  clear: () => {
    try {
      localStorage.clear();
    } catch (e) {
      console.warn("safeLocalStorage.clear failed", e);
    }
  }
};
