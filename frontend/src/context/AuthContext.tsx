import React, { createContext, useContext, useState, ReactNode } from "react";

export type UserRole = "USER" | "ADMIN";

interface AuthContextType {
  role: UserRole;
  userId: string;
  setRole: (role: UserRole) => void;
  setUserId: (id: string) => void;
  isAdmin: boolean;
  hasActivelySelectedUser: boolean;
  setHasActivelySelectedUser: (value: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const MOCK_USERS = [
  { id: "user_1", name: "Alice Chen", display_balance_label: "Personal Account" },
  { id: "user_2", name: "Bob Martinez", display_balance_label: "Business Account" },
  { id: "user_3", name: "Carol Johnson", display_balance_label: "Savings Account" },
  { id: "user_4", name: "David Kim", display_balance_label: "Checking Account" },
  { id: "user_5", name: "Emma Williams", display_balance_label: "Personal Account" },
  { id: "user_6", name: "Frank Nguyen", display_balance_label: "Business Account" },
  { id: "user_7", name: "Grace Patel", display_balance_label: "Savings Account" },
  { id: "user_8", name: "Henry Okafor", display_balance_label: "Checking Account" },
  { id: "user_9", name: "Isabella Santos", display_balance_label: "Personal Account" },
  { id: "user_10", name: "James Liu", display_balance_label: "Business Account" },
  { id: "user_11", name: "Karen Müller", display_balance_label: "Savings Account" },
  { id: "user_12", name: "Liam Adeyemi", display_balance_label: "Checking Account" },
  { id: "user_13", name: "Mia Tanaka", display_balance_label: "Personal Account" },
  { id: "user_14", name: "Noah Fernandez", display_balance_label: "Business Account" },
  { id: "user_15", name: "Olivia Hassan", display_balance_label: "Savings Account" },
  { id: "user_16", name: "Paul Osei", display_balance_label: "Checking Account" },
  { id: "user_17", name: "Quinn Ramirez", display_balance_label: "Personal Account" },
  { id: "user_18", name: "Rachel Dubois", display_balance_label: "Business Account" },
  { id: "user_19", name: "Samuel Park", display_balance_label: "Savings Account" },
  { id: "user_20", name: "Tina Kovač", display_balance_label: "Checking Account" },
];

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [role, setRole] = useState<UserRole>("USER");
  const [userId, setUserId] = useState<string>(MOCK_USERS[0].id);
  const [hasActivelySelectedUser, setHasActivelySelectedUser] = useState(false);

  const isAdmin = role === "ADMIN";

  return (
    <AuthContext.Provider value={{ role, userId, setRole, setUserId, isAdmin, hasActivelySelectedUser, setHasActivelySelectedUser }}>
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
