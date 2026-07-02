import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useDirectory } from "@/hooks/useAccounts";
import { Search, Briefcase } from "lucide-react";

export function DirectoryPage() {
  const [search, setSearch] = useState("");
  const [industry, setIndustry] = useState("");
  const { data: accounts = [], isLoading, error } = useDirectory(search, industry);

  return (
    <div className="min-h-screen bg-surface p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold text-primary">B2B Directory</h1>
        <p className="text-muted">Discover and connect with other businesses.</p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              className="pl-9"
              placeholder="Search by name or industry"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Input
            placeholder="Filter industry"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="sm:w-56"
          />
          <Button onClick={() => { setSearch(""); setIndustry(""); }}>
            Clear
          </Button>
        </div>

        {isLoading ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-3xl" />
            ))}
          </div>
        ) : error ? (
          <Card className="mt-6">
            <CardContent className="p-6 text-center text-error">
              Failed to load directory. Make sure you are logged in with a Pro Business plan.
            </CardContent>
          </Card>
        ) : accounts.length === 0 ? (
          <Card className="mt-6">
            <CardContent className="p-6 text-center text-muted">
              No public business accounts found.
            </CardContent>
          </Card>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {accounts.map((account) => (
              <Link
                key={account.id}
                to={`/a/${account.slug}`}
                data-testid={`directory-account-${account.slug}`}
              >
                <Card className="h-full transition-colors hover:border-secondary/50 hover:bg-surface-elevated/40">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/10 text-secondary">
                          <Briefcase className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{account.name}</CardTitle>
                          <p className="text-xs text-muted">{account.industry ?? "Business"}</p>
                        </div>
                      </div>
                      <Badge variant="outline">{account.lifecycleStage}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {account.website && (
                      <p className="text-xs text-secondary hover:underline">{account.website}</p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
