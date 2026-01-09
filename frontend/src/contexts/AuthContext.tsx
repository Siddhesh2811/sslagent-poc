import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
  domainId: string;
  isAuthenticated: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (domainId: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session on load
    const savedUser = localStorage.getItem('ssl_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (error) {
        localStorage.removeItem('ssl_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (domainId: string, password: string): Promise<boolean> => {
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: domainId, password }),
      });

      const data = await response.json();

      if (response.ok) {
        const userData: User = {
          domainId: data.user.username,
          isAuthenticated: true,
        };

        setUser(userData);
        localStorage.setItem('ssl_user', JSON.stringify(userData));
        // You might want to store the token too: localStorage.setItem('ssl_token', data.token);
        setIsLoading(false);
        return true;
      }
    } catch (error) {
      console.error("Login Failed:", error);
    }

    setIsLoading(false);
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('ssl_user');
  };

  const value = {
    user,
    login,
    logout,
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};