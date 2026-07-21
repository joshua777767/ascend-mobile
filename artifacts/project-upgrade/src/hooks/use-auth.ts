import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";

export function useAuth() {
  const { data, isLoading, isError, error } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      retry: false,
      // Re-check auth state when the user brings the app to the foreground.
      // WKWebView fires visibilitychange which React Query treats as a focus
      // event, so this reliably fires on app resume.
      refetchOnWindowFocus: true,
      // Consider auth data fresh for 5 minutes so foregrounding doesn't
      // cause a visible loading flash during normal uninterrupted use.
      staleTime: 5 * 60 * 1000,
      // Silently call /api/auth/me every 10 minutes while the app is open.
      // Combined with rolling:true on the server, each call re-issues a
      // Set-Cookie with a fresh 30-day Expires, keeping the session alive
      // even when the user is idle on the dashboard.
      refetchInterval: 10 * 60 * 1000,
      refetchIntervalInBackground: false,
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
