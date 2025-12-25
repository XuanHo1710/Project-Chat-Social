import { QUERY_KEYS } from "@/constants/query-keys";
import { accountService } from "@/services/account.service";
import { AccountCardFriendType } from "@/types/account";
import { PageResponse } from "@/types/common";
import { useQuery } from "@tanstack/react-query";

interface AccountFilterParams {
  page?: number;
  size?: number;
  sort?: string;
  search?: string;
  active?: boolean;
}

// All accounts to test add Friends
export function useAccountsByPage(
  userId: string,
  params: AccountFilterParams = {}
) {
  const { page = 1, size = 12, sort, search } = params;
  const queryParams: Record<string, string | number | boolean> = { page, size };
  //   if (sort) queryParams.sort = sort;
  //   else queryParams.sort = "createdAt,desc";

  if (search) queryParams.search = search;

  return useQuery<PageResponse<AccountCardFriendType>, Error>({
    queryKey: [QUERY_KEYS.ACCOUNTS_PAGINATED, page, size, sort, search, userId],
    queryFn: () => accountService.getAccountsByPage(queryParams),
  });
}

// export function useCustomerAccountsByPage(params: AccountFilterParams = {}) {
//   const { page = 0, size = 12, sort, search, active, membership } = params;
//   const queryParams: Record<string, string | number | boolean> = { page, size };
//   if (sort) queryParams.sort = sort;
//   else queryParams.sort = "createdAt,desc";

//   if (search) queryParams.search = search;
//   if (active !== undefined) queryParams.active = active;

//   if (membership) queryParams.membership = membership;

//   return useQuery<PageResponse<AccountResponseType>, Error>({
//     queryKey: [
//       QUERY_KEYS.CUSTOMER_ACCOUNTS_PAGINATED,
//       page,
//       size,
//       sort,
//       search,
//       active,
//       membership
//     ],
//     queryFn: () => accountService.getCustomerAccountsByPage(queryParams),
//   });
// }

// export function useAccountById(id: string) {
//   return useQuery({
//     queryKey: [QUERY_KEYS.ACCOUNT_BY_ID, id],
//     queryFn: () => accountService.getAccountById(id),
//     enabled: !!id,
//   });
// }

// export function useAddAccountMutation() {
//   const queryClient = useQueryClient();
//   return useMutation({
//     mutationFn: (data: AccountCreateRequestType) =>
//       accountService.createAccount(data),
//     onSuccess: () => {
//       queryClient.invalidateQueries({
//         queryKey: [QUERY_KEYS.ACCOUNTS_PAGINATED],
//       });
//     },
//   });
// }

// export function useUpdateAccountMutation() {
//   const queryClient = useQueryClient();
//   return useMutation({
//     mutationFn: ({
//       id,
//       data,
//     }: {
//       id: string;
//       data: AccountUpdateRequestType;
//     }) => accountService.updateAccount(id, data),
//     onSuccess: () => {
//       queryClient.invalidateQueries({
//         queryKey: [QUERY_KEYS.ACCOUNTS_PAGINATED],
//       });
//       queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ACCOUNT_BY_ID] });
//     },
//   });
// }

// export function useUpdateAccountProfileMutation() {
//   const queryClient = useQueryClient();
//   return useMutation({
//     mutationFn: ({
//       id,
//       data,
//     }: {
//       id: string;
//       data: AccountUpdateProfileRequestType;
//     }) => accountService.updateAccountProfile(id, data),
//     onSuccess: () => {
//       queryClient.invalidateQueries({
//         queryKey: [QUERY_KEYS.ACCOUNTS_PAGINATED],
//       });
//       queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ACCOUNT_BY_ID] });
//     },
//   });
// }

// export function useChangePasswordAccountMutation() {
//   const queryClient = useQueryClient();
//   return useMutation({
//     mutationFn: ({
//       id,
//       data,
//     }: {
//       id: string;
//       data: ChangePasswordRequestType;
//     }) => accountService.changePasswordAccount(id, data),
//     onSuccess: () => {
//       queryClient.invalidateQueries({
//         queryKey: [QUERY_KEYS.ACCOUNTS_PAGINATED],
//       });
//       queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ACCOUNT_BY_ID] });
//     },
//   });
// }

// export function useDeleteAccountMutation() {
//   const queryClient = useQueryClient();
//   return useMutation({
//     mutationFn: (id: string) => accountService.deleteAccount(id),
//     onSuccess: () => {
//       queryClient.invalidateQueries({
//         queryKey: [QUERY_KEYS.ACCOUNTS_PAGINATED],
//       });
//     },
//   });
// }

// export function useChangeAccountStatusMutation() {
//   const queryClient = useQueryClient();
//   return useMutation({
//     mutationFn: (id: string) => accountService.toggleStatus(id),
//     onSuccess: () => {
//       queryClient.invalidateQueries({
//         queryKey: [QUERY_KEYS.ACCOUNTS_PAGINATED],
//       });
//     },
//   });
// }
