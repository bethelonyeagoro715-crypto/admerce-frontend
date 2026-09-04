'use client';

import { getToken, onMessage, type Messaging, type MessagePayload } from 'firebase/messaging';
import api from './api';
import { getMessagingInstance } from '../firebase';

type Router = {
  push: (url: string) => void;
};

class NotificationService {
  private static instance: NotificationService;
  private router: Router | null = null;

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async init(router: Router): Promise<void> {
    this.router = router;

    // Request permission
    await this.requestPermission();

    // Get messaging instance
    const messaging = await getMessagingInstance();
    if (!messaging) return;

    // Get token and save to backend
    await this.getAndSaveToken(messaging);

    // Listen for foreground messages
    onMessage(messaging, (payload) => {
      console.log('Foreground message:', payload);
      this.showLocalNotification(payload);
    });
  }

  private async requestPermission(): Promise<NotificationPermission | null> {
    if (typeof window === 'undefined' || !('Notification' in window)) return null;

    try {
      const permission = await Notification.requestPermission();
      console.log('Notification permission:', permission);
      return permission;
    } catch (error) {
      console.error('Permission request failed:', error);
      return null;
    }
  }

  private async getAndSaveToken(messaging: Messaging): Promise<void> {
    try {
      const token = await getToken(messaging, {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      });
      if (token) {
        console.log('FCM Token:', token);
        await api.saveFcmToken(token);
      } else {
        console.warn('No registration token available.');
      }
    } catch (error) {
      console.error('Failed to get FCM token:', error);
    }
  }

  private showLocalNotification(payload: MessagePayload): void {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    const title = payload.notification?.title || 'Admerce';
    const body = payload.notification?.body || '';
    const data = payload.data || {};

    if (Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body,
        data,
        icon: '/admerce_symbol.png',
      });

      notification.onclick = () => {
        this.navigateFromPayload(data);
      };
    }
  }

  private navigateFromPayload(data: Record<string, string>): void {
    if (!this.router) return;

    const type = data.type;
    switch (type) {
      case 'order':
        this.router.push('/order-history');
        break;
      case 'message':
        this.router.push('/inbox');
        break;
      case 'promotion':
        this.router.push('/notifications');
        break;
      default:
        this.router.push('/notifications');
    }
  }
}

export default NotificationService.getInstance();