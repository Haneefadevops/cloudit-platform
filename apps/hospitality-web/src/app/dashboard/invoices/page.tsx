"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
  Select,
} from "@cloudit/ui";
import { Plus, Pencil, Trash2, FileText, Eye, CheckCircle, CreditCard } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { InvoiceModal } from "@/components/invoice-modal";
import { InvoicePreviewModal } from "@/components/invoice-preview-modal";
import { PaymentModal } from "@/components/payment-modal";
import { api } from "@/lib/api";
import { formatDate, formatLkr } from "@/lib/format";
import type { Invoice, Reservation, PaginatedResponse, Property } from "@/lib/types";

const statusBadgeVariant: Record<string, string> = {
  draft: "secondary",
  issued: "default",
  paid: "default",
  overdue: "destructive",
  cancelled: "outline",
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [previewInvoiceId, setPreviewInvoiceId] = useState<string | null>(null);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setIsLoading(true);
      const [iRes, pRes, rRes] = await Promise.all([
        api.get<PaginatedResponse<Invoice>>("/invoices?limit=1000"),
        api.get<PaginatedResponse<Property>>("/properties?limit=100"),
        api.get<PaginatedResponse<Reservation>>("/reservations?limit=1000"),
      ]);
      setInvoices(iRes.data);
      setProperties(pRes.data);
      setReservations(rRes.data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  const filteredInvoices = invoices.filter((invoice) => {
    const guestName = `${invoice.guest?.firstName || ""} ${invoice.guest?.lastName || ""}`.toLowerCase();
    const matchesSearch =
      invoice.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      guestName.includes(search.toLowerCase());
    const matchesStatus = statusFilter ? invoice.status === statusFilter : true;
    return matchesSearch && matchesStatus;
  });

  const handleSubmit = async (data: Partial<Invoice>) => {
    try {
      if (editingInvoice) {
        await api.patch(`/invoices/${editingInvoice.id}`, data);
      } else {
        await api.post("/invoices", data);
      }
      setModalOpen(false);
      setEditingInvoice(null);
      loadData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (invoice: Invoice) => {
    if (!confirm(`Delete invoice ${invoice.invoiceNumber}?`)) return;
    try {
      await api.delete(`/invoices/${invoice.id}`);
      loadData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleMarkPaid = async (invoice: Invoice) => {
    if (!confirm(`Mark invoice ${invoice.invoiceNumber} as paid?`)) return;
    try {
      await api.post(`/invoices/${invoice.id}/mark-paid`, {});
      loadData();
    } catch (error) {
      console.error(error);
    }
  };

  const statusOptions = [
    { value: "", label: "All Statuses" },
    { value: "draft", label: "Draft" },
    { value: "issued", label: "Issued" },
    { value: "paid", label: "Paid" },
    { value: "overdue", label: "Overdue" },
    { value: "cancelled", label: "Cancelled" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" description="Manage guest invoices and payments">
        <Button onClick={() => { setEditingInvoice(null); setModalOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Create Invoice
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            <Input
              placeholder="Search invoices..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <Select
              options={statusOptions}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="max-w-xs"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Guest</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center">Loading...</TableCell>
                  </TableRow>
                ) : filteredInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      No invoices found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInvoices.map((invoice) => {
                    const balance = Number(invoice.totalAmount) - Number(invoice.paidAmount);
                    return (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          {invoice.invoiceNumber}
                        </div>
                      </TableCell>
                      <TableCell>
                        {invoice.guest?.firstName} {invoice.guest?.lastName}
                      </TableCell>
                      <TableCell>{invoice.property?.name}</TableCell>
                      <TableCell>{formatDate(invoice.issueDate)}</TableCell>
                      <TableCell>{formatLkr(invoice.totalAmount)}</TableCell>
                      <TableCell>{formatLkr(invoice.paidAmount)}</TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant[invoice.status] as any}>
                          {invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setPreviewInvoiceId(invoice.id)}
                            title="Preview"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {invoice.status !== "paid" && invoice.status !== "cancelled" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setPaymentInvoice(invoice)}
                              title="Record Payment"
                              disabled={balance <= 0}
                              className="text-blue-600"
                            >
                              <CreditCard className="h-4 w-4" />
                            </Button>
                          )}
                          {invoice.status !== "paid" && invoice.status !== "cancelled" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleMarkPaid(invoice)}
                              title="Mark Paid"
                              className="text-green-600"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { setEditingInvoice(invoice); setModalOpen(true); }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(invoice)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <InvoiceModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingInvoice(null); }}
        invoice={editingInvoice}
        reservations={reservations}
        onSubmit={handleSubmit}
      />

      <InvoicePreviewModal
        open={!!previewInvoiceId}
        onClose={() => setPreviewInvoiceId(null)}
        invoiceId={previewInvoiceId}
      />

      <PaymentModal
        open={!!paymentInvoice}
        onClose={() => setPaymentInvoice(null)}
        invoice={paymentInvoice}
        onSuccess={loadData}
      />
    </div>
  );
}
