"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal, Button, Input, Select, Form, FormField, FormLabel, FormError } from "@cloudit/ui";
import { api } from "@/lib/api";
import { formatLkr } from "@/lib/format";
import type { Invoice, Payment, PaymentIntent, PaymentMethod } from "@/lib/types";

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  onSuccess: () => void;
}

const methodOptions = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "payhere", label: "PayHere" },
  { value: "stripe", label: "Stripe" },
];

const methodLabels: Record<PaymentMethod, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  payhere: "PayHere",
  stripe: "Stripe",
};

function getBalance(invoice: Invoice | null) {
  if (!invoice) return 0;
  return Math.max(Number(invoice.totalAmount) - Number(invoice.paidAmount), 0);
}

export function PaymentModal({ open, onClose, invoice, onSuccess }: PaymentModalProps) {
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [providerRef, setProviderRef] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const balance = useMemo(() => getBalance(invoice), [invoice]);
  const isGatewayPayment = method === "payhere" || method === "stripe";

  useEffect(() => {
    if (open) {
      setAmount(balance);
      setMethod("cash");
      setProviderRef("");
      setNotes("");
      setError("");
    }
  }, [open, balance]);

  async function handleSubmit() {
    if (!invoice) return;
    if (amount <= 0) {
      setError("Payment amount must be greater than zero");
      return;
    }
    if (amount > balance) {
      setError("Payment amount cannot exceed the invoice balance");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");

      let gatewayReference = providerRef.trim() || undefined;
      if (isGatewayPayment && !gatewayReference) {
        const intent = await api.post<PaymentIntent>("/payments/intent", {
          invoiceId: invoice.id,
          amount,
          method,
        });
        gatewayReference = intent.providerRef;
      }

      await api.post<Payment>("/payments", {
        invoiceId: invoice.id,
        amount,
        method,
        providerStatus: isGatewayPayment ? "pending" : "succeeded",
        providerRef: gatewayReference,
        notes: notes.trim() || undefined,
      });

      onSuccess();
      onClose();
    } catch (submitError: any) {
      setError(submitError?.message || "Unable to record payment");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record Payment"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !invoice}>
            {isSubmitting ? "Saving..." : "Save Payment"}
          </Button>
        </>
      }
    >
      {!invoice ? (
        <div className="py-8 text-center text-muted-foreground">No invoice selected</div>
      ) : (
        <Form className="space-y-4">
          <div className="rounded-md border p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Invoice</span>
              <span className="font-medium">{invoice.invoiceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total</span>
              <span>{formatLkr(invoice.totalAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Paid</span>
              <span>{formatLkr(invoice.paidAmount)}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Balance</span>
              <span>{formatLkr(balance)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField>
              <FormLabel required>Method</FormLabel>
              <Select
                options={methodOptions}
                value={method}
                onChange={(event) => setMethod(event.target.value as PaymentMethod)}
              />
            </FormField>
            <FormField>
              <FormLabel required>Amount (Rs.)</FormLabel>
              <Input
                type="number"
                min={0.01}
                step="0.01"
                max={balance}
                value={amount}
                onChange={(event) => setAmount(Number(event.target.value))}
              />
            </FormField>
          </div>

          <FormField>
            <FormLabel>{methodLabels[method]} Reference</FormLabel>
            <Input
              value={providerRef}
              onChange={(event) => setProviderRef(event.target.value)}
              placeholder={isGatewayPayment ? "Generated automatically if blank" : "Receipt or transfer reference"}
            />
          </FormField>

          <FormField>
            <FormLabel>Notes</FormLabel>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </FormField>

          <FormError message={error} />
        </Form>
      )}
    </Modal>
  );
}
