import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";

export function useAuth() {
  const { data, isLoading, isError, error } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      retry: false,
      refetchOnWindowFocus: false,
    },
  });

  // A 401 is the normal "not signed in" state, not a failure to surface.
  // Anything else (5xx, network/DB error, unparseable response) is a real
  // problem the user should see instead of an endless spinner.
  const status = (error as { status?: number } | null | undefined)?.status;
  const isServerError = isError && status !== 401;

  return {
    user: data ?? null,
    isAuthed: !!data && !isError,
    isLoading,
    isServerError,
  };
}
