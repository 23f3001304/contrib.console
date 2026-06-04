import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  addRepo,
  getIssues,
  getLabels,
  getPreferences,
  getQueue,
  getRateLimit,
  getRepoCloned,
  getRepoDetail,
  getRepoMap,
  getRepos,
  postQueue,
  removeQueue,
  getReviews,
  getWorkerStatus,
  getMessages,
  putPreferences,
  putRepos,
  requestRepoMap,
  respondReview,
  getSchedule,
  putSchedule,
  runScheduleNow,
  getPulls,
  getPullComments,
  openPullRequest,
  sendCommentToWorker,
} from "./client"
import type { AddRepoInput, EnqueueInput } from "./client"
import type {
  ApprovedRepo,
  IssueFilters,
  Preferences,
  WorkerSchedule,
} from "./types"

export function usePreferences() {
  return useQuery({
    queryKey: ["preferences"],
    queryFn: getPreferences,
  })
}

export function useUpdatePreferences() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (next: Preferences) => putPreferences(next),
    onSuccess: (saved) => {
      qc.setQueryData(["preferences"], saved)
    },
  })
}

export function useSchedule() {
  return useQuery({ queryKey: ["schedule"], queryFn: getSchedule })
}

export function useUpdateSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (next: WorkerSchedule) => putSchedule(next),
    onSuccess: (saved) => qc.setQueryData(["schedule"], saved),
  })
}

export function useRunScheduleNow() {
  return useMutation({ mutationFn: runScheduleNow })
}

export function usePulls(owner?: string, repo?: string) {
  return useQuery({
    queryKey: ["prs", owner, repo],
    queryFn: () => getPulls(owner as string, repo as string),
    enabled: Boolean(owner && repo),
  })
}

export function usePullComments(owner?: string, repo?: string, number?: number) {
  return useQuery({
    queryKey: ["pr-comments", owner, repo, number],
    queryFn: () =>
      getPullComments(owner as string, repo as string, number as number),
    enabled: Boolean(owner && repo && number),
  })
}

export function useOpenPullRequest() {
  return useMutation({ mutationFn: openPullRequest })
}

export function useSendCommentToWorker() {
  return useMutation({ mutationFn: sendCommentToWorker })
}

export function useRepoDetail(owner?: string, repo?: string) {
  return useQuery({
    queryKey: ["repo", owner, repo],
    queryFn: () => getRepoDetail(owner as string, repo as string),
    enabled: Boolean(owner && repo),
    retry: false,
  })
}

export function useRepoCloned(owner?: string, repo?: string) {
  return useQuery({
    queryKey: ["repo-cloned", owner, repo],
    queryFn: () => getRepoCloned(owner as string, repo as string),
    enabled: Boolean(owner && repo),
    retry: false,
    staleTime: 60_000,
  })
}

export function useRepos() {
  return useQuery({
    queryKey: ["repos"],
    queryFn: getRepos,
  })
}

export function useApproveRepos() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (repos: ApprovedRepo[]) => putRepos(repos),
    onSuccess: (saved) => {
      qc.setQueryData(["repos"], saved)
    },
  })
}

export function useAddRepo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AddRepoInput) => addRepo(input),
    onSuccess: (saved) => {
      qc.setQueryData(["repos"], saved)
    },
  })
}

export function useIssues(owner?: string, repo?: string, filters?: IssueFilters) {
  return useQuery({
    queryKey: ["issues", owner, repo, filters],
    queryFn: () =>
      getIssues(owner as string, repo as string, filters as IssueFilters),
    enabled: Boolean(owner && repo && filters),
    retry: false,
    staleTime: 60_000,
  })
}

export function useLabels(owner?: string, repo?: string) {
  return useQuery({
    queryKey: ["labels", owner, repo],
    queryFn: () => getLabels(owner as string, repo as string),
    enabled: Boolean(owner && repo),
    retry: false,
    staleTime: 30 * 60 * 1000,
  })
}

export function useQueue() {
  return useQuery({
    queryKey: ["queue"],
    queryFn: getQueue,
  })
}

export function useRateLimit() {
  return useQuery({
    queryKey: ["rate-limit"],
    queryFn: getRateLimit,
    retry: false,
    refetchInterval: 60_000,
    staleTime: 20_000,
  })
}

export function useReviews() {
  return useQuery({
    queryKey: ["reviews"],
    queryFn: getReviews,
    refetchInterval: 5000,
  })
}

export function useWorkerStatus() {
  return useQuery({
    queryKey: ["worker-status"],
    queryFn: getWorkerStatus,
    refetchInterval: 10_000,
  })
}

export function useMessages() {
  return useQuery({
    queryKey: ["messages"],
    queryFn: getMessages,
    refetchInterval: 5000,
  })
}

export function useRespondReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: respondReview,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reviews"] })
    },
  })
}

export function useEnqueue() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: EnqueueInput) => postQueue(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["queue"] })
    },
  })
}

export function useDequeue() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (taskId: string) => removeQueue(taskId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["queue"] })
    },
  })
}

export function useRepoMap(owner?: string, repo?: string) {
  return useQuery({
    queryKey: ["repo-map", owner, repo],
    queryFn: () => getRepoMap(owner as string, repo as string),
    enabled: Boolean(owner && repo),
    retry: false,
    refetchInterval: (query) => {
      const data = query.state.data
      return data && data.request && !data.map ? 5000 : false
    },
  })
}

export function useRequestRepoMap() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { owner: string; name: string; url?: string }) =>
      requestRepoMap(input),
    onSuccess: (_saved, vars) => {
      qc.invalidateQueries({ queryKey: ["repo-map", vars.owner, vars.name] })
    },
  })
}
