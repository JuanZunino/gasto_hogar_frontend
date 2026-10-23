export interface Expense {
  id: number;
  description: string;
  amount: string;
  date: string;
  notes: string | null;
  receipt_attached: boolean;
  category: { id: number; name: string };
  household: { id: number; name: string } | null;
}
