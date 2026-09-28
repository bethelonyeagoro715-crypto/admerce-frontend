'use client';

import { useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthGuard } from '../../../../hooks/useAuthGuard';
import { SettingsShell, SettingsSection } from '../../../../components/settings/SettingsUI';
import { alertDialog } from '../../../../components/ui/dialogs';
import {
  MdSearch,
  MdExpandMore,
  MdExpandLess,
  MdHelpOutline,
  MdShoppingBag,
  MdStorefront,
  MdLocalShipping,
  MdAccountBalanceWallet,
  MdPerson,
  MdSecurity,
  MdMailOutline,
  MdChatBubbleOutline,
  MdReportProblem,
  MdFeedback,
  MdOpenInNew,
} from 'react-icons/md';

interface Faq {
  q: string;
  a: string;
}

interface FaqCategory {
  id: string;
  label: string;
  icon: React.ReactNode;
  iconBg: string;
  items: Faq[];
}

const CATEGORIES: FaqCategory[] = [
  {
    id: 'buying',
    label: 'Buying',
    icon: <MdShoppingBag size={18} color="#0504AA" />,
    iconBg: '#EEF0FF',
    items: [
      {
        q: 'How do I reserve an item?',
        a: 'Open the listing, tap Reserve, and confirm the pickup window. Your funds move into escrow and are released to the seller when you confirm pickup.',
      },
      {
        q: 'What is escrow?',
        a: 'Escrow holds your payment safely until you confirm you received the item. If the pickup window expires without confirmation, the funds are automatically returned to you.',
      },
      {
        q: 'Can I cancel a reservation?',
        a: 'Yes, before the pickup window expires. Open the order in your wallet, tap Cancel, and choose a reason. Funds return to your wallet immediately.',
      },
      {
        q: 'How do I contact a seller?',
        a: 'Tap Message on the listing or store page. All chats stay in your Inbox.',
      },
    ],
  },
  {
    id: 'selling',
    label: 'Selling',
    icon: <MdStorefront size={18} color="#0891B2" />,
    iconBg: '#E0F2FE',
    items: [
      {
        q: 'How do I create my first listing?',
        a: 'Go to Storekeeper → Items → Add item. Add a title, price, photos, and stock. Our AI can auto-fill details from your photo.',
      },
      {
        q: 'When do I get paid?',
        a: 'Funds move from escrow to your wallet the moment the buyer confirms pickup, or when the pickup window expires and the system auto-releases.',
      },
      {
        q: 'How do I change my pickup window?',
        a: 'Settings → Preferences → Default pickup window. You can choose 1 to 24 hours.',
      },
      {
        q: 'How do I pause my store?',
        a: 'Settings → Preferences → Vacation mode. Listings are hidden and new orders are blocked until you turn it off.',
      },
    ],
  },
  {
    id: 'delivery',
    label: 'Delivery',
    icon: <MdLocalShipping size={18} color="#D97706" />,
    iconBg: '#FEF3C7',
    items: [
      {
        q: 'Who delivers my order?',
        a: 'Independent couriers on the Admerce network. Once a storekeeper dispatches, you can track the courier in the order view.',
      },
      {
        q: 'Can I pick up instead of delivery?',
        a: 'Yes. Choose Pickup instead of Delivery when reserving. You get the store address and pickup window.',
      },
    ],
  },
  {
    id: 'wallet',
    label: 'Wallet & payments',
    icon: <MdAccountBalanceWallet size={18} color="#16A34A" />,
    iconBg: '#DCFCE7',
    items: [
      {
        q: 'How do I top up my wallet?',
        a: 'Shopper → Wallet → Top up. Use a saved card or a new card via Paystack.',
      },
      {
        q: 'Why is a top-up showing as a debit?',
        a: 'That is a display issue being fixed. All top-ups credit your wallet. If the balance is wrong, contact support.',
      },
      {
        q: 'Are withdrawals real?',
        a: 'Wallet withdrawals are currently ledger-only and do not move real money to your bank yet. Paystack Transfers integration is coming soon.',
      },
    ],
  },
  {
    id: 'account',
    label: 'Account',
    icon: <MdPerson size={18} color="#7E22CE" />,
    iconBg: '#F3E8FF',
    items: [
      {
        q: 'How do I change my phone number?',
        a: 'Settings → Account → Phone & email. A 6-digit code verifies the new number.',
      },
      {
        q: 'How do I switch roles?',
        a: 'Settings → Roles → Switch role. Onboarding screens appear if you have not used that role yet.',
      },
      {
        q: 'How do I delete my account?',
        a: 'Settings → Danger zone → Delete account. This is permanent and cannot be undone.',
      },
    ],
  },
  {
    id: 'safety',
    label: 'Safety & security',
    icon: <MdSecurity size={18} color="#DC2626" />,
    iconBg: '#FEE2E2',
    items: [
      {
        q: 'How do I keep my account secure?',
        a: 'Enable two-factor authentication in Settings → Account, use a strong password, and never share OTP codes.',
      },
      {
        q: 'Someone is harassing me. What do I do?',
        a: 'Open the chat, tap the menu, and choose Block. You can also report the user from Settings → Report a problem.',
      },
      {
        q: 'How do I report a fake listing?',
        a: 'Open the listing, tap the menu, and choose Report. Include a photo if you can.',
      },
    ],
  },
];

