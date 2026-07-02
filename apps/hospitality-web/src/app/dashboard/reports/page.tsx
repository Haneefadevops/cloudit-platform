"use client";

import { useEffect, useState } from "react";
import { Button, Card, CardContent, Input, Select, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge } from "@cloudit/ui";
import { BarChart3, BedDouble, Users, ClipboardList, Wallet, Receipt, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatsCard } from "@/components/stats-card";
import { api } from "@/lib/api";
import { formatDate, formatLkr } from "@/lib/format";
import type {
  Property,
  PaginatedResponse,
  OccupancyReport,
  RevenueReport,
  RevenueManagementReport,
  GuestReport,
  GuestSourceReport,
  ReservationReport,
  TaxSummaryReport,
  TdlReport,
  ReportType,
} from "@/lib/types";

const reportTabs: { value: ReportType; label: string; icon: React.ReactNode }[] = [
  { value: "occupancy", label: "Occupancy", icon: <BedDouble className="h-4 w-4" /> },
  { value: "revenue", label: "Revenue", icon: <Wallet className="h-4 w-4" /> },
  { value: "revenue-management", label: "Revenue Mgmt", icon: <TrendingUp className="h-4 w-4" /> },
  { value: "guests", label: "Guests", icon: <Users className="h-4 w-4" /> },
  { value: "guest-sources", label: "Sources", icon: <Users className="h-4 w-4" /> },
  { value: "reservations", label: "Reservations", icon: <ClipboardList className="h-4 w-4" /> },
  { value: "tax-summary", label: "Tax Summary", icon: <Receipt className="h-4 w-4" /> },
  { value: "tdl", label: "TDL", icon: <BarChart3 className="h-4 w-4" /> },
];

function getDefaultDateRange() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  return {
    startDate: start.toISOString().split("T")[0],
    endDate: today.toISOString().split("T")[0],
  };
}

