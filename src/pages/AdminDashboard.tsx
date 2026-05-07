import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  ArrowLeft, Bell, Menu, X, Users, ShoppingCart, DollarSign, Activity, Send,
  MessageSquare, Eye, Trash2, Search, CheckCircle, Clock, MapPin, MoreVertical,
  Package, FileText, TrendingUp, RefreshCw, BadgeCheck, ShieldCheck, ShieldX,
  Check, AlertCircle, Crown, Shield, UserCog, Lock, Star, Truck, Leaf,
  BarChart3, Wheat, Sprout, Mountain, Globe, ChevronRight, Filter, Download,
  Settings, Zap, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, Legend,
} from "recharts";
import OrbisLinkLogo from "@/assets/orbislink-logo.png";
import AdminManagement from "@/components/admin/AdminManagement";
import DeliveryTracking from "@/components/admin/DeliveryTracking";
import WorkSessionTimer from "@/components/admin/WorkSessionTimer";
import { useWorkSession } from "@/hooks/useWorkSession";

// ÔöÇÔöÇÔöÇ Types ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ

type AdminPermission =
  | "manage_users" | "manage_products" | "manage_orders"
  | "manage_support" | "manage_sourcing" | "view_analytics" | "manage_admins";

type TabType =
  | "dashboard" | "products" | "users" | "transactions" | "notifications"
  | "orders" | "fichas" | "sourcing" | "market" | "admins" | "referrals" | "deliveries";

interface Product {
  id: string; product_type: string; quantity: number; price: number;
  logistics_access: string; user_id: string; created_at: string;
}
interface User {
  id: string; full_name: string; email?: string | null; phone?: string | null;
  user_type?: string | null; created_at?: string | null; verified?: boolean;
  verified_at?: string | null; is_root_admin?: boolean;
}
interface Order {
  id: string; user_id: string; product_id: string; quantity: number;
  location: string; status: string; created_at: string;
}
interface Transaction {
  id: string; wallet_id: string; type: string; status: string; amount: number;
  description?: string | null; related_user_id?: string | null; created_at: string;
}
interface Notification {
  id: string; user_id: string; type: string; title: string;
  message: string; read: boolean; created_at: string;
}
interface Ficha {
  id: string; user_id: string; nome_ficha: string; produto: string;
  tipo_negocio: string; qualidade?: string; telefone?: string; created_at: string;
}
interface SourcingRequest {
  id: string; user_id: string; product_name: string; quantity: number;
  delivery_date: string; description: string | null; status: string;
  admin_notes: string | null; created_at: string;
}
interface TopAgent {
  agent_id: string; agent_name: string; agent_avatar: string | null;
  total_referrals: number; total_points: number;
}
interface Referral {
  id: string; agent_id: string; referred_user_id: string; points: number;
  created_at: string; agent_name: string; agent_avatar: string | null;
  agent_code: string; referred_user_name: string;
}

// ÔöÇÔöÇÔöÇ Design Tokens ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ

const AGRO_COLORS = {
  primary: "#1a6b3c",
  primaryDark: "#0f4526",
  primaryLight: "#2d8a52",
  accent: "#e8a012",
  accentLight: "#f5c842",
  earth: "#7a5c3a",
  soil: "#4a3728",
  harvest: "#c4501a",
  sky: "#1e6b9e",
  sage: "#5a8a6a",
  cream: "#faf8f0",
  bark: "#6b4c2a",
};

const CHART_COLORS = ["#1a6b3c", "#e8a012", "#c4501a", "#1e6b9e", "#5a8a6a", "#7a5c3a"];

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  completed:   { label: "Conclu├¡do",   cls: "status-success" },
  concluida:   { label: "Conclu├¡da",   cls: "status-success" },
  pending:     { label: "Pendente",    cls: "status-warning" },
  aguardando:  { label: "Aguardando",  cls: "status-warning" },
  in_progress: { label: "Em Progresso",cls: "status-info" },
  failed:      { label: "Falhou",      cls: "status-danger" },
  cancelado:   { label: "Cancelado",   cls: "status-danger" },
  cancelled:   { label: "Cancelado",   cls: "status-danger" },
  blocked:     { label: "Bloqueado",   cls: "status-neutral" },
};

