import { useEffect, useState, type ReactNode } from "react";
import {
  Home, Search, Bookmark, MessageSquare, Star, User, Bell,
  LayoutGrid, List, Shield, MapPin, Wifi, Zap, Lock, Droplets,
  ChevronRight, ChevronLeft, ChevronDown, Plus, Filter, Eye, EyeOff, Phone,
  Flag, Check, X, AlertCircle, Users, Building2, LogOut, Menu,
  ArrowRight, Upload, CheckCircle, Clock, XCircle, Mail, LayoutDashboard,
  BookOpen, BarChart2, Camera, ClipboardList, Globe,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from "recharts";
import { ApiError, api, type AccountsData, type AdminDashboardData, type AdminSettingsData, type ApiHostel, type ApiMessage, type ApiNotification, type ApiReport, type ApiReview, type ApiUser, type ApiVerification, type LandlordDashboardData, type StudentDashboardData } from "../api/client";
import aamustedLogo from "../assets/aamusted-logo.png";
import heroCampusImage from "../assets/srg-hero-campus.png";

const resolveMediaUrl = (path?: string | null) => {
  if (!path || path.startsWith("blob:") || path.startsWith("data:") || path.startsWith("http")) return path ?? "";
  const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api";
  return `${new URL(apiBase, window.location.origin).origin}${path}`;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
            error_callback?: (error: unknown) => void;
          }) => {
            requestAccessToken: (options?: { prompt?: string }) => void;
          };
        };
      };
    };
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Page =
  | "landing"
  | "student-dashboard"
  | "student-saved"
  | "student-messages"
  | "student-reviews"
  | "student-guide"
  | "student-reports"
  | "student-profile"
  | "student-password"
  | "listings"
  | "hostel-detail"
  | "landlord-dashboard"
  | "landlord-listings"
  | "landlord-messages"
  | "landlord-reviews"
  | "landlord-verification"
  | "landlord-profile"
  | "add-hostel"
  | "admin-dashboard"
  | "admin-users"
  | "admin-landlords"
  | "admin-listings"
  | "admin-verifications"
  | "admin-reviews"
  | "admin-reports"
  | "admin-accounts"
  | "admin-settings"
  | "auth";

type AuthView = "login" | "signup" | "forgot" | "reset";
type UserRole = "student" | "landlord" | "admin";

interface Hostel {
  id: number;
  name: string;
  location: string;
  distance: string;
  price: number;
  rating: number;
  reviews: number;
  verified: boolean;
  facilities: string[];
  image: string;
  type: string;
  available: boolean;
  landlord: string;
  landlordId?: number;
  landlordPhone?: string | null;
  description: string;
  status?: string;
  adminNotes?: string | null;
  rejectionReason?: string | null;
  reviewedAt?: string | null;
  currentRental?: ApiHostel["current_rental"];
}

const DASHBOARD_BY_ROLE: Record<UserRole, Page> = {
  student: "student-dashboard",
  landlord: "landlord-dashboard",
  admin: "admin-dashboard",
};

const PROFILE_BY_ROLE: Record<UserRole, Page> = {
  student: "student-profile",
  landlord: "landlord-profile",
  admin: "admin-settings",
};

const PAGE_ROLE_PREFIX: Record<UserRole, string> = {
  student: "student-",
  landlord: "landlord-",
  admin: "admin-",
};

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
let googleIdentityScriptPromise: Promise<void> | null = null;

function loadGoogleIdentityScript() {
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve();
  }

  if (!googleIdentityScriptPromise) {
    googleIdentityScriptPromise = new Promise((resolve, reject) => {
      const existingScript = document.getElementById("google-identity-services");

      if (existingScript) {
        existingScript.addEventListener("load", () => resolve(), { once: true });
        existingScript.addEventListener("error", () => reject(new Error("Google sign-in could not load.")), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.id = "google-identity-services";
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Google sign-in could not load."));
      document.head.appendChild(script);
    });
  }

  return googleIdentityScriptPromise;
}

async function getGoogleClientId() {
  if (GOOGLE_CLIENT_ID) {
    return GOOGLE_CLIENT_ID;
  }

  const config = await api.getConfig();
  return config.google_client_id || "";
}

const PORTAL_PAGES: Page[] = [
  "student-dashboard",
  "student-saved",
  "student-messages",
  "student-reviews",
  "student-guide",
  "student-reports",
  "student-profile",
  "student-password",
  "listings",
  "hostel-detail",
  "landlord-dashboard",
  "landlord-listings",
  "landlord-messages",
  "landlord-reviews",
  "landlord-verification",
  "landlord-profile",
  "add-hostel",
  "admin-dashboard",
  "admin-users",
  "admin-landlords",
  "admin-listings",
  "admin-verifications",
  "admin-reviews",
  "admin-reports",
  "admin-accounts",
  "admin-settings",
];

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("srg_auth_user") ?? "null") as ApiUser | null;
  } catch {
    return null;
  }
}

function readStoredRole(): UserRole {
  const user = readStoredUser();
  const role = user?.role ?? localStorage.getItem("srg_auth_role");
  return role === "landlord" || role === "admin" ? role : "student";
}

function clearSession() {
  localStorage.removeItem("srg_auth_token");
  localStorage.removeItem("srg_auth_user");
  localStorage.removeItem("srg_auth_role");
  localStorage.removeItem("srg_current_page");
  localStorage.removeItem("srg_selected_hostel_id");
}

function readSelectedHostelId() {
  const value = Number(localStorage.getItem("srg_selected_hostel_id"));
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function openHostelDetail(navigate: (p: Page) => void, hostelId: number) {
  localStorage.setItem("srg_selected_hostel_id", String(hostelId));
  navigate("hostel-detail");
}

function getInitialPage(): Page {
  const hasSession = Boolean(localStorage.getItem("srg_auth_token"));
  if (!hasSession) return "landing";

  const role = readStoredRole();
  const storedPage = localStorage.getItem("srg_current_page") as Page | null;
  if (storedPage && PORTAL_PAGES.includes(storedPage) && storedPage.startsWith(PAGE_ROLE_PREFIX[role])) {
    return storedPage;
  }

  return DASHBOARD_BY_ROLE[role];
}

// ── Data ──────────────────────────────────────────────────────────────────────

const HOSTELS: Hostel[] = [
  {
    id: 1,
    name: "Greenview Student Hostel",
    location: "12 Tanoso Road, Kumasi",
    distance: "0.4 km from AAMUSTED",
    price: 3500,
    rating: 4.8,
    reviews: 47,
    verified: true,
    facilities: ["wifi", "security", "water", "electricity"],
    image: "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=800&h=500&fit=crop&auto=format",
    type: "Self-contain",
    available: true,
    landlord: "Mr. Kwame Mensah",
    description:
      "A clean and modern self-contained hostel with 24/7 power supply and strong Wi-Fi. Each room comes fully furnished with a study desk, wardrobe, and private bathroom. Located a short walk from the AAMUSTED main gate.",
  },
  {
    id: 2,
    name: "Campus View Apartments",
    location: "7 University Avenue, Tanoso",
    distance: "0.8 km from AAMUSTED",
    price: 4200,
    rating: 4.6,
    reviews: 33,
    verified: true,
    facilities: ["wifi", "security", "electricity"],
    image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&h=500&fit=crop&auto=format",
    type: "1-bedroom",
    available: true,
    landlord: "Mrs. Abena Owusu",
    description:
      "Spacious one-bedroom apartments ideal for students who prefer privacy. Features include gated access, CCTV, a shared laundry room, and a rooftop lounge.",
  },
  {
    id: 3,
    name: "Scholars Lodge",
    location: "3 Abuakwa Close, Kumasi",
    distance: "1.2 km from AAMUSTED",
    price: 2800,
    rating: 4.3,
    reviews: 62,
    verified: true,
    facilities: ["water", "security", "electricity"],
    image: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=500&fit=crop&auto=format",
    type: "Room & parlour",
    available: false,
    landlord: "Mr. Kofi Boateng",
    description:
      "Affordable room and parlour apartments in a quiet residential area. Clean shared bathrooms, consistent water supply, and 24-hour security guard on site.",
  },
  {
    id: 4,
    name: "Prestige Student Hub",
    location: "45 Asuoyeboah Street, Kumasi",
    distance: "0.6 km from AAMUSTED",
    price: 5200,
    rating: 4.9,
    reviews: 28,
    verified: true,
    facilities: ["wifi", "security", "water", "electricity"],
    image: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=500&fit=crop&auto=format",
    type: "Self-contain",
    available: true,
    landlord: "Dr. Yaw Asante",
    description:
      "Premium furnished accommodation with uninterrupted power, high-speed fibre internet, and on-site management. Study rooms, gym access, and a common area included.",
  },
  {
    id: 5,
    name: "Harmony House",
    location: "22 Kwadaso Estate, Kumasi",
    distance: "1.8 km from AAMUSTED",
    price: 2400,
    rating: 4.1,
    reviews: 89,
    verified: false,
    facilities: ["water", "electricity"],
    image: "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800&h=500&fit=crop&auto=format",
    type: "Shared room",
    available: true,
    landlord: "Mr. Kojo Appiah",
    description:
      "Budget-friendly shared rooms for students. Well-maintained communal facilities including kitchen, lounge, and bathrooms. Perfect for first-year students.",
  },
  {
    id: 6,
    name: "Sunrise Student Suites",
    location: "9 Santasi Road, Kumasi",
    distance: "1.1 km from AAMUSTED",
    price: 3800,
    rating: 4.5,
    reviews: 41,
    verified: true,
    facilities: ["wifi", "security", "water", "electricity"],
    image: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=500&fit=crop&auto=format",
    type: "Self-contain",
    available: true,
    landlord: "Mrs. Akosua Adu",
    description:
      "Modern suites with contemporary furnishings, air conditioning, and dedicated parking. Close to shopping centres and easy transport links to campus.",
  },
];

const LISTING_GROWTH = [
  { month: "Jan", listings: 42, verified: 30 },
  { month: "Feb", listings: 58, verified: 41 },
  { month: "Mar", listings: 71, verified: 55 },
  { month: "Apr", listings: 85, verified: 67 },
  { month: "May", listings: 99, verified: 78 },
  { month: "Jun", listings: 118, verified: 92 },
];

const USER_ACTIVITY = [
  { month: "Jan", students: 120, landlords: 18 },
  { month: "Feb", students: 185, landlords: 25 },
  { month: "Mar", students: 240, landlords: 31 },
  { month: "Apr", students: 310, landlords: 42 },
  { month: "May", students: 390, landlords: 55 },
  { month: "Jun", students: 470, landlords: 68 },
];

function mapApiHostel(hostel: ApiHostel): Hostel {
  return {
    id: hostel.id,
    name: hostel.name,
    location: hostel.location,
    distance: hostel.distance,
    price: hostel.price,
    rating: Number(hostel.rating),
    reviews: hostel.reviews_count,
    verified: hostel.verified,
    facilities: hostel.facilities ?? [],
    image: hostel.image ?? HOSTELS[0].image,
    type: hostel.type,
    available: hostel.available,
    landlord: hostel.landlord?.business_name || hostel.landlord?.name || "Verified landlord",
    landlordId: hostel.landlord?.id,
    landlordPhone: hostel.landlord?.phone,
    description: hostel.description ?? "Verified student accommodation near AAMUSTED.",
    status: hostel.status ?? (hostel.verified ? "verified" : "pending"),
    adminNotes: hostel.admin_notes,
    rejectionReason: hostel.rejection_reason,
    reviewedAt: hostel.reviewed_at,
    currentRental: hostel.current_rental,
  };
}

// ── Shared Components ─────────────────────────────────────────────────────────

function LogoMark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClass = {
    sm: "w-10 h-10",
    md: "w-12 h-12",
    lg: "w-14 h-14",
  };

  return (
    <img src={aamustedLogo} alt="AAMUSTED logo" className={`${sizeClass[size]} object-contain shrink-0`} />
  );
}

function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs font-medium px-2 py-0.5 rounded-full border border-emerald-200">
      <Shield className="w-3 h-3" />
      Verified
    </span>
  );
}

function StarRating({ rating, count }: { rating: number; count?: number }) {
  return (
    <div className="flex items-center gap-1">
      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
      <span className="text-sm font-semibold text-slate-800">{rating}</span>
      {count !== undefined && (
        <span className="text-sm text-slate-400">({count})</span>
      )}
    </div>
  );
}

function FacilityIcon({ type }: { type: string }) {
  const map: Record<string, { icon: ReactNode; label: string }> = {
    wifi: { icon: <Wifi className="w-3.5 h-3.5" />, label: "Wi-Fi" },
    security: { icon: <Lock className="w-3.5 h-3.5" />, label: "Security" },
    water: { icon: <Droplets className="w-3.5 h-3.5" />, label: "Water" },
    electricity: { icon: <Zap className="w-3.5 h-3.5" />, label: "Power" },
  };
  const item = map[type];
  if (!item) return null;
  return (
    <span className="inline-flex items-center gap-1 bg-slate-50 text-slate-600 text-xs px-2 py-1 rounded-md border border-slate-100">
      {item.icon}
      {item.label}
    </span>
  );
}

