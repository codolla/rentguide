const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api";

type ApiOptions = RequestInit & {
  token?: string | null;
};

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "ApiError";
  }
}

async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");

  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let message = `Request failed with ${response.status}`;

    try {
      const error = await response.json();
      if (typeof error?.message === "string") {
        message = error.message;
      }
    } catch {
      // Keep the generic message when the response is not JSON.
    }

    throw new ApiError(message, response.status);
  }

  return response.json() as Promise<T>;
}

export interface ApiHostel {
  id: number;
  name: string;
  location: string;
  distance: string;
  price: number;
  rating: number;
  reviews_count: number;
  verified: boolean;
  facilities: string[] | null;
  image: string | null;
  type: string;
  available: boolean;
  description: string | null;
  status?: string | null;
  admin_notes?: string | null;
  rejection_reason?: string | null;
  reviewed_at?: string | null;
  landlord?: {
    id: number;
    name: string;
    business_name?: string | null;
    phone?: string | null;
  } | null;
  reviews?: ApiReview[];
  current_rental?: {
    id: number;
    reference: string;
    rent_amount: string;
    status: string;
    rented_at: string;
    student?: { id: number; name: string; email: string; phone?: string | null } | null;
  } | null;
}

export interface ApiMessage {
  id: number;
  sender_id: number;
  receiver_id: number;
  hostel_id: number | null;
  body: string;
  created_at: string;
  sender?: { id: number; name: string } | null;
  receiver?: { id: number; name: string } | null;
  hostel?: { id: number; name: string } | null;
}

export interface ApiReview {
  id: number;
  hostel_id: number | null;
  rating: number;
  comment: string;
  status?: string;
  created_at: string;
  user?: {
    id: number;
    name: string;
  } | null;
  hostel?: {
    id: number;
    name: string;
  } | null;
}

export interface ApiUser {
  id: number;
  name: string;
  email: string;
  role: "student" | "landlord" | "admin";
  phone?: string | null;
  student_id?: string | null;
  programme?: string | null;
  business_name?: string | null;
  profile_photo?: string | null;
  status?: string | null;
}

export interface ApiNotification {
  id: number;
  type: string;
  title: string;
  body: string | null;
  action_url: string | null;
  read_at: string | null;
  created_at: string;
}

export interface AccountsData {
  commission_percentage: number;
  statistics: { transactions: number; total_rent: number; system_total: number; landlords_total: number; rented_hostels: number };
  transactions: Array<{ id: number; reference: string; rent_amount: string; commission_percentage: string; system_fee: string; landlord_amount: string; status: string; rented_at: string; hostel: { id: number; name: string; location: string }; student: { id: number; name: string; email: string }; landlord: { id: number; name: string; business_name?: string | null } }>;
  hostels: Array<{ id: number; landlord_id: number; name: string; location: string; price: number; landlord?: { id: number; name: string; business_name?: string | null } }>;
  students: Array<{ id: number; name: string; email: string }>;
}

interface Paginated<T> {
  data: T[];
  total?: number;
}

export interface ApiReport {
  id: number;
  reporter_id: number;
  hostel_id: number;
  reason: string;
  severity: string;
  status: string;
  created_at: string;
  reporter?: { id: number; name: string } | null;
  hostel?: { id: number; name: string } | null;
}

export interface ApiVerification {
  id: number;
  landlord_id: number;
  hostel_id: number | null;
  type: string;
  status: string;
  document_path?: string | null;
  notes?: string | null;
  admin_notes?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  landlord?: { id: number; name: string; business_name?: string | null } | null;
  hostel?: { id: number; name: string } | null;
}

export interface AdminDashboardData {
  students: number;
  landlords: number;
  listings: number;
  verified_listings: number;
  open_reports: number;
  pending_verifications: number;
  pending_listings: number;
  recent_reports: ApiReport[];
  recent_verifications: ApiVerification[];
  recent_listings: ApiHostel[];
}

export interface AdminSettingsData {
  rules: boolean[];
  defaults: {
    currency: string;
    radius: string;
    sla: string;
    support: string;
  };
}

export interface LandlordDashboardData {
  landlord: ApiUser;
  total_listings: number;
  active_rooms: number;
  student_inquiries: number;
  average_rating: number;
  verified_listings: number;
  pending_listings: number;
  rejected_listings: number;
  listings: ApiHostel[];
  recent_messages: ApiMessage[];
  verification_requests: ApiVerification[];
}

export interface StudentDashboardData {
  user: ApiUser;
  saved_count: number;
  new_listings: number;
  unread_messages: number;
  recommended_count: number;
  recommended: ApiHostel[];
  saved_listings: ApiHostel[];
  recent_messages: ApiMessage[];
}

