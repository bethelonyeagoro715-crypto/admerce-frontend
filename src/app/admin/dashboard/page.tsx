'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../services/api';
import {
  MdDashboard,
  MdPeople,
  MdStore,
  MdShoppingBag,
  MdAttachMoney,
  MdRefresh,
  MdDownload,
  MdAdminPanelSettings,
  MdInventory,
  MdDeliveryDining,
  MdSwapHoriz,
  MdBuild,
  MdSettings,
  MdLogout,
  MdInfoOutline,
  MdTrendingUp,
  MdPersonAdd,
  MdWifiOff,
} from 'react-icons/md';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// ─── Types ──────────────────────────────────────────────────────────
interface AdminStats {
  total_users?: number;
  total_stores?: number;
  total_orders?: number;
  total_revenue?: number;
  growth?: number;
  user_growth?: number[];
  monthly_revenue?: number[];
  category_sales?: Record<string, number>;
  orders_trend?: number[];
  recent_activity?: Activity[];
  top_stores?: TopStore[];
  [key: string]: unknown;
}

interface Activity {
  type?: 'user' | 'store' | 'order';
  name?: string;
  action?: string;
  time?: string;
}

interface TopStore {
  name?: string;
  items?: number;
  revenue?: number;
  rating?: number;
}

const EMPTY_STATS: AdminStats = {
  total_users: 0,
  total_stores: 0,
  total_orders: 0,
  total_revenue: 0,
  growth: 0,
  user_growth: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  monthly_revenue: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  category_sales: { 'No Data': 100 },
  orders_trend: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  recent_activity: [],
  top_stores: [],
};

const COLORS = ['#0504AA', '#7B61FF', '#00C48C', '#FF6B6B', '#FFB800', '#A0A0A0'];

