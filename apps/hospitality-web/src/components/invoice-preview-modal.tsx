"use client";

import { useEffect, useState } from "react";
import { Modal, Button, Card, CardContent, Badge } from "@cloudit/ui";
import { api } from "@/lib/api";
import type { InvoicePreview } from "@/lib/types";

interface InvoicePreviewModalProps {
  open: boolean;
  onClose: () => void;
  invoiceId: string | null;
}

export function InvoicePreviewModal({ open, onClose, invoiceId }: InvoicePreviewModalProps) {
  const [preview, setPreview] = useState<InvoicePreview | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open && invoiceId) {
      loadPreview();
    } else {
      setPreview(null);
    }
  }, [open, invoiceId]);

  async function loadPreview() {
    if (!invoiceId) return;
    try {
      setIsLoading(true);
      const data = await api.get<InvoicePreview>(`/invoices/${invoiceId}/preview`);
      setPreview(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invoice Preview"
      className="max-w-2xl"
      footer={
        <Button variant="outline" onClick={onClose}>Close</Button>
      }
    >
      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground">Loading preview...</div>
      ) : !preview ? (
        <div className="py-8 text-center text-muted-foreground">No preview available</div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-bold">{preview.property.name}</h3>
              <p className="text-sm text-muted-foreground">{preview.property.address}</p>
              <p className="text-sm text-muted-foreground">{preview.property.phone}</p>
              <p className="text-sm text-muted-foreground">{preview.property.email}</p>
              {preview.property.taxId && (
                <p className="text-sm text-muted-foreground">Tax ID: {preview.property.taxId}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm font-medium">{preview.invoiceNumber}</p>
              <p className="text-sm text-muted-foreground">
                Issue: {new Date(preview.issueDate).toLocaleDateString()}
              </p>
              {preview.dueDate && (
                <p className="text-sm text-muted-foreground">
                  Due: {new Date(preview.dueDate).toLocaleDateString()}
                </p>
              )}
              <Badge variant={preview.status === "paid" ? "default" : "secondary"} className="mt-2">
                {preview.status}
              </Badge>
            </div>
          </div>

          <Card>
            <CardContent className="p-4">
              <p className="text-sm font-medium">Bill To</p>
              <p className="text-sm">{preview.guest.name}</p>
              <p className="text-sm text-muted-foreground">{preview.guest.address}</p>
              <p className="text-sm text-muted-foreground">{preview.guest.email}</p>
              <p className="text-sm text-muted-foreground">{preview.guest.phone}</p>
            </CardContent>
          </Card>

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Description</th>
                  <th className="px-4 py-2 text-right font-medium">Amount (Rs.)</th>
                </tr>
              </thead>
              <tbody>
                {preview.lineItems.map((item, index) => (
                  <tr key={index} className="border-t">
                    <td className="px-4 py-2">{item.description}</td>
                    <td className="px-4 py-2 text-right">{Number(item.amount).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>Rs. {Number(preview.subtotal).toLocaleString()}</span>
            </div>
            {preview.taxBreakdown.map((tax) => (
              <div key={tax.name} className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {tax.name} ({tax.rate}%)
                </span>
                <span>Rs. {Number(tax.amount).toLocaleString()}</span>
              </div>
            ))}
            <div className="flex justify-between border-t pt-2 text-base font-semibold">
              <span>Total</span>
              <span>Rs. {Number(preview.totalAmount).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Paid</span>
              <span>Rs. {Number(preview.paidAmount).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm font-medium">
              <span>Balance</span>
              <span>
                Rs. {Number(preview.totalAmount - preview.paidAmount).toLocaleString()}
              </span>
            </div>
          </div>

          {preview.notes && (
            <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              {preview.notes}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