function getStoredToken() {
  return localStorage.getItem("srg_auth_token");
}

export const api = {
  async getConfig() {
    return apiRequest<{ google_client_id?: string | null }>("/config");
  },

  async getListings(): Promise<ApiHostel[]> {
    const result = await apiRequest<Paginated<ApiHostel> | ApiHostel[]>("/listings");
    return Array.isArray(result) ? result : result.data;
  },

  async getListing(id: number): Promise<ApiHostel> {
    return apiRequest<ApiHostel>(`/listings/${id}`);
  },

  async getAdminListing(id: number): Promise<ApiHostel> {
    return apiRequest<ApiHostel>(`/admin/listings/${id}`, {
      token: getStoredToken(),
    });
  },

  async getSavedListings(): Promise<ApiHostel[]> {
    return apiRequest<ApiHostel[]>("/saved-listings", {
      token: getStoredToken(),
    });
  },

  async getStudentDashboard() {
    return apiRequest<StudentDashboardData>("/student/dashboard", {
      token: getStoredToken(),
    });
  },

  async saveListing(id: number) {
    return apiRequest<{ message: string }>(`/listings/${id}/save`, {
      method: "POST",
      token: getStoredToken(),
    });
  },

  async removeSavedListing(id: number) {
    return apiRequest<{ message: string }>(`/listings/${id}/save`, {
      method: "DELETE",
      token: getStoredToken(),
    });
  },

  async reportListing(id: number, input: { reason: string; severity?: "low" | "medium" | "high" }) {
    return apiRequest<ApiReport>(`/listings/${id}/report`, {
      method: "POST",
      token: getStoredToken(),
      body: JSON.stringify(input),
    });
  },

  async getStudentReports() { return apiRequest<ApiReport[]>("/student/reports", { token: getStoredToken() }); },
  async createStudentReport(input: { hostel_id?: number; reason: string; severity: "low" | "medium" | "high" }) {
    return apiRequest<ApiReport>("/student/reports", { method: "POST", token: getStoredToken(), body: JSON.stringify(input) });
  },

  async login(input: { email: string; password: string; role: "student" | "landlord" | "admin" }) {
    return apiRequest<{ token: string; user: unknown }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async loginWithGoogle(input: { access_token: string; role: "student" | "landlord" | "admin" }) {
    return apiRequest<{ token: string; user: ApiUser }>("/auth/google", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async register(input: {
    name: string;
    email: string;
    password: string;
    role: "student" | "landlord";
    phone?: string;
    student_id?: string;
    business_name?: string;
  }) {
    return apiRequest<{ token: string; user: unknown }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async forgotPassword(input: { email: string }) {
    return apiRequest<{ message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async resetPassword(input: {
    email: string;
    token: string;
    password: string;
    password_confirmation: string;
  }) {
    return apiRequest<{ message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async me() {
    return apiRequest<ApiUser>("/me", {
      token: getStoredToken(),
    });
  },

  async updateProfile(input: {
    name: string;
    email: string;
    phone?: string;
    student_id?: string;
    programme?: string;
    business_name?: string;
    profile_photo_file?: File | null;
  }) {
    const body = new FormData();
    body.set("_method", "PUT");
    Object.entries(input).forEach(([key, value]) => {
      if (value !== undefined && value !== null) body.set(key, value instanceof File ? value : String(value));
    });
    return apiRequest<{ user: ApiUser }>("/profile", {
      method: "POST",
      token: getStoredToken(),
      body,
    });
  },

  async updatePassword(input: {
    current_password: string;
    password: string;
    password_confirmation: string;
  }) {
    return apiRequest<{ message: string }>("/password", {
      method: "PUT",
      token: getStoredToken(),
      body: JSON.stringify(input),
    });
  },

  async getNotifications(): Promise<ApiNotification[]> {
    return apiRequest<ApiNotification[]>("/notifications", {
      token: getStoredToken(),
    });
  },

  async markNotificationRead(id: number) {
    return apiRequest<ApiNotification>(`/notifications/${id}/read`, {
      method: "PUT",
      token: getStoredToken(),
    });
  },

  async markAllNotificationsRead() {
    return apiRequest<{ message: string }>("/notifications/read-all", {
      method: "PUT",
      token: getStoredToken(),
    });
  },

  async getMessages(): Promise<ApiMessage[]> {
    return apiRequest<ApiMessage[]>("/messages", {
      token: getStoredToken(),
    });
  },

  async sendMessage(input: { receiver_id: number; hostel_id?: number; body: string }) {
    return apiRequest<ApiMessage>("/messages", {
      method: "POST",
      token: getStoredToken(),
      body: JSON.stringify(input),
    });
  },

  async getReviews(): Promise<ApiReview[]> {
    return apiRequest<ApiReview[]>("/reviews");
  },

  async getMyReviews(): Promise<ApiReview[]> {
    return apiRequest<ApiReview[]>("/my-reviews", {
      token: getStoredToken(),
    });
  },

  async createReview(input: { hostel_id: number; rating: number; comment: string }) {
    return apiRequest<ApiReview>("/reviews", {
      method: "POST",
      token: getStoredToken(),
      body: JSON.stringify(input),
    });
  },

  async updateReview(id: number, input: { rating: number; comment: string }) {
    return apiRequest<ApiReview>(`/reviews/${id}`, {
      method: "PUT",
      token: getStoredToken(),
      body: JSON.stringify(input),
    });
  },

  async deleteReview(id: number) {
    return apiRequest<{ message: string }>(`/reviews/${id}`, {
      method: "DELETE",
      token: getStoredToken(),
    });
  },

  async getLandlordListings(): Promise<ApiHostel[]> {
    return apiRequest<ApiHostel[]>("/landlord/listings", {
      token: getStoredToken(),
    });
  },

  async getLandlordDashboard() {
    return apiRequest<LandlordDashboardData>("/landlord/dashboard", {
      token: getStoredToken(),
    });
  },

  async getLandlordMessages() {
    return apiRequest<ApiMessage[]>("/landlord/messages", {
      token: getStoredToken(),
    });
  },

  async getLandlordReviews() {
    return apiRequest<ApiReview[]>("/landlord/reviews", {
      token: getStoredToken(),
    });
  },

  async getLandlordVerifications() {
    return apiRequest<ApiVerification[]>("/landlord/verifications", {
      token: getStoredToken(),
    });
  },

  async createLandlordListing(input: {
    name: string;
    location: string;
    distance: string;
    price: number;
    type: string;
    description?: string;
    facilities?: string[];
    image?: string;
    image_file?: File | null;
  }) {
    const body = new FormData();
    body.set("name", input.name);
    body.set("location", input.location);
    body.set("distance", input.distance);
    body.set("price", String(input.price));
    body.set("type", input.type);
    if (input.description) body.set("description", input.description);
    if (input.image) body.set("image", input.image);
    if (input.image_file) body.set("image_file", input.image_file);
    input.facilities?.forEach((facility) => body.append("facilities[]", facility));

    return apiRequest<ApiHostel>("/landlord/listings", {
      method: "POST",
      token: getStoredToken(),
      body,
    });
  },

  async updateLandlordListing(id: number, input: Partial<{
    name: string;
    location: string;
    distance: string;
    price: number;
    type: string;
    description: string;
    facilities: string[];
    image: string;
    image_file: File;
    available: boolean;
  }>) {
    const hasFile = input.image_file instanceof File;
    const body = hasFile ? new FormData() : JSON.stringify(input);
    const method = hasFile ? "POST" : "PUT";

    if (hasFile && body instanceof FormData) {
      body.set("_method", "PUT");
      Object.entries(input).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        if (key === "facilities" && Array.isArray(value)) {
          value.forEach((facility) => body.append("facilities[]", facility));
        } else if (key === "image_file" && value instanceof File) {
          body.set("image_file", value);
        } else {
          body.set(key, String(value));
        }
      });
    }

    return apiRequest<ApiHostel>(`/landlord/listings/${id}`, {
      method,
      token: getStoredToken(),
      body,
    });
  },

  async submitLandlordVerification(input: {
    hostel_id?: number;
    type: string;
    document_path?: string;
    document_file?: File | null;
    notes?: string;
  }) {
    const hasFile = input.document_file instanceof File;
    const body = hasFile ? new FormData() : JSON.stringify(input);

    if (hasFile && body instanceof FormData) {
      body.set("type", input.type);
      if (input.hostel_id) body.set("hostel_id", String(input.hostel_id));
      if (input.document_path) body.set("document_path", input.document_path);
      if (input.document_file) body.set("document_file", input.document_file);
      if (input.notes) body.set("notes", input.notes);
    }

    return apiRequest<ApiVerification>("/landlord/verification", {
      method: "POST",
      token: getStoredToken(),
      body,
    });
  },

  async getAdminDashboard() {
    return apiRequest<AdminDashboardData>("/admin/dashboard", {
      token: getStoredToken(),
    });
  },

  async getAdminAccounts() {
    return apiRequest<AccountsData>("/admin/accounts", { token: getStoredToken() });
  },

  async updateRentCommission(percentage: number) {
    return apiRequest<{ commission_percentage: number }>("/admin/accounts/commission", { method: "PUT", token: getStoredToken(), body: JSON.stringify({ percentage }) });
  },

  async createRentTransaction(input: { hostel_id: number; student_id: number; rent_amount: number; rented_at?: string }) {
    return apiRequest<AccountsData["transactions"][number]>("/admin/accounts/transactions", { method: "POST", token: getStoredToken(), body: JSON.stringify(input) });
  },

  async getAdminSettings() {
    return apiRequest<AdminSettingsData>("/admin/settings", {
      token: getStoredToken(),
    });
  },

  async updateAdminSettings(input: AdminSettingsData) {
    return apiRequest<AdminSettingsData>("/admin/settings", {
      method: "PUT",
      token: getStoredToken(),
      body: JSON.stringify(input),
    });
  },

  async getAdminUsers() {
    const result = await apiRequest<Paginated<ApiUser> | ApiUser[]>("/admin/users", {
      token: getStoredToken(),
    });
    return Array.isArray(result) ? result : result.data;
  },

  async updateAdminUserStatus(id: number, status: "active" | "suspended") {
    return apiRequest<ApiUser>(`/admin/users/${id}/status`, {
      method: "PUT",
      token: getStoredToken(),
      body: JSON.stringify({ status }),
    });
  },

  async updateAdminUser(id: number, input: {
    name: string;
    email: string;
    phone?: string | null;
    student_id?: string | null;
    programme?: string | null;
    business_name?: string | null;
    status: "active" | "suspended";
  }) {
    return apiRequest<ApiUser>(`/admin/users/${id}`, {
      method: "PUT",
      token: getStoredToken(),
      body: JSON.stringify(input),
    });
  },

  async deleteAdminUser(id: number) {
    return apiRequest<{ message: string }>(`/admin/users/${id}`, {
      method: "DELETE",
      token: getStoredToken(),
    });
  },

  async getAdminLandlords() {
    const result = await apiRequest<Paginated<(ApiUser & { hostels_count?: number })> | (ApiUser & { hostels_count?: number })[]>("/admin/landlords", {
      token: getStoredToken(),
    });
    return Array.isArray(result) ? result : result.data;
  },

  async getAdminListings() {
    const result = await apiRequest<Paginated<ApiHostel> | ApiHostel[]>("/admin/listings", {
      token: getStoredToken(),
    });
    return Array.isArray(result) ? result : result.data;
  },

  async approveAdminListing(id: number, input: { admin_notes?: string } = {}) {
    return apiRequest<ApiHostel>(`/admin/listings/${id}/approve`, {
      method: "POST",
      token: getStoredToken(),
      body: JSON.stringify(input),
    });
  },

  async rejectAdminListing(id: number, input: { rejection_reason: string; admin_notes?: string }) {
    return apiRequest<ApiHostel>(`/admin/listings/${id}/reject`, {
      method: "POST",
      token: getStoredToken(),
      body: JSON.stringify(input),
    });
  },

  async getAdminReviews() {
    const result = await apiRequest<Paginated<ApiReview> | ApiReview[]>("/admin/reviews", {
      token: getStoredToken(),
    });
    return Array.isArray(result) ? result : result.data;
  },

  async updateAdminReviewStatus(id: number, status: "active" | "pending" | "hidden") {
    return apiRequest<ApiReview>(`/admin/reviews/${id}/status`, {
      method: "PUT",
      token: getStoredToken(),
      body: JSON.stringify({ status }),
    });
  },

  async getAdminReports() {
    const result = await apiRequest<Paginated<ApiReport> | ApiReport[]>("/admin/reports", {
      token: getStoredToken(),
    });
    return Array.isArray(result) ? result : result.data;
  },

  async resolveAdminReport(id: number) {
    return apiRequest<ApiReport>(`/admin/reports/${id}/resolve`, {
      method: "POST",
      token: getStoredToken(),
    });
  },

  async getAdminVerifications() {
    const result = await apiRequest<Paginated<ApiVerification> | ApiVerification[]>("/admin/verifications", {
      token: getStoredToken(),
    });
    return Array.isArray(result) ? result : result.data;
  },

  async approveAdminVerification(id: number, input: { admin_notes?: string } = {}) {
    return apiRequest<ApiVerification>(`/admin/verifications/${id}/approve`, {
      method: "POST",
      token: getStoredToken(),
      body: JSON.stringify(input),
    });
  },

  async rejectAdminVerification(id: number, input: { rejection_reason: string; admin_notes?: string }) {
    return apiRequest<ApiVerification>(`/admin/verifications/${id}/reject`, {
      method: "POST",
      token: getStoredToken(),
      body: JSON.stringify(input),
    });
  },
};
