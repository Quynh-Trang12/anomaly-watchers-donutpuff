import React, { createContext, useContext, useState, ReactNode } from "react";

/**
 * AnomalyWatchers Demo Auth Provider
 * NOTE: This is NOT a real authentication system. 
 * This context serves as a global state to simulate different roles (USER/ADMIN) 
 * for demonstration purposes. Security logic is bypassed for the project demo.
 */

export type UserRole = "USER" | "ADMIN";

interface AuthContextType {
  role: UserRole;
  userId: string;
  setRole: (role: UserRole) => void;
  setUserId: (id: string) => void;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Personas used for the simulation demos
export const MOCK_USERS = [
  { id: "student_sam", name: "Student Sam", display_balance_label: "Student Account" },
  { id: "student_lina", name: "Student Lina", display_balance_label: "Student Account" },
  { id: "intern_jake", name: "Intern Jake", display_balance_label: "Intern Account" },
  { id: "freelancer_amy", name: "Freelancer Amy", display_balance_label: "Freelance Ledger" },
  { id: "freelancer_minh", name: "Freelancer Minh", display_balance_label: "Freelance Ledger" },
  { id: "teacher_anna", name: "Teacher Anna", display_balance_label: "Educator Account" },
  { id: "teacher_david", name: "Teacher David", display_balance_label: "Educator Account" },
  { id: "engineer_khanh", name: "Engineer Khanh", display_balance_label: "Professional Account" },
  { id: "engineer_lucas", name: "Engineer Lucas", display_balance_label: "Professional Account" },
  { id: "doctor_emily", name: "Doctor Emily", display_balance_label: "High-Tier Medical" },
  { id: "doctor_huy", name: "Doctor Huy", display_balance_label: "High-Tier Medical" },
  { id: "smallbiz_oliver", name: "SmallBiz Oliver", display_balance_label: "Business Operations" },
  { id: "shop_owner_lan", name: "Shop Owner Lan", display_balance_label: "Merchant Account" },
  { id: "manager_sophia", name: "Manager Sophia", display_balance_label: "Corporate Payroll" },
  { id: "manager_quang", name: "Manager Quang", display_balance_label: "Corporate Payroll" },
  { id: "retired_john", name: "Retired John", display_balance_label: "Pension Fund" },
  { id: "retired_ba", name: "Retired Ba", display_balance_label: "Pension Fund" },
  { id: "crypto_trader_neo", name: "Crypto Trader Neo", display_balance_label: "Digital Asset Portfolio" },
  { id: "influencer_mia", name: "Influencer Mia", display_balance_label: "Creator Account" },
  { id: "unemployed_tom", name: "Unemployed Tom", display_balance_label: "Basic Savings" },
];

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Start the demo as a standard retail user
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