function PasswordInput({
  value,
  onChange,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={`relative ${className}`}>
      <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        type={visible ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full border border-slate-200 rounded-xl pl-9 pr-11 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200 placeholder:text-slate-400"
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

function HostelCard({
  hostel,
  navigate,
  compact = false,
  onSave,
  isSaved = false,
}: {
  hostel: Hostel;
  navigate: (p: Page) => void;
  compact?: boolean;
  onSave?: (hostel: Hostel) => void;
  isSaved?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group">
      <div className={`relative overflow-hidden bg-slate-100 ${compact ? "h-40" : "h-48"}`}>
        <img
          src={hostel.image}
          alt={hostel.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {!hostel.available && (
          <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center">
            <span className="bg-white text-slate-700 text-xs font-semibold px-3 py-1 rounded-full">
              Currently Full
            </span>
          </div>
        )}
        <div className="absolute top-3 left-3">
          {hostel.verified && <VerifiedBadge />}
        </div>
        <button
          onClick={() => onSave?.(hostel)}
          className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm p-1.5 rounded-full hover:bg-white transition-colors"
          aria-label={isSaved ? "Saved listing" : "Save listing"}
        >
          <Bookmark className={`w-4 h-4 ${isSaved ? "fill-[#8D173E] text-[#8D173E]" : "text-slate-600"}`} />
        </button>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-semibold text-slate-900 text-sm leading-tight">{hostel.name}</h3>
          <div className="flex-shrink-0">
            <StarRating rating={hostel.rating} count={hostel.reviews} />
          </div>
        </div>
        <p className="text-xs text-slate-500 flex items-center gap-1 mb-1">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          {hostel.location}
        </p>
        <p className="text-xs text-[#8D173E] font-medium mb-3">{hostel.distance}</p>
        <div className="flex flex-wrap gap-1 mb-3">
          {hostel.facilities.slice(0, 3).map((f) => (
            <FacilityIcon key={f} type={f} />
          ))}
          {hostel.facilities.length > 3 && (
            <span className="text-xs text-slate-400 self-center">
              +{hostel.facilities.length - 3}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-slate-50">
          <div>
            <span className="text-lg font-bold text-slate-900">
              GH₵{hostel.price.toLocaleString()}
            </span>
            <span className="text-xs text-slate-400"> /semester</span>
          </div>
          <button
            onClick={() => openHostelDetail(navigate, hostel.id)}
            className="bg-[#8D173E] hover:bg-[#741231] text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            View Details
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  trend,
  color = "rose",
}: {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: string;
  color?: "rose" | "emerald" | "amber";
}) {
  const colorMap = {
    rose: "bg-rose-50 text-[#8D173E]",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2.5 rounded-xl ${colorMap[color]}`}>{icon}</div>
        {trend && (
          <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
            {trend}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-900 mb-1">{value}</p>
      <p className="text-sm text-slate-500">{title}</p>
    </div>
  );
}

function DashboardSidebar({
  role,
  navigate,
  activePage,
}: {
  role: "student" | "landlord" | "admin";
  navigate: (p: Page) => void;
  activePage: Page;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const studentNav = [
    { icon: <LayoutDashboard className="w-4 h-4" />, label: "Dashboard", page: "student-dashboard" as Page },
    { icon: <Search className="w-4 h-4" />, label: "Find Rooms", page: "listings" as Page },
    { icon: <Bookmark className="w-4 h-4" />, label: "Saved Listings", page: "student-saved" as Page },
    { icon: <MessageSquare className="w-4 h-4" />, label: "Messages", page: "student-messages" as Page },
    { icon: <Star className="w-4 h-4" />, label: "Reviews", page: "student-reviews" as Page },
    { icon: <BookOpen className="w-4 h-4" />, label: "Rental Guide", page: "student-guide" as Page },
    { icon: <Flag className="w-4 h-4" />, label: "Report Issue", page: "student-reports" as Page },
    { icon: <User className="w-4 h-4" />, label: "Profile", page: "student-profile" as Page },
  ];
  const landlordNav = [
    { icon: <LayoutDashboard className="w-4 h-4" />, label: "Dashboard", page: "landlord-dashboard" as Page },
    { icon: <Building2 className="w-4 h-4" />, label: "My Listings", page: "landlord-listings" as Page },
    { icon: <Plus className="w-4 h-4" />, label: "Add New Hostel", page: "add-hostel" as Page },
    { icon: <MessageSquare className="w-4 h-4" />, label: "Messages", page: "landlord-messages" as Page },
    { icon: <Star className="w-4 h-4" />, label: "Reviews", page: "landlord-reviews" as Page },
    { icon: <Shield className="w-4 h-4" />, label: "Verification", page: "landlord-verification" as Page },
    { icon: <User className="w-4 h-4" />, label: "Profile", page: "landlord-profile" as Page },
  ];
  const adminNav = [
    { icon: <LayoutDashboard className="w-4 h-4" />, label: "Overview", page: "admin-dashboard" as Page },
    { icon: <Users className="w-4 h-4" />, label: "Users", page: "admin-users" as Page },
    { icon: <Building2 className="w-4 h-4" />, label: "Landlords", page: "admin-landlords" as Page },
    { icon: <ClipboardList className="w-4 h-4" />, label: "Listings", page: "admin-listings" as Page },
    { icon: <CheckCircle className="w-4 h-4" />, label: "Verifications", page: "admin-verifications" as Page },
    { icon: <Star className="w-4 h-4" />, label: "Reviews", page: "admin-reviews" as Page },
    { icon: <Flag className="w-4 h-4" />, label: "Reports", page: "admin-reports" as Page },
    { icon: <BarChart2 className="w-4 h-4" />, label: "Accounts", page: "admin-accounts" as Page },
    { icon: <User className="w-4 h-4" />, label: "Settings", page: "admin-settings" as Page },
  ];

  const navItems =
    role === "student" ? studentNav : role === "landlord" ? landlordNav : adminNav;

  const roleColors = {
    student: "bg-[#8D173E]",
    landlord: "bg-emerald-600",
    admin: "bg-slate-800",
  };
  const roleLabels = { student: "Student", landlord: "Landlord", admin: "Admin" };

  const navigateFromSidebar = (page: Page) => {
    setMobileOpen(false);
    navigate(page);
  };

  const signOut = () => {
    setMobileOpen(false);
    clearSession();
    navigate("auth");
  };

  const sidebarContent = () => (
    <>
      <div className="px-5 py-5 border-b border-slate-100">
        <button onClick={() => navigateFromSidebar("landing")} className="flex items-center gap-2">
          <LogoMark />
          <span className="font-bold text-slate-900 text-sm leading-tight">AAMUSTED Rent Guide</span>
        </button>
      </div>
      <div className="px-5 py-3 border-b border-slate-50">
        <span
          className={`text-xs font-semibold text-white px-2.5 py-1 rounded-md ${roleColors[role]}`}
        >
          {roleLabels[role]} Portal
        </span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <button
            key={item.label}
            onClick={() => navigateFromSidebar(item.page)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors text-left ${
              activePage === item.page
                ? "bg-rose-50 text-rose-700 font-semibold"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>
      <div className="px-3 py-4 border-t border-slate-100">
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-4 z-40 w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-700"
        aria-label="Open navigation menu"
        aria-expanded={mobileOpen}
      >
        <Menu className="w-5 h-5" />
      </button>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <button
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-[1px]"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation menu"
          />
          <aside className="relative w-[min(19rem,86vw)] h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-left duration-200">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-3 z-10 w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"
              aria-label="Close navigation menu"
            >
              <X className="w-5 h-5" />
            </button>
            {sidebarContent()}
          </aside>
        </div>
      )}

      <aside className="hidden lg:flex w-60 flex-shrink-0 bg-white border-r border-slate-100 flex-col h-screen sticky top-0">
        {sidebarContent()}
      </aside>
    </>
  );
}

function TopBar({ title, navigate }: { title: string; navigate: (p: Page) => void }) {
  const [user, setUser] = useState<ApiUser | null>(() => readStoredUser());
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const role = user?.role ?? readStoredRole();
  const displayName = user?.business_name || user?.name || (role === "admin" ? "AAMUSTED Admin" : role === "landlord" ? "Landlord" : "Student");
  const unreadNotifications = notifications.filter((notification) => !notification.read_at).length;
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "U";
  const profilePhotoUrl = resolveMediaUrl(user?.profile_photo);

  useEffect(() => {
    if (!localStorage.getItem("srg_auth_token")) return;

    let active = true;

    api.me()
      .then((currentUser) => {
        if (!active) return;
        setUser(currentUser);
        localStorage.setItem("srg_auth_user", JSON.stringify(currentUser));
        localStorage.setItem("srg_auth_role", currentUser.role);
      })
      .catch(() => {
        if (!active) return;
        setUser(readStoredUser());
      });

    api.getNotifications()
      .then((items) => {
        if (!active) return;
        setNotifications(items);
      })
      .catch(() => {
        if (!active) return;
        setNotifications([]);
      });

    const syncStoredUser = () => setUser(readStoredUser());
    window.addEventListener("srg:user-updated", syncStoredUser);

    return () => {
      active = false;
      window.removeEventListener("srg:user-updated", syncStoredUser);
    };
  }, []);

  const markNotificationRead = async (notification: ApiNotification) => {
    if (!notification.read_at) {
      setNotifications((items) =>
        items.map((item) =>
          item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item
        )
      );

      try {
        await api.markNotificationRead(notification.id);
      } catch {
        api.getNotifications().then(setNotifications).catch(() => undefined);
      }
    }

    setNotificationsOpen(false);

    if (notification.action_url) {
      navigate(notification.action_url as Page);
    }
  };

  const markAllNotificationsRead = async () => {
    setNotifications((items) =>
      items.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() }))
    );

    try {
      await api.markAllNotificationsRead();
    } catch {
      api.getNotifications().then(setNotifications).catch(() => undefined);
    }
  };

  return (
    <div className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-6 sticky top-0 z-10 flex-shrink-0">
      <div className="flex items-center gap-3 pl-12 lg:pl-0">
        <h1 className="text-base font-semibold text-slate-900">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            onClick={() => setNotificationsOpen((open) => !open)}
            className="relative p-2 rounded-lg hover:bg-slate-50 transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5 text-slate-500" />
            {unreadNotifications > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadNotifications > 9 ? "9+" : unreadNotifications}
              </span>
            )}
          </button>
          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] bg-white border border-slate-100 rounded-xl shadow-xl overflow-hidden z-30">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">Notifications</p>
                {unreadNotifications > 0 && (
                  <button
                    onClick={markAllNotificationsRead}
                    className="text-xs font-semibold text-rose-700 hover:text-rose-800"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm font-medium text-slate-700">No notifications yet</p>
                    <p className="text-xs text-slate-500 mt-1">Approvals, messages, and reports will appear here.</p>
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <button
                      key={notification.id}
                      onClick={() => markNotificationRead(notification)}
                      className="w-full text-left px-4 py-3 border-b border-slate-50 last:border-b-0 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${notification.read_at ? "bg-slate-200" : "bg-rose-600"}`} />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-slate-900 truncate">{notification.title}</span>
                          {notification.body && (
                            <span className="block text-xs text-slate-600 mt-0.5 line-clamp-2">{notification.body}</span>
                          )}
                          <span className="block text-[11px] text-slate-400 mt-1">
                            {new Date(notification.created_at).toLocaleString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        <button
          onClick={() => navigate(PROFILE_BY_ROLE[role])}
          className="flex items-center gap-2 rounded-xl p-1 hover:bg-slate-50 transition-colors"
        >
          <div className="w-8 h-8 rounded-full overflow-hidden bg-[#8D173E] text-white flex items-center justify-center text-xs font-bold">
            {profilePhotoUrl ? <img src={profilePhotoUrl} alt={displayName} className="w-full h-full object-cover" /> : initials}
          </div>
          <span className="text-sm font-medium text-slate-800 hidden md:block">{displayName}</span>
          <ChevronDown className="w-4 h-4 text-slate-400 hidden md:block" />
        </button>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between gap-3">
        <h3 className="font-semibold text-slate-900 text-sm">{title}</h3>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function TableShell({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto">{children}</div>;
}

// ── Landing Page ──────────────────────────────────────────────────────────────

function LandingPage({ navigate }: { navigate: (p: Page) => void }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [listings, setListings] = useState<Hostel[]>([]);
  const [reviews, setReviews] = useState<ApiReview[]>([]);
  const [landingStatus, setLandingStatus] = useState<"loading" | "api" | "error">("loading");
  const [heroSearch, setHeroSearch] = useState("");
  const [heroPrice, setHeroPrice] = useState("any");
  const [heroType, setHeroType] = useState("any");
  const user = readStoredUser();
  const isAuthenticated = Boolean(localStorage.getItem("srg_auth_token"));
  const dashboardPage = DASHBOARD_BY_ROLE[readStoredRole()];
  const landingNav = [
    { label: "Home", section: "top" },
    { label: "Listings", page: "listings" as Page },
    { label: "How It Works", section: "how-it-works" },
    { label: "Reviews", section: "reviews" },
  ];

  useEffect(() => {
    let active = true;

    Promise.all([api.getListings(), api.getReviews()])
      .then(([listingItems, reviewItems]) => {
        if (!active) return;
        setListings(listingItems.map(mapApiHostel));
        setReviews(reviewItems);
        setLandingStatus("api");
      })
      .catch(() => {
        if (!active) return;
        setListings([]);
        setReviews([]);
        setLandingStatus("error");
      });

    return () => {
      active = false;
    };
  }, []);

  const scrollToSection = (section: string) => {
    setMobileOpen(false);
    if (section === "top") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    document.getElementById(section)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openListingsWithSearch = () => {
    localStorage.setItem("srg_listing_search", heroSearch);
    localStorage.setItem("srg_listing_price", heroPrice);
    localStorage.setItem("srg_listing_type", heroType);
    navigate("listings");
  };

  const handleFooterLink = (label: string) => {
    if (label === "Find Rooms") {
      navigate("listings");
    } else if (label === "How It Works" || label === "Verification Process" || label === "Safety Tips") {
      scrollToSection("how-it-works");
    } else if (label === "Reviews") {
      scrollToSection("reviews");
    } else if (label === "List Your Hostel") {
      navigate(isAuthenticated ? "landlord-dashboard" : "auth");
    } else if (label === "Dashboard") {
      navigate(isAuthenticated ? dashboardPage : "auth");
    } else if (label === "Report a Fraud") {
      navigate("listings");
    } else if (label === "Contact Us" || label === "Help Center") {
      navigate(isAuthenticated ? dashboardPage : "auth");
    } else {
      navigate("listings");
    }
  };

  const signOut = () => {
    clearSession();
    setMobileOpen(false);
    navigate("landing");
  };

  const averageRating = reviews.length
    ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)
    : "4.7";
  const reviewCount = reviews.length || 300;
  const popularListings = listings.slice(0, 3);
  const verifiedCount = listings.filter((listing) => listing.verified).length || 500;
  const displayReviews = reviews.slice(0, 3);

  return (
    <div id="top" className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LogoMark />
            <span className="font-bold text-slate-900">AAMUSTED Rent Guide</span>
          </div>
          <div className="hidden md:flex items-center gap-7 text-sm">
            {landingNav.map((item) => (
              <button
                key={item.label}
                onClick={() => item.page ? navigate(item.page) : scrollToSection(item.section)}
                className="text-slate-600 hover:text-[#8D173E] font-medium transition-colors"
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <button
                  onClick={() => navigate(dashboardPage)}
                  className="text-sm font-medium text-slate-700 hover:text-[#8D173E] transition-colors px-3 py-2"
                >
                  {user?.name ? user.name.split(" ")[0] : "Dashboard"}
                </button>
                <button
                  onClick={signOut}
                  className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => navigate("auth")}
                  className="text-sm font-medium text-slate-700 hover:text-[#8D173E] transition-colors px-3 py-2"
                >
                  Login
                </button>
                <button
                  onClick={() => navigate("auth")}
                  className="bg-[#8D173E] hover:bg-[#741231] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                >
                  Sign Up Free
                </button>
              </>
            )}
          </div>
          <button className="md:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
        {mobileOpen && (
          <div className="md:hidden border-t border-slate-100 bg-white px-6 py-4 flex flex-col gap-3">
            {landingNav.map((item) => (
              <button
                key={item.label}
                onClick={() => item.page ? navigate(item.page) : scrollToSection(item.section)}
                className="text-left text-slate-700 font-medium py-1 text-sm"
              >
                {item.label}
              </button>
            ))}
            <div className="flex gap-3 pt-2">
              {isAuthenticated ? (
                <>
                  <button
                    onClick={() => navigate(dashboardPage)}
                    className="flex-1 border border-slate-200 rounded-xl py-2.5 text-sm font-medium text-slate-700"
                  >
                    Dashboard
                  </button>
                  <button
                    onClick={signOut}
                    className="flex-1 bg-slate-900 text-white rounded-xl py-2.5 text-sm font-semibold"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => navigate("auth")}
                    className="flex-1 border border-slate-200 rounded-xl py-2.5 text-sm font-medium text-slate-700"
                  >
                    Login
                  </button>
                  <button
                    onClick={() => navigate("auth")}
                    className="flex-1 bg-[#8D173E] text-white rounded-xl py-2.5 text-sm font-semibold"
                  >
                    Sign Up
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-rose-950 via-rose-900 to-rose-800 overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={heroCampusImage}
            alt="University campus"
            className="w-full h-full object-cover opacity-20"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-rose-950/60 to-transparent" />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 py-24 lg:py-36">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-rose-200 text-sm font-medium px-3 py-1.5 rounded-full mb-6 border border-white/20">
              <Shield className="w-4 h-4" />
              100% Verified Listings Near AAMUSTED
            </div>
            <h1 className="text-4xl lg:text-5xl xl:text-6xl font-extrabold text-white leading-[1.15] mb-6">
              Find Verified Student
              <br />
              Accommodation
              <br />
              <span className="text-rose-300">Near Campus</span>
            </h1>
            <p className="text-rose-200 text-lg mb-10 leading-relaxed max-w-xl">
              Search verified hostels around AAMUSTED, compare prices, read real student reviews,
              and contact landlords safely — all in one place.
            </p>

            {/* Search box */}
            <div className="bg-white rounded-2xl p-2 shadow-2xl shadow-rose-950/40 flex flex-col lg:flex-row gap-2">
              <div className="flex items-center gap-2 flex-1 px-3 py-2 lg:border-r border-slate-100">
                <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <input
                  value={heroSearch}
                  onChange={(event) => setHeroSearch(event.target.value)}
                  className="flex-1 text-sm outline-none placeholder:text-slate-400 text-slate-800"
                  placeholder="Location or hostel name"
                />
              </div>
              <div className="flex items-center gap-2 flex-1 px-3 py-2 lg:border-r border-slate-100">
                <span className="text-slate-400 text-sm font-medium">GH₵</span>
                <select value={heroPrice} onChange={(event) => setHeroPrice(event.target.value)} className="flex-1 text-sm outline-none bg-transparent text-slate-700">
                  <option value="any">Any price range</option>
                  <option value="under150">Under GH₵3,000</option>
                  <option value="150to200">GH₵3,000 - GH₵4,000</option>
                  <option value="over200">Above GH₵4,000</option>
                </select>
              </div>
              <div className="flex items-center gap-2 flex-1 px-3 py-2 lg:border-r border-slate-100">
                <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <select value={heroType} onChange={(event) => setHeroType(event.target.value)} className="flex-1 text-sm outline-none bg-transparent text-slate-700">
                  <option value="any">Any room type</option>
                  <option value="Self-contain">Self-contain</option>
                  <option value="1-bedroom">1-bedroom</option>
                  <option value="Room & parlour">Room & parlour</option>
                  <option value="Shared room">Shared room</option>
                </select>
              </div>
              <button
                onClick={openListingsWithSearch}
                className="bg-[#8D173E] hover:bg-[#741231] text-white font-semibold px-6 py-3 rounded-xl transition-colors flex items-center gap-2 justify-center text-sm"
              >
                <Search className="w-4 h-4" />
                Find a Room
              </button>
            </div>

            <div className="flex items-center gap-5 mt-5 text-sm">
              <button
                onClick={() => navigate("landlord-dashboard")}
                className="text-rose-200 hover:text-white font-medium flex items-center gap-1.5 transition-colors"
              >
                List Your Hostel <ArrowRight className="w-4 h-4" />
              </button>
              <span className="text-rose-700">·</span>
              <span className="text-rose-300">{verifiedCount}+ verified listings</span>
            </div>
          </div>
        </div>
      </section>

      {/* Feature cards */}
      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">
              Everything You Need to Find Safe Housing
            </h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">
              We make student accommodation safer, simpler, and more transparent.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              {
                icon: <Shield className="w-6 h-6" />,
                title: "Verified Listings",
                desc: "Every hostel is inspected and verified by our team before going live.",
                color: "rose",
              },
              {
                icon: <Star className="w-6 h-6" />,
                title: "Student Reviews",
                desc: "Read authentic reviews from students currently living in each hostel.",
                color: "amber",
              },
              {
                icon: <BarChart2 className="w-6 h-6" />,
                title: "Transparent Prices",
                desc: "See the full cost breakdown upfront — no hidden fees.",
                color: "emerald",
              },
              {
                icon: <Camera className="w-6 h-6" />,
                title: "Virtual Room Preview",
                desc: "View high-quality photos and virtual tours before visiting.",
                color: "rose",
              },
              {
                icon: <Phone className="w-6 h-6" />,
                title: "Direct Landlord Contact",
                desc: "Contact verified landlords through our secure messaging system.",
                color: "rose",
              },
            ].map((item) => {
              const bg: Record<string, string> = {
                rose: "bg-rose-50 text-[#8D173E]",
                amber: "bg-amber-50 text-amber-600",
                emerald: "bg-emerald-50 text-emerald-600",
              };
              return (
                <div
                  key={item.title}
                  className="p-6 rounded-2xl border border-slate-100 hover:shadow-md transition-shadow bg-white"
                >
                  <div
                    className={`w-12 h-12 rounded-xl ${bg[item.color]} flex items-center justify-center mb-4`}
                  >
                    {item.icon}
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-2 text-sm">{item.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Popular hostels */}
      <section className="bg-slate-50 py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-1">Popular Hostels Near AAMUSTED</h2>
              <p className="text-slate-500 text-sm">Top-rated and most-booked accommodation this semester</p>
            </div>
            <button
              onClick={() => navigate("listings")}
              className="text-[#8D173E] hover:text-[#741231] text-sm font-semibold flex items-center gap-1 transition-colors"
            >
              View All <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {popularListings.map((h) => (
              <HostelCard key={h.id} hostel={h} navigate={navigate} />
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-white py-20 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 mb-12">
            <div>
              <span className="text-xs font-bold text-[#8D173E] uppercase tracking-widest">Simple process</span>
              <h2 className="text-3xl font-bold text-slate-900 mt-2 mb-3">
                How AAMUSTED Rent Guide Works
              </h2>
              <p className="text-slate-500 max-w-2xl">
                Move from search to safe inspection with clear verification signals, student feedback, and landlord contact details.
              </p>
            </div>
            <button
              onClick={() => navigate("listings")}
              className="w-full sm:w-auto bg-[#8D173E] hover:bg-[#741231] text-white text-sm font-semibold px-5 py-3 rounded-xl transition-colors inline-flex items-center justify-center gap-2"
            >
              Start Searching <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_22rem] gap-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  step: "01",
                  title: "Search verified rooms",
                  desc: "Filter by Tanoso, Abuakwa, Kwadaso, price range, room type, distance, and available facilities.",
                  icon: <Search className="w-7 h-7" />,
                  points: ["Campus distance", "Cedi price range", "Availability"],
                },
                {
                  step: "02",
                  title: "Compare with confidence",
                  desc: "Check photos, landlord verification, utilities, review scores, and full cost breakdowns before visiting.",
                  icon: <BarChart2 className="w-7 h-7" />,
                  points: ["Student reviews", "Facilities", "Transparent costs"],
                },
                {
                  step: "03",
                  title: "Contact safely",
                  desc: "Message verified landlords, arrange inspection, save listings, and report anything suspicious.",
                  icon: <Phone className="w-7 h-7" />,
                  points: ["Verified contact", "Inspection plan", "Safety reporting"],
                },
              ].map((item) => (
                <div key={item.step} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-14 h-14 bg-[#8D173E] rounded-2xl flex items-center justify-center text-white shadow-lg shadow-rose-100">
                      {item.icon}
                    </div>
                    <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full">
                      Step {item.step}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{item.title}</h3>
                  <p className="text-slate-500 leading-relaxed text-sm mb-5">{item.desc}</p>
                  <div className="space-y-2">
                    {item.points.map((point) => (
                      <div key={point} className="flex items-center gap-2 text-sm text-slate-600">
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                        {point}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl bg-slate-950 text-white p-6 relative overflow-hidden">
              <div className="absolute inset-0 opacity-20">
                <img src={heroCampusImage} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center mb-5">
                  <Shield className="w-6 h-6 text-amber-300" />
                </div>
                <h3 className="text-xl font-bold mb-2">Safety-first checklist</h3>
                <p className="text-slate-300 text-sm leading-relaxed mb-5">
                  Every listing is designed to help students avoid scams before committing money.
                </p>
                <div className="space-y-3">
                  {[
                    "Confirm verified badge and landlord profile",
                    "Visit the room before payment",
                    "Compare total rent, fees, and utilities",
                    "Use report controls for suspicious listings",
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-3 text-sm text-slate-200">
                      <Check className="w-4 h-4 text-emerald-300 mt-0.5 flex-shrink-0" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Reviews */}
      <section id="reviews" className="bg-slate-50 py-20 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 mb-10">
            <div>
              <span className="text-xs font-bold text-[#8D173E] uppercase tracking-widest">Student feedback</span>
              <h2 className="text-3xl font-bold text-slate-900 mt-2 mb-3">Reviews from AAMUSTED students</h2>
              <p className="text-slate-500 max-w-2xl">
                Realistic review cards help students compare safety, landlord responsiveness, utilities, and value before booking a viewing.
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 min-w-52">
              <div className="flex items-center gap-2 mb-1">
                <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                <span className="text-2xl font-bold text-slate-900">{averageRating}</span>
                <span className="text-sm text-slate-400">/ 5</span>
              </div>
              <p className="text-xs text-slate-500">Average rating across {reviewCount}+ student reviews</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {(displayReviews.length ? displayReviews.map((review) => ({
              name: review.user?.name ?? "AAMUSTED student",
              meta: review.hostel?.name ?? "Student accommodation",
              rating: review.rating,
              hostel: review.hostel?.name ?? "Verified hostel",
              text: review.comment,
            })) : [
              {
                name: "Afia Boakye",
                meta: "Level 300, Education",
                rating: 5,
                hostel: "Greenview Student Hostel",
                text: "The distance filter saved me a lot of stress. I found a verified room near Tanoso and inspected it before paying.",
              },
              {
                name: "Kwaku Ansah",
                meta: "Level 200, ICT",
                rating: 4,
                hostel: "Campus View Apartments",
                text: "The reviews and facilities list made comparison easy. I could see Wi-Fi, security, water, and the actual cedi price clearly.",
              },
              {
                name: "Maame Serwaa",
                meta: "Level 400, Business Education",
                rating: 5,
                hostel: "Prestige Student Hub",
                text: "I liked that the landlord profile was verified. The safety note reminded me to inspect first, which was very helpful.",
              },
            ]).map((review) => (
              <div key={review.name} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <div className="flex items-start justify-between gap-3 mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-rose-50 text-[#8D173E] flex items-center justify-center font-bold">
                      {review.name[0]}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{review.name}</p>
                      <p className="text-xs text-slate-500">{review.meta}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Star
                        key={index}
                        className={`w-3.5 h-3.5 ${index < review.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed mb-5">"{review.text}"</p>
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-slate-500">{review.hostel}</span>
                  <VerifiedBadge />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA banner */}
      <section className="bg-gradient-to-r from-[#8D173E] to-[#A91F4E] py-16">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Ready to find your perfect room?</h2>
          <p className="text-rose-100 mb-8 max-w-md mx-auto text-sm">
            Join over 2,400 students who found safe, affordable accommodation through AAMUSTED Rent Guide.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <button
              onClick={() => isAuthenticated ? navigate(dashboardPage) : navigate("auth")}
              className="bg-white text-rose-700 font-semibold px-7 py-3 rounded-xl hover:bg-rose-50 transition-colors text-sm"
            >
              {isAuthenticated ? "Go to Dashboard" : "Get Started Free"}
            </button>
            <button
              onClick={() => navigate("listings")}
              className="border border-white/30 text-white font-medium px-7 py-3 rounded-xl hover:bg-white/10 transition-colors text-sm"
            >
              Browse Listings
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <LogoMark size="sm" />
                <span className="font-bold text-white text-sm">AAMUSTED Rent Guide</span>
              </div>
              <p className="text-sm leading-relaxed">
                Helping AAMUSTED students find safe, verified, and affordable accommodation.
              </p>
            </div>
            {[
              {
                title: "Platform",
                links: ["Find Rooms", "How It Works", "Pricing", "Reviews"],
              },
              {
                title: "Landlords",
                links: ["List Your Hostel", "Verification Process", "Dashboard", "Pricing"],
              },
              {
                title: "Support",
                links: ["Help Center", "Report a Fraud", "Contact Us", "Safety Tips"],
              },
            ].map((col) => (
              <div key={col.title}>
                <h4 className="text-white font-semibold text-sm mb-4">{col.title}</h4>
                <ul className="space-y-2">
                  {col.links.map((link) => (
                    <li key={link}>
                      <button onClick={() => handleFooterLink(link)} className="text-left text-sm hover:text-white transition-colors">
                        {link}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
            <p>© 2025 AAMUSTED Rent Guide. All rights reserved.</p>
            <div className="flex items-center gap-5">
              <button onClick={() => scrollToSection("top")} className="hover:text-white transition-colors">Privacy Policy</button>
              <button onClick={() => scrollToSection("top")} className="hover:text-white transition-colors">Terms of Service</button>
              <button onClick={() => scrollToSection("top")} className="hover:text-white transition-colors">Cookie Policy</button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ── Student Dashboard ─────────────────────────────────────────────────────────

function StudentDashboard({ navigate }: { navigate: (p: Page) => void }) {
  const [activeFilter, setActiveFilter] = useState("All");
  const filters = ["All", "Under GH₵3k", "Self-contain", "Wi-Fi", "Within 1km", "Available Now", "Verified Only"];
  const emptyDashboard: StudentDashboardData = {
    user: readStoredUser() ?? {
      id: 0,
      name: "Student",
      email: "",
      role: "student",
    },
    saved_count: 0,
    new_listings: 0,
    unread_messages: 0,
    recommended_count: 0,
    recommended: [],
    saved_listings: [],
    recent_messages: [],
  };
  const [dashboard, setDashboard] = useState<StudentDashboardData>(emptyDashboard);
  const [dashboardStatus, setDashboardStatus] = useState<"loading" | "api" | "error">("loading");
  const [dashboardMessage, setDashboardMessage] = useState("Loading your dashboard...");

  useEffect(() => {
    let active = true;

    api.getStudentDashboard()
      .then((data) => {
        if (!active) return;
        setDashboard(data);
        setDashboardStatus("api");
        setDashboardMessage("Dashboard updated.");
      })
      .catch((error) => {
        if (!active) return;
        setDashboardStatus("error");
        setDashboardMessage(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
      });

    return () => {
      active = false;
    };
  }, []);

  const recommended = dashboard.recommended.map(mapApiHostel).filter((hostel) => {
    if (activeFilter === "Under GH₵3k") return hostel.price < 3000;
    if (activeFilter === "Self-contain") return hostel.type === "Self-contain";
    if (activeFilter === "Wi-Fi") return hostel.facilities.includes("wifi");
    if (activeFilter === "Within 1km") return hostel.distance.includes("0.") || hostel.distance.includes("1 km");
    if (activeFilter === "Available Now") return hostel.available;
    if (activeFilter === "Verified Only") return hostel.verified;
    return true;
  });
  const savedListings = dashboard.saved_listings.map(mapApiHostel);
  const firstName = dashboard.user.name.split(" ")[0] || "Student";

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <DashboardSidebar role="student" navigate={navigate} activePage="student-dashboard" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title="Dashboard" navigate={navigate} />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto space-y-6">
            <div
              className={`rounded-xl border px-4 py-3 text-sm flex items-start gap-2 ${
                dashboardStatus === "api"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : dashboardStatus === "error"
                    ? "bg-red-50 border-red-200 text-red-700"
                    : dashboardStatus === "loading"
                      ? "bg-slate-50 border-slate-200 text-slate-600"
                      : "bg-amber-50 border-amber-200 text-amber-800"
              }`}
            >
              {dashboardStatus === "loading" ? <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
              <span>{dashboardMessage}</span>
            </div>
            {/* Welcome banner */}
            <div className="bg-gradient-to-r from-[#8D173E] to-[#A91F4E] rounded-2xl p-6 text-white">
              <p className="text-rose-200 text-sm font-medium mb-1">Good morning</p>
              <h2 className="text-xl font-bold mb-1">Welcome back, {firstName}!</h2>
              <p className="text-rose-200 text-sm">
                {dashboard.recommended_count} verified listings match your saved preferences.
              </p>
              <button
                onClick={() => navigate("listings")}
                className="mt-4 bg-white text-rose-700 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-rose-50 transition-colors inline-flex items-center gap-2"
              >
                Browse New Listings <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Saved Hostels"
                value={dashboard.saved_count}
                icon={<Bookmark className="w-5 h-5" />}
                color="rose"
              />
              <StatCard
                title="New Listings"
                value={dashboard.new_listings}
                icon={<Building2 className="w-5 h-5" />}
                color="emerald"
              />
              <StatCard
                title="Unread Messages"
                value={dashboard.unread_messages}
                icon={<MessageSquare className="w-5 h-5" />}
                color="amber"
              />
              <StatCard
                title="Recommended"
                value={dashboard.recommended_count}
                icon={<Star className="w-5 h-5" />}
                color="rose"
              />
            </div>

            {/* Quick filters */}
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Quick Filters</h3>
              <div className="flex flex-wrap gap-2">
                {filters.map((f) => (
                  <button
                    key={f}
                    onClick={() => setActiveFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      activeFilter === f
                        ? "bg-[#8D173E] text-white border-[#8D173E]"
                        : "bg-white text-slate-600 border-slate-200 hover:border-rose-300 hover:text-[#8D173E]"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Recommended */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-900">Recommended for You</h3>
                <button
                  onClick={() => navigate("listings")}
                  className="text-sm text-[#8D173E] font-medium hover:text-[#741231] flex items-center gap-1"
                >
                  See all <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recommended.slice(0, 3).map((h) => (
                  <HostelCard key={h.id} hostel={h} navigate={navigate} compact />
                ))}
                {recommended.length === 0 && (
                  <p className="text-sm text-slate-500">No recommendations match this quick filter yet.</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
              <div className="xl:col-span-2 space-y-5">
                <SectionCard
                  title="Saved Listings"
                  action={
                    <button
                      onClick={() => navigate("student-saved")}
                      className="text-xs text-[#8D173E] font-semibold hover:text-[#741231]"
                    >
                      View all
                    </button>
                  }
                >
                  <div className="space-y-3">
                    {savedListings.length === 0 ? (
                      <p className="text-sm text-slate-500">No saved listings yet.</p>
                    ) : savedListings.map((h) => (
                      <div
                        key={h.id}
                        className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors"
                      >
                        <img
                          src={h.image}
                          alt={h.name}
                          className="w-full sm:w-20 h-28 sm:h-16 rounded-lg object-cover bg-slate-100"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-slate-900 text-sm">{h.name}</p>
                            {h.verified && <VerifiedBadge />}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">{h.location} · {h.distance}</p>
                        </div>
                        <div className="flex sm:flex-col items-center sm:items-end justify-between gap-3">
                          <p className="font-bold text-slate-900 text-sm">GH₵{h.price.toLocaleString()}</p>
                          <button
                            onClick={() => openHostelDetail(navigate, h.id)}
                            className="text-xs text-[#8D173E] font-semibold hover:text-[#741231]"
                          >
                            Details
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard
                  title="Rental Guide"
                  action={
                    <button
                      onClick={() => navigate("student-guide")}
                      className="text-xs text-[#8D173E] font-semibold hover:text-[#741231]"
                    >
                      Open guide
                    </button>
                  }
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { title: "Before paying", desc: "Inspect rooms, confirm ownership, and request a receipt.", icon: <Shield className="w-5 h-5" /> },
                      { title: "Compare fairly", desc: "Check annual rate, utilities, distance, and transport cost.", icon: <BarChart2 className="w-5 h-5" /> },
                      { title: "Report concerns", desc: "Flag suspicious listings so admins can investigate quickly.", icon: <Flag className="w-5 h-5" /> },
                    ].map((item) => (
                      <div key={item.title} className="rounded-xl border border-slate-100 p-4 bg-slate-50">
                        <div className="w-9 h-9 rounded-lg bg-white text-[#8D173E] flex items-center justify-center mb-3 border border-slate-100">
                          {item.icon}
                        </div>
                        <p className="font-semibold text-slate-900 text-sm mb-1">{item.title}</p>
                        <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              </div>

              <div className="space-y-5">
                <SectionCard
                  title="Messages"
                  action={
                    <button
                      onClick={() => navigate("student-messages")}
                      className="text-xs text-[#8D173E] font-semibold hover:text-[#741231]"
                    >
                      Open inbox
                    </button>
                  }
                >
                  <div className="space-y-4">
                    {dashboard.recent_messages.length === 0 ? (
                      <p className="text-sm text-slate-500">No recent messages yet.</p>
                    ) : dashboard.recent_messages.map((m) => (
                      <div key={m.id} className="flex gap-3">
                        <div className="w-9 h-9 rounded-full bg-rose-50 text-rose-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                          {(m.sender?.name ?? "M")[0]}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-slate-900 truncate">{m.sender?.name ?? "Message"}</p>
                            <span className="text-xs text-slate-400">{formatDate(m.created_at)}</span>
                          </div>
                          <p className="text-xs text-slate-500 leading-relaxed">{m.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard title="Profile Readiness">
                  <div className="space-y-3">
                    {[
                      { label: "Student ID verified", done: true },
                      { label: "Accommodation preferences", done: true },
                      { label: "Emergency contact", done: false },
                      { label: "Viewing checklist saved", done: false },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">{item.label}</span>
                        {item.done ? (
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Clock className="w-4 h-4 text-amber-500" />
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => navigate("student-profile")}
                      className="w-full mt-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
                    >
                      Complete Profile
                    </button>
                  </div>
                </SectionCard>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function StudentPortalShell({
  title,
  activePage,
  navigate,
  children,
}: {
  title: string;
  activePage: Page;
  navigate: (p: Page) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <DashboardSidebar role="student" navigate={navigate} activePage={activePage} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title={title} navigate={navigate} />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

function StudentSavedPage({ navigate }: { navigate: (p: Page) => void }) {
  const [saved, setSaved] = useState<Hostel[]>([]);
  const [savedStatus, setSavedStatus] = useState<"loading" | "api" | "error">("loading");
  const [savedMessage, setSavedMessage] = useState("Loading saved listings...");

  useEffect(() => {
    let active = true;

    api.getSavedListings()
      .then((items) => {
        if (!active) return;
        setSaved(items.map(mapApiHostel));
        setSavedStatus("api");
        setSavedMessage("Saved listings loaded.");
      })
      .catch((error) => {
        if (!active) return;

        setSavedStatus("error");
        setSavedMessage(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
      });

    return () => {
      active = false;
    };
  }, []);

  const removeSaved = async (hostel: Hostel) => {
    const previous = saved;
    setSaved((current) => current.filter((item) => item.id !== hostel.id));

    try {
      await api.removeSavedListing(hostel.id);
      setSavedStatus("api");
      setSavedMessage(`${hostel.name} was removed from your saved listings.`);
    } catch (error) {
      if (error instanceof ApiError) {
        setSaved(previous);
        setSavedStatus("error");
        setSavedMessage(error.message);
        return;
      }

      setSaved(previous);
      setSavedStatus("error");
      setSavedMessage("Something went wrong. Please try again.");
    }
  };

  return (
    <StudentPortalShell title="Saved Listings" activePage="student-saved" navigate={navigate}>
      <div
        className={`rounded-xl border px-4 py-3 text-sm flex items-start gap-2 ${
          savedStatus === "api"
            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
            : savedStatus === "error"
              ? "bg-red-50 border-red-200 text-red-700"
              : savedStatus === "loading"
                ? "bg-slate-50 border-slate-200 text-slate-600"
                : "bg-amber-50 border-amber-200 text-amber-800"
        }`}
      >
        {savedStatus === "loading" ? (
          <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />
        ) : savedStatus === "error" ? (
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        ) : (
          <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        )}
        <span>{savedMessage}</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Saved accommodation</h2>
          <p className="text-sm text-slate-500">Track rooms you want to inspect, compare, or contact later.</p>
        </div>
        <button
          onClick={() => navigate("listings")}
          className="bg-[#8D173E] hover:bg-[#741231] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors inline-flex items-center justify-center gap-2"
        >
          <Search className="w-4 h-4" />
          Find More Rooms
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Saved Listings" value={saved.length} icon={<Bookmark className="w-5 h-5" />} color="rose" />
        <StatCard title="Available Now" value={saved.filter((h) => h.available).length} icon={<CheckCircle className="w-5 h-5" />} color="emerald" />
        <StatCard title="Inspections Booked" value="2" icon={<CalendarIcon />} color="amber" />
        <StatCard title="Avg. Price" value="GH₵3,850" icon={<BarChart2 className="w-5 h-5" />} color="rose" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {saved.map((h) => (
          <div key={h.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col sm:flex-row gap-4">
            <img src={h.image} alt={h.name} className="w-full sm:w-40 h-36 rounded-xl object-cover bg-slate-100" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h3 className="font-semibold text-slate-900 text-sm">{h.name}</h3>
                {h.verified && <VerifiedBadge />}
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                <MapPin className="w-3 h-3" />
                {h.location}
              </p>
              <p className="text-xs text-[#8D173E] font-medium mb-3">{h.distance}</p>
              <div className="flex flex-wrap gap-1 mb-4">
                {h.facilities.slice(0, 3).map((f) => <FacilityIcon key={f} type={f} />)}
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-900">GH₵{h.price.toLocaleString()}</p>
                  <p className="text-xs text-slate-400">per semester</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openHostelDetail(navigate, h.id)}
                    className="text-xs font-semibold text-white bg-[#8D173E] hover:bg-[#741231] px-3 py-2 rounded-lg transition-colors"
                  >
                    View
                  </button>
                  <button
                    onClick={() => removeSaved(h)}
                    className="text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 px-3 py-2 rounded-lg transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </StudentPortalShell>
  );
}

function CalendarIcon() {
  return <Clock className="w-5 h-5" />;
}

function StudentMessagesPage({ navigate }: { navigate: (p: Page) => void }) {
  const [selected, setSelected] = useState("");
  const currentUserId = readStoredUser()?.id ?? 0;
  const [apiMessages, setApiMessages] = useState<ApiMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [messageStatus, setMessageStatus] = useState<"loading" | "api" | "error">("loading");
  const [messageNotice, setMessageNotice] = useState("Loading messages...");

  useEffect(() => {
    let active = true;

    api.getMessages()
      .then((items) => {
        if (!active) return;
        setApiMessages(items);
        if (items[0]) {
          const otherId = items[0].sender_id === currentUserId ? items[0].receiver_id : items[0].sender_id;
          setSelected(`${items[0].hostel_id ?? 0}-${otherId}`);
        }
        setMessageStatus("api");
        setMessageNotice("Messages loaded.");
      })
      .catch((error) => {
        if (!active) return;

        setMessageStatus("error");
        setMessageNotice(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
      });

    return () => {
      active = false;
    };
  }, []);

  type Conversation = {
    key: string;
    hostel_id: number;
    receiver_id: number;
    hostel: string;
    landlord: string;
    time: string;
    unread: number;
    text: string;
  };

  const conversations = apiMessages.reduce<Conversation[]>((items, message) => {
      const otherId = message.sender_id === currentUserId ? message.receiver_id : message.sender_id;
      const key = `${message.hostel_id ?? 0}-${otherId}`;
      if (items.some((item) => item.key === key)) return items;
      const otherUser = message.sender_id === currentUserId ? message.receiver : message.sender;
      items.push({
        key,
        hostel_id: message.hostel_id ?? 0,
        receiver_id: otherId,
        hostel: message.hostel?.name ?? "AAMUSTED Rent Guide",
        landlord: otherUser?.name ?? "Landlord",
        time: new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        unread: 0,
        text: message.body,
      });
      return items;
    }, []);
  const current = conversations.find((c) => c.key === selected) ?? conversations[0];

  const threadMessages = current
    ? apiMessages
        .filter((message) => {
          const otherId = message.sender_id === currentUserId ? message.receiver_id : message.sender_id;
          return (message.hostel_id ?? 0) === current.hostel_id && otherId === current.receiver_id;
        })
        .reverse()
        .map((message) => ({
          from: message.sender_id === currentUserId ? "student" : "landlord",
          text: message.body,
          time: new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        }))
    : [];

  const sendMessage = async () => {
    if (!messageText.trim()) return;
    if (!current) {
      setMessageStatus("error");
      setMessageNotice("Open a conversation before sending a message.");
      return;
    }

    const outgoing = messageText.trim();
    setMessageText("");

    try {
      const sent = await api.sendMessage({ receiver_id: current.receiver_id, hostel_id: current.hostel_id, body: outgoing });
      setApiMessages((items) => [sent, ...items]);
      setMessageStatus("api");
      setMessageNotice("Message sent.");
    } catch (error) {
      if (error instanceof ApiError) {
        setMessageStatus("error");
        setMessageNotice(error.message);
        return;
      }

      setMessageStatus("error");
      setMessageNotice("Something went wrong. Please try again.");
      setMessageText(outgoing);
    }
  };

  return (
    <StudentPortalShell title="Messages" activePage="student-messages" navigate={navigate}>
      <div
        className={`rounded-xl border px-4 py-3 text-sm flex items-start gap-2 ${
          messageStatus === "api"
            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
            : messageStatus === "error"
              ? "bg-red-50 border-red-200 text-red-700"
              : messageStatus === "loading"
                ? "bg-slate-50 border-slate-200 text-slate-600"
                : "bg-amber-50 border-amber-200 text-amber-800"
        }`}
      >
        {messageStatus === "loading" ? (
          <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />
        ) : messageStatus === "error" ? (
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        ) : (
          <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        )}
        <span>{messageNotice}</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[20rem_minmax(0,1fr)] gap-5 min-h-[34rem]">
        <SectionCard title="Conversations">
          <div className="space-y-2">
            {conversations.length === 0 ? (
              <p className="text-sm text-slate-500">No conversations yet. Contact a landlord from a listing to start one.</p>
            ) : conversations.map((c) => (
              <button
                key={c.key}
                onClick={() => setSelected(c.key)}
                className={`w-full text-left rounded-xl border p-3 transition-colors ${
                  selected === c.key ? "border-[#8D173E] bg-rose-50" : "border-slate-100 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{c.hostel}</p>
                    <p className="text-xs text-slate-500">{c.landlord}</p>
                  </div>
                  <span className="text-xs text-slate-400">{c.time}</span>
                </div>
                <p className="text-xs text-slate-500 mt-2 line-clamp-2">{c.text}</p>
                {c.unread > 0 && (
                  <span className="mt-2 inline-flex text-xs font-bold bg-[#8D173E] text-white rounded-full px-2 py-0.5">
                    {c.unread} new
                  </span>
                )}
              </button>
            ))}
          </div>
        </SectionCard>

        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            {current ? (
              <>
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">{current.hostel}</h3>
                  <p className="text-xs text-slate-500">{current.landlord} · usually replies within 2 hours</p>
                </div>
                <button
                  onClick={() => openHostelDetail(navigate, current.hostel_id)}
                  className="text-xs font-semibold text-[#8D173E] hover:text-[#741231]"
                >
                  View listing
                </button>
              </>
            ) : (
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">No conversation selected</h3>
                <p className="text-xs text-slate-500">Messages will appear here.</p>
              </div>
            )}
          </div>
          <div className="flex-1 p-5 space-y-4 bg-slate-50">
            {threadMessages.length === 0 ? (
              <div className="h-full min-h-64 flex items-center justify-center text-sm text-slate-500">
                No messages to show.
              </div>
            ) : threadMessages.map((msg, index) => (
              <div key={index} className={`flex ${msg.from === "student" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${
                  msg.from === "student" ? "bg-[#8D173E] text-white" : "bg-white text-slate-700 border border-slate-100"
                }`}>
                  <p>{msg.text}</p>
                  <p className={`text-[11px] mt-1 ${msg.from === "student" ? "text-white/70" : "text-slate-400"}`}>{msg.time}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-slate-100 flex gap-3">
            <input
              value={messageText}
              onChange={(event) => setMessageText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  sendMessage();
                }
              }}
              className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200"
              placeholder="Type a message..."
              disabled={!current}
            />
            <button
              onClick={sendMessage}
              disabled={!current}
              className="bg-[#8D173E] hover:bg-[#741231] disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
            >
              Send
            </button>
          </div>
        </section>
      </div>
    </StudentPortalShell>
  );
}

function StudentReviewsPage({ navigate }: { navigate: (p: Page) => void }) {
  const [reviews, setReviews] = useState<ApiReview[]>([]);
  const [reviewableListings, setReviewableListings] = useState<Hostel[]>([]);
  const [selectedHostelId, setSelectedHostelId] = useState(0);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [editingReviewId, setEditingReviewId] = useState<number | null>(null);
  const [editingRating, setEditingRating] = useState(5);
  const [editingComment, setEditingComment] = useState("");
  const [reviewStatus, setReviewStatus] = useState<"loading" | "api" | "error" | "saving">("loading");
  const [reviewMessage, setReviewMessage] = useState("Loading reviews...");

  useEffect(() => {
    let active = true;

    Promise.all([api.getMyReviews(), api.getListings()])
      .then(([items, listingItems]) => {
        if (!active) return;
        const mappedListings = listingItems.map(mapApiHostel);
        setReviews(items);
        setReviewableListings(mappedListings);
        setSelectedHostelId(mappedListings[0]?.id ?? 0);
        setReviewStatus("api");
        setReviewMessage("Reviews loaded.");
      })
      .catch((error) => {
        if (!active) return;

        setReviewStatus("error");
        setReviewMessage(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
      });

    return () => {
      active = false;
    };
  }, []);

  const publishReview = async () => {
    if (!comment.trim()) {
      setReviewStatus("error");
      setReviewMessage("Write a review comment before publishing.");
      return;
    }
    if (!selectedHostelId) {
      setReviewStatus("error");
      setReviewMessage("No listing is available to review yet.");
      return;
    }

    setReviewStatus("saving");
    setReviewMessage("Publishing review...");

    try {
      const created = await api.createReview({
        hostel_id: selectedHostelId,
        rating,
        comment,
      });
      const hostel = reviewableListings.find((item) => item.id === selectedHostelId);
      setReviews((items) => [{ ...created, hostel: created.hostel ?? (hostel ? { id: hostel.id, name: hostel.name } : null) }, ...items]);
      setComment("");
      setRating(5);
      setReviewStatus("api");
      setReviewMessage("Review published.");
    } catch (error) {
      if (error instanceof ApiError) {
        setReviewStatus("error");
        setReviewMessage(error.message);
        return;
      }

      setReviewStatus("error");
      setReviewMessage("Something went wrong. Please try again.");
    }
  };

  const deleteReview = async (review: ApiReview) => {
    const previous = reviews;
    setReviews((items) => items.filter((item) => item.id !== review.id));

    try {
      await api.deleteReview(review.id);
      setReviewStatus("api");
      setReviewMessage("Review deleted.");
    } catch (error) {
      if (error instanceof ApiError) {
        setReviews(previous);
        setReviewStatus("error");
        setReviewMessage(error.message);
        return;
      }

      setReviews(previous);
      setReviewStatus("error");
      setReviewMessage("Something went wrong. Please try again.");
    }
  };

  const startEditingReview = (review: ApiReview) => {
    setEditingReviewId(review.id);
    setEditingRating(review.rating);
    setEditingComment(review.comment);
  };

  const cancelEditingReview = () => {
    setEditingReviewId(null);
    setEditingRating(5);
    setEditingComment("");
  };

  const saveEditedReview = async (review: ApiReview) => {
    if (!editingComment.trim()) {
      setReviewStatus("error");
      setReviewMessage("Review comment cannot be empty.");
      return;
    }

    setReviewStatus("saving");
    setReviewMessage("Updating review...");

    try {
      const updated = await api.updateReview(review.id, {
        rating: editingRating,
        comment: editingComment,
      });
      setReviews((items) => items.map((item) => item.id === review.id ? { ...item, ...updated } : item));
      cancelEditingReview();
      setReviewStatus("api");
      setReviewMessage("Review updated.");
    } catch (error) {
      if (error instanceof ApiError) {
        setReviewStatus("error");
        setReviewMessage(error.message);
        return;
      }

      setReviewStatus("error");
      setReviewMessage("Something went wrong. Please try again.");
    }
  };

  return (
    <StudentPortalShell title="My Reviews" activePage="student-reviews" navigate={navigate}>
      <div
        className={`rounded-xl border px-4 py-3 text-sm flex items-start gap-2 ${
          reviewStatus === "api"
            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
            : reviewStatus === "error"
              ? "bg-red-50 border-red-200 text-red-700"
              : reviewStatus === "loading" || reviewStatus === "saving"
                ? "bg-slate-50 border-slate-200 text-slate-600"
                : "bg-amber-50 border-amber-200 text-amber-800"
        }`}
      >
        {reviewStatus === "loading" || reviewStatus === "saving" ? (
          <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />
        ) : reviewStatus === "error" ? (
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        ) : (
          <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        )}
        <span>{reviewMessage}</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_24rem] gap-5">
        <SectionCard title="Reviews You Posted">
          <div className="space-y-5">
            {reviews.length === 0 ? (
              <p className="text-sm text-slate-500">No reviews yet.</p>
            ) : reviews.map((review) => (
              <div key={review.id} className="rounded-xl border border-slate-100 p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{review.hostel?.name ?? "Student accommodation"}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(review.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Star key={index} className={`w-4 h-4 ${index < review.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />
                    ))}
                  </div>
                </div>
                {editingReviewId === review.id ? (
                  <div className="space-y-3">
                    <div className="flex gap-1">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <button key={index} onClick={() => setEditingRating(index + 1)} className="p-1">
                          <Star className={`w-5 h-5 ${index < editingRating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />
                        </button>
                      ))}
                    </div>
                    <textarea
                      rows={4}
                      value={editingComment}
                      onChange={(event) => setEditingComment(event.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rose-200"
                    />
                  </div>
                ) : (
                  <p className="text-sm text-slate-600 leading-relaxed">{review.comment}</p>
                )}
                <div className="flex gap-2 mt-4">
                  {editingReviewId === review.id ? (
                    <>
                      <button onClick={() => saveEditedReview(review)} className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg">Save Changes</button>
                      <button onClick={cancelEditingReview} className="text-xs font-semibold text-slate-600 bg-slate-50 px-3 py-2 rounded-lg">Cancel</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => startEditingReview(review)} className="text-xs font-semibold text-[#8D173E] bg-rose-50 px-3 py-2 rounded-lg">Edit</button>
                      <button
                        onClick={() => deleteReview(review)}
                        className="text-xs font-semibold text-red-600 bg-red-50 px-3 py-2 rounded-lg"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Write a Review">
          <div className="space-y-4">
            <select
              value={selectedHostelId}
              onChange={(event) => setSelectedHostelId(Number(event.target.value))}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-200"
            >
              {reviewableListings.length === 0 ? (
                <option value={0}>No listings available</option>
              ) : reviewableListings.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Rating</label>
              <div className="flex gap-1">
                {Array.from({ length: 5 }).map((_, index) => (
                  <button key={index} onClick={() => setRating(index + 1)} className="p-1">
                    <Star className={`w-6 h-6 ${index < rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />
                  </button>
                ))}
              </div>
            </div>
            <textarea
              rows={5}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Share details about safety, utilities, landlord response, and value..."
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rose-200"
            />
            <button
              onClick={publishReview}
              disabled={reviewStatus === "saving"}
              className="w-full bg-[#8D173E] hover:bg-[#741231] disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
            >
              {reviewStatus === "saving" ? "Publishing..." : "Publish Review"}
            </button>
          </div>
        </SectionCard>
      </div>
    </StudentPortalShell>
  );
}

function StudentGuidePage({ navigate }: { navigate: (p: Page) => void }) {
  return (
    <StudentPortalShell title="Rental Guide" activePage="student-guide" navigate={navigate}>
      <div className="bg-gradient-to-r from-[#8D173E] to-[#A91F4E] rounded-2xl p-6 text-white">
        <h2 className="text-xl font-bold mb-2">Safe Renting Checklist for AAMUSTED Students</h2>
        <p className="text-rose-100 text-sm max-w-2xl">Use this guide before inspecting, paying, or signing for accommodation around Tanoso and Kumasi.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[
          { title: "Before Inspection", icon: <Search className="w-6 h-6" />, items: ["Confirm exact location", "Check verified badge", "Compare price to similar rooms", "Ask what utilities are included"] },
          { title: "During Inspection", icon: <Eye className="w-6 h-6" />, items: ["Test water and power", "Inspect locks and windows", "Check distance to transport", "Take photos for comparison"] },
          { title: "Before Payment", icon: <Shield className="w-6 h-6" />, items: ["Verify landlord identity", "Request written receipt", "Avoid rushed payment pressure", "Report suspicious behaviour"] },
        ].map((section) => (
          <SectionCard key={section.title} title={section.title}>
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-[#8D173E] flex items-center justify-center mb-4">
              {section.icon}
            </div>
            <div className="space-y-3">
              {section.items.map((item) => (
                <div key={item} className="flex items-start gap-2 text-sm text-slate-600">
                  <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </SectionCard>
        ))}
      </div>

      <SectionCard
        title="Recommended Next Steps"
        action={<button onClick={() => navigate("listings")} className="text-xs font-semibold text-[#8D173E]">Browse rooms</button>}
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {["Save 3-5 options", "Message verified landlords", "Inspect before payment", "Leave a review after moving in"].map((item, index) => (
            <div key={item} className="rounded-xl bg-slate-50 border border-slate-100 p-4">
              <span className="text-xs font-bold text-amber-600">0{index + 1}</span>
              <p className="text-sm font-semibold text-slate-900 mt-2">{item}</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </StudentPortalShell>
  );
}

function StudentReportsPage({ navigate }: { navigate: (p: Page) => void }) {
  const [reports, setReports] = useState<ApiReport[]>([]);
  const [hostels, setHostels] = useState<ApiHostel[]>([]);
  const [hostelId, setHostelId] = useState("");
  const [reason, setReason] = useState("");
  const [severity, setSeverity] = useState<"low" | "medium" | "high">("medium");
  const [status, setStatus] = useState<"loading" | "saving" | "api" | "error">("loading");
  const [message, setMessage] = useState("Loading your reports...");
  useEffect(() => { Promise.all([api.getStudentReports(), api.getListings()]).then(([items, listings]) => { setReports(items); setHostels(listings); setStatus("api"); setMessage("Your issue reports are up to date."); }).catch((error) => { setStatus("error"); setMessage(error instanceof ApiError ? error.message : "Could not load reports."); }); }, []);
  const submit = async () => {
    if (!reason.trim()) { setStatus("error"); setMessage("Describe the issue before submitting."); return; }
    setStatus("saving"); setMessage("Sending issue to administrators...");
    try { const report = await api.createStudentReport({ hostel_id: hostelId ? Number(hostelId) : undefined, reason: reason.trim(), severity }); setReports((items) => [report, ...items]); setReason(""); setHostelId(""); setSeverity("medium"); setStatus("api"); setMessage("Your report was sent to all administrators."); } catch (error) { setStatus("error"); setMessage(error instanceof ApiError ? error.message : "Could not submit report."); }
  };
  return <StudentPortalShell title="Report Issue" activePage="student-reports" navigate={navigate}>
    <AdminNotice status={status} message={message} />
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-5">
      <SectionCard title="Send Issue to Admin"><div className="space-y-4"><select value={hostelId} onChange={(e) => setHostelId(e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 bg-white"><option value="">General platform issue</option>{hostels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select><select value={severity} onChange={(e) => setSeverity(e.target.value as typeof severity)} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 bg-white"><option value="low">Low severity</option><option value="medium">Medium severity</option><option value="high">High severity / urgent</option></select><textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={6} placeholder="Explain what happened, including useful details for the administrator..." className="w-full border border-slate-200 rounded-xl px-4 py-3 resize-none" /><button onClick={submit} disabled={status === "saving"} className="w-full bg-[#8D173E] text-white rounded-xl py-2.5 font-semibold disabled:opacity-60">Submit Report</button></div></SectionCard>
      <SectionCard title="My Reports"><div className="space-y-3">{reports.length ? reports.map((report) => <div key={report.id} className="border border-slate-100 rounded-xl p-4"><div className="flex justify-between gap-3"><div><p className="font-semibold text-sm text-slate-900">{report.hostel?.name ?? "General platform issue"}</p><p className="text-xs text-slate-500 mt-1">{formatDate(report.created_at)}</p></div><AdminStatusBadge status={report.status} /></div><p className="text-sm text-slate-600 mt-3">{report.reason}</p><span className="inline-block mt-2 text-xs font-semibold text-rose-700">{report.severity} severity</span></div>) : <p className="text-sm text-slate-500">You have not submitted any issue reports.</p>}</div></SectionCard>
    </div>
  </StudentPortalShell>;
}

function StudentProfilePage({ navigate }: { navigate: (p: Page) => void }) {
  const storedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("srg_auth_user") ?? "{}") as {
        name?: string;
        email?: string;
        phone?: string;
        student_id?: string;
        programme?: string;
        profile_photo?: string;
      };
    } catch {
      return {};
    }
  })();
  const [firstName, setFirstName] = useState((storedUser.name ?? "").split(" ")[0] ?? "");
  const [lastName, setLastName] = useState((storedUser.name ?? "").split(" ").slice(1).join(" "));
  const [email, setEmail] = useState(storedUser.email ?? "");
  const [phone, setPhone] = useState(storedUser.phone ?? "");
  const [studentId, setStudentId] = useState(storedUser.student_id ?? "");
  const [programme, setProgramme] = useState(storedUser.programme ?? "");
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState(resolveMediaUrl(storedUser.profile_photo));
  const [preferredLocations, setPreferredLocations] = useState("Tanoso, Abuakwa, Kwadaso");
  const [profileStatus, setProfileStatus] = useState<"idle" | "saving" | "api" | "error">("idle");
  const [profileMessage, setProfileMessage] = useState("");

  const handleProfileSave = async () => {
    const name = `${firstName.trim()} ${lastName.trim()}`.trim();

    if (!name || !email.trim()) {
      setProfileStatus("error");
      setProfileMessage("Name and email are required.");
      return;
    }

    setProfileStatus("saving");
    setProfileMessage("Saving profile...");

    try {
      const result = await api.updateProfile({
        name,
        email,
        phone,
        student_id: studentId,
        programme,
        profile_photo_file: profilePhoto,
      });
      localStorage.setItem("srg_auth_user", JSON.stringify(result.user));
      localStorage.setItem("srg_auth_role", result.user.role);
      window.dispatchEvent(new Event("srg:user-updated"));
      setProfileStatus("api");
      setProfileMessage("Profile saved.");
    } catch (error) {
      if (error instanceof ApiError) {
        setProfileStatus("error");
        setProfileMessage(error.message);
        return;
      }

      setProfileStatus("error");
      setProfileMessage("Something went wrong. Please try again.");
    }
  };

  return (
    <StudentPortalShell title="Profile" activePage="student-profile" navigate={navigate}>
      {profileStatus !== "idle" && (
        <div className={`rounded-2xl p-4 flex gap-3 text-sm ${
          profileStatus === "error"
            ? "bg-red-50 border border-red-200 text-red-700"
            : "bg-emerald-50 border border-emerald-200 text-emerald-700"
        }`}>
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          {profileMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_22rem] gap-5">
        <SectionCard title="Personal Information">
          <label className="mb-6 flex items-center gap-4 cursor-pointer w-fit">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-rose-50 border-2 border-rose-100 flex items-center justify-center">
              {profilePhotoPreview ? <img src={profilePhotoPreview} alt="Profile preview" className="w-full h-full object-cover" /> : <User className="w-8 h-8 text-rose-500" />}
            </div>
            <div><p className="text-sm font-semibold text-slate-800">Choose profile picture</p><p className="text-xs text-slate-500">JPG, PNG or WEBP, maximum 5MB</p></div>
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => { const file = event.target.files?.[0] ?? null; setProfilePhoto(file); if (file) setProfilePhotoPreview(URL.createObjectURL(file)); }} />
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: "First name", value: firstName, onChange: setFirstName },
              { label: "Last name", value: lastName, onChange: setLastName },
              { label: "Email", value: email, onChange: setEmail, type: "email" },
              { label: "Phone", value: phone, onChange: setPhone },
              { label: "Student ID", value: studentId, onChange: setStudentId },
              { label: "Programme", value: programme, onChange: setProgramme },
            ].map((field) => (
              <div key={field.label}>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">{field.label}</label>
                <input
                  type={field.type ?? "text"}
                  value={field.value}
                  onChange={(event) => field.onChange(event.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200"
                />
              </div>
            ))}
          </div>
          <div className="mt-5">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Preferred locations</label>
            <input
              value={preferredLocations}
              onChange={(event) => setPreferredLocations(event.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mt-6 pt-5 border-t border-slate-100">
            <button
              onClick={handleProfileSave}
              disabled={profileStatus === "saving"}
              className="bg-[#8D173E] hover:bg-[#741231] disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
            >
              {profileStatus === "saving" ? "Saving..." : "Save Profile"}
            </button>
            <button
              onClick={() => navigate("student-password")}
              className="border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
            >
              Change Password
            </button>
          </div>
        </SectionCard>

        <div className="space-y-5">
          <SectionCard title="Profile Completion">
            <div className="space-y-3">
              {[
                { label: "Student email verified", done: true },
                { label: "Phone number added", done: true },
                { label: "Preferred budget saved", done: true },
                { label: "Emergency contact", done: false },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{item.label}</span>
                  {item.done ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Clock className="w-4 h-4 text-amber-500" />}
                </div>
              ))}
            </div>
          </SectionCard>
          <SectionCard title="Account Actions">
            <div className="space-y-2">
              <button onClick={() => navigate("student-password")} className="w-full text-left rounded-xl border border-slate-100 p-3 text-sm text-slate-700 hover:bg-slate-50">
                Reset password
              </button>
              <button onClick={() => navigate("student-saved")} className="w-full text-left rounded-xl border border-slate-100 p-3 text-sm text-slate-700 hover:bg-slate-50">
                Manage saved listings
              </button>
              <button
                onClick={() => {
                  clearSession();
                  navigate("auth");
                }}
                className="w-full text-left rounded-xl border border-red-100 p-3 text-sm text-red-600 hover:bg-red-50"
              >
                Sign out
              </button>
            </div>
          </SectionCard>
        </div>
      </div>
    </StudentPortalShell>
  );
}

function StudentPasswordPage({ navigate }: { navigate: (p: Page) => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState<"idle" | "saving" | "api" | "error">("idle");
  const [passwordMessage, setPasswordMessage] = useState("");

  const handlePasswordUpdate = async () => {
    if (passwordStatus === "saving") return;

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordStatus("error");
      setPasswordMessage("Enter your current password and the new password.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordStatus("error");
      setPasswordMessage("The new password and confirmation do not match.");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordStatus("error");
      setPasswordMessage("Use at least 8 characters for your new password.");
      return;
    }

    setPasswordStatus("saving");
    setPasswordMessage("Updating password...");

    try {
      const result = await api.updatePassword({
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: confirmPassword,
      });
      setPasswordStatus("api");
      setPasswordMessage(`${result.message} Use your new password the next time you sign in.`);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      if (error instanceof ApiError) {
        setPasswordStatus("error");
        setPasswordMessage(error.message);
        return;
      }

      setPasswordStatus("error");
      setPasswordMessage("Something went wrong. Please try again.");
    }
  };

  return (
    <StudentPortalShell title="Password Reset" activePage="student-profile" navigate={navigate}>
      <div className="max-w-2xl">
        {passwordStatus !== "idle" && (
          <div className={`rounded-2xl p-4 flex gap-3 text-sm mb-5 ${
            passwordStatus === "error"
              ? "bg-red-50 border border-red-200 text-red-700"
              : "bg-emerald-50 border border-emerald-200 text-emerald-700"
          }`}>
            {passwordStatus === "error" ? (
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
            ) : (
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
            )}
            {passwordMessage}
          </div>
        )}
        <SectionCard title="Change Password">
          <div className="space-y-4">
            {[
              { label: "Current password", placeholder: "Enter current password", value: currentPassword, onChange: setCurrentPassword },
              { label: "New password", placeholder: "Enter new password", value: newPassword, onChange: setNewPassword },
              { label: "Confirm new password", placeholder: "Re-enter new password", value: confirmPassword, onChange: setConfirmPassword },
            ].map((field) => (
              <div key={field.label}>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">{field.label}</label>
                <PasswordInput
                  value={field.value}
                  onChange={field.onChange}
                  placeholder={field.placeholder}
                />
              </div>
            ))}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
              Use at least 8 characters with a mix of letters, numbers, and symbols.
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handlePasswordUpdate}
                disabled={passwordStatus === "saving"}
                className="bg-[#8D173E] hover:bg-[#741231] disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
              >
                {passwordStatus === "saving" ? "Updating..." : "Update Password"}
              </button>
              <button
                onClick={() => navigate("student-profile")}
                className="border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
              >
                Back to Profile
              </button>
            </div>
          </div>
        </SectionCard>
      </div>
    </StudentPortalShell>
  );
}

// ── Listings Page ─────────────────────────────────────────────────────────────

function ListingsPage({ navigate }: { navigate: (p: Page) => void }) {
  const isAuthenticated = Boolean(localStorage.getItem("srg_auth_token"));
  const authRole = readStoredRole();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState(() => localStorage.getItem("srg_listing_search") ?? "");
  const [priceFilter, setPriceFilter] = useState(() => localStorage.getItem("srg_listing_price") ?? "any");
  const [typeFilter, setTypeFilter] = useState(() => localStorage.getItem("srg_listing_type") ?? "any");
  const [locationFilter, setLocationFilter] = useState("any");
  const [ratingFilter, setRatingFilter] = useState("any");
  const [facilityFilter, setFacilityFilter] = useState<string[]>([]);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [listings, setListings] = useState<Hostel[]>([]);
  const [listingsStatus, setListingsStatus] = useState<"loading" | "api" | "error">("loading");
  const [savedIds, setSavedIds] = useState<number[]>([]);
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    let active = true;

    api.getListings()
      .then((items) => {
        if (!active) return;
        setListings(items.map(mapApiHostel));
        setListingsStatus("api");
      })
      .catch(() => {
        if (!active) return;
        setListings([]);
        setListingsStatus("error");
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated || authRole !== "student") {
      setSavedIds([]);
      return;
    }

    let active = true;

    api.getSavedListings()
      .then((items) => {
        if (!active) return;
        setSavedIds(items.map((item) => item.id));
      })
      .catch(() => {
        if (!active) return;
        setSavedIds([]);
      });

    return () => {
      active = false;
    };
  }, [isAuthenticated, authRole]);

  const filtered = listings.filter((h) => {
    const query = searchQuery.trim().toLowerCase();
    if (query && !`${h.name} ${h.location} ${h.type}`.toLowerCase().includes(query)) return false;
    if (locationFilter !== "any" && !h.location.toLowerCase().includes(locationFilter)) return false;
    if (ratingFilter !== "any" && h.rating < Number(ratingFilter)) return false;
    if (facilityFilter.some((f) => !h.facilities.includes(f))) return false;
    if (verifiedOnly && !h.verified) return false;
    if (availableOnly && !h.available) return false;
    if (typeFilter !== "any" && h.type !== typeFilter) return false;
    if (priceFilter === "under150" && h.price >= 3000) return false;
    if (priceFilter === "150to200" && (h.price < 3000 || h.price > 4000)) return false;
    if (priceFilter === "over200" && h.price <= 4000) return false;
    return true;
  });

  const toggleFacility = (facility: string) => {
    setFacilityFilter((current) =>
      current.includes(facility)
        ? current.filter((f) => f !== facility)
        : [...current, facility]
    );
  };

  const saveListing = async (hostel: Hostel) => {
    if (!isAuthenticated) {
      setSaveMessage("Sign in to save listings to your account.");
      navigate("auth");
      return;
    }

    if (authRole !== "student") {
      setSaveMessage("Use a student account to save listings.");
      return;
    }

    if (savedIds.includes(hostel.id)) {
      setSaveMessage(`${hostel.name} is already in your saved listings.`);
      return;
    }

    setSavedIds((current) => [...current, hostel.id]);

    try {
      await api.saveListing(hostel.id);
      setSaveMessage(`${hostel.name} was saved to your account.`);
    } catch (error) {
      if (error instanceof ApiError) {
        setSavedIds((current) => current.filter((id) => id !== hostel.id));
        setSaveMessage(error.message);
        return;
      }

      setSavedIds((current) => current.filter((id) => id !== hostel.id));
      setSaveMessage("Something went wrong. Please try again.");
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {isAuthenticated && <DashboardSidebar role={authRole} navigate={navigate} activePage="listings" />}
      <div className="flex-1 flex flex-col overflow-hidden">
        {isAuthenticated ? (
          <TopBar title="Find Rooms" navigate={navigate} />
        ) : (
          <div className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-6 flex-shrink-0">
            <button onClick={() => navigate("landing")} className="flex items-center gap-2">
              <LogoMark />
              <span className="font-bold text-slate-900 text-sm">AAMUSTED Rent Guide</span>
            </button>
            <button
              onClick={() => navigate("auth")}
              className="bg-[#8D173E] hover:bg-[#741231] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              Sign In
            </button>
          </div>
        )}
        <div className="flex flex-1 overflow-hidden">
          {/* Filter sidebar */}
          <aside className="hidden lg:block w-60 bg-white border-r border-slate-100 p-5 overflow-y-auto flex-shrink-0">
            <div className="flex items-center gap-2 mb-5">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="font-semibold text-slate-800 text-sm">Filters</span>
            </div>
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Location
                </label>
                <select
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-rose-200"
                >
                  <option value="any">Any location</option>
                  <option value="kumasi">Kumasi</option>
                  <option value="tanoso">Tanoso</option>
                  <option value="abuakwa">Abuakwa</option>
                  <option value="kwadaso">Kwadaso</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Price Range
                </label>
                <select
                  value={priceFilter}
                  onChange={(e) => setPriceFilter(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-rose-200"
                >
                  <option value="any">Any price</option>
                  <option value="under150">Under GH₵3,000</option>
                  <option value="150to200">GH₵3,000 - GH₵4,000</option>
                  <option value="over200">Above GH₵4,000</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Room Type
                </label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-rose-200"
                >
                  <option value="any">Any type</option>
                  <option value="Self-contain">Self-contain</option>
                  <option value="1-bedroom">1-bedroom</option>
                  <option value="Room & parlour">Room & parlour</option>
                  <option value="Shared room">Shared room</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Distance from Campus
                </label>
                <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-rose-200">
                  <option>Any distance</option>
                  <option>Under 0.5 km</option>
                  <option>0.5 – 1 km</option>
                  <option>1 – 2 km</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Rating
                </label>
                <select
                  value={ratingFilter}
                  onChange={(e) => setRatingFilter(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-rose-200"
                >
                  <option value="any">Any rating</option>
                  <option value="4.8">4.8 and above</option>
                  <option value="4.5">4.5 and above</option>
                  <option value="4">4.0 and above</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Facilities
                </label>
                <div className="space-y-2">
                  {[
                    { label: "Wi-Fi", value: "wifi" },
                    { label: "Security", value: "security" },
                    { label: "Water supply", value: "water" },
                    { label: "Electricity", value: "electricity" },
                  ].map((f) => (
                    <label key={f.value} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        className="accent-rose-600 rounded"
                        checked={facilityFilter.includes(f.value)}
                        onChange={() => toggleFacility(f.value)}
                      />
                      {f.label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Availability
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      className="accent-rose-600"
                      checked={verifiedOnly}
                      onChange={(e) => setVerifiedOnly(e.target.checked)}
                    />
                    Verified only
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      className="accent-rose-600"
                      checked={availableOnly}
                      onChange={(e) => setAvailableOnly(e.target.checked)}
                    />
                    Available now
                  </label>
                </div>
              </div>
              <button
                onClick={() => {
                  setPriceFilter("any");
                  setTypeFilter("any");
                  setLocationFilter("any");
                  setRatingFilter("any");
                  setFacilityFilter([]);
                  setVerifiedOnly(false);
                  setAvailableOnly(false);
                  setSearchQuery("");
                }}
                className="w-full text-sm text-[#8D173E] hover:text-[#741231] font-medium underline transition-colors"
              >
                Clear all filters
              </button>
            </div>
          </aside>

          {/* Main listings */}
          <main className="flex-1 overflow-y-auto p-6">
            <div className="flex flex-col gap-4 mb-5">
              {saveMessage && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{saveMessage}</span>
                </div>
              )}
              {listingsStatus !== "api" && (
                <div
                  className={`rounded-xl border px-4 py-3 text-sm flex items-start gap-2 ${
                    listingsStatus === "loading"
                      ? "bg-slate-50 border-slate-200 text-slate-600"
                      : "bg-amber-50 border-amber-200 text-amber-700"
                  }`}
                >
                  {listingsStatus === "loading" ? (
                    <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  )}
                  <span>{listingsStatus === "loading" ? "Loading listings..." : "Could not load listings."}</span>
                </div>
              )}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="relative flex-1 max-w-xl">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-200 placeholder:text-slate-400"
                  placeholder="Search by name or location..."
                />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500 hidden sm:block">
                  {filtered.length} results
                </span>
                <div className="flex border border-slate-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`p-2 transition-colors ${
                      viewMode === "grid"
                        ? "bg-[#8D173E] text-white"
                        : "bg-white text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`p-2 transition-colors ${
                      viewMode === "list"
                        ? "bg-[#8D173E] text-white"
                        : "bg-white text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
              </div>
              <div className="lg:hidden flex gap-2 overflow-x-auto pb-1">
                {[
                  { label: "Verified", active: verifiedOnly, onClick: () => setVerifiedOnly(!verifiedOnly) },
                  { label: "Available", active: availableOnly, onClick: () => setAvailableOnly(!availableOnly) },
                  { label: "Under GH₵3k", active: priceFilter === "under150", onClick: () => setPriceFilter(priceFilter === "under150" ? "any" : "under150") },
                  { label: "Wi-Fi", active: facilityFilter.includes("wifi"), onClick: () => toggleFacility("wifi") },
                  { label: "Security", active: facilityFilter.includes("security"), onClick: () => toggleFacility("security") },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={item.onClick}
                    className={`px-3 py-1.5 rounded-full border text-xs font-semibold whitespace-nowrap ${
                      item.active
                        ? "bg-[#8D173E] text-white border-[#8D173E]"
                        : "bg-white text-slate-600 border-slate-200"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {filtered.length === 0 && (
              <div className="text-center py-20">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Building2 className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="font-semibold text-slate-800 mb-1">No listings found</h3>
                <p className="text-slate-500 text-sm">Try adjusting your filters to see more results.</p>
              </div>
            )}

            {viewMode === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map((h) => (
                  <HostelCard
                    key={h.id}
                    hostel={h}
                    navigate={navigate}
                    onSave={saveListing}
                    isSaved={savedIds.includes(h.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((h) => (
                  <div
                    key={h.id}
                    className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col sm:flex-row gap-4 hover:shadow-md transition-shadow"
                  >
                    <div className="w-full sm:w-32 h-36 sm:h-24 flex-shrink-0 rounded-xl overflow-hidden bg-slate-100">
                      <img
                        src={h.image}
                        alt={h.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-slate-900 text-sm">{h.name}</h3>
                            {h.verified && <VerifiedBadge />}
                          </div>
                          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            {h.location} · {h.distance}
                          </p>
                        </div>
                        <StarRating rating={h.rating} count={h.reviews} />
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {h.facilities.map((f) => (
                          <FacilityIcon key={f} type={f} />
                        ))}
                      </div>
                    </div>
                    <div className="flex sm:flex-col items-center sm:items-end justify-between flex-shrink-0 gap-3">
                      <div className="text-left sm:text-right">
                        <span className="font-bold text-slate-900 text-base">
                          GH₵{h.price.toLocaleString()}
                        </span>
                        <span className="text-xs text-slate-400 block">/semester</span>
                      </div>
                      <button
                        onClick={() => openHostelDetail(navigate, h.id)}
                        className="bg-[#8D173E] hover:bg-[#741231] text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                      >
                        View Details
                      </button>
                      <button
                        onClick={() => saveListing(h)}
                        className="bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 transition-colors inline-flex items-center gap-1.5"
                      >
                        <Bookmark className={`w-3.5 h-3.5 ${savedIds.includes(h.id) ? "fill-[#8D173E] text-[#8D173E]" : ""}`} />
                        {savedIds.includes(h.id) ? "Saved" : "Save"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

// ── Hostel Detail Page ────────────────────────────────────────────────────────

function HostelDetailPage({ navigate }: { navigate: (p: Page) => void }) {
  const isAuthenticated = Boolean(localStorage.getItem("srg_auth_token"));
  const isAdmin = isAuthenticated && readStoredRole() === "admin";
  const selectedHostelId = readSelectedHostelId();
  const [hostel, setHostel] = useState<Hostel | null>(null);
  const [detailReviews, setDetailReviews] = useState<ApiReview[]>([]);
  const [activeImage, setActiveImage] = useState(0);
  const [saved, setSaved] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "loading" | "api" | "error" | "saving">("loading");
  const [saveMessage, setSaveMessage] = useState("");
  const [contactNote, setContactNote] = useState("Hello, I am interested in this hostel and would like to arrange an inspection.");
  const [reportReason, setReportReason] = useState("Suspicious listing or payment request");
  const [contactStatus, setContactStatus] = useState<"idle" | "api" | "error" | "saving">("idle");
  const [contactMessage, setContactMessage] = useState("");
  const [reportStatus, setReportStatus] = useState<"idle" | "api" | "error" | "saving">("idle");
  const [reportMessage, setReportMessage] = useState("");
  const images = hostel ? [hostel.image, HOSTELS[1].image, HOSTELS[2].image, HOSTELS[3].image] : [];

  useEffect(() => {
    let active = true;

    const detailRequest = isAdmin ? api.getAdminListing(selectedHostelId) : api.getListing(selectedHostelId);

    detailRequest
      .then((item) => {
        if (!active) return;
        setHostel(mapApiHostel(item));
        setDetailReviews(item.reviews ?? []);
        setSaveStatus("idle");
        setSaveMessage("");
      })
      .catch((error) => {
        if (!active) return;
        setHostel(null);
        setDetailReviews([]);
        setSaveStatus("error");
        setSaveMessage(error instanceof ApiError ? error.message : "Could not load listing.");
      });

    return () => {
      active = false;
    };
  }, [isAdmin, selectedHostelId]);

  if (!hostel) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="bg-white border-b border-slate-100 px-6 py-4">
          <button
            onClick={() => navigate("listings")}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Listings
          </button>
        </div>
        <div className="max-w-3xl mx-auto px-6 py-16">
          <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm">
            {saveStatus === "loading" ? (
              <Clock className="w-8 h-8 text-slate-400 mx-auto mb-3" />
            ) : (
              <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
            )}
            <h1 className="text-xl font-bold text-slate-900 mb-2">
              {saveStatus === "loading" ? "Loading listing..." : "Listing unavailable"}
            </h1>
            <p className="text-sm text-slate-500">{saveMessage || "Loading details..."}</p>
          </div>
        </div>
      </div>
    );
  }

  const reviews = detailReviews.map((review) => ({
    name: review.user?.name ?? "Student",
    rating: review.rating,
    date: new Date(review.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" }),
    text: review.comment,
  }));

  const allFacilities = [
    { key: "wifi", icon: <Wifi className="w-5 h-5" />, label: "High-speed Wi-Fi" },
    { key: "security", icon: <Lock className="w-5 h-5" />, label: "24/7 Security" },
    { key: "water", icon: <Droplets className="w-5 h-5" />, label: "Running Water" },
    { key: "electricity", icon: <Zap className="w-5 h-5" />, label: "Stable Power" },
  ];

  const saveListing = async () => {
    if (!isAuthenticated) {
      setSaveStatus("error");
      setSaveMessage("Sign in to save listings to your account.");
      navigate("auth");
      return;
    }

    if (saved) {
      setSaveStatus("api");
      setSaveMessage("This listing is already saved.");
      return;
    }

    setSaved(true);

    try {
      await api.saveListing(hostel.id);
      setSaveStatus("api");
      setSaveMessage("Listing saved to your account.");
    } catch (error) {
      if (error instanceof ApiError) {
        setSaved(false);
        setSaveStatus("error");
        setSaveMessage(error.message);
        return;
      }

      setSaved(false);
      setSaveStatus("error");
      setSaveMessage("Something went wrong. Please try again.");
    }
  };

  const contactLandlord = async () => {
    if (!isAuthenticated) {
      setContactStatus("error");
      setContactMessage("Sign in to contact the landlord.");
      navigate("auth");
      return;
    }

    if (!hostel.landlordId) {
      setContactStatus("error");
      setContactMessage("This listing does not have a landlord account attached yet.");
      return;
    }

    if (!contactNote.trim()) {
      setContactStatus("error");
      setContactMessage("Enter a short message before contacting the landlord.");
      return;
    }

    setContactStatus("saving");
    setContactMessage("Sending message...");

    try {
      await api.sendMessage({
        receiver_id: hostel.landlordId,
        hostel_id: hostel.id,
        body: contactNote.trim(),
      });
      setContactStatus("api");
      setContactMessage("Message sent to landlord.");
    } catch (error) {
      if (error instanceof ApiError) {
        setContactStatus("error");
        setContactMessage(error.message);
        return;
      }

      setContactStatus("error");
      setContactMessage("Something went wrong. Please try again.");
    }
  };

  const reportListing = async () => {
    if (!isAuthenticated) {
      setReportStatus("error");
      setReportMessage("Sign in to report this listing.");
      navigate("auth");
      return;
    }

    if (!reportReason.trim()) {
      setReportStatus("error");
      setReportMessage("Choose or enter a report reason.");
      return;
    }

    setReportStatus("saving");
    setReportMessage("Submitting report...");

    try {
      await api.reportListing(hostel.id, {
        reason: reportReason.trim(),
        severity: reportReason.toLowerCase().includes("fraud") || reportReason.toLowerCase().includes("payment") ? "high" : "medium",
      });
      setReportStatus("api");
      setReportMessage("Report submitted to admin for review.");
    } catch (error) {
      if (error instanceof ApiError) {
        setReportStatus("error");
        setReportMessage(error.message);
        return;
      }

      setReportStatus("error");
      setReportMessage("Something went wrong. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Back nav */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100 px-6 py-4 flex items-center gap-3 shadow-sm">
        <button
          onClick={() => navigate("listings")}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Listings
        </button>
        <span className="text-slate-200">/</span>
        <span className="text-sm text-slate-700 font-medium">{hostel.name}</span>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: main */}
          <div className="lg:col-span-2 space-y-6">
            {/* Gallery */}
            <div className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
              <div className="relative h-72 lg:h-96 bg-slate-100">
                <img
                  src={images[activeImage]}
                  alt={hostel.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-4 left-4 flex items-center gap-2">
                  {hostel.verified && <VerifiedBadge />}
                  {hostel.available ? (
                    <span className="bg-emerald-500 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                      Available
                    </span>
                  ) : (
                    <span className="bg-red-500 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                      Full
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2 p-3">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImage(i)}
                    className={`w-16 h-12 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${
                      activeImage === i ? "border-[#8D173E] opacity-100" : "border-transparent opacity-60 hover:opacity-80"
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            {/* Info */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h1 className="text-xl font-bold text-slate-900 mb-1">{hostel.name}</h1>
                  <p className="text-slate-500 flex items-center gap-1 text-sm">
                    <MapPin className="w-4 h-4" /> {hostel.location}
                  </p>
                  <p className="text-[#8D173E] text-sm font-medium mt-1">{hostel.distance}</p>
                </div>
                <StarRating rating={hostel.rating} count={hostel.reviews} />
              </div>
              <p className="text-slate-600 leading-relaxed text-sm">{hostel.description}</p>
            </div>

            {/* Price details and available rooms */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <SectionCard title="Price Details">
                <div className="space-y-3">
                  {[
                    { label: "Semester rent", value: `GH₵${hostel.price.toLocaleString()}` },
                    { label: "Refundable caution fee", value: "GH₵500" },
                    { label: "Service charge", value: "GH₵200" },
                    { label: "Estimated yearly total", value: `GH₵${(hostel.price * 2 + 700).toLocaleString()}` },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">{row.label}</span>
                      <span className="font-semibold text-slate-900">{row.value}</span>
                    </div>
                  ))}
                </div>
              </SectionCard>
              <SectionCard title="Available Rooms">
                <div className="space-y-3">
                  {[
                    { room: "Block A · Room 12", type: "Self-contain", status: "Available" },
                    { room: "Block B · Room 04", type: "Self-contain", status: "Inspection booked" },
                    { room: "Block C · Room 18", type: "Self-contain", status: "Available" },
                  ].map((room) => (
                    <div key={room.room} className="flex items-center justify-between gap-3 text-sm">
                      <div>
                        <p className="font-semibold text-slate-900">{room.room}</p>
                        <p className="text-xs text-slate-500">{room.type}</p>
                      </div>
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                          room.status === "Available"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {room.status}
                      </span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>

            {/* Facilities */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h2 className="font-semibold text-slate-900 mb-4">Facilities & Utilities</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {allFacilities.map((item) => {
                  const has = hostel.facilities.includes(item.key);
                  return (
                    <div
                      key={item.key}
                      className={`flex items-center gap-3 p-3.5 rounded-xl border ${
                        has
                          ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                          : "bg-slate-50 border-slate-100 text-slate-400"
                      }`}
                    >
                      {item.icon}
                      <span className="text-sm font-medium flex-1">{item.label}</span>
                      {has ? (
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <X className="w-4 h-4" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Location */}
            <SectionCard title="Map & Location">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="md:col-span-3 h-56 rounded-2xl bg-slate-100 border border-slate-200 relative overflow-hidden">
                  <div className="absolute inset-0 bg-[linear-gradient(90deg,#e2e8f0_1px,transparent_1px),linear-gradient(#e2e8f0_1px,transparent_1px)] bg-[size:28px_28px]" />
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-[#8D173E] text-white flex items-center justify-center shadow-lg shadow-rose-200">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-sm rounded-xl border border-slate-100 p-3">
                    <p className="text-sm font-semibold text-slate-900">{hostel.location}</p>
                    <p className="text-xs text-slate-500">{hostel.distance} · About 7 minutes by shuttle</p>
                  </div>
                </div>
                <div className="md:col-span-2 space-y-3">
                  {[
                    { label: "Nearest campus gate", value: "Main Gate" },
                    { label: "Transport access", value: "Bike, bus, campus shuttle" },
                    { label: "Nearby essentials", value: "Pharmacy, market, cafe" },
                    { label: "Viewing hours", value: "Mon-Sat, 9:00 AM-5:00 PM" },
                  ].map((row) => (
                    <div key={row.label} className="rounded-xl border border-slate-100 p-3">
                      <p className="text-xs text-slate-400 mb-0.5">{row.label}</p>
                      <p className="text-sm font-semibold text-slate-800">{row.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>

            {/* Safety notice */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800 mb-1">Safety Reminder</p>
                <p className="text-sm text-amber-700 leading-relaxed">
                  Always verify the landlord's identity and visit the property in person before any payment. Use our secure messaging to communicate and never pay outside the platform.
                </p>
              </div>
            </div>

            {/* Reviews */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-semibold text-slate-900">
                  Student Reviews ({hostel.reviews})
                </h2>
                <div className="flex items-center gap-1.5">
                  <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                  <span className="font-bold text-slate-900 text-lg">{hostel.rating}</span>
                  <span className="text-slate-400 text-sm">/ 5.0</span>
                </div>
              </div>
              <div className="space-y-5">
                {reviews.map((r, i) => (
                  <div
                    key={i}
                    className="pb-5 border-b border-slate-50 last:border-0 last:pb-0"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-rose-100 rounded-full flex items-center justify-center text-rose-700 text-sm font-bold flex-shrink-0">
                          {r.name[0]}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{r.name}</p>
                          <p className="text-xs text-slate-400">{r.date}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, j) => (
                          <Star
                            key={j}
                            className={`w-3.5 h-3.5 ${
                              j < r.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">{r.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: sidebar */}
          <div className="space-y-4">
            {/* Price + CTA */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sticky top-6">
              <div className="mb-4 pb-4 border-b border-slate-50">
                <span className="text-3xl font-extrabold text-slate-900">
                  GH₵{hostel.price.toLocaleString()}
                </span>
                <span className="text-slate-400 text-sm"> per semester</span>
              </div>
              <div className="space-y-2.5 mb-5">
                {[
                  { label: "Room type", value: hostel.type },
                  {
                    label: "Availability",
                    value: hostel.available ? "Rooms Available" : "Currently Full",
                    valueClass: hostel.available ? "text-emerald-600" : "text-red-500",
                  },
                  { label: "Annual rate", value: `GH₵${(hostel.price * 2).toLocaleString()}` },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">{row.label}</span>
                    <span className={`font-medium ${row.valueClass ?? "text-slate-800"}`}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
              <textarea
                value={contactNote}
                onChange={(event) => setContactNote(event.target.value)}
                rows={3}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rose-200 mb-2"
                placeholder="Write a message to the landlord..."
              />
              <button
                onClick={contactLandlord}
                disabled={contactStatus === "saving"}
                className="w-full bg-[#8D173E] hover:bg-[#741231] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors mb-2"
              >
                {contactStatus === "saving" ? "Sending..." : "Contact Landlord"}
              </button>
              {contactStatus !== "idle" && (
                <div
                  className={`mb-3 rounded-xl border px-3 py-2 text-xs ${
                    contactStatus === "error"
                      ? "bg-red-50 border-red-200 text-red-700"
                      : "bg-emerald-50 border-emerald-200 text-emerald-700"
                  }`}
                >
                  {contactMessage}
                </div>
              )}
              <button
                onClick={saveListing}
                className="w-full bg-white hover:bg-slate-50 text-slate-700 font-medium py-3 rounded-xl border border-slate-200 transition-colors flex items-center justify-center gap-2"
              >
                <Bookmark className={`w-4 h-4 ${saved ? "fill-[#8D173E] text-[#8D173E]" : ""}`} />
                {saved ? "Saved Listing" : "Save Listing"}
              </button>
              {saveStatus !== "idle" && (
                <div
                  className={`mt-3 rounded-xl border px-3 py-2 text-xs ${
                    saveStatus === "error"
                      ? "bg-red-50 border-red-200 text-red-700"
                      : "bg-emerald-50 border-emerald-200 text-emerald-700"
                  }`}
                >
                  {saveMessage}
                </div>
              )}
              <select
                value={reportReason}
                onChange={(event) => setReportReason(event.target.value)}
                className="w-full mt-3 border border-red-100 text-red-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-100 bg-red-50"
              >
                <option>Suspicious listing or payment request</option>
                <option>Wrong price or hidden charges</option>
                <option>Fake photos or wrong location</option>
                <option>Landlord is unreachable</option>
                <option>Unsafe accommodation concern</option>
              </select>
              <button
                onClick={reportListing}
                disabled={reportStatus === "saving"}
                className="w-full mt-2 text-sm text-red-500 hover:text-red-700 disabled:text-slate-400 flex items-center justify-center gap-1.5 py-2 transition-colors"
              >
                <Flag className="w-4 h-4" />
                {reportStatus === "saving" ? "Submitting..." : "Report this listing"}
              </button>
              {reportStatus !== "idle" && (
                <div
                  className={`mt-2 rounded-xl border px-3 py-2 text-xs ${
                    reportStatus === "error"
                      ? "bg-red-50 border-red-200 text-red-700"
                      : "bg-emerald-50 border-emerald-200 text-emerald-700"
                  }`}
                >
                  {reportMessage}
                </div>
              )}
            </div>

            {/* Landlord card */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h3 className="font-semibold text-slate-900 mb-4 text-sm">About the Landlord</h3>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center text-rose-700 font-bold text-lg flex-shrink-0">
                  A
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{hostel.landlord}</p>
                  <VerifiedBadge />
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-slate-600">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  Identity verified
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  6 active listings
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Clock className="w-4 h-4 text-slate-400" />
                  Responds within 2 hours
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Landlord Dashboard ────────────────────────────────────────────────────────

function LandlordDashboard({ navigate }: { navigate: (p: Page) => void }) {
  const emptyDashboard: LandlordDashboardData = {
    landlord: readStoredUser() ?? {
      id: 0,
      name: "Landlord",
      email: "",
      role: "landlord",
      status: "active",
    },
    total_listings: 0,
    active_rooms: 0,
    student_inquiries: 0,
    average_rating: 0,
    verified_listings: 0,
    pending_listings: 0,
    rejected_listings: 0,
    listings: [],
    recent_messages: [],
    verification_requests: [],
  };
  const [dashboard, setDashboard] = useState<LandlordDashboardData>(emptyDashboard);
  const [status, setStatus] = useState<"loading" | "api" | "error">("loading");
  const [message, setMessage] = useState("Loading dashboard...");

  useEffect(() => {
    let active = true;

    api.getLandlordDashboard()
      .then((data) => {
        if (!active) return;
        setDashboard(data);
        setStatus("api");
        setMessage("Dashboard updated.");
      })
      .catch((error) => {
        if (!active) return;
        setStatus("error");
        setMessage(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
      });

    return () => {
      active = false;
    };
  }, []);

  const listings = dashboard.listings.map(mapApiHostel);
  const latestStatus = dashboard.pending_listings > 0 ? "pending" : dashboard.rejected_listings > 0 ? "rejected" : "verified";
  const verificationText = latestStatus === "verified"
    ? "Your account and approved listings are trusted by students."
    : latestStatus === "pending"
      ? "Some documents or listings are still under admin review."
      : "One or more listings need corrections before approval.";

  function StatusBadge({ status }: { status: string }) {
    const style: Record<string, string> = {
      verified: "bg-emerald-50 text-emerald-700 border-emerald-200",
      pending: "bg-amber-50 text-amber-700 border-amber-200",
      rejected: "bg-red-50 text-red-700 border-red-200",
      draft: "bg-slate-50 text-slate-600 border-slate-200",
    };
    const icon: Record<string, ReactNode> = {
      verified: <CheckCircle className="w-3 h-3" />,
      pending: <Clock className="w-3 h-3" />,
      rejected: <XCircle className="w-3 h-3" />,
      draft: <Clock className="w-3 h-3" />,
    };
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${style[status]}`}
      >
        {icon[status]}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <DashboardSidebar role="landlord" navigate={navigate} activePage="landlord-dashboard" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title="Landlord Dashboard" navigate={navigate} />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto space-y-6">
            <AdminNotice status={status} message={message} />
            <div className={`${latestStatus === "verified" ? "bg-emerald-50 border-emerald-200" : latestStatus === "pending" ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200"} border rounded-2xl p-4 flex items-center gap-3`}>
              <Shield className={`w-5 h-5 flex-shrink-0 ${latestStatus === "verified" ? "text-emerald-600" : latestStatus === "pending" ? "text-amber-600" : "text-red-600"}`} />
              <div>
                <p className={`text-sm font-semibold ${latestStatus === "verified" ? "text-emerald-800" : latestStatus === "pending" ? "text-amber-800" : "text-red-800"}`}>
                  {latestStatus === "verified" ? "Account verified" : latestStatus === "pending" ? "Verification pending" : "Action required"}
                </p>
                <p className={`text-xs ${latestStatus === "verified" ? "text-emerald-600" : latestStatus === "pending" ? "text-amber-700" : "text-red-700"}`}>
                  {verificationText}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Total Listings" value={dashboard.total_listings} icon={<Building2 className="w-5 h-5" />} color="rose" />
              <StatCard title="Available Listings" value={dashboard.active_rooms} icon={<Home className="w-5 h-5" />} color="emerald" />
              <StatCard title="Student Inquiries" value={dashboard.student_inquiries} icon={<MessageSquare className="w-5 h-5" />} color="amber" />
              <StatCard title="Avg. Rating" value={dashboard.average_rating.toFixed(1)} icon={<Star className="w-5 h-5" />} color="rose" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-900">My Hostel Listings</h3>
                <button
                  onClick={() => navigate("add-hostel")}
                  className="bg-[#8D173E] hover:bg-[#741231] text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add New Hostel
                </button>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <TableShell>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      {["Hostel", "Type", "Rooms", "Price/Sem", "Status", "Inquiries", ""].map((h) => (
                        <th
                          key={h}
                          className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wide"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {listings.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-4 font-medium text-slate-900">{l.name}</td>
                        <td className="px-5 py-4 text-slate-600">{l.type}</td>
                        <td className="px-5 py-4 text-slate-600">{l.available ? "Available" : "Full"}</td>
                        <td className="px-5 py-4 font-semibold text-slate-900">
                          GH₵{l.price.toLocaleString()}
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge status={l.status ?? "pending"} />
                        </td>
                        <td className="px-5 py-4 text-slate-600">{dashboard.recent_messages.filter((item) => item.hostel_id === l.id).length}</td>
                        <td className="px-5 py-4">
                          <button
                            onClick={() => openHostelDetail(navigate, l.id)}
                            className="text-[#8D173E] hover:text-[#741231] font-medium text-xs flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" /> View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </TableShell>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
              <div className="xl:col-span-2">
                <SectionCard title="Listing Form Preview">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { label: "Basic information", value: "Hostel name, address, landlord contact", icon: <ClipboardList className="w-5 h-5" /> },
                      { label: "Room pricing", value: "Room types, rates, deposits, available units", icon: <BarChart2 className="w-5 h-5" /> },
                      { label: "Facilities", value: "Power, water, security, internet, extras", icon: <Zap className="w-5 h-5" /> },
                      { label: "Media upload", value: "Photos, video tour, exterior and room shots", icon: <Camera className="w-5 h-5" /> },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50 p-4 flex gap-3">
                        <div className="w-10 h-10 rounded-lg bg-white text-[#8D173E] flex items-center justify-center border border-slate-100 flex-shrink-0">
                          {item.icon}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => navigate("add-hostel")}
                    className="mt-4 w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors inline-flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Start a New Listing
                  </button>
                </SectionCard>
              </div>
              <div className="space-y-5">
                <SectionCard title="Recent Messages">
                  <div className="space-y-4">
                    {dashboard.recent_messages.length === 0 ? (
                      <p className="text-sm text-slate-500">No inquiries yet.</p>
                    ) : dashboard.recent_messages.map((m) => (
                      <div key={m.id} className="flex gap-3">
                        <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                          {(m.sender?.name ?? "S")[0]}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-slate-900">{m.sender?.name ?? "Student"}</p>
                            <span className="text-xs text-slate-400">{formatDate(m.created_at)}</span>
                          </div>
                          <p className="text-xs text-slate-500 leading-relaxed">{m.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>
                <SectionCard title="Verification Checklist">
                  <div className="space-y-3">
                    {dashboard.verification_requests.length === 0 ? (
                      <p className="text-sm text-slate-500">No verification requests submitted yet.</p>
                    ) : dashboard.verification_requests.map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">{item.type}</span>
                        {item.status === "approved" ? (
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
                        ) : item.status === "rejected" ? (
                          <XCircle className="w-4 h-4 text-red-500" />
                        ) : (
                          <Clock className="w-4 h-4 text-amber-500" />
                        )}
                      </div>
                    ))}
                  </div>
                </SectionCard>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function LandlordPortalShell({
  title,
  activePage,
  navigate,
  children,
}: {
  title: string;
  activePage: Page;
  navigate: (p: Page) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <DashboardSidebar role="landlord" navigate={navigate} activePage={activePage} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title={title} navigate={navigate} />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

function LandlordStatusBadge({ status }: { status: string }) {
  const style: Record<string, string> = {
    verified: "bg-emerald-50 text-emerald-700 border-emerald-200",
    approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
    draft: "bg-slate-50 text-slate-600 border-slate-200",
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${style[status] ?? style.draft}`}>
      {status === "verified" || status === "approved" ? <CheckCircle className="w-3 h-3" /> : status === "rejected" ? <XCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function LandlordListingsPage({ navigate }: { navigate: (p: Page) => void }) {
  const [listings, setListings] = useState<Hostel[]>([]);
  const [status, setStatus] = useState<"loading" | "api" | "error">("loading");
  const [message, setMessage] = useState("Loading landlord listings...");
  const [editingListing, setEditingListing] = useState<Hostel | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    location: "",
    distance: "",
    price: "",
    type: "",
    description: "",
    available: true,
  });
  const [editImageFile, setEditImageFile] = useState<File | null>(null);

  useEffect(() => {
    let active = true;

    api.getLandlordListings()
      .then((items) => {
        if (!active) return;
        setListings(items.map(mapApiHostel));
        setStatus("api");
        setMessage("Listings loaded.");
      })
      .catch((error) => {
        if (!active) return;

        setStatus("error");
        setMessage(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
      });

    return () => {
      active = false;
    };
  }, []);

  const toggleAvailability = async (listing: Hostel) => {
    const previous = listings;
    const nextAvailable = !listing.available;
    setListings((items) => items.map((item) => item.id === listing.id ? { ...item, available: nextAvailable } : item));

    try {
      await api.updateLandlordListing(listing.id, { available: nextAvailable });
      setStatus("api");
      setMessage(`${listing.name} availability updated.`);
    } catch (error) {
      if (error instanceof ApiError) {
        setListings(previous);
        setStatus("error");
        setMessage(error.message);
        return;
      }

      setListings(previous);
      setStatus("error");
      setMessage("Something went wrong. Please try again.");
    }
  };

  const startEditListing = (listing: Hostel) => {
    setEditingListing(listing);
    setEditImageFile(null);
    setEditForm({
      name: listing.name,
      location: listing.location,
      distance: listing.distance,
      price: String(listing.price),
      type: listing.type,
      description: listing.description ?? "",
      available: listing.available,
    });
  };

  const saveListingEdits = async () => {
    if (!editingListing) return;
    if (!editForm.name.trim() || !editForm.location.trim() || !editForm.price.trim()) {
      setStatus("error");
      setMessage("Name, location, and price are required.");
      return;
    }

    try {
      const updated = await api.updateLandlordListing(editingListing.id, {
        name: editForm.name.trim(),
        location: editForm.location.trim(),
        distance: editForm.distance.trim(),
        price: Number(editForm.price),
        type: editForm.type.trim(),
        description: editForm.description.trim(),
        available: editForm.available,
        image_file: editImageFile ?? undefined,
      });
      setListings((items) => items.map((item) => item.id === editingListing.id ? mapApiHostel(updated) : item));
      setEditingListing(null);
      setEditImageFile(null);
      setStatus("api");
      setMessage("Listing updated and sent back for admin review.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof ApiError ? error.message : "Could not update listing.");
    }
  };

  return (
    <LandlordPortalShell title="My Listings" activePage="landlord-listings" navigate={navigate}>
      <div
        className={`rounded-xl border px-4 py-3 text-sm flex items-start gap-2 ${
          status === "api"
            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
            : status === "error"
              ? "bg-red-50 border-red-200 text-red-700"
              : status === "loading"
                ? "bg-slate-50 border-slate-200 text-slate-600"
                : "bg-amber-50 border-amber-200 text-amber-800"
        }`}
      >
        {status === "loading" ? <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
        <span>{message}</span>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Uploaded hostels</h2>
          <p className="text-sm text-slate-500">Manage prices, room availability, verification status, and student inquiries.</p>
        </div>
        <button
          onClick={() => navigate("add-hostel")}
          className="bg-[#8D173E] hover:bg-[#741231] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors inline-flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add New Hostel
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Listings" value={listings.length} icon={<Building2 className="w-5 h-5" />} color="rose" />
        <StatCard title="Available Listings" value={listings.filter((item) => item.available).length} icon={<Home className="w-5 h-5" />} color="emerald" />
        <StatCard title="Pending Reviews" value={listings.filter((item) => item.status === "pending").length} icon={<Clock className="w-5 h-5" />} color="amber" />
        <StatCard title="Rejected Listings" value={listings.filter((item) => item.status === "rejected").length} icon={<XCircle className="w-5 h-5" />} color="rose" />
      </div>

      <SectionCard title="Listing Management">
        <TableShell>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {["Hostel", "Type", "Rooms", "Available", "Rented By", "Price/Sem", "Status", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {listings.map((listing) => (
                <tr key={listing.name} className="hover:bg-slate-50">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <img src={listing.image} alt={listing.name} className="w-12 h-10 rounded-lg object-cover" />
                      <div>
                        <p className="font-semibold text-slate-900">{listing.name}</p>
                        <p className="text-xs text-slate-500">{listing.inquiries} inquiries</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-slate-600">{listing.type}</td>
                  <td className="px-4 py-4 text-slate-600">-</td>
                  <td className="px-4 py-4 text-slate-600">{listing.available ? "Yes" : "No"}</td>
                  <td className="px-4 py-4">
                    {listing.currentRental?.student ? <div><p className="font-medium text-slate-800">{listing.currentRental.student.name}</p><p className="text-xs text-slate-500">{listing.currentRental.student.email}</p></div> : <span className="text-slate-400">Not rented</span>}
                  </td>
                  <td className="px-4 py-4 font-semibold text-slate-900">GH₵{listing.price.toLocaleString()}</td>
                  <td className="px-4 py-4"><LandlordStatusBadge status={listing.status ?? "pending"} /></td>
                  <td className="px-4 py-4">
                    <div className="flex gap-2">
                      <button onClick={() => openHostelDetail(navigate, listing.id)} className="text-xs font-semibold text-[#8D173E] bg-rose-50 px-3 py-1.5 rounded-lg">View</button>
                      <button onClick={() => startEditListing(listing)} className="text-xs font-semibold text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg">Edit</button>
                      <button
                        onClick={() => toggleAvailability(listing)}
                        className="text-xs font-semibold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg"
                      >
                        {listing.available ? "Mark Full" : "Mark Available"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      </SectionCard>
      {editingListing && (
        <div className="fixed inset-0 z-40 bg-slate-950/40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Edit listing</h3>
                <p className="text-xs text-slate-500">Content changes return the listing to pending admin review.</p>
              </div>
              <button onClick={() => setEditingListing(null)} className="p-2 rounded-lg hover:bg-slate-50" aria-label="Close edit listing">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: "name", label: "Hostel name" },
                { key: "location", label: "Location" },
                { key: "distance", label: "Distance" },
                { key: "price", label: "Price", type: "number" },
                { key: "type", label: "Room type" },
              ].map((field) => (
                <label key={field.key} className="block">
                  <span className="block text-xs font-semibold text-slate-500 mb-1.5">{field.label}</span>
                  <input
                    type={field.type ?? "text"}
                    value={editForm[field.key as keyof typeof editForm] as string}
                    onChange={(event) => setEditForm((form) => ({ ...form, [field.key]: event.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200"
                  />
                </label>
              ))}
              <label className="block md:col-span-2">
                <span className="block text-xs font-semibold text-slate-500 mb-1.5">Description</span>
                <textarea
                  value={editForm.description}
                  onChange={(event) => setEditForm((form) => ({ ...form, description: event.target.value }))}
                  rows={4}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rose-200"
                />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3 text-sm text-slate-700">
                <span>Available for students</span>
                <input
                  type="checkbox"
                  checked={editForm.available}
                  onChange={(event) => setEditForm((form) => ({ ...form, available: event.target.checked }))}
                  className="accent-[#8D173E]"
                />
              </label>
              <label className="block rounded-xl border border-slate-100 p-3 text-sm text-slate-700 cursor-pointer hover:bg-slate-50">
                <span className="block text-xs font-semibold text-slate-500 mb-1.5">Replace image</span>
                <span className="text-sm text-slate-700">{editImageFile?.name ?? "Choose JPG, PNG or WEBP"}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={(event) => setEditImageFile(event.target.files?.[0] ?? null)}
                />
              </label>
            </div>
            <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row sm:justify-end gap-2">
              <button onClick={() => setEditingListing(null)} className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700">Cancel</button>
              <button onClick={saveListingEdits} className="px-4 py-2.5 rounded-xl bg-[#8D173E] text-white text-sm font-semibold">Save changes</button>
            </div>
          </div>
        </div>
      )}
    </LandlordPortalShell>
  );
}

function LandlordMessagesPage({ navigate }: { navigate: (p: Page) => void }) {
  const storedUser = readStoredUser();
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [activeKey, setActiveKey] = useState("");
  const [reply, setReply] = useState("");
  const [status, setStatus] = useState<"loading" | "api" | "error" | "saving">("loading");
  const [notice, setNotice] = useState("Loading messages...");

  useEffect(() => {
    let active = true;

    api.getLandlordMessages()
      .then((items) => {
        if (!active) return;
        setMessages(items.length ? items : []);
        if (items[0]) { const otherId = items[0].sender_id === storedUser?.id ? items[0].receiver_id : items[0].sender_id; setActiveKey(`${items[0].hostel_id ?? 0}-${otherId}`); }
        setStatus("api");
        setNotice("Messages loaded.");
      })
      .catch((error) => {
        if (!active) return;
        setStatus("error");
        setNotice(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
      });

    return () => {
      active = false;
    };
  }, []);

  const contacts = messages.reduce<{ key: string; id: number; hostelId: number; name: string; listing: string; text: string; time: string }[]>((items, message) => {
    const otherId = message.sender_id === storedUser?.id ? message.receiver_id : message.sender_id;
    const key = `${message.hostel_id ?? 0}-${otherId}`;
    if (items.some((item) => item.key === key)) return items;
    const other = message.sender_id === storedUser?.id ? message.receiver : message.sender;
    items.push({
      key, id: otherId, hostelId: message.hostel_id ?? 0,
      name: other?.name ?? "Student",
      listing: message.hostel?.name ?? "General inquiry",
      text: message.body,
      time: formatDate(message.created_at),
    });
    return items;
  }, []);
  const current = contacts.find((contact) => contact.key === activeKey) ?? contacts[0];
  const currentMessages = current
    ? messages.filter((message) => (message.sender_id === current.id || message.receiver_id === current.id) && message.hostel_id === current.hostelId).slice().reverse()
    : [];

  const sendReply = async () => {
    if (!current || !reply.trim()) return;
    setStatus("saving");
    setNotice("Sending reply...");

    try {
      const sent = await api.sendMessage({
        receiver_id: current.id,
        hostel_id: current.hostelId,
        body: reply.trim(),
      });
      setMessages((items) => [sent, ...items]);
      setReply("");
      setStatus("api");
      setNotice("Reply sent.");
    } catch (error) {
      setStatus("error");
      setNotice(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
    }
  };

  return (
    <LandlordPortalShell title="Messages" activePage="landlord-messages" navigate={navigate}>
      <AdminNotice status={status} message={notice} />
      <div className="grid grid-cols-1 lg:grid-cols-[20rem_minmax(0,1fr)] gap-5 min-h-[34rem]">
        <SectionCard title="Student Inquiries">
          <div className="space-y-2">
            {contacts.length === 0 ? (
              <p className="text-sm text-slate-500">No student inquiries yet.</p>
            ) : contacts.map((contact) => (
              <button
                key={contact.id}
                onClick={() => setActiveKey(contact.key)}
                className={`w-full text-left rounded-xl border p-3 transition-colors ${current?.id === contact.id ? "border-[#8D173E] bg-rose-50" : "border-slate-100 hover:bg-slate-50"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{contact.name}</p>
                    <p className="text-xs text-slate-500">{contact.listing}</p>
                  </div>
                  <span className="text-xs text-slate-400">{contact.time}</span>
                </div>
                <p className="text-xs text-slate-500 mt-2">{contact.text}</p>
              </button>
            ))}
          </div>
        </SectionCard>

        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">{current?.name ?? "No conversation selected"}</h3>
              <p className="text-xs text-slate-500">{current?.listing ?? "Select a message"}</p>
            </div>
            <button onClick={() => navigate("landlord-listings")} className="text-xs font-semibold text-[#8D173E]">View listing</button>
          </div>
          <div className="flex-1 p-5 bg-slate-50 space-y-4">
            {currentMessages.length === 0 ? (
              <p className="text-sm text-slate-500">Choose an inquiry to view messages.</p>
            ) : currentMessages.map((msg) => {
              const fromLandlord = msg.sender_id === storedUser?.id;
              return (
              <div key={msg.id} className={`flex ${fromLandlord ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${fromLandlord ? "bg-[#8D173E] text-white" : "bg-white text-slate-700 border border-slate-100"}`}>
                  <p>{msg.body}</p>
                  <p className={`text-[11px] mt-1 ${fromLandlord ? "text-white/70" : "text-slate-400"}`}>{formatDate(msg.created_at)}</p>
                </div>
              </div>
              );
            })}
          </div>
          <div className="p-4 border-t border-slate-100 flex gap-3">
            <input
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") sendReply();
              }}
              className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200"
              placeholder="Reply to student..."
            />
            <button onClick={sendReply} className="bg-[#8D173E] hover:bg-[#741231] text-white text-sm font-semibold px-5 py-2.5 rounded-xl">Send</button>
          </div>
        </section>
      </div>
    </LandlordPortalShell>
  );
}

function LandlordReviewsPage({ navigate }: { navigate: (p: Page) => void }) {
  const [reviews, setReviews] = useState<ApiReview[]>([]);
  const [status, setStatus] = useState<"loading" | "api" | "error">("loading");
  const [message, setMessage] = useState("Loading reviews...");

  useEffect(() => {
    let active = true;

    api.getLandlordReviews()
      .then((items) => {
        if (!active) return;
        setReviews(items);
        setStatus("api");
        setMessage("Reviews loaded.");
      })
      .catch((error) => {
        if (!active) return;
        setStatus("error");
        setMessage(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
      });

    return () => {
      active = false;
    };
  }, []);

  const averageRating = reviews.length
    ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)
    : "0.0";

  return (
    <LandlordPortalShell title="Reviews" activePage="landlord-reviews" navigate={navigate}>
      <AdminNotice status={status} message={message} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Average Rating" value={averageRating} icon={<Star className="w-5 h-5" />} color="rose" />
        <StatCard title="Total Reviews" value={reviews.length} icon={<MessageSquare className="w-5 h-5" />} color="emerald" />
        <StatCard title="Recent This Month" value={reviews.filter((review) => new Date(review.created_at).getMonth() === new Date().getMonth()).length} icon={<Clock className="w-5 h-5" />} color="amber" />
        <StatCard title="5-Star Reviews" value={reviews.filter((review) => review.rating === 5).length} icon={<CheckCircle className="w-5 h-5" />} color="emerald" />
      </div>
      <SectionCard title="Student Feedback">
        <div className="space-y-4">
          {reviews.length === 0 ? (
            <p className="text-sm text-slate-500">No student reviews yet.</p>
          ) : reviews.map((review) => (
            <div key={review.id} className="rounded-xl border border-slate-100 p-4">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{review.user?.name ?? "Student"}</p>
                  <p className="text-xs text-slate-500">{review.hostel?.name ?? "Listing"} · {formatDate(review.created_at)}</p>
                </div>
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`w-4 h-4 ${i < review.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />)}
                </div>
              </div>
              <p className="text-sm text-slate-600">{review.comment}</p>
              <button onClick={() => navigate("landlord-messages")} className="mt-3 text-xs font-semibold text-[#8D173E] bg-rose-50 px-3 py-2 rounded-lg">Message student</button>
            </div>
          ))}
        </div>
      </SectionCard>
    </LandlordPortalShell>
  );
}

function LandlordVerificationPage({ navigate }: { navigate: (p: Page) => void }) {
  const [requests, setRequests] = useState<ApiVerification[]>([]);
  const [listings, setListings] = useState<Hostel[]>([]);
  const [documentType, setDocumentType] = useState("Property ownership document");
  const [selectedHostelId, setSelectedHostelId] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"loading" | "api" | "error" | "saving">("loading");
  const [message, setMessage] = useState("Loading verification requests...");

  useEffect(() => {
    let active = true;

    Promise.all([api.getLandlordVerifications(), api.getLandlordListings()])
      .then(([verificationItems, listingItems]) => {
        if (!active) return;
        setRequests(verificationItems);
        setListings(listingItems.map(mapApiHostel));
        setStatus("api");
        setMessage("Verification history loaded.");
      })
      .catch((error) => {
        if (!active) return;
        setRequests([]);
        setListings([]);
        setStatus("error");
        setMessage(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
      });

    return () => {
      active = false;
    };
  }, []);

  const submitVerification = async () => {
    if (!documentType.trim()) {
      setStatus("error");
      setMessage("Document type is required.");
      return;
    }

    setStatus("saving");
    setMessage("Submitting verification request...");

    try {
      const created = await api.submitLandlordVerification({
        hostel_id: selectedHostelId ? Number(selectedHostelId) : undefined,
        type: documentType,
        document_file: documentFile,
        notes,
      });
      setRequests((items) => [created as ApiVerification, ...items]);
      setNotes("");
      setDocumentFile(null);
      setStatus("api");
      setMessage("Verification request submitted.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
    }
  };

  const accountVerified = requests.some((request) => request.status === "approved");

  return (
    <LandlordPortalShell title="Verification" activePage="landlord-verification" navigate={navigate}>
      <AdminNotice status={status} message={message} />
      <div className={`${accountVerified ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"} border rounded-2xl p-5 flex gap-3`}>
        <Shield className={`w-6 h-6 flex-shrink-0 ${accountVerified ? "text-emerald-600" : "text-amber-600"}`} />
        <div>
          <p className={`font-semibold ${accountVerified ? "text-emerald-800" : "text-amber-800"}`}>{accountVerified ? "Landlord account verified" : "Verification pending"}</p>
          <p className={`text-sm ${accountVerified ? "text-emerald-700" : "text-amber-700"}`}>Your identity and ownership requests are reviewed by admin before listings become trusted.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard title="Verification History">
          <div className="space-y-3">
            {requests.length === 0 ? (
              <p className="text-sm text-slate-500">No verification requests submitted yet.</p>
            ) : requests.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3 gap-3">
                <div>
                  <span className="text-sm text-slate-700 font-medium">{item.type}</span>
                  <p className="text-xs text-slate-500">{item.hostel?.name ?? "Landlord account"} · {formatDate(item.created_at)}</p>
                  {item.document_path && (
                    <a href={item.document_path} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[#8D173E]">
                      View uploaded document
                    </a>
                  )}
                </div>
                <LandlordStatusBadge status={item.status} />
              </div>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="Submit Verification Request">
          <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center bg-slate-50">
            <Upload className="w-8 h-8 text-[#8D173E] mx-auto mb-3" />
            <p className="font-semibold text-slate-900 text-sm">Record an ID, ownership, or listing review request</p>
            <p className="text-xs text-slate-500 mt-1">Upload a PDF or image and add notes for admin review.</p>
          </div>
          <div className="mt-4 space-y-3">
            <input value={documentType} onChange={(event) => setDocumentType(event.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200" placeholder="Document type" />
            <select value={selectedHostelId} onChange={(event) => setSelectedHostelId(event.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200">
              <option value="">Landlord account verification</option>
              {listings.map((listing) => <option key={listing.id} value={listing.id}>{listing.name}</option>)}
            </select>
            <label className="block rounded-xl border border-slate-200 px-4 py-3 text-sm cursor-pointer hover:bg-slate-50">
              <span className="font-semibold text-slate-700">{documentFile?.name ?? "Upload document file"}</span>
              <span className="block text-xs text-slate-400 mt-0.5">PDF, JPG, PNG or WEBP up to 10MB</span>
              <input
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rose-200" placeholder="Notes or document reference" />
          </div>
          <button
            onClick={submitVerification}
            disabled={status === "saving"}
            className="mt-4 w-full bg-[#8D173E] hover:bg-[#741231] disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 rounded-xl"
          >
            {status === "saving" ? "Submitting..." : "Submit for Review"}
          </button>
        </SectionCard>
      </div>
    </LandlordPortalShell>
  );
}

function LandlordProfilePage({ navigate }: { navigate: (p: Page) => void }) {
  const storedUser = readStoredUser();
  const [name, setName] = useState(storedUser?.name ?? "");
  const [businessName, setBusinessName] = useState(storedUser?.business_name ?? "");
  const [email, setEmail] = useState(storedUser?.email ?? "");
  const [phone, setPhone] = useState(storedUser?.phone ?? "");
  const [primaryLocation, setPrimaryLocation] = useState("");
  const [responseTime, setResponseTime] = useState("");
  const [bio, setBio] = useState("");
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState(resolveMediaUrl(storedUser?.profile_photo));
  const [profileStatus, setProfileStatus] = useState<"idle" | "loading" | "saving" | "api" | "error">("loading");
  const [profileMessage, setProfileMessage] = useState("Loading profile...");

  useEffect(() => {
    let active = true;

    api.me()
      .then((user) => {
        if (!active) return;
        setName(user.name);
        setBusinessName(user.business_name ?? "");
        setEmail(user.email);
        setPhone(user.phone ?? "");
        setProfilePhotoPreview(resolveMediaUrl(user.profile_photo));
        setProfileStatus("api");
        setProfileMessage("Profile loaded.");
      })
      .catch((error) => {
        if (!active) return;
        setProfileStatus("error");
        setProfileMessage(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
      });

    return () => {
      active = false;
    };
  }, []);

  const saveProfile = async () => {
    if (!name.trim() || !email.trim()) {
      setProfileStatus("error");
      setProfileMessage("Name and email are required.");
      return;
    }

    setProfileStatus("saving");
    setProfileMessage("Saving profile...");

    try {
      const result = await api.updateProfile({
        name,
        email,
        phone,
        business_name: businessName,
        profile_photo_file: profilePhoto,
      });
      localStorage.setItem("srg_auth_user", JSON.stringify(result.user));
      localStorage.setItem("srg_auth_role", result.user.role);
      window.dispatchEvent(new Event("srg:user-updated"));
      setProfileStatus("api");
      setProfileMessage("Profile saved.");
    } catch (error) {
      if (error instanceof ApiError) {
        setProfileStatus("error");
        setProfileMessage(error.message);
        return;
      }

      setProfileStatus("error");
      setProfileMessage("Something went wrong. Please try again.");
    }
  };

  return (
    <LandlordPortalShell title="Profile" activePage="landlord-profile" navigate={navigate}>
      {profileStatus !== "idle" && <AdminNotice status={profileStatus === "idle" ? "api" : profileStatus} message={profileMessage} />}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_22rem] gap-5">
        <SectionCard title="Business Details">
          <label className="mb-6 flex items-center gap-4 cursor-pointer w-fit">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-emerald-50 border-2 border-emerald-100 flex items-center justify-center">
              {profilePhotoPreview ? <img src={profilePhotoPreview} alt="Profile preview" className="w-full h-full object-cover" /> : <User className="w-8 h-8 text-emerald-600" />}
            </div>
            <div><p className="text-sm font-semibold text-slate-800">Choose profile picture</p><p className="text-xs text-slate-500">JPG, PNG or WEBP, maximum 5MB</p></div>
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => { const file = event.target.files?.[0] ?? null; setProfilePhoto(file); if (file) setProfilePhotoPreview(URL.createObjectURL(file)); }} />
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: "Full name", value: name, onChange: setName },
              { label: "Business name", value: businessName, onChange: setBusinessName },
              { label: "Email", value: email, onChange: setEmail, type: "email" },
              { label: "Phone", value: phone, onChange: setPhone },
              { label: "Primary location", value: primaryLocation, onChange: setPrimaryLocation },
              { label: "Response time", value: responseTime, onChange: setResponseTime },
            ].map((field) => (
              <div key={field.label}>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">{field.label}</label>
                <input value={field.value} onChange={(event) => field.onChange(event.target.value)} type={field.type ?? "text"} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200" />
              </div>
            ))}
          </div>
          <div className="mt-5">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Public bio</label>
            <textarea value={bio} onChange={(event) => setBio(event.target.value)} rows={4} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rose-200" />
          </div>
          <button onClick={saveProfile} disabled={profileStatus === "saving"} className="mt-5 bg-[#8D173E] hover:bg-[#741231] disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-2.5 rounded-xl">
            {profileStatus === "saving" ? "Saving..." : "Save Profile"}
          </button>
        </SectionCard>
        <div className="space-y-5">
          <SectionCard title="Account Status">
            <div className="space-y-3">
              {["Identity verified", "Phone confirmed", "Payment details added", "4 active listings"].map((item) => (
                <div key={item} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{item}</span>
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                </div>
              ))}
            </div>
          </SectionCard>
          <SectionCard title="Quick Actions">
            <div className="space-y-2">
              <button onClick={() => navigate("landlord-verification")} className="w-full text-left rounded-xl border border-slate-100 p-3 text-sm hover:bg-slate-50">Manage verification</button>
              <button onClick={() => navigate("landlord-listings")} className="w-full text-left rounded-xl border border-slate-100 p-3 text-sm hover:bg-slate-50">Manage listings</button>
              <button
                onClick={() => {
                  clearSession();
                  navigate("auth");
                }}
                className="w-full text-left rounded-xl border border-red-100 p-3 text-sm text-red-600 hover:bg-red-50"
              >
                Sign out
              </button>
            </div>
          </SectionCard>
        </div>
      </div>
    </LandlordPortalShell>
  );
}

// ── Add Hostel Page ───────────────────────────────────────────────────────────

function AddHostelPage({ navigate }: { navigate: (p: Page) => void }) {
  const [step, setStep] = useState(1);
  const [hostelName, setHostelName] = useState("");
  const [hostelLocation, setHostelLocation] = useState("");
  const [hostelDistance, setHostelDistance] = useState("");
  const [hostelDescription, setHostelDescription] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [roomType, setRoomType] = useState("Self-contain");
  const [roomPrice, setRoomPrice] = useState("");
  const [availableRooms, setAvailableRooms] = useState("");
  const [annualPrice, setAnnualPrice] = useState("");
  const [waterSupply, setWaterSupply] = useState("Constant (borehole)");
  const [electricitySupply, setElectricitySupply] = useState("Constant ECG/grid supply");
  const [securitySetup, setSecuritySetup] = useState("24/7 security guard");
  const [internetSetup, setInternetSetup] = useState("Fibre broadband");
  const [facilities, setFacilities] = useState<string[]>(["electricity", "water", "wifi", "security"]);
  const [otherFacilities, setOtherFacilities] = useState<string[]>(["Kitchen"]);
  const [image, setImage] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [virtualTourLink, setVirtualTourLink] = useState("");
  const [submitStatus, setSubmitStatus] = useState<"idle" | "saving" | "api" | "error">("idle");
  const [submitMessage, setSubmitMessage] = useState("");
  const steps = ["Basic Info", "Room Details", "Facilities", "Upload Photos", "Submit"];

  const toggleFacilityValue = (value: string) => {
    setFacilities((items) => items.includes(value) ? items.filter((item) => item !== value) : [...items, value]);
  };

  const toggleOtherFacility = (value: string) => {
    setOtherFacilities((items) => items.includes(value) ? items.filter((item) => item !== value) : [...items, value]);
  };

  const submitListing = async () => {
    if (!hostelName.trim() || !hostelLocation.trim() || !roomPrice.trim()) {
      setSubmitStatus("error");
      setSubmitMessage("Hostel name, location, and semester price are required.");
      return;
    }

    if (!imageFile) {
      setSubmitStatus("error");
      setSubmitMessage("Please choose a hostel image from your device before submitting.");
      setStep(4);
      return;
    }

    setSubmitStatus("saving");
    setSubmitMessage("Submitting listing...");

    const listingDetails = [
      hostelDescription.trim(),
      "",
      `Available rooms: ${availableRooms || "Not specified"}`,
      `Annual price: ${annualPrice ? `GH₵${Number(annualPrice).toLocaleString()}` : "Not specified"}`,
      contactName.trim() ? `Contact person: ${contactName.trim()}` : "",
      contactPhone.trim() ? `Contact phone: ${contactPhone.trim()}` : "",
      `Water supply: ${waterSupply}`,
      `Electricity: ${electricitySupply}`,
      `Security: ${securitySetup}`,
      `Internet: ${internetSetup}`,
      otherFacilities.length ? `Other facilities: ${otherFacilities.join(", ")}` : "",
      virtualTourLink.trim() ? `Virtual tour: ${virtualTourLink.trim()}` : "",
    ].filter(Boolean).join("\n");

    try {
      await api.createLandlordListing({
        name: hostelName,
        location: hostelLocation,
        distance: hostelDistance,
        price: Number(roomPrice),
        type: roomType,
        description: listingDetails,
        facilities,
        image_file: imageFile,
      });
      setSubmitStatus("api");
      setSubmitMessage("Listing submitted to Laravel for verification.");
      navigate("landlord-listings");
    } catch (error) {
      if (error instanceof ApiError) {
        setSubmitStatus("error");
        setSubmitMessage(error.message);
        return;
      }

      setSubmitStatus("error");
      setSubmitMessage("Something went wrong. Please try again.");
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <DashboardSidebar role="landlord" navigate={navigate} activePage="add-hostel" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title="Add New Hostel" navigate={navigate} />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_20rem] gap-5">
            <div>
            {/* Step tracker */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-5">
              <div className="flex items-center justify-between">
                {steps.map((s, i) => {
                  const num = i + 1;
                  const done = num < step;
                  const active = num === step;
                  return (
                    <div key={s} className="flex items-center">
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                            done
                              ? "bg-emerald-500 text-white"
                              : active
                              ? "bg-[#8D173E] text-white shadow-md shadow-rose-200"
                              : "bg-slate-100 text-slate-400"
                          }`}
                        >
                          {done ? <Check className="w-4 h-4" /> : num}
                        </div>
                        <span
                          className={`text-xs mt-1.5 font-medium hidden sm:block ${
                            active ? "text-[#8D173E]" : done ? "text-slate-600" : "text-slate-400"
                          }`}
                        >
                          {s}
                        </span>
                      </div>
                      {i < steps.length - 1 && (
                        <div
                          className={`h-0.5 mx-2 flex-1 min-w-[2rem] transition-colors ${
                            done ? "bg-emerald-400" : "bg-slate-200"
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Form */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              {step === 1 && (
                <div className="space-y-5">
                  <h2 className="text-lg font-bold text-slate-900">Basic Information</h2>
                  {[
                    { label: "Hostel Name", placeholder: "e.g. Greenview Student Hostel", type: "text", value: hostelName, onChange: setHostelName },
                    { label: "Full Address", placeholder: "e.g. 12 Tanoso Road, Kumasi", type: "text", value: hostelLocation, onChange: setHostelLocation },
                    { label: "Distance from AAMUSTED", placeholder: "e.g. 0.5 km from AAMUSTED", type: "text", value: hostelDistance, onChange: setHostelDistance },
                    { label: "Landlord / Contact Name", placeholder: "Full legal name", type: "text", value: contactName, onChange: setContactName },
                    { label: "Phone Number", placeholder: "+233 24 000 0000", type: "tel", value: contactPhone, onChange: setContactPhone },
                  ].map((f) => (
                    <div key={f.label}>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        {f.label}
                      </label>
                      <input
                        type={f.type}
                        placeholder={f.placeholder}
                        value={"value" in f ? f.value : undefined}
                        onChange={"onChange" in f ? (event) => f.onChange(event.target.value) : undefined}
                        className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200 placeholder:text-slate-400"
                      />
                    </div>
                  ))}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Hostel Description
                    </label>
                    <textarea
                      rows={4}
                      placeholder="Describe your hostel, environment, amenities, and what makes it stand out..."
                      value={hostelDescription}
                      onChange={(event) => setHostelDescription(event.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200 placeholder:text-slate-400 resize-none"
                    />
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <h2 className="text-lg font-bold text-slate-900">Room Details & Pricing</h2>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Room Type</label>
                    <select
                      value={roomType}
                      onChange={(event) => setRoomType(event.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200 bg-white"
                    >
                      <option>Self-contain</option>
                      <option>1-bedroom</option>
                      <option>Room & parlour</option>
                      <option>Shared room</option>
                    </select>
                  </div>
                  {[
                    { label: "Number of Available Rooms", placeholder: "e.g. 8", type: "number", value: availableRooms, onChange: setAvailableRooms },
                    { label: "Price per Semester (GH₵)", placeholder: "e.g. 3500", type: "number", value: roomPrice, onChange: setRoomPrice },
                    { label: "Annual Price (GH₵)", placeholder: "e.g. 7000", type: "number", value: annualPrice, onChange: setAnnualPrice },
                  ].map((f) => (
                    <div key={f.label}>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        {f.label}
                      </label>
                      <input
                        type={f.type}
                        placeholder={f.placeholder}
                        value={"value" in f ? f.value : undefined}
                        onChange={"onChange" in f ? (event) => f.onChange(event.target.value) : undefined}
                        className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200 placeholder:text-slate-400"
                      />
                    </div>
                  ))}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Included in Rent
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: "Electricity", value: "electricity" },
                        { label: "Water", value: "water" },
                        { label: "Wi-Fi", value: "wifi" },
                        { label: "Security", value: "security" },
                        { label: "Laundry", value: "laundry" },
                        { label: "Parking", value: "parking" },
                      ].map((item) => (
                        <label
                          key={item.value}
                          className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors"
                        >
                          <input
                            type="checkbox"
                            className="accent-rose-600"
                            checked={facilities.includes(item.value)}
                            onChange={() => toggleFacilityValue(item.value)}
                          />
                          {item.label}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-5">
                  <h2 className="text-lg font-bold text-slate-900">Facilities & Utilities</h2>
                  {[
                    {
                      label: "Water Supply",
                      options: ["Constant (borehole)", "Tap water only", "Stored (tank)", "Irregular"],
                      value: waterSupply,
                      onChange: setWaterSupply,
                    },
                    {
                      label: "Electricity",
                      options: ["Constant ECG/grid supply", "Generator backup", "Solar backup", "Irregular"],
                      value: electricitySupply,
                      onChange: setElectricitySupply,
                    },
                    {
                      label: "Security",
                      options: ["24/7 security guard", "CCTV only", "Locked gate", "No security"],
                      value: securitySetup,
                      onChange: setSecuritySetup,
                    },
                    {
                      label: "Internet",
                      options: ["Fibre broadband", "4G router", "No internet"],
                      value: internetSetup,
                      onChange: setInternetSetup,
                    },
                  ].map((f) => (
                    <div key={f.label}>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        {f.label}
                      </label>
                      <select
                        value={f.value}
                        onChange={(event) => f.onChange(event.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200 bg-white"
                      >
                        {f.options.map((o) => (
                          <option key={o}>{o}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Other Facilities
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {["Study room", "Common room", "Kitchen", "Gym", "Car park", "Rooftop"].map((item) => (
                        <label
                          key={item}
                          className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors"
                        >
                          <input
                            type="checkbox"
                            className="accent-rose-600"
                            checked={otherFacilities.includes(item)}
                            onChange={() => toggleOtherFacility(item)}
                          />
                          {item}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-5">
                  <h2 className="text-lg font-bold text-slate-900">Upload Photos & Video</h2>
                  <p className="text-sm text-slate-500">
                    Choose a clear hostel photo from your phone or computer. JPG, PNG, and WEBP files up to 10MB are accepted.
                  </p>
                  <label className="block border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center hover:border-rose-300 transition-colors cursor-pointer bg-slate-50">
                    <div className="w-14 h-14 bg-rose-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                      <Upload className="w-7 h-7 text-rose-500" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700 mb-1">Click to choose an image from your device</p>
                    <p className="text-xs text-slate-400">{imageFile ? imageFile.name : "JPG, PNG or WEBP up to 10MB"}</p>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        setImageFile(file);
                        if (file) setImage(URL.createObjectURL(file));
                      }}
                    />
                  </label>
                  {image && (
                    <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-50">
                      <img src={image} alt="Selected hostel preview" className="w-full h-64 object-cover" />
                      <div className="px-4 py-3 flex items-center gap-2 text-sm text-emerald-700">
                        <CheckCircle className="w-4 h-4" />
                        Image selected and ready to upload
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Virtual Tour Link{" "}
                      <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="url"
                      placeholder="e.g. YouTube or Matterport link"
                      value={virtualTourLink}
                      onChange={(event) => setVirtualTourLink(event.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200 placeholder:text-slate-400"
                    />
                  </div>
                </div>
              )}

              {step === 5 && (
                <div className="text-center py-4 space-y-5">
                  <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto">
                    <CheckCircle className="w-8 h-8 text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 mb-2">
                      Ready to Submit for Verification
                    </h2>
                    <p className="text-slate-500 text-sm max-w-sm mx-auto">
                      Our team will review your listing within 2–3 business days. You will receive a notification once approved.
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4 text-left space-y-2">
                    {[
                      "Basic information provided",
                      "Room details and pricing set",
                      "Facilities documented",
                      "Photos uploaded",
                    ].map((item) => (
                      <div key={item} className="flex items-center gap-2 text-sm text-slate-700">
                        <Check className="w-4 h-4 text-emerald-500" />
                        {item}
                      </div>
                    ))}
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700 text-left flex gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>
                      Ensure all information is accurate. Fraudulent listings result in permanent account suspension.
                    </span>
                  </div>
                  {submitStatus !== "idle" && (
                    <div className={`rounded-xl border p-4 text-sm text-left ${
                      submitStatus === "error"
                        ? "bg-red-50 border-red-200 text-red-700"
                        : "bg-emerald-50 border-emerald-200 text-emerald-700"
                    }`}>
                      {submitMessage}
                    </div>
                  )}
                  <button
                    onClick={submitListing}
                    disabled={submitStatus === "saving"}
                    className="bg-[#8D173E] hover:bg-[#741231] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold px-8 py-3 rounded-xl transition-colors w-full"
                  >
                    {submitStatus === "saving" ? "Submitting..." : "Submit for Verification"}
                  </button>
                </div>
              )}

              {step < 5 && (
                <div className="flex items-center justify-between mt-6 pt-5 border-t border-slate-100">
                  <button
                    onClick={() => step > 1 && setStep(step - 1)}
                    disabled={step === 1}
                    className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </button>
                  <button
                    onClick={() => setStep(step + 1)}
                    className="bg-[#8D173E] hover:bg-[#741231] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors flex items-center gap-2"
                  >
                    {step === 4 ? "Preview & Submit" : "Continue"}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            </div>

            <aside className="space-y-5">
              <SectionCard title="Live Listing Preview">
                <div className="rounded-2xl overflow-hidden border border-slate-100 bg-slate-50">
                  <img src={image} alt="Listing preview" className="h-40 w-full object-cover" />
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="font-semibold text-slate-900 text-sm">{hostelName || "New hostel listing"}</p>
                        <p className="text-xs text-slate-500">{hostelDistance}</p>
                      </div>
                      <VerifiedBadge />
                    </div>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {facilities.slice(0, 3).map((f) => (
                        <FacilityIcon key={f} type={f} />
                      ))}
                    </div>
                    <p className="text-lg font-bold text-slate-900">GH₵{Number(roomPrice || 0).toLocaleString()} <span className="text-xs text-slate-400 font-normal">/semester</span></p>
                  </div>
                </div>
              </SectionCard>
              <SectionCard title="Verification Requirements">
                <div className="space-y-3">
                  {[
                    "Clear room and exterior photos",
                    "Accurate location and distance",
                    "Current price and room availability",
                    "Landlord contact details",
                    "Proof of ownership or management",
                  ].map((item, index) => (
                    <div key={item} className="flex gap-3 text-sm">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        index < step ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
                      }`}>
                        {index < step ? <Check className="w-3.5 h-3.5" /> : index + 1}
                      </div>
                      <span className="text-slate-600">{item}</span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}

// ── Admin Dashboard ───────────────────────────────────────────────────────────

function AdminDashboard({ navigate }: { navigate: (p: Page) => void }) {
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [adminSettings, setAdminSettings] = useState<AdminSettingsData>(DEFAULT_ADMIN_SETTINGS);
  const [adminStatus, setAdminStatus] = useState<"loading" | "api" | "error" | "saving">("loading");
  const [adminMessage, setAdminMessage] = useState("Loading admin dashboard...");
  const [reviewAction, setReviewAction] = useState<AdminReviewAction | null>(null);

  useEffect(() => {
    let active = true;

    Promise.all([api.getAdminDashboard(), api.getAdminSettings()])
      .then(([data, settings]) => {
        if (!active) return;
        setDashboard(data);
        setAdminSettings(settings);
        setAdminStatus("api");
        setAdminMessage("Admin dashboard updated.");
      })
      .catch((error) => {
        if (!active) return;
        setAdminStatus("error");
        setAdminMessage(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
      });

    return () => {
      active = false;
    };
  }, []);

  const verificationRequests = dashboard?.recent_verifications.map((request) => ({
    id: request.id,
    hostelId: request.hostel_id,
    landlord: request.landlord?.business_name || request.landlord?.name || "Landlord",
    hostel: request.hostel?.name ?? "Account verification",
    submitted: formatDate(request.created_at),
    status: request.status,
  })) ?? [];

  const reports = dashboard?.recent_reports.map((report) => ({
    id: report.id,
    hostelId: report.hostel_id,
    reporter: report.reporter?.name ?? "Student",
    listing: report.hostel?.name ?? "Listing",
    reason: report.reason,
    date: formatDate(report.created_at),
    severity: report.severity,
  })) ?? [];

  const listingQueue = dashboard?.recent_listings.map(apiListingToAdminHostel) ?? [];

  const approveListing = async (id: number, adminNotes = "") => {
    try {
      await api.approveAdminListing(id, { admin_notes: adminNotes });
      setDashboard((current) => current ? {
        ...current,
        recent_listings: current.recent_listings.map((item) => item.id === id ? { ...item, verified: true, status: "verified" } : item),
        pending_listings: Math.max(0, current.pending_listings - 1),
        verified_listings: current.verified_listings + 1,
      } : current);
      setAdminStatus("api");
      setAdminMessage("Listing approved.");
    } catch (error) {
      setAdminStatus("error");
      setAdminMessage(error instanceof ApiError ? error.message : "Could not approve listing.");
    }
  };

  const rejectListing = async (id: number, reason = "", adminNotes = "") => {
    if (!reason.trim()) {
      setAdminStatus("error");
      setAdminMessage("A rejection reason is required.");
      return;
    }

    try {
      await api.rejectAdminListing(id, { rejection_reason: reason.trim(), admin_notes: adminNotes });
      setDashboard((current) => current ? {
        ...current,
        recent_listings: current.recent_listings.map((item) => item.id === id ? { ...item, verified: false, status: "rejected" } : item),
        pending_listings: Math.max(0, current.pending_listings - 1),
      } : current);
      setAdminStatus("api");
      setAdminMessage("Listing rejected.");
    } catch (error) {
      setAdminStatus("error");
      setAdminMessage(error instanceof ApiError ? error.message : "Could not reject listing.");
    }
  };

  const updateDashboardVerification = async (id: number, action: "approve" | "reject", input: { admin_notes?: string; rejection_reason?: string }) => {
    if (action === "reject" && !input.rejection_reason?.trim()) {
      setAdminStatus("error");
      setAdminMessage("A rejection reason is required.");
      return;
    }

    try {
      const updated = action === "approve"
        ? await api.approveAdminVerification(id, { admin_notes: input.admin_notes })
        : await api.rejectAdminVerification(id, { rejection_reason: input.rejection_reason.trim(), admin_notes: input.admin_notes });
      setDashboard((current) => current ? {
        ...current,
        recent_verifications: current.recent_verifications.map((item) => item.id === id ? updated : item),
        pending_verifications: Math.max(0, current.pending_verifications - 1),
      } : current);
      setAdminStatus("api");
      setAdminMessage(`Verification request ${action === "approve" ? "approved" : "rejected"}.`);
    } catch (error) {
      setAdminStatus("error");
      setAdminMessage(error instanceof ApiError ? error.message : `Could not ${action} verification request.`);
    }
  };

  const submitReviewAction = (input: { admin_notes?: string; rejection_reason?: string }) => {
    if (!reviewAction) return;

    if (reviewAction.kind === "listing") {
      if (reviewAction.action === "approve") {
        approveListing(reviewAction.id, input.admin_notes ?? "");
      } else {
        rejectListing(reviewAction.id, input.rejection_reason ?? "", input.admin_notes ?? "");
      }
    } else {
      updateDashboardVerification(reviewAction.id, reviewAction.action, input);
    }

    setReviewAction(null);
  };

  const toggleAdminRule = (index: number, enabled: boolean) => {
    const nextSettings = {
      ...adminSettings,
      rules: adminSettings.rules.map((value, itemIndex) => itemIndex === index ? enabled : value),
    };

    setAdminSettings(nextSettings);
    setAdminStatus("saving");
    setAdminMessage("Saving admin setting...");

    api.updateAdminSettings(nextSettings)
      .then((settings) => {
        setAdminSettings(settings);
        setAdminStatus("api");
        setAdminMessage("Admin setting saved.");
      })
      .catch((error) => {
        setAdminStatus("error");
        setAdminMessage(error instanceof ApiError ? error.message : "Could not save admin setting.");
      });
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <DashboardSidebar role="admin" navigate={navigate} activePage="admin-dashboard" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title="Admin Overview" navigate={navigate} />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <AdminNotice status={adminStatus} message={adminMessage} />
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard title="Total Students" value={dashboard?.students ?? "2,841"} icon={<Users className="w-5 h-5" />} color="rose" />
              <StatCard title="Landlords" value={dashboard?.landlords ?? "184"} icon={<User className="w-5 h-5" />} color="emerald" />
              <StatCard title="Total Listings" value={dashboard?.listings ?? "537"} icon={<Building2 className="w-5 h-5" />} color="amber" />
              <StatCard title="Verified" value={dashboard?.verified_listings ?? "419"} icon={<Shield className="w-5 h-5" />} color="rose" />
              <StatCard title="Open Reports" value={dashboard?.open_reports ?? "7"} icon={<Flag className="w-5 h-5" />} color="rose" />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <h3 className="font-semibold text-slate-900 mb-1 text-sm">Listing Growth</h3>
                <p className="text-xs text-slate-400 mb-4">Total vs. verified listings per month</p>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={LISTING_GROWTH}>
                    <defs>
                      <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8D173E" stopOpacity={0.12} />
                        <stop offset="95%" stopColor="#8D173E" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid #e2e8f0",
                        fontSize: 12,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="listings"
                      stroke="#8D173E"
                      strokeWidth={2}
                      fill="url(#grad1)"
                      name="Total"
                    />
                    <Area
                      type="monotone"
                      dataKey="verified"
                      stroke="#10B981"
                      strokeWidth={2}
                      fill="transparent"
                      name="Verified"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <h3 className="font-semibold text-slate-900 mb-1 text-sm">User Activity</h3>
                <p className="text-xs text-slate-400 mb-4">New students and landlords per month</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={USER_ACTIVITY} barSize={14} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid #e2e8f0",
                        fontSize: 12,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                      }}
                    />
                    <Bar dataKey="students" fill="#8D173E" radius={[4, 4, 0, 0]} name="Students" />
                    <Bar dataKey="landlords" fill="#10B981" radius={[4, 4, 0, 0]} name="Landlords" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Verification requests */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
                <h3 className="font-semibold text-slate-900 text-sm">Verification Requests</h3>
                <span className="bg-amber-50 text-amber-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-amber-200">
                  {dashboard?.pending_verifications ?? 3} pending
                </span>
              </div>
              <TableShell>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {["Landlord", "Hostel", "Submitted", "Status", "Actions"].map((h) => (
                      <th
                        key={h}
                        className="text-left px-5 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {verificationRequests.map((r) => (
                    <tr key={r.hostel} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-slate-900">{r.landlord}</td>
                      <td className="px-5 py-3.5 text-slate-600">{r.hostel}</td>
                      <td className="px-5 py-3.5 text-slate-500">{r.submitted}</td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${
                            r.status === "pending"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-slate-50 text-slate-600 border-slate-200"
                          }`}
                        >
                          {r.status === "pending" ? (
                            <Clock className="w-3 h-3" />
                          ) : (
                            <Eye className="w-3 h-3" />
                          )}
                          {r.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openHostelDetail(navigate, r.hostelId ?? 1)}
                            className="text-xs text-slate-600 hover:text-slate-800 border border-slate-200 rounded-lg px-2.5 py-1 transition-colors"
                          >
                            View
                          </button>
                          <button
                            onClick={() => setReviewAction({ kind: "verification", id: r.id, name: r.hostel, action: "approve" })}
                            disabled={r.status !== "pending"}
                            className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1 transition-colors hover:bg-emerald-100 disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => setReviewAction({ kind: "verification", id: r.id, name: r.hostel, action: "reject" })}
                            disabled={r.status !== "pending"}
                            className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1 transition-colors hover:bg-red-100 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </TableShell>
            </div>

            {/* Reports */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-50">
                <h3 className="font-semibold text-slate-900 text-sm">Recent Reports</h3>
              </div>
              <TableShell>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {["Reporter", "Listing", "Reason", "Severity", "Date"].map((h) => (
                      <th
                        key={h}
                        className="text-left px-5 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {reports.map((r) => (
                    <tr key={r.listing} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-slate-900">{r.reporter}</td>
                      <td className="px-5 py-3.5 text-slate-600">{r.listing}</td>
                      <td className="px-5 py-3.5 text-slate-600">{r.reason}</td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full border ${
                            r.severity === "high"
                              ? "bg-red-50 text-red-700 border-red-200"
                              : r.severity === "medium"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-slate-50 text-slate-600 border-slate-200"
                          }`}
                        >
                          {r.severity}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">{r.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </TableShell>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
              <div className="xl:col-span-2">
                <SectionCard title="Listing Approval Queue">
                  <div className="space-y-3">
                    {listingQueue.map((h, index) => (
                      <div
                        key={h.id}
                        className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-slate-100 p-3 hover:bg-slate-50 transition-colors"
                      >
                        <img src={h.image} alt={h.name} className="w-full sm:w-20 h-28 sm:h-16 rounded-lg object-cover bg-slate-100" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-slate-900">{h.name}</p>
                            <span
                              className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                                index === 0
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-slate-50 text-slate-600 border-slate-200"
                              }`}
                            >
                              {index === 0 ? "Needs review" : "Ready"}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">{h.landlord} · {h.location}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => openHostelDetail(navigate, h.id)}
                            className="text-xs text-slate-600 hover:text-slate-800 border border-slate-200 rounded-lg px-2.5 py-1.5 transition-colors"
                          >
                            View
                          </button>
                          <button
                            onClick={() => setReviewAction({ kind: "listing", id: h.id, name: h.name, action: "approve" })}
                            className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 hover:bg-emerald-100 transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => setReviewAction({ kind: "listing", id: h.id, name: h.name, action: "reject" })}
                            className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5 hover:bg-red-100 transition-colors"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              </div>
              <div className="space-y-5">
                <SectionCard title="Platform Health">
                  <div className="space-y-4">
                    {[
                      { label: "Verification SLA", value: "1.8 days", tone: "emerald" },
                      { label: "Report response", value: "4.2 hrs", tone: "emerald" },
                      { label: "Flagged listings", value: "7 open", tone: "amber" },
                      { label: "Rejected uploads", value: "14 this month", tone: "rose" },
                    ].map((item) => (
                      <div key={item.label}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-slate-500">{item.label}</span>
                          <span className="font-semibold text-slate-900">{item.value}</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              item.tone === "emerald"
                                ? "bg-emerald-500 w-4/5"
                                : item.tone === "amber"
                                ? "bg-amber-500 w-3/5"
                                : "bg-rose-500 w-2/5"
                            }`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>
                <SectionCard
                  title="Admin Settings"
                  action={<button onClick={() => navigate("admin-settings")} className="text-xs font-semibold text-[#8D173E]">Open settings</button>}
                >
                  <div className="space-y-3">
                    {ADMIN_RULE_LABELS.map((item, index) => (
                      <label key={item} className="flex items-center justify-between gap-3 text-sm text-slate-700">
                        <span>{item}</span>
                        <input
                          type="checkbox"
                          checked={adminSettings.rules[index] ?? false}
                          onChange={(event) => toggleAdminRule(index, event.target.checked)}
                          className="accent-rose-600"
                        />
                      </label>
                    ))}
                  </div>
                </SectionCard>
              </div>
            </div>
          </div>
        </main>
      </div>
      {reviewAction && (
        <AdminReviewModal
          action={reviewAction}
          onClose={() => setReviewAction(null)}
          onSubmit={submitReviewAction}
        />
      )}
    </div>
  );
}

function AdminPortalShell({
  title,
  activePage,
  navigate,
  children,
}: {
  title: string;
  activePage: Page;
  navigate: (p: Page) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <DashboardSidebar role="admin" navigate={navigate} activePage={activePage} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title={title} navigate={navigate} />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

function AdminStatusBadge({ status }: { status: string }) {
  const style: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700 border-emerald-200",
    verified: "bg-emerald-50 text-emerald-700 border-emerald-200",
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    suspended: "bg-red-50 text-red-700 border-red-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
    hidden: "bg-red-50 text-red-700 border-red-200",
    reviewed: "bg-slate-50 text-slate-600 border-slate-200",
    open: "bg-amber-50 text-amber-700 border-amber-200",
    resolved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-semibold ${style[status] ?? style.reviewed}`}>
      {status === "active" || status === "verified" || status === "resolved" ? (
        <CheckCircle className="w-3 h-3" />
      ) : status === "suspended" || status === "rejected" ? (
        <XCircle className="w-3 h-3" />
      ) : (
        <Clock className="w-3 h-3" />
      )}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function AdminNotice({
  status,
  message,
}: {
  status: "loading" | "api" | "error" | "saving";
  message: string;
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm flex items-start gap-2 ${
        status === "api"
          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
          : status === "error"
            ? "bg-red-50 border-red-200 text-red-700"
            : "bg-slate-50 border-slate-200 text-slate-600"
      }`}
    >
      {status === "loading" || status === "saving" ? (
        <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />
      ) : status === "error" ? (
        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
      ) : (
        <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
      )}
      <span>{message}</span>
    </div>
  );
}

type AdminReviewAction = {
  kind: "listing" | "verification";
  id: number;
  name: string;
  action: "approve" | "reject";
};

function AdminReviewModal({
  action,
  onClose,
  onSubmit,
}: {
  action: AdminReviewAction;
  onClose: () => void;
  onSubmit: (input: { admin_notes?: string; rejection_reason?: string }) => void;
}) {
  const [adminNotes, setAdminNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [error, setError] = useState("");
  const isReject = action.action === "reject";

  const submit = () => {
    if (isReject && !rejectionReason.trim()) {
      setError("A rejection reason is required.");
      return;
    }

    onSubmit({
      admin_notes: adminNotes.trim() || undefined,
      rejection_reason: isReject ? rejectionReason.trim() : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-900 capitalize">{action.action} {action.kind}</p>
            <p className="text-xs text-slate-500 mt-1">{action.name}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-50" aria-label="Close review modal">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {isReject && (
            <label className="block">
              <span className="block text-sm font-semibold text-slate-700 mb-1.5">Rejection reason</span>
              <textarea
                value={rejectionReason}
                onChange={(event) => {
                  setRejectionReason(event.target.value);
                  setError("");
                }}
                rows={3}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rose-200"
              />
            </label>
          )}
          <label className="block">
            <span className="block text-sm font-semibold text-slate-700 mb-1.5">Admin note</span>
            <textarea
              value={adminNotes}
              onChange={(event) => setAdminNotes(event.target.value)}
              rows={3}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rose-200"
              placeholder="Optional internal note"
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row sm:justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700">Cancel</button>
          <button
            onClick={submit}
            className={`px-4 py-2.5 rounded-xl text-white text-sm font-semibold ${isReject ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
          >
            {isReject ? "Reject" : "Approve"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminUserEditModal({
  user,
  onClose,
  onSave,
  onDelete,
}: {
  user: ApiUser;
  onClose: () => void;
  onSave: (input: {
    name: string;
    email: string;
    phone?: string | null;
    student_id?: string | null;
    programme?: string | null;
    business_name?: string | null;
    status: "active" | "suspended";
  }) => void;
  onDelete: () => void;
}) {
  const [form, setForm] = useState({
    name: user.name,
    email: user.email,
    phone: user.phone ?? "",
    student_id: user.student_id ?? "",
    programme: user.programme ?? "",
    business_name: user.business_name ?? "",
    status: (user.status === "suspended" ? "suspended" : "active") as "active" | "suspended",
  });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const updateField = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = () => {
    onSave({
      ...form,
      phone: form.phone || null,
      student_id: user.role === "student" ? form.student_id || null : null,
      programme: user.role === "student" ? form.programme || null : null,
      business_name: user.role === "landlord" ? form.business_name || null : null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Edit {user.role}</p>
            <p className="text-xs text-slate-500 mt-1">{user.email}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-50" aria-label="Close user editor">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { key: "name", label: "Name", type: "text" },
            { key: "email", label: "Email", type: "email" },
            { key: "phone", label: "Phone", type: "tel" },
          ].map((field) => (
            <label key={field.key} className="block">
              <span className="block text-xs font-semibold text-slate-500 mb-1.5">{field.label}</span>
              <input
                type={field.type}
                value={form[field.key as keyof typeof form]}
                onChange={(event) => updateField(field.key as keyof typeof form, event.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200"
              />
            </label>
          ))}
          {user.role === "student" && (
            <>
              <label className="block">
                <span className="block text-xs font-semibold text-slate-500 mb-1.5">Student ID</span>
                <input value={form.student_id} onChange={(event) => updateField("student_id", event.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200" />
              </label>
              <label className="block">
                <span className="block text-xs font-semibold text-slate-500 mb-1.5">Programme</span>
                <input value={form.programme} onChange={(event) => updateField("programme", event.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200" />
              </label>
            </>
          )}
          {user.role === "landlord" && (
            <label className="block">
              <span className="block text-xs font-semibold text-slate-500 mb-1.5">Business name</span>
              <input value={form.business_name} onChange={(event) => updateField("business_name", event.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200" />
            </label>
          )}
          <label className="block">
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Status</span>
            <select
              value={form.status}
              onChange={(event) => updateField("status", event.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-200"
            >
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </label>
        </div>
        <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            {confirmDelete ? (
              <button onClick={onDelete} className="text-sm font-semibold text-red-700 bg-red-50 border border-red-200 px-4 py-2.5 rounded-xl">
                Confirm delete
              </button>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="text-sm font-semibold text-red-600 hover:text-red-700">
                Delete account
              </button>
            )}
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700">Cancel</button>
            <button onClick={submit} className="px-4 py-2.5 rounded-xl bg-[#8D173E] text-white text-sm font-semibold">Save changes</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "-";
}

function exportCsv(filename: string, rows: unknown[][]) {
  const escapeCsv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function apiListingToAdminHostel(hostel: ApiHostel): Hostel {
  return mapApiHostel(hostel);
}

const ADMIN_RULE_LABELS = [
  "Require ID before students message landlords",
  "Auto-hide listings after 3 unresolved reports",
  "Notify landlords when availability is stale",
  "Send weekly safety digest to admins",
];

const DEFAULT_ADMIN_RULES = [true, true, true, false];

const DEFAULT_ADMIN_SETTINGS: AdminSettingsData = {
  rules: DEFAULT_ADMIN_RULES,
  defaults: {
    currency: "GH₵ Ghana cedi",
    radius: "2 km",
    sla: "2 business days",
    support: "support@aamustedrentguide.edu.gh",
  },
};

function AdminUsersPage({ navigate }: { navigate: (p: Page) => void }) {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<ApiUser | null>(null);
  const [editingUser, setEditingUser] = useState<ApiUser | null>(null);
  const [status, setStatus] = useState<"loading" | "api" | "error" | "saving">("loading");
  const [message, setMessage] = useState("Loading users...");

  useEffect(() => {
    let active = true;

    api.getAdminUsers()
      .then((items) => {
        if (!active) return;
        setUsers(items);
        setStatus("api");
        setMessage("Users loaded.");
      })
      .catch((error) => {
        if (!active) return;
        setStatus("error");
        setMessage(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
      });

    return () => {
      active = false;
    };
  }, []);

  const toggleUserStatus = async (user: ApiUser) => {
    const nextStatus = user.status === "suspended" ? "active" : "suspended";
    try {
      const updated = await api.updateAdminUserStatus(user.id, nextStatus);
      setUsers((items) => items.map((item) => item.id === user.id ? updated : item));
      setStatus("api");
      setMessage(`${user.name} marked ${nextStatus}.`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof ApiError ? error.message : "Could not update user status.");
    }
  };

  const saveUser = async (user: ApiUser, input: Parameters<typeof api.updateAdminUser>[1]) => {
    setStatus("saving");
    setMessage("Saving user...");

    try {
      const updated = await api.updateAdminUser(user.id, input);
      setUsers((items) => items.map((item) => item.id === user.id ? updated : item));
      setSelectedUser((current) => current?.id === user.id ? updated : current);
      setEditingUser(null);
      setStatus("api");
      setMessage(`${updated.name} updated.`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof ApiError ? error.message : "Could not update user.");
    }
  };

  const deleteUser = async (user: ApiUser) => {
    setStatus("saving");
    setMessage("Deleting user...");

    try {
      await api.deleteAdminUser(user.id);
      setUsers((items) => items.filter((item) => item.id !== user.id));
      setSelectedUser((current) => current?.id === user.id ? null : current);
      setEditingUser(null);
      setStatus("api");
      setMessage(`${user.name} deleted.`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof ApiError ? error.message : "Could not delete user.");
    }
  };

  const studentCount = users.filter((user) => user.role === "student").length;
  const activeCount = users.filter((user) => user.status !== "suspended").length;
  const suspendedCount = users.filter((user) => user.status === "suspended").length;
  const exportUsersCsv = () => {
    exportCsv("aamusted-rent-guide-users", [
      ["Name", "Email", "Role", "Phone", "Student ID", "Programme", "Business", "Status"],
      ...users.map((user) => [
        user.name,
        user.email,
        user.role,
        user.phone ?? "",
        user.student_id ?? "",
        user.programme ?? "",
        user.business_name ?? "",
        user.status ?? "active",
      ]),
    ]);
    setStatus("api");
    setMessage("User CSV exported.");
  };

  return (
    <AdminPortalShell title="Users" activePage="admin-users" navigate={navigate}>
      <AdminNotice status={status} message={message} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Students" value={studentCount} icon={<Users className="w-5 h-5" />} color="rose" />
        <StatCard title="Active Users" value={activeCount} icon={<CheckCircle className="w-5 h-5" />} color="emerald" />
        <StatCard title="All Accounts" value={users.length} icon={<Plus className="w-5 h-5" />} color="amber" />
        <StatCard title="Suspended" value={suspendedCount} icon={<XCircle className="w-5 h-5" />} color="rose" />
      </div>
      <SectionCard
        title="Student Accounts"
        action={<button onClick={exportUsersCsv} className="text-xs font-semibold text-[#8D173E]">Export CSV</button>}
      >
        <TableShell>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {["Name", "Email", "Role", "Joined", "Status", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users.map((user) => (
                <tr key={user.email} className="hover:bg-slate-50">
                  <td className="px-4 py-4 font-semibold text-slate-900">{user.name}</td>
                  <td className="px-4 py-4 text-slate-600">{user.email}</td>
                  <td className="px-4 py-4 text-slate-600 capitalize">{user.role}</td>
                  <td className="px-4 py-4 text-slate-500">-</td>
                  <td className="px-4 py-4"><AdminStatusBadge status={user.status ?? "active"} /></td>
                  <td className="px-4 py-4">
                    <div className="flex gap-2">
                      <button onClick={() => setSelectedUser(user)} className="text-xs font-semibold text-slate-600 border border-slate-200 px-2.5 py-1.5 rounded-lg">View</button>
                      {user.role !== "admin" && (
                        <>
                          <button onClick={() => setEditingUser(user)} className="text-xs font-semibold text-[#8D173E] bg-rose-50 px-2.5 py-1.5 rounded-lg">Edit</button>
                          <button
                            onClick={() => toggleUserStatus(user)}
                            className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg ${user.status === "suspended" ? "text-emerald-700 bg-emerald-50" : "text-red-600 bg-red-50"}`}
                          >
                            {user.status === "suspended" ? "Activate" : "Suspend"}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      </SectionCard>
      {selectedUser && (
        <SectionCard
          title="Selected User"
          action={<button onClick={() => setSelectedUser(null)} className="text-xs font-semibold text-slate-500">Close</button>}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              { label: "Name", value: selectedUser.name },
              { label: "Email", value: selectedUser.email },
              { label: "Role", value: selectedUser.role },
              { label: "Status", value: selectedUser.status ?? "active" },
              { label: "Phone", value: selectedUser.phone ?? "-" },
              { label: "Student ID", value: selectedUser.student_id ?? "-" },
              { label: "Programme", value: selectedUser.programme ?? "-" },
              { label: "Business", value: selectedUser.business_name ?? "-" },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">{item.label}</p>
                <p className="text-sm font-semibold text-slate-900 break-words capitalize">{item.value}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
      {editingUser && (
        <AdminUserEditModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSave={(input) => saveUser(editingUser, input)}
          onDelete={() => deleteUser(editingUser)}
        />
      )}
    </AdminPortalShell>
  );
}

function AdminLandlordsPage({ navigate }: { navigate: (p: Page) => void }) {
  const [landlords, setLandlords] = useState<(ApiUser & { hostels_count?: number })[]>([]);
  const [editingLandlord, setEditingLandlord] = useState<ApiUser | null>(null);
  const [status, setStatus] = useState<"loading" | "api" | "error" | "saving">("loading");
  const [message, setMessage] = useState("Loading landlords...");

  useEffect(() => {
    let active = true;

    api.getAdminLandlords()
      .then((items) => {
        if (!active) return;
        setLandlords(items);
        setStatus("api");
        setMessage("Landlords loaded.");
      })
      .catch((error) => {
        if (!active) return;
        setStatus("error");
        setMessage(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
      });

    return () => {
      active = false;
    };
  }, []);

  const toggleLandlordStatus = async (landlord: ApiUser) => {
    const nextStatus = landlord.status === "suspended" ? "active" : "suspended";
    try {
      const updated = await api.updateAdminUserStatus(landlord.id, nextStatus);
      setLandlords((items) => items.map((item) => item.id === landlord.id ? { ...item, ...updated } : item));
      setStatus("api");
      setMessage(`${landlord.business_name || landlord.name} marked ${nextStatus}.`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof ApiError ? error.message : "Could not update landlord status.");
    }
  };

  const saveLandlord = async (landlord: ApiUser, input: Parameters<typeof api.updateAdminUser>[1]) => {
    setStatus("saving");
    setMessage("Saving landlord...");

    try {
      const updated = await api.updateAdminUser(landlord.id, input);
      setLandlords((items) => items.map((item) => item.id === landlord.id ? { ...item, ...updated } : item));
      setEditingLandlord(null);
      setStatus("api");
      setMessage(`${updated.business_name || updated.name} updated.`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof ApiError ? error.message : "Could not update landlord.");
    }
  };

  const deleteLandlord = async (landlord: ApiUser) => {
    setStatus("saving");
    setMessage("Deleting landlord...");

    try {
      await api.deleteAdminUser(landlord.id);
      setLandlords((items) => items.filter((item) => item.id !== landlord.id));
      setEditingLandlord(null);
      setStatus("api");
      setMessage(`${landlord.business_name || landlord.name} deleted.`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof ApiError ? error.message : "Could not delete landlord.");
    }
  };

  const verifiedCount = landlords.filter((landlord) => landlord.status === "active").length;
  const suspendedCount = landlords.filter((landlord) => landlord.status === "suspended").length;

  return (
    <AdminPortalShell title="Landlords" activePage="admin-landlords" navigate={navigate}>
      <AdminNotice status={status} message={message} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Landlords" value={landlords.length} icon={<User className="w-5 h-5" />} color="rose" />
        <StatCard title="Active" value={verifiedCount} icon={<Shield className="w-5 h-5" />} color="emerald" />
        <StatCard title="Total Listings" value={landlords.reduce((sum, item) => sum + (item.hostels_count ?? 0), 0)} icon={<Clock className="w-5 h-5" />} color="amber" />
        <StatCard title="Suspended" value={suspendedCount} icon={<XCircle className="w-5 h-5" />} color="rose" />
      </div>
      <SectionCard title="Landlord Directory">
        <TableShell>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {["Name", "Business", "Listings", "Response", "Status", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {landlords.map((landlord) => (
                <tr key={landlord.id} className="hover:bg-slate-50">
                  <td className="px-4 py-4 font-semibold text-slate-900">{landlord.name}</td>
                  <td className="px-4 py-4 text-slate-600">{landlord.business_name ?? "-"}</td>
                  <td className="px-4 py-4 text-slate-600">{landlord.hostels_count ?? 0}</td>
                  <td className="px-4 py-4 text-slate-500">-</td>
                  <td className="px-4 py-4"><AdminStatusBadge status={landlord.status ?? "active"} /></td>
                  <td className="px-4 py-4">
                    <div className="flex gap-2">
                      <button onClick={() => navigate("admin-verifications")} className="text-xs font-semibold text-[#8D173E] bg-rose-50 px-2.5 py-1.5 rounded-lg">Review</button>
                      <button onClick={() => setEditingLandlord(landlord)} className="text-xs font-semibold text-slate-700 border border-slate-200 px-2.5 py-1.5 rounded-lg">Edit</button>
                      <button
                        onClick={() => toggleLandlordStatus(landlord)}
                        className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg ${landlord.status === "suspended" ? "text-emerald-700 bg-emerald-50" : "text-red-600 bg-red-50"}`}
                      >
                        {landlord.status === "suspended" ? "Activate" : "Suspend"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      </SectionCard>
      {editingLandlord && (
        <AdminUserEditModal
          user={editingLandlord}
          onClose={() => setEditingLandlord(null)}
          onSave={(input) => saveLandlord(editingLandlord, input)}
          onDelete={() => deleteLandlord(editingLandlord)}
        />
      )}
    </AdminPortalShell>
  );
}

function AdminListingsPage({ navigate }: { navigate: (p: Page) => void }) {
  const [listings, setListings] = useState<Hostel[]>([]);
  const [status, setStatus] = useState<"loading" | "api" | "error" | "saving">("loading");
  const [message, setMessage] = useState("Loading listings...");
  const [auditResults, setAuditResults] = useState<{ id: number; name: string; issues: string[]; severity: "low" | "medium" | "high" }[]>([]);
  const [reviewAction, setReviewAction] = useState<AdminReviewAction | null>(null);

  useEffect(() => {
    let active = true;

    api.getAdminListings()
      .then((items) => {
        if (!active) return;
        setListings(items.map(apiListingToAdminHostel));
        setStatus("api");
        setMessage("Listings loaded.");
      })
      .catch((error) => {
        if (!active) return;
        setStatus("error");
        setMessage(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
      });

    return () => {
      active = false;
    };
  }, []);

  const updateListingStatus = async (listing: Hostel, action: "approve" | "reject", input: { admin_notes?: string; rejection_reason?: string }) => {
    if (action === "reject" && !input.rejection_reason?.trim()) {
      setStatus("error");
      setMessage("A rejection reason is required.");
      return;
    }

    try {
      const updated = action === "approve"
        ? await api.approveAdminListing(listing.id, { admin_notes: input.admin_notes })
        : await api.rejectAdminListing(listing.id, { rejection_reason: input.rejection_reason.trim(), admin_notes: input.admin_notes });
      setListings((items) => items.map((item) => item.id === listing.id ? apiListingToAdminHostel(updated) : item));
      setStatus("api");
      setMessage(`${listing.name} ${action === "approve" ? "approved" : "rejected"}.`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof ApiError ? error.message : `Could not ${action} listing.`);
    }
  };

  const submitListingReviewAction = (input: { admin_notes?: string; rejection_reason?: string }) => {
    if (!reviewAction) return;
    const listing = listings.find((item) => item.id === reviewAction.id);
    if (!listing) return;

    updateListingStatus(listing, reviewAction.action, input);
    setReviewAction(null);
  };

  const runListingAudit = () => {
    const results = listings.map((listing) => {
      const issues: string[] = [];

      if (!listing.image) issues.push("Missing listing image");
      if (!listing.description || listing.description.length < 40) issues.push("Description is too short");
      if (!listing.facilities.length) issues.push("No facilities selected");
      if (listing.price < 1000 || listing.price > 10000) issues.push("Price is outside expected student range");
      if (!listing.verified && listing.available) issues.push("Available listing is not verified");
      if (listing.status === "pending") issues.push("Waiting for admin verification");
      if (listing.status === "rejected") issues.push("Rejected listing still needs correction");

      const severity = issues.some((issue) => issue.includes("Price") || issue.includes("not verified") || issue.includes("Rejected"))
        ? "high"
        : issues.length > 1
          ? "medium"
          : "low";

      return { id: listing.id, name: listing.name, issues, severity };
    }).filter((result) => result.issues.length > 0);

    setAuditResults(results);
    setStatus("api");
    setMessage(results.length ? `Listing audit found ${results.length} listing${results.length === 1 ? "" : "s"} needing review.` : "Listing audit passed. No issues found.");
  };

  const exportListingsCsv = () => {
    exportCsv("aamusted-rent-guide-listings", [
      ["Name", "Landlord", "Location", "Type", "Price", "Available", "Status", "Issues"],
      ...listings.map((listing) => [
        listing.name,
        listing.landlord,
        listing.location,
        listing.type,
        listing.price,
        listing.available ? "yes" : "no",
        listing.status ?? (listing.verified ? "verified" : "pending"),
        auditResults.find((result) => result.id === listing.id)?.issues.join("; ") ?? "",
      ]),
    ]);
    setStatus("api");
    setMessage("Listing CSV exported.");
  };

  return (
    <AdminPortalShell title="Listings" activePage="admin-listings" navigate={navigate}>
      <AdminNotice status={status} message={message} />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Accommodation inventory</h2>
          <p className="text-sm text-slate-500">Approve, inspect, hide, or review all hostel listings on the platform.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportListingsCsv} className="border border-slate-200 text-slate-700 text-sm font-semibold px-4 py-2.5 rounded-xl">
            Export CSV
          </button>
          <button onClick={runListingAudit} className="bg-[#8D173E] hover:bg-[#741231] text-white text-sm font-semibold px-4 py-2.5 rounded-xl">
            Run Listing Audit
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Listings" value={listings.length} icon={<Building2 className="w-5 h-5" />} color="rose" />
        <StatCard title="Verified" value={listings.filter((item) => item.status === "verified" || item.verified).length} icon={<CheckCircle className="w-5 h-5" />} color="emerald" />
        <StatCard title="Pending" value={listings.filter((item) => item.status === "pending").length} icon={<Clock className="w-5 h-5" />} color="amber" />
        <StatCard title="Rejected" value={listings.filter((item) => item.status === "rejected").length} icon={<XCircle className="w-5 h-5" />} color="rose" />
      </div>
      {auditResults.length > 0 && (
        <SectionCard title="Listing Audit Results">
          <div className="space-y-3">
            {auditResults.map((result) => (
              <div key={result.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-sm font-semibold text-slate-900">{result.name}</p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                      result.severity === "high"
                        ? "bg-red-50 text-red-700 border-red-200"
                        : result.severity === "medium"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-slate-50 text-slate-600 border-slate-200"
                    }`}>
                      {result.severity}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {result.issues.map((issue) => (
                      <span key={issue} className="text-xs text-slate-600 bg-white border border-slate-200 rounded-full px-2.5 py-1">{issue}</span>
                    ))}
                  </div>
                </div>
                <button onClick={() => openHostelDetail(navigate, result.id)} className="text-xs font-semibold text-[#8D173E] bg-rose-50 px-3 py-2 rounded-lg">
                  Inspect Listing
                </button>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {listings.map((h) => (
          <div key={h.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <img src={h.image} alt={h.name} className="h-40 w-full object-cover" />
            <div className="p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{h.name}</p>
                  <p className="text-xs text-slate-500">{h.landlord} · {h.location}</p>
                </div>
                <AdminStatusBadge status={h.status ?? (h.verified ? "verified" : "pending")} />
              </div>
              <p className="text-sm font-bold text-slate-900 mb-3">GH₵{h.price.toLocaleString()} <span className="font-normal text-xs text-slate-400">/semester</span></p>
              {h.currentRental?.student ? (
                <div className="mb-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                  <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-emerald-700">RENTED</span><span className="text-[11px] text-emerald-700">{new Date(h.currentRental.rented_at).toLocaleDateString()}</span></div>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{h.currentRental.student.name}</p>
                  <p className="text-xs text-slate-600">{h.currentRental.student.email}</p>
                  <p className="mt-1 text-[11px] text-slate-500">Transaction: {h.currentRental.reference}</p>
                </div>
              ) : <div className="mb-3 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">Not currently rented</div>}
              <div className="flex gap-2">
                <button onClick={() => openHostelDetail(navigate, h.id)} className="flex-1 text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg py-2">View</button>
                <button onClick={() => setReviewAction({ kind: "listing", id: h.id, name: h.name, action: "approve" })} className="flex-1 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-lg py-2">Approve</button>
                <button onClick={() => setReviewAction({ kind: "listing", id: h.id, name: h.name, action: "reject" })} className="flex-1 text-xs font-semibold text-red-700 bg-red-50 rounded-lg py-2">Reject</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {reviewAction && (
        <AdminReviewModal
          action={reviewAction}
          onClose={() => setReviewAction(null)}
          onSubmit={submitListingReviewAction}
        />
      )}
    </AdminPortalShell>
  );
}

function AdminVerificationsPage({ navigate }: { navigate: (p: Page) => void }) {
  const [requests, setRequests] = useState<ApiVerification[]>([]);
  const [status, setStatus] = useState<"loading" | "api" | "error" | "saving">("loading");
  const [message, setMessage] = useState("Loading verification requests...");
  const [reviewAction, setReviewAction] = useState<AdminReviewAction | null>(null);

  useEffect(() => {
    let active = true;

    api.getAdminVerifications()
      .then((items) => {
        if (!active) return;
        setRequests(items);
        setStatus("api");
        setMessage("Verification requests loaded.");
      })
      .catch((error) => {
        if (!active) return;
        setStatus("error");
        setMessage(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
      });

    return () => {
      active = false;
    };
  }, []);

  const updateVerification = async (request: ApiVerification, action: "approve" | "reject", input: { admin_notes?: string; rejection_reason?: string }) => {
    if (action === "reject" && !input.rejection_reason?.trim()) {
      setStatus("error");
      setMessage("A rejection reason is required.");
      return;
    }

    try {
      const updated = action === "approve"
        ? await api.approveAdminVerification(request.id, { admin_notes: input.admin_notes })
        : await api.rejectAdminVerification(request.id, { rejection_reason: input.rejection_reason.trim(), admin_notes: input.admin_notes });
      setRequests((items) => items.map((item) => item.id === request.id ? updated : item));
      setStatus("api");
      setMessage(`Verification request ${action === "approve" ? "approved" : "rejected"}.`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof ApiError ? error.message : `Could not ${action} verification request.`);
    }
  };

  const submitVerificationReviewAction = (input: { admin_notes?: string; rejection_reason?: string }) => {
    if (!reviewAction) return;
    const request = requests.find((item) => item.id === reviewAction.id);
    if (!request) return;

    updateVerification(request, reviewAction.action, input);
    setReviewAction(null);
  };

  const exportVerificationsCsv = () => {
    exportCsv("aamusted-rent-guide-verifications", [
      ["Landlord", "Hostel", "Type", "Status", "Submitted", "Document", "Admin Notes", "Rejection Reason"],
      ...requests.map((request) => [
        request.landlord?.business_name || request.landlord?.name || "Landlord",
        request.hostel?.name ?? "Account verification",
        request.type,
        request.status,
        formatDate(request.created_at),
        request.document_path ?? "",
        request.admin_notes ?? "",
        request.rejection_reason ?? "",
      ]),
    ]);
    setStatus("api");
    setMessage("Verification CSV exported.");
  };

  return (
    <AdminPortalShell title="Verification Requests" activePage="admin-verifications" navigate={navigate}>
      <AdminNotice status={status} message={message} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Requests" value={requests.length} icon={<Shield className="w-5 h-5" />} color="rose" />
        <StatCard title="Pending" value={requests.filter((item) => item.status === "pending").length} icon={<Clock className="w-5 h-5" />} color="amber" />
        <StatCard title="Approved" value={requests.filter((item) => item.status === "approved").length} icon={<CheckCircle className="w-5 h-5" />} color="emerald" />
        <StatCard title="Rejected" value={requests.filter((item) => item.status === "rejected").length} icon={<XCircle className="w-5 h-5" />} color="rose" />
      </div>
      <SectionCard title="Pending Verification Queue">
        <div className="flex justify-end mb-4">
          <button onClick={exportVerificationsCsv} className="text-xs font-semibold text-[#8D173E] border border-rose-100 bg-rose-50 px-3 py-2 rounded-lg">Export CSV</button>
        </div>
        <TableShell>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {["Landlord", "Hostel", "Type", "Submitted", "Status", "Document", "Controls"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {requests.map((request) => (
                <tr key={request.id} className="hover:bg-slate-50">
                  <td className="px-4 py-4 font-semibold text-slate-900">{request.landlord?.business_name || request.landlord?.name || "Landlord"}</td>
                  <td className="px-4 py-4 text-slate-600">{request.hostel?.name ?? "Account verification"}</td>
                  <td className="px-4 py-4 text-slate-600">{request.type}</td>
                  <td className="px-4 py-4 text-slate-500">{formatDate(request.created_at)}</td>
                  <td className="px-4 py-4"><AdminStatusBadge status={request.status} /></td>
                  <td className="px-4 py-4">
                    {request.document_path ? (
                      <a href={request.document_path} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[#8D173E]">Open</a>
                    ) : (
                      <span className="text-xs text-slate-400">None</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex gap-2">
                      <button onClick={() => openHostelDetail(navigate, request.hostel_id ?? 1)} className="text-xs font-semibold text-slate-700 border border-slate-200 px-2.5 py-1.5 rounded-lg">View</button>
                      <button onClick={() => setReviewAction({ kind: "verification", id: request.id, name: request.hostel?.name ?? "Landlord account", action: "approve" })} className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg">Approve</button>
                      <button onClick={() => setReviewAction({ kind: "verification", id: request.id, name: request.hostel?.name ?? "Landlord account", action: "reject" })} className="text-xs font-semibold text-red-700 bg-red-50 px-2.5 py-1.5 rounded-lg">Reject</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      </SectionCard>
      <SectionCard title="Verification Standards">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {["Government ID", "Ownership proof", "Accurate location", "Room photos"].map((item) => (
            <div key={item} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <CheckCircle className="w-5 h-5 text-emerald-500 mb-3" />
              <p className="text-sm font-semibold text-slate-900">{item}</p>
            </div>
          ))}
        </div>
      </SectionCard>
      {reviewAction && (
        <AdminReviewModal
          action={reviewAction}
          onClose={() => setReviewAction(null)}
          onSubmit={submitVerificationReviewAction}
        />
      )}
    </AdminPortalShell>
  );
}

function AdminReviewsPage({ navigate }: { navigate: (p: Page) => void }) {
  const [reviews, setReviews] = useState<ApiReview[]>([]);
  const [status, setStatus] = useState<"loading" | "api" | "error" | "saving">("loading");
  const [message, setMessage] = useState("Loading reviews...");

  useEffect(() => {
    let active = true;

    api.getAdminReviews()
      .then((items) => {
        if (!active) return;
        setReviews(items);
        setStatus("api");
        setMessage("Reviews loaded.");
      })
      .catch((error) => {
        if (!active) return;
        setStatus("error");
        setMessage(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
      });

    return () => {
      active = false;
    };
  }, []);

  const updateReviewStatus = async (review: ApiReview, nextStatus: "active" | "hidden") => {
    setStatus("saving");
    setMessage("Updating review...");

    try {
      const updated = await api.updateAdminReviewStatus(review.id, nextStatus);
      setReviews((items) => items.map((item) => item.id === review.id ? updated : item));
      setStatus("api");
      setMessage(`Review ${nextStatus === "active" ? "approved" : "hidden"}.`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
    }
  };

  return (
    <AdminPortalShell title="Reviews" activePage="admin-reviews" navigate={navigate}>
      <AdminNotice status={status} message={message} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Reviews" value={reviews.length} icon={<Star className="w-5 h-5" />} color="rose" />
        <StatCard title="Active" value={reviews.filter((item) => (item.status ?? "active") === "active").length} icon={<CheckCircle className="w-5 h-5" />} color="emerald" />
        <StatCard title="Pending" value={reviews.filter((item) => item.status === "pending").length} icon={<Clock className="w-5 h-5" />} color="amber" />
        <StatCard title="Hidden" value={reviews.filter((item) => item.status === "hidden").length} icon={<XCircle className="w-5 h-5" />} color="rose" />
      </div>
      <SectionCard title="Review Moderation">
        <div className="space-y-4">
          {reviews.length === 0 ? (
            <p className="text-sm text-slate-500">No student reviews yet.</p>
          ) : reviews.map((review) => (
            <div key={review.id} className="rounded-xl border border-slate-100 p-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{review.user?.name ?? "Student"}</p>
                  <p className="text-xs text-slate-500">{review.hostel?.name ?? "Listing"} · {formatDate(review.created_at)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`w-4 h-4 ${i < review.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />)}
                  </div>
                  <AdminStatusBadge status={review.status ?? "active"} />
                </div>
              </div>
              <p className="text-sm text-slate-600 mb-4">{review.comment}</p>
              <div className="flex gap-2">
                <button onClick={() => updateReviewStatus(review, "active")} className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg">Approve</button>
                <button onClick={() => updateReviewStatus(review, "hidden")} className="text-xs font-semibold text-red-700 bg-red-50 px-3 py-2 rounded-lg">Hide</button>
                <button onClick={() => openHostelDetail(navigate, review.hostel_id)} className="text-xs font-semibold text-slate-700 border border-slate-200 px-3 py-2 rounded-lg">View Listing</button>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </AdminPortalShell>
  );
}

function AdminReportsPage({ navigate }: { navigate: (p: Page) => void }) {
  const [reports, setReports] = useState<ApiReport[]>([]);
  const [status, setStatus] = useState<"loading" | "api" | "error" | "saving">("loading");
  const [message, setMessage] = useState("Loading reports...");

  useEffect(() => {
    let active = true;

    api.getAdminReports()
      .then((items) => {
        if (!active) return;
        setReports(items);
        setStatus("api");
        setMessage("Reports loaded.");
      })
      .catch((error) => {
        if (!active) return;
        setStatus("error");
        setMessage(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
      });

    return () => {
      active = false;
    };
  }, []);

  const resolveReport = async (report: ApiReport) => {
    try {
      const updated = await api.resolveAdminReport(report.id);
      setReports((items) => items.map((item) => item.id === report.id ? { ...item, ...updated } : item));
      setStatus("api");
      setMessage("Report resolved.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof ApiError ? error.message : "Could not resolve report.");
    }
  };

  const openReports = reports.filter((report) => report.status === "open");
  const exportReportsCsv = () => {
    exportCsv("aamusted-rent-guide-reports", [
      ["Reporter", "Listing", "Reason", "Severity", "Status", "Date"],
      ...reports.map((report) => [
        report.reporter?.name ?? "Student",
        report.hostel?.name ?? "Listing",
        report.reason,
        report.severity,
        report.status,
        formatDate(report.created_at),
      ]),
    ]);
    setStatus("api");
    setMessage("Report CSV exported.");
  };

  return (
    <AdminPortalShell title="Reports" activePage="admin-reports" navigate={navigate}>
      <AdminNotice status={status} message={message} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Open Reports" value={openReports.length} icon={<Flag className="w-5 h-5" />} color="rose" />
        <StatCard title="High Severity" value={reports.filter((item) => item.severity === "high").length} icon={<AlertCircle className="w-5 h-5" />} color="rose" />
        <StatCard title="Resolved" value={reports.filter((item) => item.status === "resolved").length} icon={<CheckCircle className="w-5 h-5" />} color="emerald" />
        <StatCard title="Total Reports" value={reports.length} icon={<Clock className="w-5 h-5" />} color="amber" />
      </div>
      <SectionCard
        title="Fraud and Safety Reports"
        action={<button onClick={exportReportsCsv} className="text-xs font-semibold text-[#8D173E]">Export CSV</button>}
      >
        <TableShell>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {["Reporter", "Listing", "Reason", "Severity", "Date", "Status", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {reports.map((report) => (
                <tr key={report.id} className="hover:bg-slate-50">
                  <td className="px-4 py-4 font-semibold text-slate-900">{report.reporter?.name ?? "Student"}</td>
                  <td className="px-4 py-4 text-slate-600">{report.hostel?.name ?? "Listing"}</td>
                  <td className="px-4 py-4 text-slate-600">{report.reason}</td>
                  <td className="px-4 py-4">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${report.severity === "high" ? "bg-red-50 text-red-700 border-red-200" : report.severity === "medium" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-slate-50 text-slate-600 border-slate-200"}`}>{report.severity}</span>
                  </td>
                  <td className="px-4 py-4 text-slate-500">{formatDate(report.created_at)}</td>
                  <td className="px-4 py-4"><AdminStatusBadge status={report.status} /></td>
                  <td className="px-4 py-4">
                    <div className="flex gap-2">
                      <button onClick={() => openHostelDetail(navigate, report.hostel_id)} className="text-xs font-semibold text-slate-700 border border-slate-200 px-2.5 py-1.5 rounded-lg">View</button>
                      <button
                        onClick={() => resolveReport(report)}
                        disabled={report.status === "resolved"}
                        className="text-xs font-semibold text-emerald-700 bg-emerald-50 disabled:opacity-50 px-2.5 py-1.5 rounded-lg"
                      >
                        Resolve
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      </SectionCard>
    </AdminPortalShell>
  );
}

function AdminAccountsPage({ navigate }: { navigate: (p: Page) => void }) {
  const [data, setData] = useState<AccountsData | null>(null);
  const [percentage, setPercentage] = useState("5");
  const [hostelId, setHostelId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [rentAmount, setRentAmount] = useState("");
  const [status, setStatus] = useState<"loading" | "saving" | "api" | "error">("loading");
  const [message, setMessage] = useState("Loading account records...");

  const load = () => api.getAdminAccounts().then((result) => { setData(result); setPercentage(String(result.commission_percentage)); setStatus("api"); setMessage("Account records loaded."); }).catch((error) => { setStatus("error"); setMessage(error instanceof ApiError ? error.message : "Could not load accounts."); });
  useEffect(() => { load(); }, []);

  const saveCommission = async () => {
    const value = Number(percentage);
    if (!Number.isFinite(value) || value < 0 || value > 100) { setStatus("error"); setMessage("Commission must be between 0 and 100 percent."); return; }
    setStatus("saving"); setMessage("Saving commission...");
    try { await api.updateRentCommission(value); await load(); setMessage("Commission percentage saved. New rentals will use this rate."); } catch (error) { setStatus("error"); setMessage(error instanceof ApiError ? error.message : "Could not save commission."); }
  };

  const recordRental = async () => {
    if (!hostelId || !studentId || Number(rentAmount) <= 0) { setStatus("error"); setMessage("Choose a hostel, student, and valid rent amount."); return; }
    setStatus("saving"); setMessage("Recording rent transaction...");
    try { await api.createRentTransaction({ hostel_id: Number(hostelId), student_id: Number(studentId), rent_amount: Number(rentAmount) }); setHostelId(""); setStudentId(""); setRentAmount(""); await load(); setMessage("Rental and transaction recorded."); } catch (error) { setStatus("error"); setMessage(error instanceof ApiError ? error.message : "Could not record rental."); }
  };

  const money = (value: number | string) => `GH₵${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return <AdminPortalShell title="Accounts" activePage="admin-accounts" navigate={navigate}>
    <AdminNotice status={status} message={message} />
    <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
      <StatCard title="Total Rent" value={money(data?.statistics.total_rent ?? 0)} icon={<BarChart2 className="w-5 h-5" />} color="rose" />
      <StatCard title="System Total" value={money(data?.statistics.system_total ?? 0)} icon={<Shield className="w-5 h-5" />} color="emerald" />
      <StatCard title="Landlords Total" value={money(data?.statistics.landlords_total ?? 0)} icon={<Building2 className="w-5 h-5" />} color="amber" />
      <StatCard title="Transactions" value={data?.statistics.transactions ?? 0} icon={<ClipboardList className="w-5 h-5" />} color="rose" />
      <StatCard title="Rented Hostels" value={data?.statistics.rented_hostels ?? 0} icon={<Home className="w-5 h-5" />} color="emerald" />
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <SectionCard title="System Usage Commission"><div className="flex gap-3"><input type="number" min="0" max="100" step="0.01" value={percentage} onChange={(e) => setPercentage(e.target.value)} className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5" /><button onClick={saveCommission} className="bg-[#8D173E] text-white rounded-xl px-5 text-sm font-semibold">Save %</button></div><p className="text-xs text-slate-500 mt-2">Applied only to new transactions; past financial records retain their original rate.</p></SectionCard>
      <SectionCard title="Record Rented Hostel"><div className="space-y-3"><select value={hostelId} onChange={(e) => { setHostelId(e.target.value); const hostel = data?.hostels.find((h) => h.id === Number(e.target.value)); if (hostel) setRentAmount(String(hostel.price)); }} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 bg-white"><option value="">Select verified hostel</option>{data?.hostels.map((h) => <option key={h.id} value={h.id}>{h.name} — {h.landlord?.business_name || h.landlord?.name}</option>)}</select><select value={studentId} onChange={(e) => setStudentId(e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 bg-white"><option value="">Select student</option>{data?.students.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.email}</option>)}</select><input type="number" value={rentAmount} onChange={(e) => setRentAmount(e.target.value)} placeholder="Rent amount" className="w-full border border-slate-200 rounded-xl px-4 py-2.5" /><button onClick={recordRental} className="w-full bg-slate-800 text-white rounded-xl py-2.5 text-sm font-semibold">Record Transaction</button></div></SectionCard>
    </div>
    <SectionCard title="Rented Hostels & Transactions"><TableShell><table className="w-full text-sm"><thead><tr className="bg-slate-50 border-b border-slate-100">{["Reference", "Hostel", "Student", "Landlord", "Rent", "Rate", "System", "Landlord Net", "Date"].map((h) => <th key={h} className="text-left px-4 py-3 text-xs text-slate-500 uppercase">{h}</th>)}</tr></thead><tbody>{data?.transactions.length ? data.transactions.map((t) => <tr key={t.id} className="border-b border-slate-50"><td className="px-4 py-3 font-medium">{t.reference}</td><td className="px-4 py-3">{t.hostel.name}</td><td className="px-4 py-3">{t.student.name}</td><td className="px-4 py-3">{t.landlord.business_name || t.landlord.name}</td><td className="px-4 py-3">{money(t.rent_amount)}</td><td className="px-4 py-3">{t.commission_percentage}%</td><td className="px-4 py-3 text-emerald-700">{money(t.system_fee)}</td><td className="px-4 py-3">{money(t.landlord_amount)}</td><td className="px-4 py-3">{new Date(t.rented_at).toLocaleDateString()}</td></tr>) : <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-500">No rented hostels or transactions recorded yet.</td></tr>}</tbody></table></TableShell></SectionCard>
  </AdminPortalShell>;
}

function AdminSettingsPage({ navigate }: { navigate: (p: Page) => void }) {
  const storedUser = readStoredUser();
  const [adminName, setAdminName] = useState(storedUser?.name ?? "");
  const [adminEmail, setAdminEmail] = useState(storedUser?.email ?? "");
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState(resolveMediaUrl(storedUser?.profile_photo));
  const [rules, setRules] = useState(DEFAULT_ADMIN_SETTINGS.rules);
  const [defaults, setDefaults] = useState(DEFAULT_ADMIN_SETTINGS.defaults);
  const [status, setStatus] = useState<"loading" | "api" | "error" | "saving">("loading");
  const [message, setMessage] = useState("Loading platform settings...");

  useEffect(() => {
    let active = true;

    api.getAdminSettings()
      .then((settings) => {
        if (!active) return;
        setRules(settings.rules);
        setDefaults(settings.defaults);
        setStatus("api");
        setMessage("Platform settings loaded.");
      })
      .catch((error) => {
        if (!active) return;
        setStatus("error");
        setMessage(error instanceof ApiError ? error.message : "Could not load platform settings.");
      });

    return () => {
      active = false;
    };
  }, []);

  const saveSettings = async () => {
    setStatus("saving");
    setMessage("Saving platform settings...");

    try {
      const settings = await api.updateAdminSettings({ rules, defaults });
      setRules(settings.rules);
      setDefaults(settings.defaults);
      setStatus("api");
      setMessage("Admin settings saved.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof ApiError ? error.message : "Could not save platform settings.");
    }
  };

  const saveAdminProfile = async () => {
    setStatus("saving");
    setMessage("Saving admin profile...");
    try {
      const result = await api.updateProfile({ name: adminName, email: adminEmail, profile_photo_file: profilePhoto });
      localStorage.setItem("srg_auth_user", JSON.stringify(result.user));
      window.dispatchEvent(new Event("srg:user-updated"));
      setProfilePhotoPreview(resolveMediaUrl(result.user.profile_photo) || profilePhotoPreview);
      setProfilePhoto(null);
      setStatus("api");
      setMessage("Admin profile saved.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof ApiError ? error.message : "Could not save admin profile.");
    }
  };

  return (
    <AdminPortalShell title="Settings" activePage="admin-settings" navigate={navigate}>
      <AdminNotice status={status} message={message} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard title="Admin Profile">
          <div className="space-y-4">
            <label className="flex items-center gap-4 cursor-pointer w-fit">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-slate-100 border-2 border-slate-200 flex items-center justify-center">
                {profilePhotoPreview ? <img src={profilePhotoPreview} alt="Admin profile preview" className="w-full h-full object-cover" /> : <User className="w-8 h-8 text-slate-600" />}
              </div>
              <div><p className="text-sm font-semibold text-slate-800">Choose profile picture</p><p className="text-xs text-slate-500">JPG, PNG or WEBP, maximum 5MB</p></div>
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => { const file = event.target.files?.[0] ?? null; setProfilePhoto(file); if (file) setProfilePhotoPreview(URL.createObjectURL(file)); }} />
            </label>
            <input value={adminName} onChange={(event) => setAdminName(event.target.value)} placeholder="Full name" className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm" />
            <input type="email" value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} placeholder="Email" className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm" />
            <button onClick={saveAdminProfile} disabled={status === "saving"} className="w-full bg-slate-800 hover:bg-slate-900 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-xl">Save Admin Profile</button>
          </div>
        </SectionCard>
        <SectionCard title="Safety Rules">
          <div className="space-y-4">
            {ADMIN_RULE_LABELS.map((item, index) => (
              <label key={item} className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 p-3 text-sm text-slate-700">
                <span>{item}</span>
                <input
                  type="checkbox"
                  checked={rules[index] ?? false}
                  onChange={(event) => {
                    setStatus("api");
                    setMessage("You have unsaved platform setting changes.");
                    setRules((items) => items.map((value, itemIndex) => itemIndex === index ? event.target.checked : value));
                  }}
                  className="accent-[#8D173E]"
                />
              </label>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="Platform Defaults">
          <div className="space-y-4">
            {[
              { key: "currency", label: "Default currency" },
              { key: "radius", label: "Campus radius" },
              { key: "sla", label: "Review SLA" },
              { key: "support", label: "Support email" },
            ].map((field) => (
              <div key={field.label}>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">{field.label}</label>
                <input
                  value={defaults[field.key] ?? ""}
                  onChange={(event) => {
                    setStatus("api");
                    setMessage("You have unsaved platform setting changes.");
                    setDefaults((items) => ({ ...items, [field.key]: event.target.value }));
                  }}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200"
                />
              </div>
            ))}
            <button
              onClick={saveSettings}
              disabled={status === "saving" || status === "loading"}
              className="w-full bg-[#8D173E] hover:bg-[#741231] disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-xl"
            >
              {status === "saving" ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </SectionCard>
      </div>
    </AdminPortalShell>
  );
}

// ── Auth Page ─────────────────────────────────────────────────────────────────

function AuthPage({
  navigate,
  view,
  setView,
}: {
  navigate: (p: Page) => void;
  view: AuthView;
  setView: (v: AuthView) => void;
}) {
  const [role, setRole] = useState<UserRole>("student");
  const demoEmails: Record<UserRole, string> = {
    student: "student@aamustedrentguide.edu.gh",
    landlord: "landlord@aamustedrentguide.edu.gh",
    admin: "admin@aamustedrentguide.edu.gh",
  };
  const [email, setEmail] = useState(demoEmails.student);
  const [password, setPassword] = useState("password");
  const [authStatus, setAuthStatus] = useState<"idle" | "loading" | "api" | "error">("idle");
  const [authMessage, setAuthMessage] = useState("");
  const [signupFirstName, setSignupFirstName] = useState("");
  const [signupLastName, setSignupLastName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupIdentifier, setSignupIdentifier] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [forgotEmail, setForgotEmail] = useState(demoEmails.student);
  const [forgotStatus, setForgotStatus] = useState<"idle" | "loading" | "api" | "error">("idle");
  const [forgotMessage, setForgotMessage] = useState("");
  const [resetEmail, setResetEmail] = useState(() => new URLSearchParams(window.location.search).get("email") ?? "");
  const [resetToken, setResetToken] = useState(() => new URLSearchParams(window.location.search).get("reset_token") ?? "");
  const [resetPassword, setResetPassword] = useState("");
  const [resetPasswordConfirmation, setResetPasswordConfirmation] = useState("");
  const [resetStatus, setResetStatus] = useState<"idle" | "loading" | "api" | "error">("idle");
  const [resetMessage, setResetMessage] = useState("");
  const loginTarget: Record<UserRole, Page> = {
    student: "student-dashboard",
    landlord: "landlord-dashboard",
    admin: "admin-dashboard",
  };
  const roleCopy: Record<UserRole, {
    subtitle: string;
    quote: string;
    name: string;
    meta: string;
    initial: string;
  }> = {
    student: {
      subtitle: "Find saved rooms, messages, reviews, and safe housing updates.",
      quote: "I found my perfect self-contain within 2 days. The verified badges helped me know I was dealing with a legitimate landlord.",
      name: "Chisom Eze",
      meta: "300 Level, Computer Science, AAMUSTED",
      initial: "C",
    },
    landlord: {
      subtitle: "Manage your listings, inquiries, reviews, and verification requests.",
      quote: "Posting my hostel was straightforward, and student inquiries now come through one organized place instead of scattered calls.",
      name: "Kwame Mensah",
      meta: "Verified Landlord, Tanoso",
      initial: "K",
    },
    admin: {
      subtitle: "Review listings, verify landlords, resolve reports, and keep the platform safe.",
      quote: "The admin workspace keeps verification, reports, users, and listing quality checks in one view for faster decisions.",
      name: "AAMUSTED Housing Desk",
      meta: "Platform Administration",
      initial: "A",
    },
  };
  const currentRoleCopy = roleCopy[role];
  const seededEmails = Object.values(demoEmails);

  const selectRole = (nextRole: UserRole) => {
    setRole(nextRole);
    setAuthStatus("idle");
    setAuthMessage("");

    if (seededEmails.includes(email)) {
      setEmail(demoEmails[nextRole]);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setAuthStatus("error");
      setAuthMessage("Enter your email and password to continue.");
      return;
    }

    setAuthStatus("loading");
    setAuthMessage("Signing in...");

    try {
      const session = await api.login({ email, password, role });
      const authenticatedUser = session.user as ApiUser;
      localStorage.setItem("srg_auth_token", session.token);
      localStorage.setItem("srg_auth_user", JSON.stringify(authenticatedUser));
      localStorage.setItem("srg_auth_role", authenticatedUser.role);
      localStorage.setItem("srg_current_page", DASHBOARD_BY_ROLE[authenticatedUser.role]);
      setAuthStatus("api");
      setAuthMessage("Signed in.");
      navigate(loginTarget[authenticatedUser.role]);
    } catch (error) {
      if (error instanceof ApiError) {
        setAuthStatus("error");
        setAuthMessage(error.message);
        return;
      }

      setAuthStatus("error");
      setAuthMessage("Something went wrong. Please try again.");
    }
  };

  const handleSignup = async () => {
    const name = `${signupFirstName.trim()} ${signupLastName.trim()}`.trim();

    if (!name || !signupEmail.trim() || !signupPassword.trim()) {
      setAuthStatus("error");
      setAuthMessage("Enter your name, email, and password to create an account.");
      return;
    }

    setAuthStatus("loading");
    setAuthMessage("Creating your account...");

    try {
      const session = await api.register({
        name,
        email: signupEmail,
        password: signupPassword,
        role: role === "landlord" ? "landlord" : "student",
        ...(role === "landlord"
          ? { phone: signupIdentifier }
          : { student_id: signupIdentifier }),
      });
      const authenticatedUser = session.user as ApiUser;

      localStorage.setItem("srg_auth_token", session.token);
      localStorage.setItem("srg_auth_user", JSON.stringify(authenticatedUser));
      localStorage.setItem("srg_auth_role", authenticatedUser.role);
      localStorage.setItem("srg_current_page", DASHBOARD_BY_ROLE[authenticatedUser.role]);
      setAuthStatus("api");
      setAuthMessage("Account created.");
      navigate(DASHBOARD_BY_ROLE[authenticatedUser.role]);
    } catch (error) {
      if (error instanceof ApiError) {
        setAuthStatus("error");
        setAuthMessage(error.message);
        return;
      }

      setAuthStatus("error");
      setAuthMessage("Something went wrong. Please try again.");
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) {
      setForgotStatus("error");
      setForgotMessage("Enter your email address to request a password reset.");
      return;
    }

    setForgotStatus("loading");
    setForgotMessage("Preparing reset instructions...");

    try {
      const result = await api.forgotPassword({ email: forgotEmail });
      setForgotStatus("api");
      setForgotMessage(result.message);
    } catch (error) {
      if (error instanceof ApiError) {
        setForgotStatus("error");
        setForgotMessage(error.message);
        return;
      }

      setForgotStatus("error");
      setForgotMessage("Something went wrong. Please try again.");
    }
  };

  const handleResetPassword = async () => {
    if (!resetEmail.trim() || !resetToken.trim()) {
      setResetStatus("error");
      setResetMessage("This reset link is missing required details.");
      return;
    }

    if (!resetPassword || resetPassword !== resetPasswordConfirmation) {
      setResetStatus("error");
      setResetMessage("Enter matching password values.");
      return;
    }

    setResetStatus("loading");
    setResetMessage("Resetting password...");

    try {
      const result = await api.resetPassword({
        email: resetEmail,
        token: resetToken,
        password: resetPassword,
        password_confirmation: resetPasswordConfirmation,
      });
      setResetStatus("api");
      setResetMessage(result.message);
      setPassword("");
      window.history.replaceState({}, "", window.location.pathname);
    } catch (error) {
      setResetStatus("error");
      setResetMessage(error instanceof ApiError ? error.message : "Could not reset password.");
    }
  };

  const handleGoogleAuth = async () => {
    setAuthStatus("loading");
    setAuthMessage("Opening Google sign-in...");

    try {
      const googleClientId = await getGoogleClientId();

      if (!googleClientId) {
        setAuthStatus("error");
        setAuthMessage("Add GOOGLE_CLIENT_ID to backend/.env or VITE_GOOGLE_CLIENT_ID to .env to enable Google sign-in.");
        return;
      }

      await loadGoogleIdentityScript();

      const tokenClient = window.google?.accounts?.oauth2?.initTokenClient({
        client_id: googleClientId,
        scope: "openid email profile",
        callback: async (response) => {
          if (!response.access_token) {
            setAuthStatus("error");
            setAuthMessage(response.error || "Google did not return a sign-in token.");
            return;
          }

          setAuthMessage("Verifying Google account...");

          try {
            const session = await api.loginWithGoogle({
              access_token: response.access_token,
              role,
            });
            localStorage.setItem("srg_auth_token", session.token);
            localStorage.setItem("srg_auth_user", JSON.stringify(session.user));
            localStorage.setItem("srg_auth_role", session.user.role);
            localStorage.setItem("srg_current_page", DASHBOARD_BY_ROLE[session.user.role]);
            setAuthStatus("api");
            setAuthMessage("Signed in with Google.");
            navigate(loginTarget[session.user.role]);
          } catch (error) {
            setAuthStatus("error");
            setAuthMessage(error instanceof ApiError ? error.message : "Google sign-in could not be verified.");
          }
        },
        error_callback: () => {
          setAuthStatus("error");
          setAuthMessage("Google sign-in was closed before it completed.");
        },
      });

      if (!tokenClient) {
        setAuthStatus("error");
        setAuthMessage("Google sign-in is unavailable in this browser.");
        return;
      }

      tokenClient.requestAccessToken({ prompt: "select_account" });
    } catch (error) {
      setAuthStatus("error");
      setAuthMessage(error instanceof Error ? error.message : "Google sign-in could not start.");
    }
  };

  const showLegalNotice = (label: "Terms of Service" | "Privacy Policy") => {
    const messages = {
      "Terms of Service": "Use AAMUSTED Rent Guide honestly, inspect rooms before payment, and report suspicious listings for admin review.",
      "Privacy Policy": "We use account, profile, listing, message, and review data only to run the accommodation platform and protect users.",
    };

    setAuthStatus("api");
    setAuthMessage(messages[label]);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-rose-950 via-rose-900 to-rose-800 flex-col p-12 relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={heroCampusImage}
            alt="Campus"
            className="w-full h-full object-cover opacity-55"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-rose-950/45 via-rose-900/15 to-transparent" />
        </div>
        <button
          onClick={() => navigate("landing")}
          className="relative flex items-center gap-2 mb-auto w-fit"
        >
          <LogoMark />
          <span className="font-bold text-white">AAMUSTED Rent Guide</span>
        </button>
        <div className="relative bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
          <div className="flex items-center gap-0.5 mb-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
            ))}
          </div>
          <blockquote className="text-base font-medium leading-relaxed mb-4 text-white/90">
            "{currentRoleCopy.quote}"
          </blockquote>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-rose-400/30 rounded-full flex items-center justify-center text-white font-bold">
              {currentRoleCopy.initial}
            </div>
            <div>
              <p className="font-semibold text-white text-sm">{currentRoleCopy.name}</p>
              <p className="text-rose-300 text-sm">{currentRoleCopy.meta}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <button
            onClick={() => navigate("landing")}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-8 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to home
          </button>

          {view === "login" && (
            <>
              <h1 className="text-2xl font-bold text-slate-900 mb-1">Welcome back</h1>
              <p className="text-slate-500 text-sm mb-7">{currentRoleCopy.subtitle}</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Account type
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: "student" as UserRole, label: "Student", icon: <User className="w-4 h-4" /> },
                      { value: "landlord" as UserRole, label: "Landlord", icon: <Building2 className="w-4 h-4" /> },
                      { value: "admin" as UserRole, label: "Admin", icon: <Shield className="w-4 h-4" /> },
                    ].map((r) => (
                      <button
                        key={r.value}
                        onClick={() => selectRole(r.value)}
                        className={`flex items-center justify-center gap-1.5 py-2 rounded-xl border-2 text-xs font-semibold transition-all ${
                          role === r.value
                            ? "border-[#8D173E] bg-rose-50 text-rose-700"
                            : "border-slate-200 text-slate-600 hover:border-slate-300 bg-white"
                        }`}
                      >
                        {r.icon}
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="w-full border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200 placeholder:text-slate-400"
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm font-medium text-slate-700">Password</label>
                    <button
                      onClick={() => {
                        setForgotEmail(email);
                        setForgotStatus("idle");
                        setForgotMessage("");
                        setView("forgot");
                      }}
                      className="text-sm text-[#8D173E] hover:text-[#741231] transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <PasswordInput
                    value={password}
                    onChange={setPassword}
                    placeholder="••••••••"
                  />
                </div>
                {authStatus !== "idle" && (
                  <div
                    className={`rounded-xl border px-4 py-3 text-sm ${
                      authStatus === "error"
                        ? "border-red-200 bg-red-50 text-red-700"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {authMessage}
                  </div>
                )}
                <button
                  onClick={handleLogin}
                  disabled={authStatus === "loading"}
                  className="w-full bg-[#8D173E] hover:bg-[#741231] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition-colors"
                >
                  {authStatus === "loading" ? "Signing In..." : `Sign In as ${role === "admin" ? "Admin" : role === "landlord" ? "Landlord" : "Student"}`}
                </button>
                <div className="relative flex items-center">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="px-3 text-xs text-slate-400">or continue with</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>
                <button onClick={handleGoogleAuth} className="w-full border border-slate-200 rounded-xl py-2.5 flex items-center justify-center gap-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                  <Globe className="w-4 h-4" />
                  Continue with Google
                </button>
              </div>
              <p className="text-center text-sm text-slate-500 mt-6">
                No account?{" "}
                <button
                  onClick={() => {
                    selectRole("student");
                    setView("signup");
                  }}
                  className="text-[#8D173E] font-semibold hover:text-[#741231]"
                >
                  Create one
                </button>
              </p>
            </>
          )}

          {view === "signup" && (
            <>
              <h1 className="text-2xl font-bold text-slate-900 mb-1">Create your account</h1>
              <p className="text-slate-500 text-sm mb-5">
                Join thousands of students finding safe accommodation
              </p>
              <div className="flex gap-3 mb-5">
                {[
                  { value: "student", label: "Student", icon: <User className="w-4 h-4" /> },
                  { value: "landlord", label: "Landlord", icon: <Building2 className="w-4 h-4" /> },
                ].map((r) => (
                  <button
                    key={r.value}
                    onClick={() => selectRole(r.value as UserRole)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                      role === r.value
                        ? "border-[#8D173E] bg-rose-50 text-rose-700"
                        : "border-slate-200 text-slate-600 hover:border-slate-300 bg-white"
                    }`}
                  >
                    {r.icon}
                    {r.label}
                  </button>
                ))}
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    placeholder="First name"
                    value={signupFirstName}
                    onChange={(event) => setSignupFirstName(event.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200 placeholder:text-slate-400"
                  />
                  <input
                    placeholder="Last name"
                    value={signupLastName}
                    onChange={(event) => setSignupLastName(event.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200 placeholder:text-slate-400"
                  />
                </div>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    placeholder="Email address"
                    value={signupEmail}
                    onChange={(event) => setSignupEmail(event.target.value)}
                    className="w-full border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200 placeholder:text-slate-400"
                  />
                </div>
                {role === "student" ? (
                  <input
                    placeholder="Matric number (e.g. AAMUSTED/2021/CS/001)"
                    value={signupIdentifier}
                    onChange={(event) => setSignupIdentifier(event.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200 placeholder:text-slate-400"
                  />
                ) : (
                  <input
                    placeholder="Phone number"
                    value={signupIdentifier}
                    onChange={(event) => setSignupIdentifier(event.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200 placeholder:text-slate-400"
                  />
                )}
                <PasswordInput
                  value={signupPassword}
                  onChange={setSignupPassword}
                  placeholder="Create a password"
                />
                {authStatus !== "idle" && (
                  <div
                    className={`rounded-xl border px-4 py-3 text-sm ${
                      authStatus === "error"
                        ? "border-red-200 bg-red-50 text-red-700"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {authMessage}
                  </div>
                )}
                <p className="text-xs text-slate-500">
                  By creating an account you agree to our{" "}
                  <button onClick={() => showLegalNotice("Terms of Service")} className="text-[#8D173E] hover:underline">Terms of Service</button> and{" "}
                  <button onClick={() => showLegalNotice("Privacy Policy")} className="text-[#8D173E] hover:underline">Privacy Policy</button>.
                </p>
                <button
                  onClick={handleSignup}
                  disabled={authStatus === "loading"}
                  className="w-full bg-[#8D173E] hover:bg-[#741231] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition-colors"
                >
                  {authStatus === "loading" ? "Creating Account..." : "Create Account"}
                </button>
              </div>
              <p className="text-center text-sm text-slate-500 mt-5">
                Already have an account?{" "}
                <button
                  onClick={() => {
                    setAuthStatus("idle");
                    setAuthMessage("");
                    setView("login");
                  }}
                  className="text-[#8D173E] font-semibold hover:text-[#741231]"
                >
                  Sign in
                </button>
              </p>
            </>
          )}

          {view === "forgot" && (
            <>
              <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center mb-6">
                <Mail className="w-6 h-6 text-[#8D173E]" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mb-1">Reset your password</h1>
              <p className="text-slate-500 text-sm mb-7">
                Enter your email and we will send you a reset link.
              </p>
              <div className="space-y-4">
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={forgotEmail}
                    onChange={(event) => setForgotEmail(event.target.value)}
                    className="w-full border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200 placeholder:text-slate-400"
                  />
                </div>
                {forgotStatus !== "idle" && (
                  <div
                    className={`rounded-xl border px-4 py-3 text-sm flex items-start gap-2 ${
                      forgotStatus === "error"
                        ? "border-red-200 bg-red-50 text-red-700"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {forgotStatus === "error" ? (
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    ) : (
                      <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    )}
                    <span>{forgotMessage}</span>
                  </div>
                )}
                <button
                  onClick={handleForgotPassword}
                  disabled={forgotStatus === "loading"}
                  className="w-full bg-[#8D173E] hover:bg-[#741231] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition-colors"
                >
                  {forgotStatus === "loading" ? "Sending..." : "Send Reset Link"}
                </button>
              </div>
              <div className="text-center mt-6">
                <button
                  onClick={() => setView("login")}
                  className="text-sm text-[#8D173E] font-semibold hover:text-[#741231] inline-flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back to sign in
                </button>
              </div>
            </>
          )}

          {view === "reset" && (
            <>
              <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center mb-6">
                <Lock className="w-6 h-6 text-[#8D173E]" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mb-1">Create new password</h1>
              <p className="text-slate-500 text-sm mb-7">
                Enter a new password for your AAMUSTED Rent Guide account.
              </p>
              <div className="space-y-4">
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(event) => setResetEmail(event.target.value)}
                  placeholder="Email address"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200 placeholder:text-slate-400"
                />
                <PasswordInput value={resetPassword} onChange={setResetPassword} placeholder="New password" />
                <PasswordInput value={resetPasswordConfirmation} onChange={setResetPasswordConfirmation} placeholder="Confirm new password" />
                {resetStatus !== "idle" && (
                  <div
                    className={`rounded-xl border px-4 py-3 text-sm flex items-start gap-2 ${
                      resetStatus === "error"
                        ? "border-red-200 bg-red-50 text-red-700"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {resetStatus === "error" ? (
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    ) : (
                      <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    )}
                    <span>{resetMessage}</span>
                  </div>
                )}
                <button
                  onClick={handleResetPassword}
                  disabled={resetStatus === "loading"}
                  className="w-full bg-[#8D173E] hover:bg-[#741231] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition-colors"
                >
                  {resetStatus === "loading" ? "Resetting..." : "Reset Password"}
                </button>
              </div>
              <div className="text-center mt-6">
                <button
                  onClick={() => setView("login")}
                  className="text-sm text-[#8D173E] font-semibold hover:text-[#741231] inline-flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back to sign in
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage] = useState<Page>(() => getInitialPage());
  const [authView, setAuthView] = useState<AuthView>(() => new URLSearchParams(window.location.search).has("reset_token") ? "reset" : "login");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("reset_token")) {
      setPage("auth");
      setAuthView("reset");
    }
  }, []);

  const navigate = (p: Page) => {
    const hasSession = Boolean(localStorage.getItem("srg_auth_token"));
    const role = readStoredRole();
    const requestedRole = (Object.keys(PAGE_ROLE_PREFIX) as UserRole[]).find((item) => p.startsWith(PAGE_ROLE_PREFIX[item]));
    const targetPage = hasSession && requestedRole && requestedRole !== role
      ? DASHBOARD_BY_ROLE[role]
      : p;

    if (PORTAL_PAGES.includes(targetPage)) {
      localStorage.setItem("srg_current_page", targetPage);
    } else if (targetPage === "auth") {
      localStorage.removeItem("srg_current_page");
    }

    setPage(targetPage);
  };

  switch (page) {
    case "landing":
      return <LandingPage navigate={navigate} />;
    case "student-dashboard":
      return <StudentDashboard navigate={navigate} />;
    case "student-saved":
      return <StudentSavedPage navigate={navigate} />;
    case "student-messages":
      return <StudentMessagesPage navigate={navigate} />;
    case "student-reviews":
      return <StudentReviewsPage navigate={navigate} />;
    case "student-guide":
      return <StudentGuidePage navigate={navigate} />;
    case "student-reports":
      return <StudentReportsPage navigate={navigate} />;
    case "student-profile":
      return <StudentProfilePage navigate={navigate} />;
    case "student-password":
      return <StudentPasswordPage navigate={navigate} />;
    case "listings":
      return <ListingsPage navigate={navigate} />;
    case "hostel-detail":
      return <HostelDetailPage navigate={navigate} />;
    case "landlord-dashboard":
      return <LandlordDashboard navigate={navigate} />;
    case "landlord-listings":
      return <LandlordListingsPage navigate={navigate} />;
    case "landlord-messages":
      return <LandlordMessagesPage navigate={navigate} />;
    case "landlord-reviews":
      return <LandlordReviewsPage navigate={navigate} />;
    case "landlord-verification":
      return <LandlordVerificationPage navigate={navigate} />;
    case "landlord-profile":
      return <LandlordProfilePage navigate={navigate} />;
    case "add-hostel":
      return <AddHostelPage navigate={navigate} />;
    case "admin-dashboard":
      return <AdminDashboard navigate={navigate} />;
    case "admin-users":
      return <AdminUsersPage navigate={navigate} />;
    case "admin-landlords":
      return <AdminLandlordsPage navigate={navigate} />;
    case "admin-listings":
      return <AdminListingsPage navigate={navigate} />;
    case "admin-verifications":
      return <AdminVerificationsPage navigate={navigate} />;
    case "admin-reviews":
      return <AdminReviewsPage navigate={navigate} />;
    case "admin-reports":
      return <AdminReportsPage navigate={navigate} />;
    case "admin-accounts":
      return <AdminAccountsPage navigate={navigate} />;
    case "admin-settings":
      return <AdminSettingsPage navigate={navigate} />;
    case "auth":
      return <AuthPage navigate={navigate} view={authView} setView={setAuthView} />;
    default:
      return <LandingPage navigate={navigate} />;
  }
}
