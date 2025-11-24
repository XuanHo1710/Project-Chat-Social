// import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
// import { accountService } from "@/services/admin/account.service";
// import {
//   AccountCreateRequestType,
//   AccountUpdateRequestType,
//   AccountResponseType,
//   AccountUpdateProfileRequestType,
//   ChangePasswordRequestType,
// } from "@/schema/account.schema";
// import { PageResponse } from "@/dtypes/api-response";

// export const QUERY_KEYS = {
//   CUSTOMER_ACCOUNTS_PAGINATED: "customer-accounts-paginated",
//   ACCOUNTS_PAGINATED: "accounts-paginated",
//   ACCOUNT_BY_ID: "account-by-id",
// };

// interface AccountFilterParams {
//   page?: number;
//   size?: number;
//   sort?: string;
//   search?: string;
//   active?: boolean;
//   roleIds?: string;
//   membership?: string;
// }

// export function useAccountsByPage(params: AccountFilterParams = {}) {
//   const { page = 0, size = 12, sort, search, active, roleIds } = params;
//   const queryParams: Record<string, string | number | boolean> = { page, size };
//   if (sort) queryParams.sort = sort;
//   else queryParams.sort = "createdAt,desc";

//   if (search) queryParams.search = search;
//   if (active !== undefined) queryParams.active = active;
//   if (roleIds) queryParams.roleIds = roleIds;

//   return useQuery<PageResponse<AccountResponseType>, Error>({
//     queryKey: [
//       QUERY_KEYS.ACCOUNTS_PAGINATED,
//       page,
//       size,
//       sort,
//       search,
//       active,
//       roleIds,
//     ],
//     queryFn: () => accountService.getAccountsByPage(queryParams),
//   });
// }


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
