export interface Expense {
  id: number;
  description: string;
  amount: string;
  date: string;
  notes: string | null;
  receipt_attached: boolean;
  category: { id: number; name: string };
  household: { id: number; name: string } | null;
  author: { id: number; name: string };
  can_edit: boolean;
  can_delete: boolean;
}

export interface CreateExpense {
  description: string;
  amount: string;
  date: string;
  category_id: number;
  household_id?: number | null;
  notes?: string;
}
