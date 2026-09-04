'use client';

import Image from 'next/image';
import { useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import api from '../services/api';
import { getToken, getActiveRole } from '../services/localStorage';

export default function WelcomePage() {
  const router = useRouter();
  const hasRun = useRef(false);

  const navigateAfterDelay = useCallback(async () => {
    if (hasRun.current) return;
    hasRun.current = true;

    await new Promise((resolve) => setTimeout(resolve, 5000));

    const token = getToken();
    if (token) {
      try {
        await api.getMyProfile();
        const role = getActiveRole();
        switch (role) {
          case 'storekeeper':
            router.replace('/storekeeper/home');
            break;
          case 'courier':
            router.replace('/courier/home');
            break;
          case 'flipper':
            router.replace('/flipper/home');
            break;
          case 'service_provider':
            router.replace('/service-provider/home');
            break;
          default:
            router.replace('/shopper/home');
        }
      } catch {
        router.replace('/login');
      }
    } else {
      router.replace('/permissions');
    }
  }, [router]);

  useEffect(() => {
    navigateAfterDelay();
  }, [navigateAfterDelay]);

  return (
    <main style={styles.container}>
      {/* Animated logo */}
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        <Image
          src="/admerce_symbol.png"
          alt="Admerce"
          width={200}
          height={200}
          style={styles.logo}
        />
      </motion.div>

      {/* App name (fade in after logo) */}
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        style={styles.appName}
      >
        Admerce
      </motion.h1>

      {/* Loading indicator – pulsing dots */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        style={styles.dotsContainer}
      >
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            animate={{ y: [0, -8, 0] }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: i * 0.15,
              ease: 'easeInOut',
            }}
            style={styles.dot}
          />
        ))}
      </motion.div>
    </main>
  );
}

const styles = {
  container: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    height: '100vh',
    backgroundColor: 'white',
  },
  logo: {
    height: 300,
    width: 800,
    objectFit: 'contain' as const,
  },
  appName: {
    marginTop: 16,
    fontSize: 28,
    fontWeight: 1000,
    color: '#0f06b1',
  },
  dotsContainer: {
    display: 'flex' as const,
    gap: 8,
    marginTop: 32,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    backgroundColor: '#0504AA',
  },
};