// ÔöÇÔöÇÔöÇ CSS Injection ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=DM+Mono:wght@400;500&family=Playfair+Display:wght@600;700&display=swap');

  :root {
    --agro-primary: #1a6b3c;
    --agro-primary-dark: #0f4526;
    --agro-primary-light: #2d8a52;
    --agro-accent: #e8a012;
    --agro-accent-light: #f5c842;
    --agro-earth: #7a5c3a;
    --agro-harvest: #c4501a;
    --agro-sky: #1e6b9e;
    --agro-sage: #5a8a6a;
    --agro-cream: #faf8f0;
    --agro-bark: #6b4c2a;
    --r-sm: 6px;
    --r-md: 10px;
    --r-lg: 14px;
    --r-xl: 20px;
    --shadow-card: 0 1px 3px rgba(0,0,0,.08), 0 0 0 1px rgba(0,0,0,.04);
    --shadow-elevated: 0 4px 16px rgba(0,0,0,.10), 0 0 0 1px rgba(0,0,0,.04);
  }

  * { box-sizing: border-box; }

  body, .admin-root {
    font-family: 'DM Sans', sans-serif;
    background: #f4f2ec;
    color: #1c1a16;
  }

  /* ÔöÇÔöÇ Header ÔöÇÔöÇ */
  .adm-header {
    position: sticky;
    top: 0;
    z-index: 100;
    background: #0f4526;
    border-bottom: 2px solid #1a6b3c;
  }

  .adm-header-inner {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 58px;
    gap: 16px;
  }

  .adm-brand {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }

  .adm-brand-text { display: flex; flex-direction: column; }

  .adm-brand-title {
    font-size: 13px;
    font-weight: 600;
    color: #fff;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    line-height: 1;
  }

  .adm-brand-sub {
    font-size: 10px;
    color: rgba(255,255,255,.5);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-top: 2px;
  }

  .adm-logo-badge {
    width: 36px; height: 36px;
    background: var(--agro-accent);
    border-radius: var(--r-md);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }

  .adm-header-actions { display: flex; align-items: center; gap: 8px; }

  .adm-icon-btn {
    width: 36px; height: 36px;
    background: rgba(255,255,255,.08);
    border: 1px solid rgba(255,255,255,.12);
    border-radius: var(--r-md);
    display: flex; align-items: center; justify-content: center;
    color: rgba(255,255,255,.8);
    cursor: pointer;
    transition: background .15s;
  }

  .adm-icon-btn:hover { background: rgba(255,255,255,.15); }

  .adm-notif-badge {
    position: absolute;
    top: -4px; right: -4px;
    background: var(--agro-accent);
    color: #1c1a16;
    font-size: 9px;
    font-weight: 700;
    min-width: 16px; height: 16px;
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    padding: 0 3px;
  }

  /* ÔöÇÔöÇ Nav Tabs ÔöÇÔöÇ */
  .adm-nav {
    background: #0a3a1e;
    border-bottom: 1px solid rgba(255,255,255,.06);
  }

  .adm-nav-inner {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 20px;
    display: flex;
    gap: 2px;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .adm-nav-inner::-webkit-scrollbar { display: none; }

  .adm-tab {
    display: flex; align-items: center; gap: 6px;
    padding: 10px 14px;
    font-size: 12px;
    font-weight: 500;
    color: rgba(255,255,255,.5);
    white-space: nowrap;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all .15s;
    position: relative;
    letter-spacing: 0.02em;
  }

  .adm-tab:hover { color: rgba(255,255,255,.8); }

  .adm-tab.active {
    color: #fff;
    border-bottom-color: var(--agro-accent);
  }

  .adm-tab-badge {
    background: var(--agro-accent);
    color: #1c1a16;
    font-size: 9px;
    font-weight: 700;
    min-width: 16px; height: 16px;
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    padding: 0 3px;
  }

  /* ÔöÇÔöÇ Main Layout ÔöÇÔöÇ */
  .adm-main {
    max-width: 1400px;
    margin: 0 auto;
    padding: 24px 20px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  /* ÔöÇÔöÇ Page Header ÔöÇÔöÇ */
  .adm-page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
  }

  .adm-page-title {
    font-family: 'Playfair Display', serif;
    font-size: 22px;
    font-weight: 700;
    color: var(--agro-primary-dark);
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .adm-page-subtitle {
    font-size: 13px;
    color: #6b6458;
    margin-top: 2px;
  }

  /* ÔöÇÔöÇ Root Admin Banner ÔöÇÔöÇ */
  .adm-root-banner {
    background: linear-gradient(135deg, #0f4526 0%, #1a6b3c 100%);
    border-radius: var(--r-lg);
    padding: 14px 20px;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .adm-root-banner-icon {
    width: 38px; height: 38px;
    background: var(--agro-accent);
    border-radius: var(--r-md);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }

  .adm-root-banner-text { flex: 1; }
  .adm-root-banner-label { font-size: 11px; color: rgba(255,255,255,.6); text-transform: uppercase; letter-spacing: 0.08em; }
  .adm-root-banner-value { font-size: 14px; font-weight: 600; color: #fff; margin-top: 1px; }

  /* ÔöÇÔöÇ Metric Cards ÔöÇÔöÇ */
  .adm-metrics-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 14px;
  }

  @media (max-width: 900px) { .adm-metrics-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 500px) { .adm-metrics-grid { grid-template-columns: 1fr 1fr; } }

  .adm-metric-card {
    background: #fff;
    border-radius: var(--r-lg);
    padding: 18px 20px;
    box-shadow: var(--shadow-card);
    border: 1px solid rgba(0,0,0,.05);
    position: relative;
    overflow: hidden;
    transition: box-shadow .2s, transform .2s;
  }

  .adm-metric-card:hover {
    box-shadow: var(--shadow-elevated);
    transform: translateY(-1px);
  }

  .adm-metric-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
  }

  .adm-metric-card.green::before  { background: var(--agro-primary); }
  .adm-metric-card.amber::before  { background: var(--agro-accent); }
  .adm-metric-card.orange::before { background: var(--agro-harvest); }
  .adm-metric-card.blue::before   { background: var(--agro-sky); }

  .adm-metric-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #9b9285;
  }

  .adm-metric-value {
    font-size: 32px;
    font-weight: 700;
    color: #1c1a16;
    line-height: 1;
    margin: 8px 0 10px;
    font-variant-numeric: tabular-nums;
  }

  .adm-metric-trend {
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 4px;
    font-weight: 500;
  }

  .adm-metric-trend.up   { color: var(--agro-primary); }
  .adm-metric-trend.down { color: var(--agro-harvest); }

  .adm-metric-icon {
    position: absolute;
    right: 16px; top: 20px;
    opacity: .07;
  }

  /* ÔöÇÔöÇ Cards ÔöÇÔöÇ */
  .adm-card {
    background: #fff;
    border-radius: var(--r-lg);
    border: 1px solid rgba(0,0,0,.06);
    box-shadow: var(--shadow-card);
    overflow: hidden;
  }

  .adm-card-header {
    padding: 18px 20px 14px;
    border-bottom: 1px solid #f0ede6;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px;
  }

  .adm-card-title {
    font-size: 14px;
    font-weight: 600;
    color: #1c1a16;
    display: flex;
    align-items: center;
    gap: 8px;
    letter-spacing: 0.01em;
  }

  .adm-card-title .adm-title-icon {
    width: 28px; height: 28px;
    background: #f0f5ee;
    border-radius: var(--r-sm);
    display: flex; align-items: center; justify-content: center;
    color: var(--agro-primary);
  }

  .adm-card-body { padding: 20px; }
  .adm-card-body.no-pad { padding: 0; }

  /* ÔöÇÔöÇ Tables ÔöÇÔöÇ */
  .adm-table-wrap { overflow-x: auto; }

  .adm-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  .adm-table thead tr {
    background: #f7f5ef;
    border-bottom: 2px solid #ede9df;
  }

  .adm-table thead th {
    padding: 10px 14px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: #7a7268;
    white-space: nowrap;
    text-align: left;
  }

  .adm-table tbody tr {
    border-bottom: 1px solid #f0ede6;
    transition: background .1s;
  }

  .adm-table tbody tr:hover { background: #faf9f5; }
  .adm-table tbody tr.selected { background: #f0f6ee; }

  .adm-table tbody td {
    padding: 12px 14px;
    color: #2d2b27;
    vertical-align: middle;
  }

  .adm-table .cell-mono {
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    color: #8a8178;
  }

  .adm-table .cell-name {
    font-weight: 600;
    color: #1c1a16;
  }

  .adm-table .cell-muted {
    font-size: 12px;
    color: #8a8178;
  }

  /* ÔöÇÔöÇ Status Badges ÔöÇÔöÇ */
  .adm-status {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 10px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }

  .adm-status::before {
    content: '';
    width: 5px; height: 5px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .status-success { background: #e8f5ee; color: #1a6b3c; }
  .status-success::before { background: #1a6b3c; }

  .status-warning { background: #fef4e0; color: #b37d0a; }
  .status-warning::before { background: #e8a012; }

  .status-info { background: #e3f0f8; color: #1e6b9e; }
  .status-info::before { background: #1e6b9e; }

  .status-danger { background: #fbeaea; color: #c4501a; }
  .status-danger::before { background: #c4501a; }

  .status-neutral { background: #f0ede6; color: #6b6458; }
  .status-neutral::before { background: #9b9285; }

  /* ÔöÇÔöÇ Type Badges ÔöÇÔöÇ */
  .adm-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: var(--r-sm);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.03em;
  }

  .badge-outline {
    background: transparent;
    border: 1px solid #d0cdc5;
    color: #6b6458;
  }

  .badge-green {
    background: #e8f5ee;
    color: #1a6b3c;
  }

  .badge-amber {
    background: #fef4e0;
    color: #b37d0a;
  }

  .badge-blue {
    background: #e3f0f8;
    color: #1e6b9e;
  }

  /* ÔöÇÔöÇ Action Buttons ÔöÇÔöÇ */
  .adm-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: var(--r-md);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all .15s;
    white-space: nowrap;
    border: none;
    font-family: 'DM Sans', sans-serif;
  }

  .adm-btn-primary {
    background: var(--agro-primary);
    color: #fff;
  }
  .adm-btn-primary:hover { background: var(--agro-primary-dark); }

  .adm-btn-accent {
    background: var(--agro-accent);
    color: #1c1a16;
  }
  .adm-btn-accent:hover { background: #d4920f; }

  .adm-btn-ghost {
    background: transparent;
    color: #6b6458;
    border: 1px solid #ddd9d0;
  }
  .adm-btn-ghost:hover { background: #f0ede6; }

  .adm-btn-danger {
    background: #fbeaea;
    color: #c4501a;
    border: 1px solid #f5c5b5;
  }
  .adm-btn-danger:hover { background: #f8d8d0; }

  .adm-btn-icon {
    width: 32px; height: 32px;
    padding: 0;
    justify-content: center;
    background: transparent;
    color: #8a8178;
    border: 1px solid #e0ddd6;
    border-radius: var(--r-sm);
  }
  .adm-btn-icon:hover { background: #f0ede6; color: #1c1a16; }
  .adm-btn-icon.danger:hover { background: #fbeaea; color: #c4501a; border-color: #f5c5b5; }
  .adm-btn-icon.success:hover { background: #e8f5ee; color: #1a6b3c; border-color: #c0dfc8; }
  .adm-btn-icon.warning:hover { background: #fef4e0; color: #b37d0a; border-color: #f5d890; }

  /* ÔöÇÔöÇ Search Bar ÔöÇÔöÇ */
  .adm-search {
    position: relative;
    display: flex;
    align-items: center;
  }

  .adm-search-icon {
    position: absolute;
    left: 10px;
    color: #9b9285;
    pointer-events: none;
  }

  .adm-search input {
    width: 220px;
    height: 34px;
    padding: 0 10px 0 34px;
    border: 1px solid #ddd9d0;
    border-radius: var(--r-md);
    font-size: 13px;
    font-family: 'DM Sans', sans-serif;
    background: #faf9f5;
    color: #1c1a16;
    transition: border-color .15s, box-shadow .15s;
  }

  .adm-search input:focus {
    outline: none;
    border-color: var(--agro-primary);
    box-shadow: 0 0 0 3px rgba(26,107,60,.1);
    background: #fff;
  }

  /* ÔöÇÔöÇ Chart Cards Grid ÔöÇÔöÇ */
  .adm-charts-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }

  @media (max-width: 800px) { .adm-charts-grid { grid-template-columns: 1fr; } }

  .adm-chart-full { grid-column: 1 / -1; }

  /* ÔöÇÔöÇ Leaderboard ÔöÇÔöÇ */
  .adm-leaderboard {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }

  @media (max-width: 700px) { .adm-leaderboard { grid-template-columns: 1fr; } }

  .adm-leader-card {
    border-radius: var(--r-lg);
    padding: 16px;
    border: 1px solid;
    position: relative;
    overflow: hidden;
    transition: transform .2s;
  }

  .adm-leader-card:hover { transform: translateY(-2px); }

  .adm-leader-card.rank-1 {
    background: linear-gradient(135deg, #fffbf0, #fff8e0);
    border-color: #f5d890;
  }
  .adm-leader-card.rank-2 {
    background: linear-gradient(135deg, #f5f5f5, #ececec);
    border-color: #d0cdc5;
  }
  .adm-leader-card.rank-3 {
    background: linear-gradient(135deg, #fff3ef, #ffebe5);
    border-color: #f5c5b5;
  }

  .adm-rank-badge {
    position: absolute;
    top: 12px; right: 12px;
    width: 28px; height: 28px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px;
    font-weight: 700;
  }

  .adm-rank-badge.r1 { background: var(--agro-accent); color: #1c1a16; }
  .adm-rank-badge.r2 { background: #b0b0b0; color: #fff; }
  .adm-rank-badge.r3 { background: #cd7c4a; color: #fff; }

  /* ÔöÇÔöÇ Notification Items ÔöÇÔöÇ */
  .adm-notif-item {
    padding: 14px 16px;
    border-radius: var(--r-md);
    border: 1px solid #e8e4da;
    cursor: pointer;
    transition: background .1s;
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }

  .adm-notif-item:hover { background: #faf9f5; }

  .adm-notif-item.unread {
    background: #f0f6ee;
    border-color: #c0dfc8;
  }

  .adm-notif-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: var(--agro-primary);
    flex-shrink: 0;
    margin-top: 5px;
  }

  .adm-notif-title { font-size: 13px; font-weight: 600; color: #1c1a16; }
  .adm-notif-msg { font-size: 12px; color: #6b6458; margin-top: 2px; }
  .adm-notif-time { font-size: 11px; color: #9b9285; margin-top: 4px; }

  /* ÔöÇÔöÇ Filter Tabs ÔöÇÔöÇ */
  .adm-filter-tabs {
    display: inline-flex;
    background: #f0ede6;
    border-radius: var(--r-md);
    padding: 3px;
    gap: 2px;
  }

  .adm-filter-tab {
    padding: 5px 14px;
    border-radius: var(--r-sm);
    font-size: 12px;
    font-weight: 500;
    color: #6b6458;
    cursor: pointer;
    transition: all .15s;
    border: none;
    background: transparent;
    font-family: 'DM Sans', sans-serif;
  }

  .adm-filter-tab.active {
    background: #fff;
    color: var(--agro-primary);
    font-weight: 600;
    box-shadow: 0 1px 3px rgba(0,0,0,.1);
  }

  /* ÔöÇÔöÇ Modal ÔöÇÔöÇ */
  .adm-modal-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 20px 24px 0;
  }

  .adm-modal-icon {
    width: 38px; height: 38px;
    background: #f0f5ee;
    border-radius: var(--r-md);
    display: flex; align-items: center; justify-content: center;
    color: var(--agro-primary);
  }

  .adm-modal-title {
    font-size: 16px;
    font-weight: 700;
    color: #1c1a16;
  }

  .adm-form-group { display: flex; flex-direction: column; gap: 5px; }

  .adm-label {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: #6b6458;
  }

  .adm-select, .adm-input, .adm-textarea {
    width: 100%;
    padding: 9px 12px;
    border: 1px solid #ddd9d0;
    border-radius: var(--r-md);
    font-size: 13px;
    font-family: 'DM Sans', sans-serif;
    background: #faf9f5;
    color: #1c1a16;
    transition: border-color .15s, box-shadow .15s;
  }

  .adm-select:focus, .adm-input:focus, .adm-textarea:focus {
    outline: none;
    border-color: var(--agro-primary);
    box-shadow: 0 0 0 3px rgba(26,107,60,.1);
    background: #fff;
  }

  /* ÔöÇÔöÇ Empty States ÔöÇÔöÇ */
  .adm-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 20px;
    color: #9b9285;
    gap: 10px;
    text-align: center;
  }

  .adm-empty-icon {
    width: 56px; height: 56px;
    background: #f0ede6;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 4px;
  }

  .adm-empty-title { font-size: 14px; font-weight: 600; color: #6b6458; }
  .adm-empty-sub { font-size: 12px; }

  /* ÔöÇÔöÇ Loading ÔöÇÔöÇ */
  .adm-loading {
    min-height: 100vh;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    background: #0f4526;
    gap: 16px;
  }

  .adm-loading-ring {
    width: 48px; height: 48px;
    border-radius: 50%;
    border: 3px solid rgba(255,255,255,.15);
    border-top-color: var(--agro-accent);
    animation: adm-spin .8s linear infinite;
  }

  @keyframes adm-spin { to { transform: rotate(360deg); } }

  .adm-loading-text {
    font-size: 14px;
    color: rgba(255,255,255,.6);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    font-weight: 500;
  }

  /* ÔöÇÔöÇ Separator ÔöÇÔöÇ */
  .adm-sep {
    height: 1px;
    background: #f0ede6;
    margin: 4px 0;
  }

  /* ÔöÇÔöÇ Sourcing detail cards ÔöÇÔöÇ */
  .adm-detail-card {
    padding: 16px;
    background: #faf9f5;
    border-radius: var(--r-lg);
    border: 1px solid #e8e4da;
  }

  .adm-notes-block {
    padding: 10px 12px;
    background: #f0f6ee;
    border-left: 3px solid var(--agro-primary);
    border-radius: 0 var(--r-sm) var(--r-sm) 0;
    font-size: 12px;
    color: #2d5a3a;
    margin-top: 8px;
  }

  /* ÔöÇÔöÇ AI Analysis ÔöÇÔöÇ */
  .adm-ai-block {
    padding: 20px 24px;
    background: linear-gradient(135deg, #f0f5ee, #faf9f5);
    border-radius: var(--r-lg);
    border: 1px solid #c0dfc8;
    line-height: 1.7;
    font-size: 14px;
    color: #2d2b27;
    white-space: pre-wrap;
  }

  /* ÔöÇÔöÇ Avatar ÔöÇÔöÇ */
  .adm-avatar {
    border-radius: 50%;
    background: var(--agro-primary);
    color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-weight: 700;
    flex-shrink: 0;
    font-size: 12px;
  }

  /* ÔöÇÔöÇ Referral stat cards ÔöÇÔöÇ */
  .adm-stat-card {
    border-radius: var(--r-lg);
    padding: 16px 18px;
    color: #fff;
    position: relative;
    overflow: hidden;
  }

  .adm-stat-card::after {
    content: '';
    position: absolute;
    right: -10px; bottom: -10px;
    width: 70px; height: 70px;
    border-radius: 50%;
    background: rgba(255,255,255,.08);
  }

  .adm-stat-label { font-size: 11px; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; opacity: .7; }
  .adm-stat-value { font-size: 28px; font-weight: 700; line-height: 1; margin: 6px 0 0; font-variant-numeric: tabular-nums; }

  /* ÔöÇÔöÇ Checkbox override ÔöÇÔöÇ */
  [data-state="checked"] { background: var(--agro-primary) !important; border-color: var(--agro-primary) !important; }

  /* ÔöÇÔöÇ Responsive ÔöÇÔöÇ */
  @media (max-width: 640px) {
    .adm-main { padding: 14px 12px; gap: 14px; }
    .adm-metric-value { font-size: 24px; }
    .adm-search input { width: 160px; }
  }
`;

// ÔöÇÔöÇÔöÇ Style Injector ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ

const StyleInjector = () => {
  useEffect(() => {
    const id = "adm-styles";
    if (document.getElementById(id)) return;
    const el = document.createElement("style");
    el.id = id;
    el.textContent = CSS;
    document.head.appendChild(el);
    return () => { document.getElementById(id)?.remove(); };
  }, []);
  return null;
};

// ÔöÇÔöÇÔöÇ Metric Card ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ

const MetricCard = ({
  title, value, icon, trend, color, suffix,
}: {
  title: string; value: number | string; icon: React.ReactNode;
  trend?: number; color: string; suffix?: string;
}) => (
  <div className={`adm-metric-card ${color}`}>
    <div className="adm-metric-icon">
      <div style={{ transform: "scale(4)", opacity: 1 }}>{icon}</div>
    </div>
    <div className="adm-metric-label">{title}</div>
    <div className="adm-metric-value">
      {typeof value === "number" ? value.toLocaleString() : value}
      {suffix && <span style={{ fontSize: 16, fontWeight: 400, color: "#6b6458" }}> {suffix}</span>}
    </div>
    {trend !== undefined && (
      <div className={`adm-metric-trend ${trend >= 0 ? "up" : "down"}`}>
        {trend >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
        {Math.abs(trend)}% este m├¬s
      </div>
    )}
  </div>
);

// ÔöÇÔöÇÔöÇ Status Badge ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ

const StatusBadge = ({ status }: { status: string }) => {
  const s = STATUS_MAP[status] || { label: status, cls: "status-neutral" };
  return <span className={`adm-status ${s.cls}`}>{s.label}</span>;
};

// ÔöÇÔöÇÔöÇ Custom Tooltip ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ

const AgroTooltip = ({ active, payload, label, unit = "" }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#0f4526", border: "1px solid #1a6b3c", borderRadius: 8,
      padding: "8px 14px", fontSize: 12, color: "#fff",
    }}>
      <div style={{ color: "rgba(255,255,255,.6)", marginBottom: 2 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ fontWeight: 600 }}>
          {typeof p.value === "number" ? p.value.toLocaleString() : p.value}{unit}
        </div>
      ))}
    </div>
  );
};

// ÔöÇÔöÇÔöÇ Table Toolbar ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ

const TableToolbar = ({
  title, count, icon, search, setSearch, bulkCount, onBulkDelete, extra,
}: {
  title: string; count: number; icon: React.ReactNode;
  search: string; setSearch: (v: string) => void;
  bulkCount?: number; onBulkDelete?: () => void;
  extra?: React.ReactNode;
}) => (
  <div className="adm-card-header">
    <div className="adm-card-title">
      <div className="adm-title-icon">{icon}</div>
      {title}
      <span style={{ fontSize: 12, fontWeight: 400, color: "#9b9285", marginLeft: 2 }}>({count})</span>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      {extra}
      {bulkCount != null && bulkCount > 0 && onBulkDelete && (
        <button className="adm-btn adm-btn-danger" onClick={onBulkDelete}>
          <Trash2 size={13} /> Apagar {bulkCount} selecionado{bulkCount > 1 ? "s" : ""}
        </button>
      )}
      <div className="adm-search">
        <Search size={14} className="adm-search-icon" />
        <input
          placeholder="BuscarÔÇª"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
    </div>
  </div>
);

// ÔöÇÔöÇÔöÇ Main Component ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [fichas, setFichas] = useState<Ficha[]>([]);
  const [sourcingRequests, setSourcingRequests] = useState<SourcingRequest[]>([]);
  const [topAgents, setTopAgents] = useState<TopAgent[]>([]);
  const [allReferrals, setAllReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [notifModalOpen, setNotifModalOpen] = useState(false);
  const [notifMessage, setNotifMessage] = useState("");
  const [notifTitle, setNotifTitle] = useState("");
  const [notifType, setNotifType] = useState("info");
  const [targetUser, setTargetUser] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [analyzingMarket, setAnalyzingMarket] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isRootAdmin, setIsRootAdmin] = useState(false);
  const [isSuperRoot, setIsSuperRoot] = useState(false);
  const [isSupportAgent, setIsSupportAgent] = useState(false);
  const [userPermissions, setUserPermissions] = useState<AdminPermission[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());

  const { elapsedTimeFormatted, isSessionActive, stats: workSessionStats, endSession } =
    useWorkSession(currentUserId, isSupportAgent);

  // ÔöÇÔöÇ Auth / Permission check ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      const { data: userData } = await supabase
        .from("users").select("is_root_admin, is_super_root")
        .eq("id", user.id).single();

      if (userData?.is_root_admin) {
        setIsRootAdmin(true);
        setUserPermissions([
          "manage_users", "manage_products", "manage_orders",
          "manage_support", "manage_sourcing", "view_analytics", "manage_admins",
        ]);
      }
      if ((userData as any)?.is_super_root) setIsSuperRoot(true);

      const { data: isSA } = await supabase.rpc("is_support_agent", { _user_id: user.id });
      if (isSA) setIsSupportAgent(true);

      if (!userData?.is_root_admin) {
        const { data: perms } = await supabase
          .from("admin_permissions").select("permission").eq("user_id", user.id);
        if (perms) setUserPermissions(perms.map(p => p.permission as AdminPermission));
      }
    })();
  }, []);

  const hasPermission = useCallback(
    (p: AdminPermission) => isRootAdmin || userPermissions.includes(p),
    [isRootAdmin, userPermissions],
  );

  // ÔöÇÔöÇ Data fetch ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
  useEffect(() => {
    fetchAllData();
    const iv = setInterval(fetchAllData, 30000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const ch = supabase
      .channel("notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" },
        payload => setNotifications(prev => [payload.new as Notification, ...prev]))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    supabase.from("pre_orders").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setOrders(data); });
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [prodR, usersR, transR, notR, fichasR, srcR, agentsR, refR] = await Promise.all([
        supabase.from("products").select("*").order("created_at", { ascending: false }),
        supabase.from("users").select("*").order("created_at", { ascending: false }),
        supabase.from("transactions").select("*").order("created_at", { ascending: false }),
        supabase.from("notifications").select("*").order("created_at", { ascending: false }),
        supabase.from("fichas_recebimento").select("*").order("created_at", { ascending: false }),
        supabase.from("sourcing_requests").select("*").order("created_at", { ascending: false }),
        supabase.rpc("get_top_agents_by_referrals", { limit_count: 3 }),
        supabase.from("agent_referrals").select("*").order("created_at", { ascending: false }),
      ]);
      setProducts(prodR.data || []);
      setUsers(usersR.data || []);
      setTransactions(transR.data || []);
      setNotifications(notR.data || []);
      setFichas(fichasR.data || []);
      setSourcingRequests(srcR.data || []);
      setTopAgents(agentsR.data || []);

      if (refR.data && usersR.data) {
        const um = new Map(usersR.data.map(u => [u.id, u]));
        setAllReferrals(refR.data.map((r: any) => ({
          ...r,
          agent_name: um.get(r.agent_id)?.full_name || "ÔÇö",
          agent_avatar: um.get(r.agent_id) ? null : null,
          agent_code: (um.get(r.agent_id) as any)?.agent_code || "N/A",
          referred_user_name: um.get(r.referred_user_id)?.full_name || "ÔÇö",
        })));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ÔöÇÔöÇ Actions ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
  const sendNotification = useCallback(async () => {
    if (!targetUser || !notifMessage.trim() || !notifTitle.trim()) {
      toast.error("Preencha todos os campos!"); return;
    }
    try {
      const { error } = await supabase.rpc("create_notification", {
        p_user_id: targetUser, p_type: notifType,
        p_title: notifTitle, p_message: notifMessage, p_metadata: {},
      });
      if (error) throw error;
      setNotifModalOpen(false); setNotifMessage(""); setNotifTitle(""); setTargetUser(null);
      toast.success("Notifica├º├úo enviada com sucesso!");
    } catch { toast.error("Erro ao enviar notifica├º├úo"); }
  }, [targetUser, notifMessage, notifTitle, notifType]);

  const handleDelete = useCallback(async (table: string, id: string, setter: Function) => {
    if (!confirm("Confirmar exclus├úo? Esta a├º├úo ├® irrevers├¡vel.")) return;
    try {
      if (table === "users") {
        const { error } = await supabase.rpc("admin_delete_user", { p_user_id: id });
        if (error) { toast.error("Erro: " + error.message); return; }
        setter((p: any[]) => p.filter(i => i.id !== id));
        setProducts(p => p.filter(x => x.user_id !== id));
        toast.success("Usu├írio exclu├¡do com sucesso");
      } else if (table === "products") {
        const { error } = await supabase.rpc("admin_delete_product", { p_product_id: id });
        if (error) { toast.error("Erro: " + error.message); return; }
        setter((p: any[]) => p.filter(i => i.id !== id));
        toast.success("Produto exclu├¡do com sucesso");
      } else {
        const { error } = await supabase.from(table as any).delete().eq("id", id);
        if (error) { toast.error("Erro: " + error.message); return; }
        setter((p: any[]) => p.filter(i => i.id !== id));
        toast.success("Item exclu├¡do");
      }
    } catch { toast.error("Erro ao excluir"); }
  }, []);

  const handleBulkDelete = useCallback(async (
    table: string, ids: Set<string>, setter: Function, clear: () => void,
  ) => {
    if (!ids.size) { toast.error("Nenhum item selecionado"); return; }
    if (!confirm(`Excluir ${ids.size} item(s)? Esta a├º├úo ├® irrevers├¡vel.`)) return;
    const arr = Array.from(ids);
    try {
      if (table === "users") {
        const { data, error } = await supabase.rpc("admin_bulk_delete_users", { p_user_ids: arr });
        if (error) { toast.error(error.message); return; }
        setter((p: any[]) => p.filter(i => !ids.has(i.id)));
        setProducts(p => p.filter(x => !ids.has(x.user_id)));
        clear(); toast.success(`${data || arr.length} usu├írio(s) exclu├¡do(s)`);
      } else if (table === "products") {
        const { data, error } = await supabase.rpc("admin_bulk_delete_products", { p_product_ids: arr });
        if (error) { toast.error(error.message); return; }
        setter((p: any[]) => p.filter(i => !ids.has(i.id)));
        clear(); toast.success(`${data || arr.length} produto(s) exclu├¡do(s)`);
      } else {
        const { error } = await supabase.from(table as any).delete().in("id", arr);
        if (error) { toast.error(error.message); return; }
        setter((p: any[]) => p.filter(i => !ids.has(i.id)));
        clear(); toast.success(`${arr.length} item(s) exclu├¡do(s)`);
      }
    } catch { toast.error("Erro ao excluir"); }
  }, []);

  const toggleSelectUser = useCallback((id: string) => {
    setSelectedUsers(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);
  const toggleSelectProduct = useCallback((id: string) => {
    setSelectedProducts(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);
  const toggleAllUsers = useCallback((list: User[]) => {
    setSelectedUsers(p => p.size === list.length ? new Set() : new Set(list.map(u => u.id)));
  }, []);
  const toggleAllProducts = useCallback((list: Product[]) => {
    setSelectedProducts(p => p.size === list.length ? new Set() : new Set(list.map(x => x.id)));
  }, []);

  const markRead = useCallback(async (id: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifications(p => p.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const updateOrderStatus = useCallback(async (id: string, status: string) => {
    const { error } = await supabase.from("pre_orders").update({ status }).eq("id", id);
    if (!error) { setOrders(p => p.map(o => o.id === id ? { ...o, status } : o)); toast.success("Status atualizado"); }
  }, []);

  const updateSourcingStatus = useCallback(async (id: string, status: string, notes?: string) => {
    const upd: any = { status };
    if (notes !== undefined) upd.admin_notes = notes;
    const { error } = await supabase.from("sourcing_requests").update(upd).eq("id", id);
    if (!error) { setSourcingRequests(p => p.map(s => s.id === id ? { ...s, ...upd } : s)); toast.success("Atualizado"); }
    else toast.error("Erro ao atualizar");
  }, []);

  const toggleVerification = useCallback(async (userId: string, current: boolean) => {
    try {
      const { error } = await supabase.from("users")
        .update({ verified: !current, verified_at: !current ? new Date().toISOString() : null })
        .eq("id", userId);
      if (error) throw error;
      setUsers(p => p.map(u => u.id === userId ? { ...u, verified: !current } : u));
      toast.success(!current ? "Usu├írio verificado!" : "Verifica├º├úo removida");
    } catch { toast.error("Erro ao atualizar verifica├º├úo"); }
  }, []);

  const generateAnalysis = useCallback(async () => {
    if (!products.length) { toast.error("Sem produtos para analisar"); return; }
    setAnalyzingMarket(true);
    try {
      const lang = localStorage.getItem("orbislink_language") || "pt";
      const { data, error } = await supabase.functions.invoke("market-analysis", {
        body: { products, language: lang },
      });
      if (error) throw error;
      setAiAnalysis(data.analysis);
      toast.success("An├ílise gerada!");
    } catch { toast.error("Erro ao gerar an├ílise"); }
    finally { setAnalyzingMarket(false); }
  }, [products]);

  // ÔöÇÔöÇ Memoized data ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
  const chartRevenue = useMemo(() => {
    const m: Record<string, number> = {};
    transactions.forEach(t => {
      const d = new Date(t.created_at).toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
      m[d] = (m[d] || 0) + t.amount;
    });
    return Object.entries(m).slice(-10).map(([date, amount]) => ({ date, amount }));
  }, [transactions]);

  const chartProducts = useMemo(() => {
    const m: Record<string, number> = {};
    products.forEach(p => { m[p.product_type] = (m[p.product_type] || 0) + 1; });
    return Object.entries(m).slice(0, 8).map(([name, value]) => ({ name, value }));
  }, [products]);

  const chartTxStatus = useMemo(() => {
    const m: Record<string, number> = { completed: 0, pending: 0, failed: 0, blocked: 0 };
    transactions.forEach(t => { if (m[t.status] !== undefined) m[t.status]++; });
    return Object.entries(m).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
  }, [transactions]);

  const unread = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  const filteredNotifs = useMemo(() => notifications.filter(n => {
    if (filterStatus === "unread") return !n.read;
    if (filterStatus === "read") return n.read;
    return true;
  }), [notifications, filterStatus]);

  const filteredProducts = useMemo(() =>
    products.filter(p => p.product_type.toLowerCase().includes(searchTerm.toLowerCase())),
    [products, searchTerm]);

  const filteredUsers = useMemo(() =>
    users.filter(u => (u.full_name || "").toLowerCase().includes(searchTerm.toLowerCase())),
    [users, searchTerm]);

  const filteredFichas = useMemo(() =>
    fichas.filter(f =>
      f.nome_ficha.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.produto.toLowerCase().includes(searchTerm.toLowerCase())),
    [fichas, searchTerm]);

  // ÔöÇÔöÇ Nav tabs config ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
  const tabs: Array<{ id: TabType; label: string; icon: React.ReactNode; badge?: number; guard?: boolean }> = [
    { id: "dashboard",     label: "Dashboard",    icon: <BarChart3 size={13} /> },
    { id: "orders",        label: "Pedidos",      icon: <ShoppingCart size={13} /> },
    { id: "products",      label: "Produtos",     icon: <Wheat size={13} />,     guard: !hasPermission("manage_products") },
    { id: "users",         label: "Usu├írios",     icon: <Users size={13} />,     guard: !hasPermission("manage_users") },
    { id: "transactions",  label: "Transa├º├Áes",   icon: <DollarSign size={13} /> },
    { id: "notifications", label: "Notifica├º├Áes", icon: <Bell size={13} />,      badge: unread },
    { id: "fichas",        label: "Fichas",       icon: <FileText size={13} /> },
    { id: "sourcing",      label: "Sourcing",     icon: <Globe size={13} />,     badge: sourcingRequests.filter(s => s.status === "pending").length, guard: !hasPermission("manage_sourcing") },
    { id: "market",        label: "Mercado",      icon: <TrendingUp size={13} />,guard: !hasPermission("view_analytics") },
    { id: "admins",        label: "Admins",       icon: <Crown size={13} />,     guard: !isRootAdmin && !hasPermission("manage_admins") },
    { id: "referrals",     label: "Indica├º├Áes",   icon: <Star size={13} />,      badge: allReferrals.length, guard: !hasPermission("view_analytics") },
    { id: "deliveries",    label: "Entregas",     icon: <Truck size={13} />,     guard: !isSupportAgent && !hasPermission("manage_orders") },
  ].filter(t => !t.guard);

  // ÔöÇÔöÇ Loading screen ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
  if (loading && !products.length) {
    return (
      <div className="adm-loading">
        <StyleInjector />
        <Leaf size={28} color={AGRO_COLORS.accent} />
        <div className="adm-loading-ring" />
        <div className="adm-loading-text">Carregando painel agr├¡colaÔÇª</div>
      </div>
    );
  }

  return (
    <div className="admin-root">
      <StyleInjector />

      {/* ÔöÇÔöÇ Header ÔöÇÔöÇ */}
      <header className="adm-header">
        <div className="adm-header-inner">
          <div className="adm-brand">
            <div className="adm-logo-badge">
              <Leaf size={18} color="#0f4526" />
            </div>
            <div className="adm-brand-text">
              <span className="adm-brand-title">AgriLink Admin</span>
              <span className="adm-brand-sub">Painel de Controle Agr├¡cola</span>
            </div>
          </div>

          <div className="adm-header-actions">
            <div style={{ position: "relative" }}>
              <button
                className="adm-icon-btn"
                onClick={() => setActiveTab("notifications")}
              >
                
                <Bell size={15} />
              </button>
              {unread > 0 && (
                <span className="adm-notif-badge">{unread > 99 ? "99+" : unread}</span>
              )}
            </div>
            <button className="adm-icon-btn" onClick={fetchAllData} title="Atualizar dados">
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
            <button className="adm-icon-btn" onClick={() => navigate("/")}>
              <ArrowLeft size={15} />
            </button>
            <button
              className="adm-icon-btn md:hidden"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X size={15} /> : <Menu size={15} />}
            </button>
          </div>
        </div>
      </header>

      {/* ÔöÇÔöÇ Nav ÔöÇÔöÇ */}
      <nav className="adm-nav">
        <div className="adm-nav-inner">
          {tabs.map(t => (
            <button
              key={t.id}
              className={`adm-tab ${activeTab === t.id ? "active" : ""}`}
              onClick={() => { setActiveTab(t.id); setMenuOpen(false); }}
            >
              {t.icon}
              {t.label}
              {t.badge != null && t.badge > 0 && (
                <span className="adm-tab-badge">{t.badge > 99 ? "99+" : t.badge}</span>
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* ÔöÇÔöÇ Main ÔöÇÔöÇ */}
      <main className="adm-main">

        {/* Work Timer */}
        {isSupportAgent && (
          <WorkSessionTimer
            elapsedTimeFormatted={elapsedTimeFormatted}
            isSessionActive={isSessionActive}
            stats={workSessionStats}
            onEndSession={endSession}
          />
        )}

        {/* Root Admin Banner */}
        {isRootAdmin && (
          <div className="adm-root-banner">
            <div className="adm-root-banner-icon">
              <Crown size={18} color="#0f4526" />
            </div>
            <div className="adm-root-banner-text">
              <div className="adm-root-banner-label">N├¡vel de Acesso</div>
              <div className="adm-root-banner-value">
                Root Admin ÔÇö Controle Total do Sistema{isSuperRoot ? " ┬À Super Root" : ""}
              </div>
            </div>
            <Zap size={18} color="rgba(255,255,255,.3)" />
          </div>
        )}

        {/* ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ
            DASHBOARD
        ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ */}
        {activeTab === "dashboard" && (
          <>
            {/* Page Header */}
            <div className="adm-page-header">
              <div>
                <div className="adm-page-title">
                  <Sprout size={22} color={AGRO_COLORS.primary} />
                  Vis├úo Geral do Sistema
                </div>
                <div className="adm-page-subtitle">
                  Dados actualizados automaticamente a cada 30 segundos
                </div>
              </div>
              <button className="adm-btn adm-btn-ghost" style={{ fontSize: 12, padding: "6px 14px" }}>
                <Download size={13} /> Exportar Relat├│rio
              </button>
            </div>

            {/* Metrics */}
            <div className="adm-metrics-grid">
              <MetricCard title="Produtos Activos" value={products.length} icon={<Wheat />} trend={12} color="green" />
              <MetricCard title="Utilizadores" value={users.length} icon={<Users />} trend={8} color="amber" />
              <MetricCard title="Encomendas" value={orders.length} icon={<ShoppingCart />} trend={15} color="orange" />
              <MetricCard title="Transac├º├Áes" value={transactions.length} icon={<DollarSign />} trend={5} color="blue" />
            </div>

            {/* Leaderboard */}
            <div className="adm-card">
              <div className="adm-card-header">
                <div className="adm-card-title">
                  <div className="adm-title-icon"><Crown size={14} /></div>
                  Top 3 Agentes ÔÇö Maiores Indicadores
                </div>
              </div>
              <div className="adm-card-body">
                {!topAgents.length ? (
                  <div className="adm-empty">
                    <div className="adm-empty-icon"><Star size={22} color="#9b9285" /></div>
                    <div className="adm-empty-title">Sem indica├º├Áes ainda</div>
                  </div>
                ) : (
                  <div className="adm-leaderboard">
                    {topAgents.map((a, i) => (
                      <div key={a.agent_id} className={`adm-leader-card rank-${i + 1}`}>
                        <span className={`adm-rank-badge r${i + 1}`}>{i + 1}┬░</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div
                            className="adm-avatar"
                            style={{ width: 44, height: 44, fontSize: 14, background: CHART_COLORS[i] }}
                          >
                            {a.agent_name?.charAt(0) || "A"}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13, color: "#1c1a16" }}>{a.agent_name}</div>
                            <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                              <span style={{ fontSize: 12, color: "#6b6458", display: "flex", alignItems: "center", gap: 4 }}>
                                <Users size={11} /> {a.total_referrals} indica├º├Áes
                              </span>
                              <span style={{ fontSize: 12, color: "#b37d0a", display: "flex", alignItems: "center", gap: 4 }}>
                                <Star size={11} /> {a.total_points} pts
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Charts */}
            <div className="adm-charts-grid">
              <div className="adm-card">
                <div className="adm-card-header">
                  <div className="adm-card-title">
                    <div className="adm-title-icon"><TrendingUp size={14} /></div>
                    Receita ÔÇö ├Ültimos 10 Dias
                  </div>
                </div>
                <div className="adm-card-body">
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={chartRevenue}>
                      <defs>
                        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={AGRO_COLORS.primary} stopOpacity={0.15} />
                          <stop offset="95%" stopColor={AGRO_COLORS.primary} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0ede6" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9b9285" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#9b9285" }} axisLine={false} tickLine={false} />
                      <Tooltip content={<AgroTooltip unit=" Kz" />} />
                      <Area type="monotone" dataKey="amount" stroke={AGRO_COLORS.primary} strokeWidth={2} fill="url(#revGrad)" dot={{ fill: AGRO_COLORS.primary, r: 3, strokeWidth: 0 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="adm-card">
                <div className="adm-card-header">
                  <div className="adm-card-title">
                    <div className="adm-title-icon"><Package size={14} /></div>
                    Top Produtos por Oferta
                  </div>
                </div>
                <div className="adm-card-body">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={chartProducts} layout="vertical" barSize={10}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0ede6" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: "#9b9285" }} axisLine={false} tickLine={false} />
                      <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11, fill: "#9b9285" }} axisLine={false} tickLine={false} />
                      <Tooltip content={<AgroTooltip />} />
                      <Bar dataKey="value" fill={AGRO_COLORS.primary} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="adm-card adm-chart-full">
                <div className="adm-card-header">
                  <div className="adm-card-title">
                    <div className="adm-title-icon"><Activity size={14} /></div>
                    Distribui├º├úo de Transa├º├Áes por Status
                  </div>
                </div>
                <div className="adm-card-body" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 40, flexWrap: "wrap" }}>
                  <ResponsiveContainer width={200} height={200}>
                    <PieChart>
                      <Pie data={chartTxStatus} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                        {chartTxStatus.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {chartTxStatus.map((item, i) => (
                      <div key={item.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span style={{ fontSize: 13, color: "#6b6458", textTransform: "capitalize", minWidth: 80 }}>
                          {item.name.replace(/_/g, " ")}
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "#1c1a16", fontVariantNumeric: "tabular-nums" }}>
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ
            ORDERS
        ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ */}
        {activeTab === "orders" && (
          <div className="adm-card">
            <div className="adm-card-header">
              <div className="adm-card-title">
                <div className="adm-title-icon"><ShoppingCart size={14} /></div>
                Encomendas
                <span style={{ fontSize: 12, fontWeight: 400, color: "#9b9285" }}>({orders.length})</span>
              </div>
            </div>
            <div className="adm-card-body no-pad">
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th>Cliente</th>
                      <th>Qtd</th>
                      <th>Status</th>
                      <th>Data</th>
                      <th>Ac├º├Áes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(order => {
                      const user = users.find(u => u.id === order.user_id);
                      const product = products.find(p => p.id === order.product_id);
                      return (
                        <tr key={order.id}>
                          <td className="cell-name">{product?.product_type || "ÔÇö"}</td>
                          <td>{user?.full_name || "ÔÇö"}</td>
                          <td><span className="adm-badge badge-green">{order.quantity} kg</span></td>
                          <td><StatusBadge status={order.status} /></td>
                          <td className="cell-muted">{new Date(order.created_at).toLocaleDateString("pt-BR")}</td>
                          <td>
                            <div style={{ display: "flex", gap: 4 }}>
                              <button className="adm-btn-icon adm-btn success" title="Concluir" onClick={() => updateOrderStatus(order.id, "concluida")} disabled={order.status === "concluida"}>
                                <Check size={13} />
                              </button>
                              <button className="adm-btn-icon adm-btn warning" title="Aguardando" onClick={() => updateOrderStatus(order.id, "aguardando")} disabled={order.status === "aguardando"}>
                                <Clock size={13} />
                              </button>
                              <button className="adm-btn-icon adm-btn danger" title="Cancelar" onClick={() => updateOrderStatus(order.id, "cancelado")} disabled={order.status === "cancelado"}>
                                <X size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ
            PRODUCTS
        ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ */}
        {activeTab === "products" && (
          <div className="adm-card">
            <TableToolbar
              title="Produtos"
              count={filteredProducts.length}
              icon={<Wheat size={14} />}
              search={searchTerm}
              setSearch={setSearchTerm}
              bulkCount={selectedProducts.size}
              onBulkDelete={() => handleBulkDelete("products", selectedProducts, setProducts, () => setSelectedProducts(new Set()))}
            />
            <div className="adm-card-body no-pad">
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}>
                        <Checkbox
                          checked={filteredProducts.length > 0 && selectedProducts.size === filteredProducts.length}
                          onCheckedChange={() => toggleAllProducts(filteredProducts)}
                        />
                      </th>
                      <th>Produto</th>
                      <th>Qtd (kg)</th>
                      <th>Pre├ºo</th>
                      <th>Fornecedor</th>
                      <th>Data</th>
                      <th>Ac├º├Áes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map(p => {
                      const user = users.find(u => u.id === p.user_id);
                      return (
                        <tr key={p.id} className={selectedProducts.has(p.id) ? "selected" : ""}>
                          <td><Checkbox checked={selectedProducts.has(p.id)} onCheckedChange={() => toggleSelectProduct(p.id)} /></td>
                          <td className="cell-name">{p.product_type}</td>
                          <td>{p.quantity.toLocaleString()}</td>
                          <td style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{p.price.toLocaleString("pt-AO")} Kz</td>
                          <td>{user?.full_name || "ÔÇö"}</td>
                          <td className="cell-muted">{new Date(p.created_at).toLocaleDateString("pt-BR")}</td>
                          <td>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="adm-btn-icon adm-btn"><MoreVertical size={13} /></button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" style={{ minWidth: 160 }}>
                                <DropdownMenuItem onClick={() => { setTargetUser(p.user_id); setNotifModalOpen(true); }}>
                                  <Bell size={13} className="mr-2" /> Notificar Fornecedor
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-red-600" onClick={() => handleDelete("products", p.id, setProducts)}>
                                  <Trash2 size={13} className="mr-2" /> Excluir Produto
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ
            USERS
        ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ */}
        {activeTab === "users" && (
          <div className="adm-card">
            <TableToolbar
              title="Utilizadores"
              count={filteredUsers.length}
              icon={<Users size={14} />}
              search={searchTerm}
              setSearch={setSearchTerm}
              bulkCount={selectedUsers.size}
              onBulkDelete={() => handleBulkDelete("users", selectedUsers, setUsers, () => setSelectedUsers(new Set()))}
            />
            <div className="adm-card-body no-pad">
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}>
                        <Checkbox
                          checked={filteredUsers.length > 0 && selectedUsers.size === filteredUsers.length}
                          onCheckedChange={() => toggleAllUsers(filteredUsers)}
                        />
                      </th>
                      <th>Nome</th>
                      <th>Email</th>
                      <th>Telefone</th>
                      <th>Tipo</th>
                      <th>Verifica├º├úo</th>
                      <th>Data</th>
                      <th>Ac├º├Áes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(user => (
                      <tr key={user.id} className={selectedUsers.has(user.id) ? "selected" : ""}>
                        <td><Checkbox checked={selectedUsers.has(user.id)} onCheckedChange={() => toggleSelectUser(user.id)} /></td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div className="adm-avatar" style={{ width: 30, height: 30, background: AGRO_COLORS.sage }}>
                              {user.full_name?.charAt(0) || "U"}
                            </div>
                            <span className="cell-name">{user.full_name}</span>
                            {user.verified && <BadgeCheck size={14} color={AGRO_COLORS.primary} />}
                          </div>
                        </td>
                        <td className="cell-muted">{user.email || "ÔÇö"}</td>
                        <td style={{ fontFamily: "DM Mono, monospace", fontSize: 12 }}>{user.phone || "ÔÇö"}</td>
                        <td>
                          <span className="adm-badge badge-outline" style={{ textTransform: "capitalize" }}>
                            {user.user_type || "user"}
                          </span>
                        </td>
                        <td>
                          {user.verified
                            ? <span className="adm-status status-success"><BadgeCheck size={11} /> Verificado</span>
                            : <span className="adm-status status-neutral">N├úo verificado</span>
                          }
                        </td>
                        <td className="cell-muted">
                          {user.created_at ? new Date(user.created_at).toLocaleDateString("pt-BR") : "ÔÇö"}
                        </td>
                        <td>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="adm-btn-icon adm-btn"><MoreVertical size={13} /></button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" style={{ minWidth: 180 }}>
                              {user.verified ? (
                                <DropdownMenuItem onClick={() => toggleVerification(user.id, true)}>
                                  <ShieldX size={13} className="mr-2" /> Remover Verifica├º├úo
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => toggleVerification(user.id, false)}>
                                  <ShieldCheck size={13} className="mr-2" /> Verificar Utilizador
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => { setTargetUser(user.id); setNotifModalOpen(true); }}>
                                <Bell size={13} className="mr-2" /> Enviar Notifica├º├úo
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-600" onClick={() => handleDelete("users", user.id, setUsers)}>
                                <Trash2 size={13} className="mr-2" /> Excluir Utilizador
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ
            TRANSACTIONS
        ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ */}
        {activeTab === "transactions" && (
          <div className="adm-card">
            <div className="adm-card-header">
              <div className="adm-card-title">
                <div className="adm-title-icon"><DollarSign size={14} /></div>
                Transac├º├Áes
                <span style={{ fontSize: 12, fontWeight: 400, color: "#9b9285" }}>({transactions.length})</span>
              </div>
            </div>
            <div className="adm-card-body no-pad">
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Tipo</th>
                      <th>Valor</th>
                      <th>Status</th>
                      <th>Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map(t => (
                      <tr key={t.id}>
                        <td className="cell-mono">{t.id.substring(0, 12)}ÔÇª</td>
                        <td style={{ textTransform: "capitalize", fontSize: 13 }}>{t.type.replace(/_/g, " ")}</td>
                        <td style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{t.amount.toLocaleString("pt-AO")} Kz</td>
                        <td><StatusBadge status={t.status} /></td>
                        <td className="cell-muted">{new Date(t.created_at).toLocaleDateString("pt-BR")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ
            NOTIFICATIONS
        ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ */}
        {activeTab === "notifications" && (
          <div className="adm-card">
            <div className="adm-card-header">
              <div className="adm-card-title">
                <div className="adm-title-icon"><Bell size={14} /></div>
                Notifica├º├Áes
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="adm-filter-tabs">
                  {["all", "unread", "read"].map(s => (
                    <button
                      key={s}
                      className={`adm-filter-tab ${filterStatus === s ? "active" : ""}`}
                      onClick={() => setFilterStatus(s)}
                    >
                      {s === "all" ? "Todas" : s === "unread" ? "N├úo Lidas" : "Lidas"}
                    </button>
                  ))}
                </div>
                <button className="adm-btn adm-btn-primary" style={{ padding: "7px 14px", fontSize: 12 }} onClick={() => setNotifModalOpen(true)}>
                  <Send size={12} /> Enviar
                </button>
              </div>
            </div>
            <div className="adm-card-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {!filteredNotifs.length ? (
                <div className="adm-empty">
                  <div className="adm-empty-icon"><Bell size={22} color="#9b9285" /></div>
                  <div className="adm-empty-title">Sem notifica├º├Áes</div>
                </div>
              ) : filteredNotifs.map(n => (
                <div key={n.id} className={`adm-notif-item ${!n.read ? "unread" : ""}`} onClick={() => markRead(n.id)}>
                  {!n.read && <div className="adm-notif-dot" />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div className="adm-notif-title">{n.title}</div>
                      {!n.read && <span className="adm-badge badge-green" style={{ fontSize: 10 }}>Novo</span>}
                    </div>
                    <div className="adm-notif-msg">{n.message}</div>
                    <div className="adm-notif-time">{new Date(n.created_at).toLocaleString("pt-BR")}</div>
                  </div>
                  {n.read ? <CheckCircle size={16} color={AGRO_COLORS.primary} /> : <Clock size={16} color="#9b9285" />}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ
            FICHAS
        ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ */}
        {activeTab === "fichas" && (
          <div className="adm-card">
            <TableToolbar
              title="Fichas de Recebimento"
              count={filteredFichas.length}
              icon={<FileText size={14} />}
              search={searchTerm}
              setSearch={setSearchTerm}
            />
            <div className="adm-card-body no-pad">
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Produto</th>
                      <th>Neg├│cio</th>
                      <th>Qualidade</th>
                      <th>Telefone</th>
                      <th>Data</th>
                      <th>Ac├º├Áes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFichas.map(f => (
                      <tr key={f.id}>
                        <td className="cell-name">{f.nome_ficha}</td>
                        <td>{f.produto}</td>
                        <td>
                          <span className={`adm-badge ${f.tipo_negocio === "compra" ? "badge-green" : "badge-blue"}`} style={{ textTransform: "capitalize" }}>
                            {f.tipo_negocio}
                          </span>
                        </td>
                        <td className="cell-muted">{f.qualidade || "ÔÇö"}</td>
                        <td style={{ fontFamily: "DM Mono, monospace", fontSize: 12 }}>{f.telefone || "ÔÇö"}</td>
                        <td className="cell-muted">{new Date(f.created_at).toLocaleDateString("pt-BR")}</td>
                        <td>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button className="adm-btn-icon adm-btn" onClick={() => { setTargetUser(f.user_id); setNotifModalOpen(true); }}>
                              <Bell size={13} />
                            </button>
                            <button className="adm-btn-icon adm-btn danger" onClick={() => handleDelete("fichas_recebimento", f.id, setFichas)}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ
            SOURCING
        ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ */}
        {activeTab === "sourcing" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="adm-card">
              <div className="adm-card-header">
                <div className="adm-card-title">
                  <div className="adm-title-icon"><Globe size={14} /></div>
                  OrbisLink Sourcing ÔÇö Pedidos Especiais
                  <span style={{ fontSize: 12, fontWeight: 400, color: "#9b9285" }}>({sourcingRequests.length})</span>
                </div>
              </div>
              {!sourcingRequests.length ? (
                <div className="adm-card-body">
                  <div className="adm-empty">
                    <div className="adm-empty-icon"><Globe size={22} color="#9b9285" /></div>
                    <div className="adm-empty-title">Sem pedidos de sourcing</div>
                  </div>
                </div>
              ) : (
                <div className="adm-card-body no-pad">
                  <div className="adm-table-wrap">
                    <table className="adm-table">
                      <thead>
                        <tr>
                          <th>Cliente</th>
                          <th>Produto</th>
                          <th>Qtd (kg)</th>
                          <th>Entrega</th>
                          <th>Status</th>
                          <th>Data</th>
                          <th>Ac├º├Áes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sourcingRequests.map(req => {
                          const user = users.find(u => u.id === req.user_id);
                          return (
                            <tr key={req.id}>
                              <td className="cell-name">{user?.full_name || "ÔÇö"}</td>
                              <td>{req.product_name}</td>
                              <td>{req.quantity.toLocaleString()}</td>
                              <td className="cell-muted">{new Date(req.delivery_date).toLocaleDateString("pt-BR")}</td>
                              <td><StatusBadge status={req.status} /></td>
                              <td className="cell-muted">{new Date(req.created_at).toLocaleDateString("pt-BR")}</td>
                              <td>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button className="adm-btn-icon adm-btn"><MoreVertical size={13} /></button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" style={{ minWidth: 180 }}>
                                    <DropdownMenuItem onClick={() => updateSourcingStatus(req.id, "in_progress")}>
                                      <Clock size={13} className="mr-2" /> Em Progresso
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => updateSourcingStatus(req.id, "completed")}>
                                      <Check size={13} className="mr-2" /> Conclu├¡do
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => updateSourcingStatus(req.id, "cancelled")}>
                                      <X size={13} className="mr-2" /> Cancelado
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => {
                                      const n = prompt("Notas do Admin:", req.admin_notes || "");
                                      if (n !== null) updateSourcingStatus(req.id, req.status, n);
                                    }}>
                                      <MessageSquare size={13} className="mr-2" /> Adicionar Notas
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => { setTargetUser(req.user_id); setNotifModalOpen(true); }}>
                                      <Bell size={13} className="mr-2" /> Notificar Cliente
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {sourcingRequests.filter(r => r.description || r.admin_notes).length > 0 && (
              <div className="adm-card">
                <div className="adm-card-header">
                  <div className="adm-card-title">
                    <div className="adm-title-icon"><FileText size={14} /></div>
                    Detalhes e Notas
                  </div>
                </div>
                <div className="adm-card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {sourcingRequests.filter(r => r.description || r.admin_notes).map(req => {
                    const user = users.find(u => u.id === req.user_id);
                    return (
                      <div key={req.id} className="adm-detail-card">
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                          <div>
                            <span style={{ fontWeight: 600, fontSize: 14 }}>{req.product_name}</span>
                            <span className="cell-muted" style={{ marginLeft: 8 }}>ÔÇö {user?.full_name}</span>
                          </div>
                          <StatusBadge status={req.status} />
                        </div>
                        {req.description && (
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#9b9285", marginBottom: 4 }}>
                              Descri├º├úo do Cliente
                            </div>
                            <div style={{ fontSize: 13, color: "#2d2b27" }}>{req.description}</div>
                          </div>
                        )}
                        {req.admin_notes && (
                          <div className="adm-notes-block">
                            <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2, color: AGRO_COLORS.primary }}>
                              Nota do Admin
                            </div>
                            {req.admin_notes}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ
            MARKET
        ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ */}
        {activeTab === "market" && (() => {
          const grouped: Record<string, { prices: number[]; quantities: number[] }> = {};
          products.forEach(p => {
            if (!grouped[p.product_type]) grouped[p.product_type] = { prices: [], quantities: [] };
            grouped[p.product_type].prices.push(p.price);
            grouped[p.product_type].quantities.push(p.quantity);
          });
          const tableData = Object.entries(grouped).map(([name, d]) => ({
            name,
            count: d.prices.length,
            minPrice: Math.min(...d.prices),
            avgPrice: Math.round(d.prices.reduce((a, b) => a + b, 0) / d.prices.length),
            maxPrice: Math.max(...d.prices),
            totalVolume: d.quantities.reduce((a, b) => a + b, 0),
          })).sort((a, b) => b.count - a.count);

          const avgPriceChart = tableData.slice(0, 8).map(r => ({ name: r.name, value: r.avgPrice }));
          const volumeChart = tableData.slice(0, 8).map(r => ({ name: r.name, value: r.totalVolume }));
          const trendChart = (() => {
            const m: Record<string, number> = {};
            products.forEach(p => {
              const d = new Date(p.created_at).toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
              m[d] = (m[d] || 0) + 1;
            });
            return Object.entries(m).slice(-14).map(([date, count]) => ({ date, count }));
          })();

          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="adm-metrics-grid">
                <MetricCard title="Total Produtos" value={products.length} icon={<Package />} color="green" />
                <MetricCard title="Volume Total" value={products.reduce((a, p) => a + p.quantity, 0)} suffix="kg" icon={<Mountain />} color="amber" />
                <MetricCard title="Pre├ºo M├®dio" value={products.length ? Math.round(products.reduce((a, p) => a + p.price, 0) / products.length).toLocaleString() : 0} suffix="AOA" icon={<DollarSign />} color="orange" />
                <MetricCard title="Tipos de Produto" value={new Set(products.map(p => p.product_type)).size} icon={<Leaf />} color="blue" />
              </div>

              <div className="adm-charts-grid">
                <div className="adm-card">
                  <div className="adm-card-header">
                    <div className="adm-card-title"><div className="adm-title-icon"><DollarSign size={14} /></div>Pre├ºo M├®dio por Produto (AOA)</div>
                  </div>
                  <div className="adm-card-body">
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={avgPriceChart} barSize={16}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0ede6" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#9b9285" }} angle={-35} textAnchor="end" height={70} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "#9b9285" }} axisLine={false} tickLine={false} />
                        <Tooltip content={<AgroTooltip unit=" AOA" />} />
                        <Bar dataKey="value" fill={AGRO_COLORS.primary} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="adm-card">
                  <div className="adm-card-header">
                    <div className="adm-card-title"><div className="adm-title-icon"><TrendingUp size={14} /></div>Volume por Produto (kg)</div>
                  </div>
                  <div className="adm-card-body">
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={volumeChart} barSize={16}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0ede6" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#9b9285" }} angle={-35} textAnchor="end" height={70} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "#9b9285" }} axisLine={false} tickLine={false} />
                        <Tooltip content={<AgroTooltip unit=" kg" />} />
                        <Bar dataKey="value" fill={AGRO_COLORS.sky} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="adm-card">
                  <div className="adm-card-header">
                    <div className="adm-card-title"><div className="adm-title-icon"><Package size={14} /></div>Distribui├º├úo por Tipo</div>
                  </div>
                  <div className="adm-card-body">
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie data={chartProducts} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={40} paddingAngle={3}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          labelLine={{ stroke: "#d0cdc5", strokeWidth: 1 }}
                        >
                          {chartProducts.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="adm-card">
                  <div className="adm-card-header">
                    <div className="adm-card-title"><div className="adm-title-icon"><Activity size={14} /></div>Tend├¬ncia de Publica├º├Áes</div>
                  </div>
                  <div className="adm-card-body">
                    <ResponsiveContainer width="100%" height={260}>
                      <AreaChart data={trendChart}>
                        <defs>
                          <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={AGRO_COLORS.accent} stopOpacity={0.2} />
                            <stop offset="95%" stopColor={AGRO_COLORS.accent} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0ede6" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9b9285" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "#9b9285" }} axisLine={false} tickLine={false} />
                        <Tooltip content={<AgroTooltip />} />
                        <Area type="monotone" dataKey="count" stroke={AGRO_COLORS.accent} strokeWidth={2} fill="url(#trendGrad)" dot={{ fill: AGRO_COLORS.accent, r: 3, strokeWidth: 0 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Price Table */}
              <div className="adm-card">
                <div className="adm-card-header">
                  <div className="adm-card-title"><div className="adm-title-icon"><DollarSign size={14} /></div>Tabela de Pre├ºos do Mercado</div>
                </div>
                <div className="adm-card-body no-pad">
                  <div className="adm-table-wrap">
                    <table className="adm-table">
                      <thead>
                        <tr>
                          <th>Produto</th>
                          <th>Ofertas</th>
                          <th>M├¡n (AOA)</th>
                          <th>M├®dio (AOA)</th>
                          <th>M├íx (AOA)</th>
                          <th>Volume Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tableData.map(row => (
                          <tr key={row.name}>
                            <td className="cell-name">{row.name}</td>
                            <td>{row.count}</td>
                            <td style={{ color: AGRO_COLORS.primary, fontWeight: 600 }}>{row.minPrice.toLocaleString()}</td>
                            <td style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{row.avgPrice.toLocaleString()}</td>
                            <td style={{ color: AGRO_COLORS.harvest, fontWeight: 600 }}>{row.maxPrice.toLocaleString()}</td>
                            <td><span className="adm-badge badge-green">{row.totalVolume.toLocaleString()} kg</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* AI Analysis */}
              <div className="adm-card">
                <div className="adm-card-header">
                  <div className="adm-card-title"><div className="adm-title-icon"><Zap size={14} /></div>An├ílise de Mercado com IA ÔÇö Google Gemini</div>
                  <button
                    className={`adm-btn ${analyzingMarket ? "adm-btn-ghost" : "adm-btn-primary"}`}
                    onClick={generateAnalysis}
                    disabled={analyzingMarket}
                  >
                    {analyzingMarket ? <><RefreshCw size={13} className="animate-spin" /> A analisarÔÇª</> : <><Zap size={13} /> Gerar An├ílise</>}
                  </button>
                </div>
                <div className="adm-card-body">
                  {aiAnalysis ? (
                    <div className="adm-ai-block">{aiAnalysis}</div>
                  ) : (
                    <div className="adm-empty">
                      <div className="adm-empty-icon"><Zap size={22} color="#9b9285" /></div>
                      <div className="adm-empty-title">An├ílise de IA n├úo gerada</div>
                      <div className="adm-empty-sub">Clique em "Gerar An├ílise" para obter insights de mercado com intelig├¬ncia artificial</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ
            ADMINS
        ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ */}
        {activeTab === "admins" && currentUserId && (
          <AdminManagement
            currentUserId={currentUserId}
            isRootAdmin={isRootAdmin}
            isSuperRoot={isSuperRoot}
            hasManageAdminsPermission={hasPermission("manage_admins")}
            users={users}
            onRefresh={fetchAllData}
          />
        )}

        {/* ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ
            REFERRALS
        ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ */}
        {activeTab === "referrals" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="adm-metrics-grid">
              {[
                { label: "Total Indica├º├Áes", value: allReferrals.length, bg: "#1a6b3c", icon: <Users size={16} /> },
                { label: "Total Pontos", value: allReferrals.reduce((s, r) => s + r.points, 0), bg: "#e8a012", icon: <Star size={16} /> },
                { label: "Agentes Activos", value: new Set(allReferrals.map(r => r.agent_id)).size, bg: "#1e6b9e", icon: <BadgeCheck size={16} /> },
                { label: "M├®dia Pts/Indica├º├úo", value: allReferrals.length ? Math.round(allReferrals.reduce((s, r) => s + r.points, 0) / allReferrals.length) : 0, bg: "#7a5c3a", icon: <TrendingUp size={16} /> },
              ].map(c => (
                <div key={c.label} className="adm-stat-card" style={{ background: c.bg }}>
                  <div className="adm-stat-label">{c.label}</div>
                  <div className="adm-stat-value">{c.value.toLocaleString()}</div>
                </div>
              ))}
            </div>

            {/* Leaderboard */}
            <div className="adm-card">
              <div className="adm-card-header">
                <div className="adm-card-title"><div className="adm-title-icon"><Crown size={14} /></div>Ranking de Agentes ÔÇö Tempo Real</div>
              </div>
              <div className="adm-card-body">
                {!topAgents.length ? (
                  <div className="adm-empty">
                    <div className="adm-empty-icon"><Users size={22} color="#9b9285" /></div>
                    <div className="adm-empty-title">Nenhum agente com indica├º├Áes</div>
                  </div>
                ) : (
                  <div className="adm-leaderboard">
                    {topAgents.map((a, i) => (
                      <div key={a.agent_id} className={`adm-leader-card rank-${i + 1}`}>
                        <span className={`adm-rank-badge r${i + 1}`}>{i + 1}┬░</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
                          <div className="adm-avatar" style={{ width: 44, height: 44, fontSize: 16, background: CHART_COLORS[i] }}>
                            {a.agent_name?.charAt(0) || "A"}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14, color: "#1c1a16" }}>{a.agent_name}</div>
                            <div style={{ display: "flex", gap: 12, marginTop: 5 }}>
                              <span style={{ fontSize: 12, color: "#6b6458", display: "flex", alignItems: "center", gap: 4 }}>
                                <Users size={11} /> {a.total_referrals}
                              </span>
                              <span style={{ fontSize: 12, color: "#b37d0a", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                                <Star size={11} /> {a.total_points} pts
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Referrals Table */}
            <div className="adm-card">
              <div className="adm-card-header">
                <div className="adm-card-title">
                  <div className="adm-title-icon"><FileText size={14} /></div>
                  Hist├│rico Completo de Indica├º├Áes
                  <span style={{ fontSize: 12, fontWeight: 400, color: "#9b9285" }}>({allReferrals.length} registos)</span>
                </div>
              </div>
              {!allReferrals.length ? (
                <div className="adm-card-body">
                  <div className="adm-empty">
                    <div className="adm-empty-icon"><Star size={22} color="#9b9285" /></div>
                    <div className="adm-empty-title">Sem indica├º├Áes registadas</div>
                    <div className="adm-empty-sub">As indica├º├Áes aparecer├úo aqui quando os agentes indicarem novos utilizadores</div>
                  </div>
                </div>
              ) : (
                <div className="adm-card-body no-pad">
                  <div className="adm-table-wrap">
                    <table className="adm-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Agente</th>
                          <th>C├│digo</th>
                          <th>Utilizador Indicado</th>
                          <th>Pontos</th>
                          <th>Data</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allReferrals.map((r, idx) => (
                          <tr key={r.id}>
                            <td className="cell-mono">{idx + 1}</td>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div className="adm-avatar" style={{ width: 28, height: 28, background: AGRO_COLORS.sage }}>
                                  {r.agent_name?.charAt(0) || "A"}
                                </div>
                                <span style={{ fontWeight: 600, fontSize: 13 }}>{r.agent_name}</span>
                              </div>
                            </td>
                            <td>
                              <span className="adm-badge badge-outline" style={{ fontFamily: "DM Mono, monospace", fontSize: 11 }}>
                                {r.agent_code}
                              </span>
                            </td>
                            <td style={{ fontSize: 13 }}>{r.referred_user_name}</td>
                            <td>
                              <span className="adm-badge badge-amber" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                <Star size={10} /> {r.points}
                              </span>
                            </td>
                            <td className="cell-muted">
                              {new Date(r.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Per-agent Stats */}
            {allReferrals.length > 0 && (
              <div className="adm-card">
                <div className="adm-card-header">
                  <div className="adm-card-title"><div className="adm-title-icon"><BarChart3 size={14} /></div>Estat├¡sticas por Agente</div>
                </div>
                <div className="adm-card-body">
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
                    {Array.from(allReferrals.reduce((acc, r) => {
                      if (!acc.has(r.agent_id)) acc.set(r.agent_id, { ...r, total_referrals: 0, total_points: 0, names: [] as string[] });
                      const ag = acc.get(r.agent_id)!;
                      ag.total_referrals++; ag.total_points += r.points; ag.names.push(r.referred_user_name);
                      return acc;
                    }, new Map<string, any>()).values()).map(ag => (
                      <div key={ag.agent_id} style={{ padding: 14, border: "1px solid #e8e4da", borderRadius: 10, background: "#faf9f5" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                          <div className="adm-avatar" style={{ width: 40, height: 40, background: AGRO_COLORS.primary }}>
                            {ag.agent_name?.charAt(0) || "A"}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>{ag.agent_name}</div>
                            <span className="adm-badge badge-outline" style={{ fontFamily: "DM Mono, monospace", fontSize: 10 }}>{ag.agent_code}</span>
                          </div>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                          <div style={{ textAlign: "center", padding: "8px 0", background: "#fff", borderRadius: 8, border: "1px solid #e8e4da" }}>
                            <div style={{ fontSize: 20, fontWeight: 700, color: AGRO_COLORS.primary }}>{ag.total_referrals}</div>
                            <div style={{ fontSize: 11, color: "#9b9285" }}>Indica├º├Áes</div>
                          </div>
                          <div style={{ textAlign: "center", padding: "8px 0", background: "#fff", borderRadius: 8, border: "1px solid #e8e4da" }}>
                            <div style={{ fontSize: 20, fontWeight: 700, color: AGRO_COLORS.accent }}>{ag.total_points}</div>
                            <div style={{ fontSize: 11, color: "#9b9285" }}>Pontos</div>
                          </div>
                        </div>
                        <div style={{ fontSize: 11, color: "#9b9285", marginBottom: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          Utilizadores indicados
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {ag.names.slice(0, 3).map((n: string, i: number) => (
                            <span key={i} className="adm-badge badge-outline" style={{ fontSize: 10 }}>{n}</span>
                          ))}
                          {ag.names.length > 3 && (
                            <span className="adm-badge badge-outline" style={{ fontSize: 10 }}>+{ag.names.length - 3}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ
            DELIVERIES
        ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ */}
        {activeTab === "deliveries" && currentUserId && (
          <DeliveryTracking currentUserId={currentUserId} />
        )}
      </main>

      {/* ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ
          NOTIFICATION MODAL
      ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ */}
      <Dialog open={notifModalOpen} onOpenChange={setNotifModalOpen}>
        <DialogContent style={{ maxWidth: 460, padding: 0, overflow: "hidden", borderRadius: 16 }}>
          <div className="adm-modal-header">
            <div className="adm-modal-icon"><Send size={16} /></div>
            <div className="adm-modal-title">Enviar Notifica├º├úo</div>
          </div>
          <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="adm-form-group">
              <label className="adm-label">Destinat├írio</label>
              <select
                className="adm-select"
                value={targetUser || ""}
                onChange={e => setTargetUser(e.target.value)}
              >
                <option value="">Seleccionar utilizadorÔÇª</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.full_name}{u.email ? ` ÔÇö ${u.email}` : ""}</option>
                ))}
              </select>
            </div>
            <div className="adm-form-group">
              <label className="adm-label">Tipo</label>
              <select className="adm-select" value={notifType} onChange={e => setNotifType(e.target.value)}>
                <option value="info">Informa├º├úo</option>
                <option value="alert">Alerta</option>
                <option value="success">Sucesso</option>
              </select>
            </div>
            <div className="adm-form-group">
              <label className="adm-label">T├¡tulo</label>
              <input className="adm-input" placeholder="T├¡tulo da notifica├º├úo" value={notifTitle} onChange={e => setNotifTitle(e.target.value)} />
            </div>
            <div className="adm-form-group">
              <label className="adm-label">Mensagem</label>
              <textarea className="adm-textarea" placeholder="Corpo da mensagemÔÇª" value={notifMessage} onChange={e => setNotifMessage(e.target.value)} rows={3} style={{ resize: "vertical" }} />
            </div>
          </div>
          <div style={{ padding: "14px 24px 20px", display: "flex", justifyContent: "flex-end", gap: 8, borderTop: "1px solid #f0ede6" }}>
            <button className="adm-btn adm-btn-ghost" onClick={() => setNotifModalOpen(false)}>Cancelar</button>
            <button className="adm-btn adm-btn-primary" onClick={sendNotification}>
              <Send size={13} /> Enviar Notifica├º├úo
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;