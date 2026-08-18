import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export const peopleViews = [
  "all",
  "needs_attention",
  "due_today",
  "overdue",
  "upcoming",
  "recent",
] as const;

export type PeopleView = (typeof peopleViews)[number];

export type PeopleWorkspaceQuery = {
  view: PeopleView;
  search?: string;
  page: number;
  pageSize: number;
  timezone: string;
};

export type PersonListItem = {
  id: string;
  displayName: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  lifecycleStage: string;
  lastInteractionAt: string | null;
  nextFollowUp: { id: string; title: string; dueAt: string } | null;
  nextBooking: { id: string; startAt: string } | null;
};

export type PeopleWorkspaceResponse = {
  items: PersonListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  counts: Record<PeopleView, number>;
};

export function usePeople(query: PeopleWorkspaceQuery) {
  return useQuery<PeopleWorkspaceResponse>({
    queryKey: ["people", query.view, query.search ?? "", query.page, query.pageSize, query.timezone],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({
        view: query.view,
        page: String(query.page),
        pageSize: String(query.pageSize),
        timezone: query.timezone,
      });
      if (query.search) params.set("search", query.search);
      const result = await apiFetch<PeopleWorkspaceResponse>(
        `/v2/customers/people?${params.toString()}`,
        { signal },
      );
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
}
