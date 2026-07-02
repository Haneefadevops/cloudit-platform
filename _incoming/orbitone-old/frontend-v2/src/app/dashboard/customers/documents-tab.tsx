import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCustomerDocuments,
  useCreateDocument,
  useUpdateDocumentStatus,
  downloadDocument,
} from "@/hooks/useDocuments";
import type { Document, DocumentType, DocumentStatus } from "@/lib/contracts";
import { FileText, Plus, Download, CheckCircle, XCircle, Send, Trash2 } from "lucide-react";

const documentTypeLabels: Record<DocumentType, string> = {
  quotation: "Quotation",
  invoice: "Invoice",
  agreement: "Agreement",
  other: "Other",
};

const statusVariant: Record<DocumentStatus, BadgeProps["variant"]> = {
  draft: "outline",
  sent: "secondary",
  accepted: "success",
  rejected: "error",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "LKR" }).format(value);
}

export function DocumentsTab({ customerId }: { customerId: string }) {
  const { data: documents = [], isLoading, error } = useCustomerDocuments(customerId);
  const create = useCreateDocument(customerId);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<DocumentType>("quotation");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [items, setItems] = useState<{ description: string; quantity: number; unitPrice: number }[]>([
    { description: "", quantity: 1, unitPrice: 0 },
  ]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data =
      type === "other"
        ? { body: notes }
        : {
            items: items.filter((i) => i.description.trim()),
            notes,
            terms,
          };
    await create.mutateAsync({ type, title, data });
    setOpen(false);
    setTitle("");
    setNotes("");
    setTerms("");
    setItems([{ description: "", quantity: 1, unitPrice: 0 }]);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-error">Failed to load documents.</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Documents</h2>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New document
        </Button>
      </div>

      {documents.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted">
            No documents yet. Create a quotation, invoice, or agreement.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <DocumentCard key={doc.id} document={doc} customerId={customerId} />
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New document</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4 pt-2">
            <div>
              <Label htmlFor="docType">Type</Label>
              <select
                id="docType"
                value={type}
                onChange={(e) => setType(e.target.value as DocumentType)}
                className="mt-1 block w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground"
              >
                {Object.entries(documentTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="docTitle">Title</Label>
              <Input id="docTitle" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>

            {type !== "other" && (
              <>
                <div className="space-y-2">
                  <Label>Line items</Label>
                  {items.map((item, index) => (
                    <div key={index} className="grid gap-2 sm:grid-cols-12">
                      <Input
                        className="sm:col-span-6"
                        placeholder="Description"
                        value={item.description}
                        onChange={(e) => {
                          const next = [...items];
                          next[index].description = e.target.value;
                          setItems(next);
                        }}
                      />
                      <Input
                        className="sm:col-span-2"
                        type="number"
                        min={0}
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => {
                          const next = [...items];
                          next[index].quantity = Number(e.target.value);
                          setItems(next);
                        }}
                      />
                      <Input
                        className="sm:col-span-3"
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="Price"
                        value={item.unitPrice}
                        onChange={(e) => {
                          const next = [...items];
                          next[index].unitPrice = Number(e.target.value);
                          setItems(next);
                        }}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="sm:col-span-1 px-2"
                        onClick={() => setItems(items.filter((_, i) => i !== index))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setItems([...items, { description: "", quantity: 1, unitPrice: 0 }])}
                  >
                    Add item
                  </Button>
                </div>
                <div>
                  <Label htmlFor="terms">Terms</Label>
                  <Textarea id="terms" rows={3} value={terms} onChange={(e) => setTerms(e.target.value)} />
                </div>
              </>
            )}

            <div>
              <Label htmlFor="notes">{type === "other" ? "Body" : "Notes"}</Label>
              <Textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={create.isPending}>
                Create
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DocumentCard({ document, customerId }: { document: Document; customerId: string }) {
  const updateStatus = useUpdateDocumentStatus(document.id, customerId);
  const [isDownloading, setIsDownloading] = useState(false);

  const subtotal =
    document.data?.items?.reduce((sum, item) => sum + (item.quantity ?? 0) * (item.unitPrice ?? 0), 0) ?? 0;

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await downloadDocument(document.id, document.title);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/10 text-secondary">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">{document.title}</CardTitle>
              <p className="text-xs text-muted">
                {documentTypeLabels[document.type]} • {new Date(document.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <Badge variant={statusVariant[document.status]}>{document.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {document.data?.items && document.data.items.length > 0 && (
          <div className="rounded-xl bg-surface-elevated/40 p-3">
            <p className="text-xs font-medium text-muted">Value</p>
            <p className="text-lg font-semibold text-foreground">{formatCurrency(subtotal)}</p>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={handleDownload} isLoading={isDownloading}>
            <Download className="mr-2 h-4 w-4" />
            PDF
          </Button>
          {document.status === "draft" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => updateStatus.mutateAsync({ status: "sent" })}
              isLoading={updateStatus.isPending}
            >
              <Send className="mr-2 h-4 w-4" />
              Mark sent
            </Button>
          )}
          {document.status === "sent" && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => updateStatus.mutateAsync({ status: "accepted" })}
                isLoading={updateStatus.isPending}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => updateStatus.mutateAsync({ status: "rejected" })}
                isLoading={updateStatus.isPending}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
