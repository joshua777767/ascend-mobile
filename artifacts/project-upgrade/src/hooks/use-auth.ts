import { useGetMe } from "@workspace/api-client-react";

export function useAuth() {
  const { data, isLoading, isError } = useGetMe();
  return {
    user: data ?? null,
    isAuthed: !!data && !isError,
    isLoading,
  };
}
