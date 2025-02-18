"use client"

import { Button } from "@/components/ui/button"
import { TransactionTable } from "./transaction-table"
import { useRouter } from "next/navigation"

export default function TransactionsPage() {
  const router = useRouter()
  return (
    <div className="container space-y-4">
      <Button onClick={() => {router.push("/transactions/new")}}>Add new transaction</Button>
      <TransactionTable />
    </div>
  )
}