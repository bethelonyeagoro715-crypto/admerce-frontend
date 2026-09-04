'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../../services/api';
import {
  MdArrowBack,
  MdCreditCard,
  MdAdd,
  MdDeleteOutline,
} from 'react-icons/md';

interface Card {
  id: number;
  last4: string;
  expiry_month: string;
  expiry_year: string;
  brand: string;
  cardholder_name?: string;
}

interface PaystackTransaction {
  reference: string;
}

interface PaystackPop {
  newTransaction: (options: {
    key: string;
    email: string;
    amount: number;
    metadata?: Record<string, unknown>;
    onSuccess: (transaction: PaystackTransaction) => void;
    onCancel: () => void;
  }) => void;
}

const BRAND_COLORS: Record<string, string> = {
  visa: '#1A1F71',
  mastercard: '#EB001B',
  verve: '#00425F',
  default: '#0504AA',
};

export default function CardsPage() {
  const router = useRouter();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadCards = async () => {
    try {
      const data = (await api.getWalletCards()) as Card[];
      setCards(data || []);
    } catch (error) {
      console.error('Failed to load cards:', error);
      setCards([]);
      alert('Failed to load cards. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = (await api.getWalletCards()) as Card[];
        if (!mounted) return;
        setCards(data || []);
      } catch (error) {
        console.error('Failed to load cards:', error);
        if (!mounted) return;
        setCards([]);
        alert('Failed to load cards. Please try again.');
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleAddCard = async () => {
    setAdding(true);
    try {
      const profile = (await api.getMyProfile()) as { email?: string };
      if (!profile?.email?.includes('@')) {
        alert('Please add an email to your profile first.');
        return;
      }

      const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
      if (!publicKey) {
        alert('Paystack key missing. Please contact support.');
        return;
      }

      const paystack = (window as unknown as { PaystackPop: PaystackPop }).PaystackPop;
      if (!paystack) {
        alert('Paystack script not loaded. Please refresh the page.');
        return;
      }

      paystack.newTransaction({
        key: publicKey,
        email: profile.email,
        amount: 50, // 50 kobo (₦0.50)
        metadata: { save_card: true },
        onSuccess: async (transaction) => {
          try {
            const savedCard = (await api.verifyAndSaveCard(transaction.reference)) as Card;
            setCards((prev) => [savedCard, ...prev]);
            setShowAddModal(false);
            alert('Card added successfully');
          } catch (error) {
            console.error('Failed to save card:', error);
            alert('Could not save card. Please try again.');
          }
        },
        onCancel: () => {
          setShowAddModal(false);
        },
      });
    } catch (error) {
      console.error('Failed to start card addition:', error);
      alert('Failed to start card addition. Please try again.');
    } finally {
      setAdding(false);
    }
  };

  const deleteCard = async (cardId: number) => {
    if (!window.confirm('Remove this card?')) return;
    setDeletingId(cardId);
    try {
      await api.deleteWalletCard(cardId);
      setCards((prev) => prev.filter((c) => c.id !== cardId));
      alert('Card removed');
    } catch (error) {
      console.error('Failed to remove card:', error);
      alert('Failed to remove card. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const brandColor = (brand: string) => BRAND_COLORS[brand] || BRAND_COLORS.default;

  if (loading) {
    return (
      <div style={css.loadScreen}>
        <div style={css.loadRing} />
      </div>
    );
  }

  return (
    <div style={css.root}>
      {/* Header */}
      <div style={css.header}>
        <button style={css.backBtn} onClick={() => router.back()}>
          <MdArrowBack size={22} color="#0F172A" />
        </button>
        <h1 style={css.headerTitle}>My Cards</h1>
        <div style={{ width: 22 }} />
      </div>

      {/* Card list */}
      {cards.length === 0 ? (
        <div style={css.emptyState}>
          <div style={css.cardIcon}>
            <MdCreditCard size={48} color="#0504AA" />
          </div>
          <h2 style={css.emptyTitle}>No Cards Yet</h2>
          <p style={css.emptySub}>Add a debit or credit card to fund your wallet instantly.</p>
        </div>
      ) : (
        <div style={css.cardList}>
          {cards.map((card) => (
            <div key={card.id} style={css.cardItem}>
              <div style={{ ...css.cardVisual, backgroundColor: brandColor(card.brand) }}>
                <span style={css.cardBrand}>{card.brand.toUpperCase()}</span>
                <span style={css.cardNumber}>•••• •••• •••• {card.last4}</span>
                <span style={css.cardExpiry}>
                  {card.expiry_month}/{card.expiry_year.slice(-2)}
                </span>
              </div>
              <button
                onClick={() => deleteCard(card.id)}
                style={css.deleteBtn}
                disabled={deletingId === card.id}
              >
                {deletingId === card.id ? (
                  <div className="animate-spin h-5 w-5 border-2 border-red-500 border-t-transparent rounded-full" />
                ) : (
                  <MdDeleteOutline size={20} color="#DC2626" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Card Button */}
      <div style={css.footer}>
        <button onClick={() => setShowAddModal(true)} style={css.addBtn}>
          <MdAdd size={20} color="#fff" />
          Add New Card
        </button>
      </div>

      {/* Add Card Modal */}
      {showAddModal && (
        <div style={css.overlay} onClick={() => setShowAddModal(false)}>
          <div style={css.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={css.modalTitle}>Add Card</h2>
            <p style={css.modalSub}>
              You will be redirected to Paystack to securely link your card.
            </p>
            <button onClick={handleAddCard} style={css.payBtn} disabled={adding}>
              {adding ? 'Processing…' : 'Proceed to Paystack'}
            </button>
            <button style={css.cancelBtn} onClick={() => setShowAddModal(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const css: Record<string, React.CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#F0F4FF' },
  loadScreen: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#F0F4FF' },
  loadRing: { width: 40, height: 40, border: '3px solid rgba(5,4,170,0.2)', borderTopColor: '#0504AA', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', backgroundColor: '#fff' },
  backBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 8, display: 'flex', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 700, color: '#0F172A', margin: 0 },
  emptyState: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 32px', textAlign: 'center' },
  cardIcon: { width: 96, height: 96, borderRadius: 24, backgroundColor: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0 },
  emptySub: { fontSize: 14, color: '#94A3B8', margin: '8px 0 24px', lineHeight: 1.5 },
  cardList: { flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 },
  cardItem: { display: 'flex', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' },
  cardVisual: { flex: 1, display: 'flex', flexDirection: 'column', gap: 12, borderRadius: 12, padding: 16, color: '#fff' },
  cardBrand: { fontSize: 12, fontWeight: 700, letterSpacing: 1 },
  cardNumber: { fontSize: 16, fontWeight: 600, letterSpacing: 1 },
  cardExpiry: { fontSize: 12, opacity: 0.8 },
  deleteBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 8 },
  footer: { padding: '16px', backgroundColor: '#fff', borderTop: '1px solid #F1F5F9' },
  addBtn: { display: 'flex', alignItems: 'center', gap: 8, width: '100%', justifyContent: 'center', padding: '14px', backgroundColor: '#0504AA', color: '#fff', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer' },
  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(3,3,90,0.5)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'flex-end' },
  modal: { width: '100%', backgroundColor: '#fff', borderRadius: '20px 20px 0 0', padding: '12px 24px 48px', animation: 'fadeUp 0.25s ease' },
  modalTitle: { fontSize: 22, fontWeight: 800, color: '#0F172A', margin: '0 0 4px' },
  modalSub: { fontSize: 13, color: '#94A3B8', margin: '0 0 20px' },
  payBtn: { width: '100%', padding: 16, backgroundColor: '#0504AA', color: '#fff', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 10 },
  cancelBtn: { width: '100%', padding: 14, backgroundColor: 'transparent', color: '#94A3B8', border: 'none', borderRadius: 14, fontSize: 14, fontWeight: 500, cursor: 'pointer' },
};