export default function ReportsPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState<string>("");
  const [dateRange, setDateRange] = useState(getDefaultDateRange());
  const [activeTab, setActiveTab] = useState<ReportType>("occupancy");
  const [isLoading, setIsLoading] = useState(false);

  const [occupancy, setOccupancy] = useState<OccupancyReport | null>(null);
  const [revenue, setRevenue] = useState<RevenueReport | null>(null);
  const [revenueManagement, setRevenueManagement] = useState<RevenueManagementReport | null>(null);
  const [guests, setGuests] = useState<GuestReport | null>(null);
  const [guestSources, setGuestSources] = useState<GuestSourceReport | null>(null);
  const [reservations, setReservations] = useState<ReservationReport | null>(null);
  const [taxSummary, setTaxSummary] = useState<TaxSummaryReport | null>(null);
  const [tdl, setTdl] = useState<TdlReport | null>(null);

  useEffect(() => {
    loadProperties();
  }, []);

  useEffect(() => {
    if (propertyId) {
      loadReport(activeTab);
    }
  }, [activeTab, propertyId, dateRange.startDate, dateRange.endDate]);

  async function loadProperties() {
    try {
      const res = await api.get<PaginatedResponse<Property>>("/properties?limit=100");
      setProperties(res.data);
      if (res.data.length > 0 && !propertyId) {
        setPropertyId(res.data[0].id);
      }
    } catch (error) {
      console.error(error);
    }
  }

  async function loadReport(type: ReportType) {
    if (!propertyId) return;
    try {
      setIsLoading(true);
      const url = `/reports/${type}?propertyId=${propertyId}&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`;
      const data = await api.get<
        | OccupancyReport
        | RevenueReport
        | RevenueManagementReport
        | GuestReport
        | GuestSourceReport
        | ReservationReport
        | TaxSummaryReport
        | TdlReport
      >(url);
      switch (type) {
        case "occupancy":
          setOccupancy(data as OccupancyReport);
          break;
        case "revenue":
          setRevenue(data as RevenueReport);
          break;
        case "revenue-management":
          setRevenueManagement(data as RevenueManagementReport);
          break;
        case "guests":
          setGuests(data as GuestReport);
          break;
        case "guest-sources":
          setGuestSources(data as GuestSourceReport);
          break;
        case "reservations":
          setReservations(data as ReservationReport);
          break;
        case "tax-summary":
          setTaxSummary(data as TaxSummaryReport);
          break;
        case "tdl":
          setTdl(data as TdlReport);
          break;
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  const propertyOptions = [
    { value: "", label: "Select property" },
    ...properties.map((p) => ({ value: p.id, label: p.name })),
  ];

  const statusBadgeVariant: Record<string, string> = {
    pending: "secondary",
    confirmed: "default",
    checked_in: "default",
    checked_out: "secondary",
    cancelled: "destructive",
    no_show: "outline",
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Hospitality performance reports">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="date"
            value={dateRange.startDate}
            onChange={(e) => setDateRange((prev) => ({ ...prev, startDate: e.target.value }))}
          />
          <Input
            type="date"
            value={dateRange.endDate}
            onChange={(e) => setDateRange((prev) => ({ ...prev, endDate: e.target.value }))}
          />
          <Select
            options={propertyOptions}
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            className="min-w-[180px]"
          />
        </div>
      </PageHeader>

      <div className="flex flex-wrap gap-2">
        {reportTabs.map((tab) => (
          <Button
            key={tab.value}
            variant={activeTab === tab.value ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab(tab.value)}
          >
            {tab.icon}
            <span className="ml-2">{tab.label}</span>
          </Button>
        ))}
      </div>

      {!propertyId ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Please select a property to view reports.
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Loading report...
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {activeTab === "occupancy" && occupancy && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatsCard title="Total Rooms" value={occupancy.summary.totalRooms} />
                <StatsCard title="Avg Occupied" value={occupancy.summary.occupiedRooms} />
                <StatsCard title="Occupancy Rate" value={`${occupancy.summary.occupancyRate}%`} />
                <StatsCard
                  title="Revenue"
                  value={formatLkr(occupancy.summary.revenue)}
                />
              </div>
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Occupied Rooms</TableHead>
                          <TableHead>Revenue</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {occupancy.byDate.map((day) => (
                          <TableRow key={day.date}>
                            <TableCell>{formatDate(day.date)}</TableCell>
                            <TableCell>{day.occupiedRooms}</TableCell>
                            <TableCell>{formatLkr(day.revenue)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {activeTab === "revenue" && revenue && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatsCard
                  title="Total Revenue"
                  value={formatLkr(revenue.summary.totalRevenue)}
                />
                <StatsCard
                  title="Subtotal"
                  value={formatLkr(revenue.summary.totalSubtotal)}
                />
                <StatsCard
                  title="Total Paid"
                  value={formatLkr(revenue.summary.totalPaid)}
                />
                <StatsCard
                  title="Outstanding"
                  value={formatLkr(revenue.summary.outstanding)}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardContent className="p-4">
                    <h3 className="mb-3 text-sm font-medium">Tax Breakdown</h3>
                    {revenue.taxBreakdown.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No tax data</p>
                    ) : (
                      <div className="space-y-2">
                        {revenue.taxBreakdown.map((tax) => (
                          <div key={tax.name} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                              {tax.name} ({tax.rate}%)
                            </span>
                            <span>{formatLkr(tax.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <h3 className="mb-3 text-sm font-medium">Revenue by Room Type</h3>
                    {revenue.byRoomType.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No room type data</p>
                    ) : (
                      <div className="space-y-2">
                        {revenue.byRoomType.map((item) => (
                          <div key={item.name} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{item.name}</span>
                            <span>{formatLkr(item.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardContent className="p-4">
                  <h3 className="mb-3 text-sm font-medium">Revenue by Invoice Status</h3>
                  <div className="flex flex-wrap gap-2">
                    {revenue.byStatus.map((item) => (
                      <Badge key={item.status} variant={statusBadgeVariant[item.status] as any || "secondary"}>
                        {item.status}: {formatLkr(item.amount)}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {activeTab === "revenue-management" && revenueManagement && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatsCard
                  title="Occupancy"
                  value={`${revenueManagement.summary.occupancyRate}%`}
                />
                <StatsCard title="ADR" value={formatLkr(revenueManagement.summary.adr)} />
                <StatsCard title="RevPAR" value={formatLkr(revenueManagement.summary.revPar)} />
                <StatsCard title="Pickup" value={revenueManagement.summary.pickup} />
              </div>

              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Room Type</TableHead>
                          <TableHead>Rooms</TableHead>
                          <TableHead>Occupancy</TableHead>
                          <TableHead>Current Rate</TableHead>
                          <TableHead>Suggested Rate</TableHead>
                          <TableHead>Change</TableHead>
                          <TableHead>Recommendation</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {revenueManagement.byRoomType.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground">
                              No room type data for this period
                            </TableCell>
                          </TableRow>
                        ) : (
                          revenueManagement.byRoomType.map((roomType) => (
                            <TableRow key={roomType.roomTypeId}>
                              <TableCell className="font-medium">{roomType.name}</TableCell>
                              <TableCell>{roomType.rooms}</TableCell>
                              <TableCell>{roomType.occupancyRate}%</TableCell>
                              <TableCell>{formatLkr(roomType.currentRate)}</TableCell>
                              <TableCell>{formatLkr(roomType.suggestedRate)}</TableCell>
                              <TableCell>
                                <Badge variant={roomType.rateChange > 0 ? "default" : roomType.rateChange < 0 ? "destructive" : "secondary"}>
                                  {roomType.rateChange > 0 ? "+" : ""}
                                  {formatLkr(roomType.rateChange)}
                                </Badge>
                              </TableCell>
                              <TableCell className="min-w-[16rem] text-sm text-muted-foreground">
                                {roomType.recommendation}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {activeTab === "guests" && guests && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatsCard title="Total Guests" value={guests.summary.totalGuests} />
                <StatsCard title="Unique Guests" value={guests.summary.uniqueGuests} />
                <StatsCard title="New Guests" value={guests.summary.newGuests} />
                <StatsCard title="Returning Guests" value={guests.summary.returningGuests} />
              </div>
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nationality</TableHead>
                          <TableHead>Guest Count</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {guests.topNationalities.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={2} className="text-center text-muted-foreground">
                              No nationality data
                            </TableCell>
                          </TableRow>
                        ) : (
                          guests.topNationalities.map((item) => (
                            <TableRow key={item.nationality}>
                              <TableCell>{item.nationality}</TableCell>
                              <TableCell>{item.count}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {activeTab === "reservations" && reservations && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatsCard title="Total Reservations" value={reservations.summary.totalReservations} />
                <StatsCard
                  title="Total Revenue"
                  value={formatLkr(reservations.summary.totalRevenue)}
                />
                <StatsCard
                  title="Cancellation Rate"
                  value={`${reservations.summary.cancellationRate}%`}
                />
                <StatsCard title="No-show Rate" value={`${reservations.summary.noShowRate}%`} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardContent className="p-4">
                    <h3 className="mb-3 text-sm font-medium">Reservations by Status</h3>
                    <div className="flex flex-wrap gap-2">
                      {reservations.byStatus.map((item) => (
                        <Badge
                          key={item.status}
                          variant={statusBadgeVariant[item.status] as any || "secondary"}
                        >
                          {item.status.replace("_", " ")}: {item.count}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <h3 className="mb-3 text-sm font-medium">Reservations by Source</h3>
                    <div className="flex flex-wrap gap-2">
                      {reservations.bySource.map((item) => (
                        <Badge key={item.source} variant="outline">
                          {item.source.replace("_", " ")}: {item.count}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          {activeTab === "guest-sources" && guestSources && (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <StatsCard
                  title="Reservations"
                  value={guestSources.summary.totalReservations}
                />
                <StatsCard
                  title="Top Source"
                  value={guestSources.bySource[0]?.source?.replace("_", " ") || "-"}
                />
                <StatsCard
                  title="Top Source Share"
                  value={`${guestSources.bySource[0]?.share ?? 0}%`}
                />
              </div>
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Source</TableHead>
                          <TableHead>Reservations</TableHead>
                          <TableHead>Share</TableHead>
                          <TableHead>Revenue</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {guestSources.bySource.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground">
                              No source data
                            </TableCell>
                          </TableRow>
                        ) : (
                          guestSources.bySource.map((item) => (
                            <TableRow key={item.source}>
                              <TableCell className="font-medium">
                                {item.source.replace("_", " ")}
                              </TableCell>
                              <TableCell>{item.count}</TableCell>
                              <TableCell>{item.share}%</TableCell>
                              <TableCell>{formatLkr(item.revenue)}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {activeTab === "tax-summary" && taxSummary && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <StatsCard title="Invoices" value={taxSummary.summary.invoiceCount} />
                <StatsCard title="Total Tax" value={formatLkr(taxSummary.summary.totalTax)} />
              </div>
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tax</TableHead>
                          <TableHead>Rate</TableHead>
                          <TableHead>Taxable Base</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Invoices</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {taxSummary.byTax.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground">
                              No tax data
                            </TableCell>
                          </TableRow>
                        ) : (
                          taxSummary.byTax.map((tax) => (
                            <TableRow key={tax.name}>
                              <TableCell className="font-medium">{tax.name}</TableCell>
                              <TableCell>{tax.rate}%</TableCell>
                              <TableCell>{formatLkr(tax.taxableBase)}</TableCell>
                              <TableCell>{formatLkr(tax.amount)}</TableCell>
                              <TableCell>{tax.invoiceCount}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {activeTab === "tdl" && tdl && (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <StatsCard title="Invoices" value={tdl.summary.invoiceCount} />
                <StatsCard
                  title="Taxable Revenue"
                  value={formatLkr(tdl.summary.taxableRevenue)}
                />
                <StatsCard title="TDL Payable" value={formatLkr(tdl.summary.tdlAmount)} />
              </div>

              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invoice</TableHead>
                          <TableHead>Issue Date</TableHead>
                          <TableHead>Taxable Revenue</TableHead>
                          <TableHead>TDL Rate</TableHead>
                          <TableHead>TDL Amount</TableHead>
                          <TableHead>Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tdl.byInvoice.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground">
                              No TDL data for this period
                            </TableCell>
                          </TableRow>
                        ) : (
                          tdl.byInvoice.map((invoice) => (
                            <TableRow key={invoice.invoiceNumber}>
                              <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                              <TableCell>{formatDate(invoice.issueDate)}</TableCell>
                              <TableCell>{formatLkr(invoice.taxableRevenue)}</TableCell>
                              <TableCell>{invoice.tdlRate}%</TableCell>
                              <TableCell>{formatLkr(invoice.tdlAmount)}</TableCell>
                              <TableCell>{formatLkr(invoice.totalAmount)}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
}
