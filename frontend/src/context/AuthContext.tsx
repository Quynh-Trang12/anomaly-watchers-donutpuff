import React, { createContext, useContext, useState, ReactNode } from "react";

export type UserRole = "USER" | "ADMIN";

interface AuthContextType {
  role: UserRole;
  userId: string;
  setRole: (role: UserRole) => void;
  setUserId: (id: string) => void;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const MOCK_USERS = [
  { id: "user_1", name: "User 1" },
  { id: "user_2", name: "User 2" },
];

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [role, setRole] = useState<UserRole>("USER");
  const [userId, setUserId] = useState<string>(MOCK_USERS[0].id);

  const isAdmin = role === "ADMIN";

  return (
    <AuthContext.Provider value={{ role, userId, setRole, setUserId, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
