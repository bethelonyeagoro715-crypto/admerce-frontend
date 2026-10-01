'use client';

import api from './api';

interface PaystackConfig {
  email: string;
  amount: number;
  metadata?: Record<string, unknown>;
  onSuccess?: (reference: string) => void;
  onClose?: () => void;
  onError?: (message: string) => void;
}

interface InitiateResponse {
  reference: string;
  authorization_url: string;
  amount: number;
}

function notify(config: PaystackConfig, message: string) {
  if (config.onError) {
    config.onError(message);
  } else {
    // Fallback so we never fail silently. Callers should prefer onError.
    alert(message);
  }
}

export async function initializePaystack(config: PaystackConfig) {
  // ── 1. Server mints the reference and records the intent.
  // The reference MUST come from the server: /verify and the webhook
  // both key off payment_intents, so a client-generated reference
  // would never match and the payment would strand.
  let initiate: InitiateResponse;
  try {
    initiate = (await api.post('/payments/initiate', {
      amount: config.amount,
    })) as unknown as InitiateResponse;
  } catch (err) {
    console.error('Initiate failed:', err);
    notify(config, 'Could not start payment. Please try again.');
    config.onClose?.();
    return;
  }

  if (!initiate || !initiate.reference) {
    console.error('Initiate returned no reference:', initiate);
    notify(config, 'Could not start payment. Please try again.');
    config.onClose?.();
    return;
  }

  // ── 2. Open Paystack Inline with the SERVER reference.
  const { default: PaystackPop } = await import('@paystack/inline-js');
  const paystack = new PaystackPop();

  const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
  if (!publicKey) {
    console.error('NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY is missing');
    notify(config, 'Payments are unavailable. Please contact support.');
    config.onClose?.();
    return;
  }

  paystack.newTransaction({
    key: publicKey,
    email: config.email,
    amount: config.amount * 100, // kobo
    ref: initiate.reference,
    metadata: config.metadata || {},
    onSuccess: async () => {
      // Verify is the happy-path check. The webhook is the safety net.
      // If verify fails transiently, the wallet will still be credited
      // by the webhook within ~30s — so we deliberately do NOT show
      // "verification failed" to the user.
      try {
        await api.post('/payments/verify', {
          reference: initiate.reference,
        });
      } catch (err) {
        console.warn('Verify failed (webhook will credit anyway):', err);
      }
      config.onSuccess?.(initiate.reference);
    },
    onCancel: () => {
      config.onClose?.();
    },
    onError: (error: { reference?: string }) => {
      console.error('Paystack error:', error);
      notify(config, 'Payment failed. Please try again.');
      config.onClose?.();
    },
  });
}