export default function AdminDashboardPage() {
  const router = useRouter();

  const [stats, setStats] = useState<AdminStats>(EMPTY_STATS);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [enableDelivery, setEnableDelivery] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = (await api.adminGetStats()) as AdminStats;
      setStats(data);
    } catch {
      setStats(EMPTY_STATS);
      setErrorMessage('Failed to load dashboard data.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadFeatureFlags = async () => {
    try {
      const flags = await api.getFeatureFlags();
      setEnableDelivery((flags.enable_delivery as boolean) ?? true);
    } catch {
      setEnableDelivery(true);
    }
  };

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
      loadFeatureFlags();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const logout = () => {
    api.clearToken();
    router.replace('/admin');
  };

  const goTo = (path: string) => {
    setDrawerOpen(false);
    router.push(path);
  };

  if (isLoading) {
    return (
      <main style={styles.center}>
        <div style={styles.spinner} />
      </main>
    );
  }

  // Prepare chart data
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const userGrowthData = (stats.user_growth || []).map((value, i) => ({ month: months[i], value }));
  const revenueData = (stats.monthly_revenue || []).map((value, i) => ({ month: months[i], value }));
  const ordersData = (stats.orders_trend || []).map((value, i) => ({ month: months[i], value }));
  const categoryData = Object.entries(stats.category_sales || {}).map(([name, value]) => ({ name, value }));

  return (
    <main style={styles.container}>
      {/* Sidebar overlay (mobile only) */}
      {drawerOpen && isMobile && <div style={styles.overlay} onClick={() => setDrawerOpen(false)} />}

      {/* Sidebar */}
      <aside
        style={{
          ...styles.sidebar,
          transform: !isMobile || drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
        }}
      >
        <div style={styles.sidebarHeader}>
          <MdAdminPanelSettings size={32} color="#fff" />
          <div>
            <div style={styles.sidebarBrand}>Admerce</div>
            <div style={styles.sidebarSub}>Admin Panel</div>
          </div>
        </div>
        <nav style={styles.nav}>
          <NavItem icon={<MdDashboard />} label="Dashboard" active onClick={() => goTo('/admin/dashboard')} />
          <NavItem icon={<MdPeople />} label="Users" onClick={() => goTo('/admin/users')} />
          <NavItem icon={<MdStore />} label="Stores" onClick={() => goTo('/admin/stores')} />
          <NavItem icon={<MdShoppingBag />} label="Orders" onClick={() => goTo('/admin/orders')} />
          <NavItem icon={<MdInventory />} label="Listings" onClick={() => goTo('/admin/listings')} />
          <NavItem icon={<MdDeliveryDining />} label="Couriers" onClick={() => goTo('/admin/couriers')} />
          <NavItem icon={<MdSwapHoriz />} label="Flippers" onClick={() => goTo('/admin/flippers')} />
          <NavItem icon={<MdBuild />} label="Services" onClick={() => goTo('/admin/services')} />
          <NavItem icon={<MdPeople />} label="Service Providers" onClick={() => goTo('/admin/service-providers')} />
          <NavItem icon={<MdSettings />} label="Settings" onClick={() => goTo('/admin/settings')} />
          <div style={{ flex: 1 }} />
          <NavItem icon={<MdLogout />} label="Logout" onClick={logout} />
        </nav>
      </aside>

      {/* Main content */}
      <div style={{
        ...styles.main,
        marginLeft: isMobile ? 0 : 240,
        width: isMobile ? '100%' : 'calc(100% - 240px)',
      }}>
        {/* Top bar */}
        <header style={styles.topBar}>
          {/* Hamburger only on mobile */}
          <button
            style={{ ...styles.menuBtn, display: isMobile ? 'flex' : 'none' }}
            onClick={() => setDrawerOpen(true)}
          >
            <MdDashboard size={24} color="#1A1A1A" />
          </button>
          <h1 style={styles.pageTitle}>Dashboard</h1>
          <div style={{ flex: 1 }} />
          <button style={styles.iconBtn} onClick={loadData} title="Refresh">
            <MdRefresh size={24} color="#0504AA" />
          </button>
          <button style={styles.iconBtn} title="Export">
            <MdDownload size={24} color="#0504AA" />
          </button>
        </header>

        {/* Content */}
        <div style={styles.content}>
          {errorMessage ? (
            <div style={styles.errorState}>
              <MdWifiOff size={48} color="#ccc" />
              <p>{errorMessage}</p>
              <button onClick={loadData} style={styles.retryBtn}>Retry</button>
            </div>
          ) : (
            <>
              {!enableDelivery && (
                <div style={styles.banner}>
                  <MdInfoOutline size={20} color="#FF9800" />
                  <span>Delivery is currently disabled. Enable it in Settings → Feature Flags.</span>
                  <button onClick={() => goTo('/admin/settings')} style={styles.bannerBtn}>
                    Go to Settings
                  </button>
                </div>
              )}

              <div style={styles.headerRow}>
                <h2 style={styles.sectionTitle}>Analytics Overview</h2>
                <span style={styles.growthBadge}>
                  <MdTrendingUp size={14} color="#4CAF50" />
                  +{stats.growth ?? 0}%
                </span>
              </div>

              {/* KPI Cards */}
              <div style={styles.kpiGrid}>
                <KpiCard
                  title="Total Users"
                  value={String(stats.total_users ?? 0)}
                  change="+12%"
                  icon={<MdPeople size={20} color="#0504AA" />}
                  color="#0504AA"
                />
                <KpiCard
                  title="Total Stores"
                  value={String(stats.total_stores ?? 0)}
                  change="+8%"
                  icon={<MdStore size={20} color="#7B61FF" />}
                  color="#7B61FF"
                />
                <KpiCard
                  title="Total Orders"
                  value={String(stats.total_orders ?? 0)}
                  change="+15%"
                  icon={<MdShoppingBag size={20} color="#00C48C" />}
                  color="#00C48C"
                />
                <KpiCard
                  title="Total Revenue"
                  value={`₦${Number(stats.total_revenue ?? 0).toLocaleString()}`}
                  change="+22%"
                  icon={<MdAttachMoney size={20} color="#FF6B6B" />}
                  color="#FF6B6B"
                />
              </div>

              {/* Charts Row 1 */}
              <div style={styles.chartsRow}>
                <ChartCard title="User Growth" subtitle="Daily signups over 12 months">
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={userGrowthData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="value" stroke="#0504AA" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Revenue Trend" subtitle="Monthly revenue over the last year">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={revenueData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#0504AA" opacity={0.75} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              {/* Charts Row 2 */}
              <div style={styles.chartsRow}>
                <ChartCard title="Sales by Category" subtitle="Distribution of orders">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} fill="#8884d8">
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Order Volume" subtitle="Monthly orders over the last year">
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={ordersData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Area type="monotone" dataKey="value" stroke="#7B61FF" fill="#7B61FF" fillOpacity={0.12} />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              {/* Bottom Row */}
              <div style={styles.bottomRow}>
                <ChartCard title="Recent Activity">
                  {(stats.recent_activity || []).length === 0 ? (
                    <p style={{ color: '#888', textAlign: 'center', padding: '16px 0' }}>
                      No recent activity yet.
                    </p>
                  ) : (
                    (stats.recent_activity || []).slice(0, 5).map((activity, i) => (
                      <div key={i} style={styles.activityItem}>
                        <div style={styles.activityIcon}>
                          <MdPersonAdd size={14} color="#0504AA" />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={styles.activityText}>
                            {activity.name} {activity.action}
                          </div>
                          <div style={styles.activityTime}>{activity.time || 'Just now'}</div>
                        </div>
                      </div>
                    ))
                  )}
                </ChartCard>

                <ChartCard title="Top Stores">
                  {(stats.top_stores || []).length === 0 ? (
                    <p style={{ color: '#888', textAlign: 'center', padding: '16px 0' }}>
                      No stores yet.
                    </p>
                  ) : (
                    (stats.top_stores || []).map((store, i) => (
                      <div key={i} style={styles.storeRow}>
                        <span style={styles.storeName}>{store.name || 'Unknown'}</span>
                        <span style={styles.storeItems}>{store.items ?? 0} items</span>
                        <span style={styles.storeRevenue}>
                          ₦{Number(store.revenue ?? 0).toLocaleString()}
                        </span>
                        <span style={styles.storeRating}>★ {(store.rating ?? 0).toFixed(1)}</span>
                      </div>
                    ))
                  )}
                </ChartCard>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}

// ─── Sub Components ───────────────────────────────────────────
function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        margin: '2px 0',
        borderRadius: 8,
        background: active ? 'rgba(255,255,255,0.15)' : 'transparent',
        color: '#fff',
        border: 'none',
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: active ? 600 : 400,
        width: '100%',
        textAlign: 'left',
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function KpiCard({ title, value, change, icon, color }: { title: string; value: string; change: string; icon: React.ReactNode; color: string }) {
  return (
    <div style={styles.kpiCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ ...styles.kpiIcon, backgroundColor: `${color}20` }}>{icon}</div>
        <span style={styles.kpiChange}>{change}</span>
      </div>
      <div style={styles.kpiValue}>{value}</div>
      <div style={styles.kpiTitle}>{title}</div>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={styles.chartCard}>
      <div style={styles.chartHeader}>
        <div>
          <h3 style={styles.chartTitle}>{title}</h3>
          {subtitle && <p style={styles.chartSubtitle}>{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    height: '100vh',
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
  },
  center: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: '#F8FAFC',
  },
  spinner: {
    width: 36,
    height: 36,
    border: '4px solid #eee',
    borderTopColor: '#0504AA',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  sidebar: {
    width: 240,
    backgroundColor: '#0504AA',
    display: 'flex',
    flexDirection: 'column',
    padding: '16px',
    transition: 'transform 0.3s ease',
    position: 'fixed',
    top: 0,
    bottom: 0,
    left: 0,
    zIndex: 30,
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 20,
  },
  sidebarHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '16px 0',
    borderBottom: '1px solid rgba(255,255,255,0.2)',
    marginBottom: 16,
  },
  sidebarBrand: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 800,
  },
  sidebarSub: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    transition: 'margin-left 0.3s ease, width 0.3s ease',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 16px',
    backgroundColor: '#fff',
    borderBottom: '1px solid #eee',
  },
  menuBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: '#1A1A1A',
    margin: 0,
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    display: 'flex',
    alignItems: 'center',
    marginLeft: 8,
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '24px',
  },
  errorState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#888',
  },
  retryBtn: {
    marginTop: 16,
    padding: '8px 20px',
    backgroundColor: '#0504AA',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
  },
  banner: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 16px',
    backgroundColor: '#FFF3E0',
    border: '1px solid #FFE0B2',
    borderRadius: 12,
    marginBottom: 16,
    fontSize: 13,
    color: '#E65100',
  },
  bannerBtn: {
    marginLeft: 'auto',
    background: 'none',
    border: 'none',
    color: '#0504AA',
    fontWeight: 600,
    cursor: 'pointer',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 700,
    color: '#1A1A1A',
    margin: 0,
  },
  growthBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 10px',
    backgroundColor: '#E8F5E9',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
    color: '#4CAF50',
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 12,
    marginBottom: 24,
  },
  kpiCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
  },
  kpiIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiChange: {
    fontSize: 12,
    fontWeight: 600,
    color: '#4CAF50',
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: 800,
    color: '#1A1A1A',
    marginTop: 12,
  },
  kpiTitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  chartsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 16,
    marginBottom: 24,
  },
  chartCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
  },
  chartHeader: {
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: '#1A1A1A',
    margin: 0,
  },
  chartSubtitle: {
    fontSize: 12,
    color: '#888',
    margin: '2px 0 0',
  },
  bottomRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 16,
  },
  activityItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 0',
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#0504AA10',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityText: {
    fontSize: 13,
    fontWeight: 500,
    color: '#1A1A1A',
  },
  activityTime: {
    fontSize: 11,
    color: '#888',
  },
  storeRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: '1px solid #f5f5f5',
  },
  storeName: {
    flex: 2,
    fontSize: 13,
    fontWeight: 500,
    color: '#1A1A1A',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  storeItems: {
    flex: 1,
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
  },
  storeRevenue: {
    flex: 1,
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
  },
  storeRating: {
    flex: 1,
    fontSize: 12,
    color: '#FFA000',
    textAlign: 'right',
  },
};