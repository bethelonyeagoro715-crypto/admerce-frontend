'use client';

import api from './api';

interface PaystackConfig {
  email: string;
  amount: number;
  reference?: string;
  metadata?: Record<string, unknown>;
  onSuccess?: (reference: string) => void;
  onClose?: () => void;
}

export async function initializePaystack(config: PaystackConfig) {
  const { default: PaystackPop } = await import('@paystack/inline-js');
  const paystack = new PaystackPop();

  const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
  console.log('Paystack key:', publicKey ? 'present' : 'MISSING');

  if (!publicKey) {
    alert('Paystack public key is missing. Check .env.local');
    return;
  }

  paystack.newTransaction({
    key: publicKey,
    email: config.email,
    amount: config.amount * 100,
    ref: config.reference || `admerce_${Date.now()}`,
    metadata: config.metadata || {},
    onSuccess: async (transaction: { reference: string }) => {
      console.log('Paystack success:', transaction);
      try {
        const res = await api.post('/payments/verify', { reference: transaction.reference });
        console.log('Verify response:', res);
        config.onSuccess?.(transaction.reference);
      } catch (err) {
        console.error('Verification failed:', err);
        alert('Payment was successful but verification failed. Please contact support.');
      }
    },
    onCancel: () => {
      console.log('Payment cancelled');
      config.onClose?.();
    },
    onError: (error: { reference: string}) => {
      console.error('Payment error:', error);
      config.onClose?.();
    },
  });
}