"use client"

import { TransactionDetails } from "./transaction-details"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

interface PageProps {
    params: {
        transactionId: string
    }
}

export default function TransactionPage({ params }: PageProps) {
    return (
        <div className="container mx-auto py-6">
            <TransactionDetails transactionId={params.transactionId} />
        </div>
    )
}
