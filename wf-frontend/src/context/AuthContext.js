/**
 * AuthContext.js
 * Manages: login state, tokens, user object, OTP flow, role detection,
 * silent refresh on mount, and logout.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as authAPI from '../api/authAPI';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser]         = useState(null);
  const [loading, setLoading]   = useState(true); // initial hydration
  const [authError, setAuthError] = useState(null);

  // ── Hydrate from localStorage on first load ───────────────
  useEffect(() => {
    const stored = localStorage.getItem('user');
    const token  = localStorage.getItem('accessToken');
    if (stored && token) {
      try { setUser(JSON.parse(stored)); }
      catch { /* corrupt data – clear */ clearStorage(); }
    }
    setLoading(false);
  }, []);

  // ── Helpers ───────────────────────────────────────────────
  const clearStorage = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  };

  const persistSession = (accessToken, refreshToken, userData) => {
    localStorage.setItem('accessToken',  accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user',         JSON.stringify(userData));
    setUser(userData);
  };

  // ── Register ─────────────────────────────────────────────
  const register = async (formData) => {
    setAuthError(null);
    const { data } = await authAPI.register(formData);
    return data; // caller navigates to OTP page
  };

  // ── Verify OTP ────────────────────────────────────────────
  const verifyOTP = async (identifier, otp) => {
    setAuthError(null);
    const { data } = await authAPI.verifyOTP({ identifier, otp });
    if (data.data?.access_token) {
      persistSession(
        data.data.access_token,
        data.data.refresh_token,
        data.data.user
      );
    }
    return data;
  };

  // ── Resend OTP ────────────────────────────────────────────
  const resendOTP = async (identifier) => {
    const { data } = await authAPI.resendOTP({ identifier });
    return data;
  };

  // ── Login ─────────────────────────────────────────────────
  const loginUser = async (identifier, password) => {
    setAuthError(null);
    const { data } = await authAPI.login({ identifier, password });
    persistSession(
      data.data.access_token,
      data.data.refresh_token,
      data.data.user
    );
    return data.data.user;
  };

  // ── Logout ────────────────────────────────────────────────
  const logoutUser = useCallback(async () => {
    try { await authAPI.logout(); } catch { /* ignore */ }
    clearStorage();
    setUser(null);
  }, []);

  // ── Change password ───────────────────────────────────────
  const changePassword = async (current_password, new_password) => {
    const { data } = await authAPI.changePassword({ current_password, new_password });
    return data;
  };

  // ── Refresh current user data from server ─────────────────
  const refreshCurrentUser = async () => {
    try {
      const { data } = await authAPI.getCurrentUser();
      const updated = data.data?.user || data.data;
      localStorage.setItem('user', JSON.stringify(updated));
      setUser(updated);
      return updated;
    } catch { return null; }
  };

  // ── Derived role helpers ──────────────────────────────────
  const isWorker = user?.user_type === 'worker';
  const isSeeker = user?.user_type === 'seeker';
  const isAdmin  = user?.user_type === 'admin';
  const isAuth   = !!user;

  return (
    <AuthContext.Provider value={{
      user, loading, authError, setAuthError,
      register, verifyOTP, resendOTP, loginUser, logoutUser,
      changePassword, refreshCurrentUser,
      isWorker, isSeeker, isAdmin, isAuth
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
