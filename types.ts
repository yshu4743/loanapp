
export interface Loan {
  id: string;
  amount: number;
  repaymentAmount: number;
  status: 'active' | 'paid' | 'overdue' | 'processing';
  appliedDate: string;
  dueDate: string;
  paidDate?: string;
}

export interface Transaction {
  id: string;
  type: 'disbursement' | 'repayment';
  amount: number;
  date: string;
  status: 'success' | 'failed' | 'pending';
}

export interface UserProfile {
  phoneNumber: string;
  isLoggedIn: boolean;
  isKycCompleted: boolean;
  fullName?: string;
  panNumber?: string;
  accountNumber?: string;
  ifscCode?: string;
  cibilScore: number;
  balance: number;
  loans: Loan[];
  transactions: Transaction[];
}

export enum AppState {
  LOGIN,
  KYC_FORM,
  BANK_DETAILS,
  KYC_FACE,
  DASHBOARD,
  APPLY,
  PAYMENT_GATEWAY,
  CHAT,
  HISTORY
}
