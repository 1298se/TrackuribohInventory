"use client"
import { Button } from '@/components/ui/button';
import { InventoryTable } from './inventory-table';
import { useRouter } from 'next/navigation';

export default function InventoryPage() {
  const router = useRouter()


  return (
    <div className="container space-y-4">
        <Button onClick={() => {router.push("/transactions/new")}}>Add new transaction</Button>
      <InventoryTable />
    </div>
  )
}