// import axios from "@/config/axios";
// import {
//   AccountCreateRequestType,
//   AccountUpdateRequestType,
//   AccountResponseType,
//   AccountUpdateProfileRequestType,
//   ChangePasswordRequestType,
// } from "@/schema/account.schema";
// import { ApiResponse, PageResponse } from "@/dtypes/api-response";

// const PREFIX = "accounts";

// class AccountService {
//   async createAccount(data: AccountCreateRequestType) {
//     const response = await axios.post<ApiResponse<AccountResponseType>>(
//       `/${PREFIX}`,
//       data,
//       { isSecure: true }
//     );
//     return response.data;
//   }

//   async updateAccount(id: string, data: AccountUpdateRequestType) {
//     const response = await axios.put<ApiResponse<AccountResponseType>>(
//       `/${PREFIX}/${id}`,
//       data,
//       { isSecure: true }
//     );
//     return response.data;
//   }

//   async updateAccountProfile(
//     id: string,
//     data: AccountUpdateProfileRequestType
//   ) {
//     const response = await axios.put<ApiResponse<AccountResponseType>>(
//       `/${PREFIX}/profile/${id}`,
//       data,
//       { isSecure: true }
//     );
//     return response.data;
//   }

//   async changePasswordAccount(
//     id: string,
//     data: ChangePasswordRequestType
//   ) {
//     const response = await axios.put<ApiResponse<AccountResponseType>>(
//       `/${PREFIX}/profile/${id}/change-password`,
//       data,
//       { isSecure: true }
//     );
//     return response.data;
//   }

//   async getAccountById(id: string) {
//     const response = await axios.get<ApiResponse<AccountResponseType>>(
//       `/${PREFIX}/${id}`,
//       { isSecure: true }
//     );
//     return response.data;
//   }

//   async getAccountsByPage(params?: Record<string, string | number | boolean | Array<string>>) {
//     const response = await axios.get<
//       ApiResponse<PageResponse<AccountResponseType>>
//     >(`/${PREFIX}`, { params, isSecure: true });
//     return response.data.data;
//   }

//   async getCustomerAccountsByPage(params?: Record<string, string | number | boolean>) {
//     const response = await axios.get<
//       ApiResponse<PageResponse<AccountResponseType>>
//     >(`/${PREFIX}/customer/get-all`, { params, isSecure: true });
//     return response.data.data;
//   }

//   async deleteAccount(id: string) {
//     const response = await axios.delete<ApiResponse<null>>(`/${PREFIX}/${id}`, {
//       isSecure: true,
//     });
//     return response.data;
//   }

//   async toggleStatus(id: string) {
//     const response = await axios.put<ApiResponse<AccountResponseType>>(
//       `/${PREFIX}/${id}/toggle-status`,
//       {},
//       { isSecure: true }
//     );
//     return response.data;
//   }
// }

// export const accountService = new AccountService();
