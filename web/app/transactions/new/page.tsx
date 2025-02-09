"use client"
import { Button } from '@/components/ui/button';
import CreateTransactionFormDialog from '../create-transaction-form-sheet';

export default function NewTransactionPage() {
  return (
    <div className="container mx-auto py-10">
      <CreateTransactionFormDialog />
    </div>
  )
}