export default function HelpCenterPage() {
  useAuthGuard();
  const router = useRouter();
  const params = useParams<{ role: string }>();
  const raw = (params?.role || 'shopper').toLowerCase();
  const role = raw === 'service-provider' ? 'service_provider' : raw;
  const roleSlug = role === 'service_provider' ? 'service-provider' : role;

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(`/settings/${roleSlug}`);
    }
  };

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    return CATEGORIES.map((c) => {
      if (activeCategory !== 'all' && activeCategory !== c.id) {
        return { ...c, items: [] };
      }
      if (!q) return c;
      return {
        ...c,
        items: c.items.filter(
          (f) =>
            f.q.toLowerCase().includes(q) ||
            f.a.toLowerCase().includes(q),
        ),
      };
    }).filter((c) => c.items.length > 0);
  }, [search, activeCategory]);

  const toggleItem = (key: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const openUrl = (url: string) => {
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const totalResults = filteredCategories.reduce(
    (n, c) => n + c.items.length,
    0,
  );

  return (
    <SettingsShell title="Help center" onBack={goBack}>
      <style>{`
        .hp-row:active { background-color: #F8FAFF; }
        .hp-chip:active { transform: scale(0.96); }
      `}</style>

      {/* Hero */}
      <div style={css.hero}>
        <div style={css.heroIcon}>
          <MdHelpOutline size={30} color="#0504AA" />
        </div>
        <div style={css.heroTitle}>How can we help?</div>
        <div style={css.heroSub}>
          Browse answers, or contact support below.
        </div>
      </div>

      {/* Search */}
      <div style={css.searchWrap}>
        <MdSearch size={18} color="#94A3B8" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search help topics"
          style={css.searchInput}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            style={css.clearBtn}
            aria-label="Clear"
          >
            ×
          </button>
        )}
      </div>

      {/* Category chips */}
      <div style={css.chips}>
        <button
          onClick={() => setActiveCategory('all')}
          className="hp-chip"
          style={{
            ...css.chip,
            borderColor: activeCategory === 'all' ? '#0504AA' : '#E6E8F0',
            backgroundColor: activeCategory === 'all' ? '#EEF0FF' : '#FFFFFF',
          }}
        >
          <span
            style={{
              color: activeCategory === 'all' ? '#0504AA' : '#475569',
              fontWeight: activeCategory === 'all' ? 700 : 600,
            }}
          >
            All
          </span>
        </button>
        {CATEGORIES.map((c) => {
          const active = activeCategory === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              className="hp-chip"
              style={{
                ...css.chip,
                borderColor: active ? '#0504AA' : '#E6E8F0',
                backgroundColor: active ? '#EEF0FF' : '#FFFFFF',
              }}
            >
              <span style={{ fontSize: 14 }}>{c.icon}</span>
              <span
                style={{
                  color: active ? '#0504AA' : '#475569',
                  fontWeight: active ? 700 : 600,
                }}
              >
                {c.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Results */}
      {filteredCategories.length === 0 ? (
        <div style={css.empty}>
          <p style={css.emptyTitle}>No results found</p>
          <p style={css.emptyBody}>
            Try a different word, or contact support below.
          </p>
        </div>
      ) : (
        <>
          {search && (
            <p style={css.resultCount}>
              {totalResults} {totalResults === 1 ? 'result' : 'results'} for
              &ldquo;{search}&rdquo;
            </p>
          )}
          {filteredCategories.map((cat) => (
            <SettingsSection key={cat.id} label={cat.label}>
              {cat.items.map((item, i) => {
                const key = `${cat.id}-${i}`;
                const open = openItems.has(key);
                return (
                  <div key={key} style={css.faqItem}>
                    <button
                      onClick={() => toggleItem(key)}
                      className="hp-row"
                      style={css.faqQuestion}
                    >
                      <span style={css.faqQText}>{item.q}</span>
                      {open ? (
                        <MdExpandLess size={20} color="#64748B" />
                      ) : (
                        <MdExpandMore size={20} color="#64748B" />
                      )}
                    </button>
                    {open && <div style={css.faqAnswer}>{item.a}</div>}
                  </div>
                );
              })}
            </SettingsSection>
          ))}
        </>
      )}

      {/* Contact support */}
      <SettingsSection label="Still need help?">
        <ContactRow
          icon={<MdMailOutline size={18} color="#0504AA" />}
          iconBg="#EEF0FF"
          label="Email support"
          subtitle="support@admerce.ng"
          onClick={() => openUrl('mailto:support@admerce.ng')}
        />
        <ContactRow
          icon={<MdChatBubbleOutline size={18} color="#16A34A" />}
          iconBg="#DCFCE7"
          label="Chat with us"
          subtitle="Reply within a few hours"
          onClick={() => openUrl('https://wa.me/2348000000000')}
        />
        <ContactRow
          icon={<MdReportProblem size={18} color="#DC2626" />}
          iconBg="#FEE2E2"
          label="Report a problem"
          subtitle="Something is broken"
          onClick={() => router.push(`/settings/${roleSlug}/report`)}
        />
        <ContactRow
          icon={<MdFeedback size={18} color="#D97706" />}
          iconBg="#FEF3C7"
          label="Send feedback"
          subtitle="Tell us what you think"
          onClick={() => router.push(`/settings/${roleSlug}/feedback`)}
        />
      </SettingsSection>

      <p style={css.footnote}>
        Support hours: Monday–Saturday, 8am–8pm WAT.
      </p>
    </SettingsShell>
  );
}

function ContactRow({
  icon,
  iconBg,
  label,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="hp-row" style={css.contactRow}>
      <span style={{ ...css.contactIcon, backgroundColor: iconBg }}>
        {icon}
      </span>
      <span style={css.contactBody}>
        <span style={css.contactLabel}>{label}</span>
        <span style={css.contactSub}>{subtitle}</span>
      </span>
      <MdOpenInNew size={16} color="#CBD5E1" />
    </button>
  );
}

const css: Record<string, React.CSSProperties> = {
  hero: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    padding: '20px 20px 12px',
  },
  heroIcon: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: '#EEF0FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: '#0B0B1A',
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  heroSub: {
    fontSize: 13.5,
    color: '#64748B',
    lineHeight: 1.5,
    maxWidth: 300,
  },
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 16px',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    border: '1px solid #EAECF3',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: 14.5,
    fontFamily: 'inherit',
    color: '#0B0B1A',
    backgroundColor: 'transparent',
    fontWeight: 500,
  },
  clearBtn: {
    background: 'none',
    border: 'none',
    fontSize: 22,
    color: '#94A3B8',
    cursor: 'pointer',
    padding: '0 6px',
    lineHeight: 1,
  },
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 12px',
    borderRadius: 999,
    border: '1.5px solid #E6E8F0',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 12.5,
    transition: 'border-color 0.15s, background-color 0.15s, transform 0.12s',
  },
  resultCount: {
    fontSize: 12.5,
    color: '#64748B',
    margin: '4px 4px -4px',
    fontWeight: 600,
  },
  empty: {
    padding: '40px 20px',
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: '#0B0B1A',
    margin: 0,
  },
  emptyBody: {
    fontSize: 13,
    color: '#64748B',
    margin: '6px 0 0',
    lineHeight: 1.5,
  },
  faqItem: { borderBottom: '1px solid #F1F5F9' },
  faqQuestion: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    padding: '14px 16px',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
    transition: 'background-color 0.15s',
  },
  faqQText: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: 600,
    color: '#0B0B1A',
    letterSpacing: -0.1,
    lineHeight: 1.4,
  },
  faqAnswer: {
    padding: '0 16px 16px',
    fontSize: 13.5,
    color: '#475569',
    lineHeight: 1.65,
  },
  contactRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    padding: '13px 16px',
    border: 'none',
    borderBottom: '1px solid #F1F5F9',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
    transition: 'background-color 0.15s',
  },
  contactIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  contactBody: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2 },
  contactLabel: {
    fontSize: 14.5,
    fontWeight: 600,
    color: '#0B0B1A',
    letterSpacing: -0.1,
  },
  contactSub: { fontSize: 12, color: '#94A3B8' },
  footnote: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    margin: '4px 4px 0',
  },
};