// src/services/api.ts
import axios, { AxiosInstance } from 'axios';
import { getToken, setToken, clearToken, getUserRole, setUserRole } from './localStorage';

// ─── Common response types ──────────────────────────────────────────
type JsonObject = Record<string, unknown>;
type JsonArray = unknown[];

// ─── Card interface ─────────────────────────────────────────────────
interface Card {
  id: number;
  last4: string;
  expiry_month: string;
  expiry_year: string;
  brand: string;
  cardholder_name?: string;
}

// ─── ApiService ──────────────────────────────────────────────────────
class ApiService {
  private static instance: ApiService;
  private axios: AxiosInstance;
  private _token: string | null = null;
  static userRole: string | null = null;

  // 🔧 Now reads from environment variable – avoids frontend/backend URL conflict
  static readonly baseUrl = process.env.NEXT_PUBLIC_API_URL ?? '';

  private constructor() {
    this.axios = axios.create({
      baseURL: ApiService.baseUrl,
      timeout: 30_000,
    });
    this.loadTokenFromStorage();
  }

  public static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  // ---------- Token & Role Management ----------
  private async loadTokenFromStorage(): Promise<void> {
    const token = getToken();
    if (token) {
      this._token = token;
      this.axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    ApiService.userRole = getUserRole();
  }

  public setToken(token: string): void {
    this._token = token;
    this.axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setToken(token);
  }

  public clearToken(): void {
    this._token = null;
    delete this.axios.defaults.headers.common['Authorization'];
    clearToken();
    ApiService.userRole = null;
  }

  public async initToken(): Promise<void> {
    await this.loadTokenFromStorage();
  }

  public async fetchAndStoreUserRole(): Promise<void> {
    try {
      const profile = await this.getMyProfile();
      if (profile.role) {
        ApiService.userRole = profile.role as string;
        setUserRole(profile.role as string);
      }
    } catch {
      // ignore
    }
  }

  // ======================== AUTHENTICATION ========================
  public async login(email: string, password: string): Promise<JsonObject> {
    const params = new URLSearchParams();
    params.append('username', email);
    params.append('password', password);
    const res = await this.axios.post('/auth/login', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    if (res.data.access_token) {
      this.setToken(res.data.access_token as string);
      await this.fetchAndStoreUserRole();
    }
    return res.data;
  }

  public async signup(
    phone: string,
    password: string,
    email: string,
    username: string
  ): Promise<JsonObject> {
    const res = await this.axios.post('/auth/signup', {
      phone,
      password,
      email,
      username,
    });
    return res.data;
  }

  public async verifyAccount(phone: string, otp: string): Promise<JsonObject> {
    const res = await this.axios.post('/auth/verify', { phone, otp });
    if (res.data.access_token) {
      this.setToken(res.data.access_token as string);
      await this.fetchAndStoreUserRole();
    }
    return res.data;
  }

  public async forgotPassword(phone: string): Promise<JsonObject> {
    const res = await this.axios.post('/auth/forgot-password', { phone });
    return res.data;
  }

  public async resetPassword(
    phone: string,
    otp: string,
    newPassword: string
  ): Promise<JsonObject> {
    const res = await this.axios.post('/auth/reset-password', {
      phone,
      otp,
      new_password: newPassword,
    });
    return res.data;
  }

  public async resetPasswordDirect(phone: string, newPassword: string): Promise<JsonObject> {
    const res = await this.axios.post('/auth/reset-password-direct', {
      phone,
      new_password: newPassword,
    });
    return res.data;
  }

  public async socialLogin(provider: string, token: string, secret?: string): Promise<JsonObject> {
    const res = await this.axios.post('/auth/social', {
      provider,
      token,
      ...(secret ? { secret } : {}),
    });
    if (res.data.access_token) {
      this.setToken(res.data.access_token as string);
      await this.fetchAndStoreUserRole();
    }
    return res.data;
  }

  public async getMyProfile(): Promise<JsonObject> {
    const res = await this.axios.get('/auth/me');
    return res.data;
  }

  public async resendVerification(phone: string): Promise<JsonObject> {
    const res = await this.axios.post('/auth/resend-verification', { phone });
    return res.data;
  }

  // ======================== PROFILE & ONBOARDING ========================
  public async completeOnboarding(role: string): Promise<void> {
    await this.axios.post('/profile/complete-onboarding', { role });
  }

  public async getOnboardedRoles(): Promise<string[]> {
    const res = await this.axios.get('/profile/onboarding-status');
    return (res.data.onboarded_roles || []) as string[];
  }

  public async getSettings(role: string): Promise<JsonObject> {
    const res = await this.axios.get(`/profile/settings/${role}`);
    return res.data;
  }

  public async saveSettings(role: string, settings: JsonObject): Promise<void> {
    await this.axios.put('/profile/settings', { role, settings });
  }

  // ======================== WALLET & ESCROW ========================
  public async getWalletBalance(): Promise<JsonObject> {
    const res = await this.axios.get('/wallet/balance');
    return res.data;
  }

  public async createWallet(): Promise<JsonObject> {
    const res = await this.axios.post('/wallet/create');
    return res.data;
  }

  public async topUp(amount: number): Promise<JsonObject> {
    const res = await this.axios.post('/wallet/topup', { amount });
    return res.data;
  }

  public async setWithdrawalPin(pin: string): Promise<JsonObject> {
    const res = await this.axios.post('/wallet/set-pin', { pin });
    return res.data;
  }

  public async withdraw(
    amount: number,
    method: string,
    accountNumber: string,
    pin: string
  ): Promise<JsonObject> {
    const res = await this.axios.post('/wallet/withdraw', {
      amount,
      method,
      account_number: accountNumber,
      pin,
    });
    return res.data;
  }

  public async reserveItem(
    orderId: string,
    storekeeperId: string,
    itemAmount: number,
    listingId: string,
    courierId?: string,
    deliveryFee = 0.0
  ): Promise<JsonObject> {
    const res = await this.axios.post('/wallet/reserve', {
      order_id: orderId,
      storekeeper_id: storekeeperId,
      item_amount: itemAmount,
      listing_id: listingId,
      ...(courierId ? { courier_id: courierId } : {}),
      delivery_fee: deliveryFee,
    });
    return res.data;
  }

  public async confirmOrder(orderId: string): Promise<JsonObject> {
    const res = await this.axios.post('/wallet/confirm', { order_id: orderId });
    return res.data;
  }

  public async dispatchOrder(orderId: string): Promise<JsonObject> {
    const res = await this.axios.post('/wallet/dispatch', { order_id: orderId });
    return res.data;
  }

  public async returnOrder(orderId: string): Promise<JsonObject> {
    const res = await this.axios.post('/wallet/return', { order_id: orderId });
    return res.data;
  }

  public async reversedPackage(orderId: string): Promise<JsonObject> {
    const res = await this.axios.post('/wallet/reversed-package', { order_id: orderId });
    return res.data;
  }

  public async getMyEscrows(): Promise<JsonArray> {
    const res = await this.axios.get('/wallet/escrows');
    return res.data;
  }

  public async instantPickup(
    listingId: string,
    storekeeperId: string,
    amount: number
  ): Promise<JsonObject> {
    const res = await this.axios.post('/wallet/instant-pickup', {
      listing_id: listingId,
      storekeeper_id: storekeeperId,
      amount,
    });
    return res.data;
  }

  // ======================== STOREKEEPER ========================
  public async createStore(
    name: string,
    description: string,
    category: string[],
    address: string,
    lat: number,
    lng: number,
    phone: string,
    storeImageUrl?: string,
    businessHours?: JsonObject,
    contactPreference = 'in-app'
  ): Promise<JsonObject> {
    const res = await this.axios.post('/storekeeper/store', {
      name,
      description,
      category,
      address,
      lat,
      lng,
      phone,
      store_image_url: storeImageUrl,
      business_hours: businessHours,
      contact_preference: contactPreference,
    });
    return res.data;
  }

  public async getMyStore(): Promise<JsonObject | null> {
    try {
      const res = await this.axios.get('/storekeeper/my-store');
      return res.data;
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 404) return null;
      throw error;
    }
  }

  public async getStoreStats(): Promise<JsonObject> {
    const res = await this.axios.get('/storekeeper/stats');
    return res.data;
  }

  public async uploadStoreImage(image: File): Promise<JsonObject> {
    const form = new FormData();
    form.append('image', image, 'store.jpg');
    const res = await this.axios.post('/storekeeper/upload-store-image', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  }

  public async uploadStoreImageBytes(imageBytes: Uint8Array): Promise<JsonObject> {
    const buffer = imageBytes.buffer.slice(imageBytes.byteOffset, imageBytes.byteOffset + imageBytes.byteLength) as ArrayBuffer;
    const blob = new Blob([buffer], { type: 'image/jpeg' });
    const file = new File([blob], 'store.jpg', { type: 'image/jpeg' });
    return this.uploadStoreImage(file);
  }

  public async updateStoreImage(formData: FormData): Promise<JsonObject> {
    const res = await this.axios.post('/storekeeper/update-store-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  }

  public async createListing(
    storeId: string,
    title: string,
    price: number,
    lat: number,
    lng: number,
    category: string,
    image?: File,
    barcode = '',
    style = 'warm',
    quantity = 1
  ): Promise<JsonObject> {
    const form = new FormData();
    form.append('store_id', storeId);
    form.append('title', title);
    form.append('price', price.toString());
    form.append('lat', lat.toString());
    form.append('lng', lng.toString());
    form.append('category', category);
    form.append('barcode', barcode);
    form.append('style', style);
    form.append('quantity', quantity.toString());
    if (image) {
      form.append('image', image);
    }
    const res = await this.axios.post('/storekeeper/listing', form);
    return res.data;
  }

  public async getStoreItems(storeId: string): Promise<JsonArray> {
    const res = await this.axios.get(`/storekeeper/items/${storeId}`);
    return res.data;
  }

  public async getStoreOrders(storeId: string): Promise<JsonArray> {
    const res = await this.axios.get(`/storekeeper/orders/${storeId}`);
    return res.data;
  }

  public async getStoreById(storeId: string): Promise<JsonObject> {
    const res = await this.axios.get(`/storekeeper/store/${storeId}`);
    return res.data;
  }

  public async getStoreLocations(): Promise<JsonArray> {
    const res = await this.axios.get('/storekeeper/stores/locations');
    return res.data;
  }

  public async searchStoreItems(storeId: string, query: string): Promise<JsonArray> {
    const res = await this.axios.get(`/storekeeper/items/${storeId}/search`, {
      params: { q: query },
    });
    return res.data;
  }

  public async followStore(storeId: string): Promise<void> {
    await this.axios.post(`/storekeeper/${storeId}/follow`);
  }

  public async unfollowStore(storeId: string): Promise<void> {
    await this.axios.delete(`/storekeeper/${storeId}/unfollow`);
  }

  public async getFollowStatus(storeId: string): Promise<boolean> {
    try {
      const res = await this.axios.get(`/storekeeper/${storeId}/follow-status`);
      return (res.data.is_following as boolean) ?? false;
    } catch {
      return false;
    }
  }

  public async rewriteListing(title: string, category?: string): Promise<JsonObject> {
    const res = await this.axios.post('/storekeeper/rewrite-listing', {
      title,
      ...(category ? { category } : {}),
    });
    return res.data;
  }

  public async previewImage(image: File, style: string): Promise<JsonObject> {
    const form = new FormData();
    form.append('image', image);
    form.append('style', style);
    const res = await this.axios.post('/storekeeper/preview-image', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  }

  public async updateItemOrder(listingIds: string[]): Promise<void> {
    await this.axios.put('/storekeeper/items/order', {
      listing_ids: listingIds,
    });
  }

  // ======================== SHOPPER ========================
  public async getFeed(lat: number, lng: number, radiusKm = 10): Promise<JsonObject> {
    const res = await this.axios.get('/shopper/real-feed', {
      params: { lat, lng, radius_km: radiusKm },
    });
    return res.data;
  }

  public async getListing(listingId: string): Promise<JsonObject> {
    const res = await this.axios.get(`/shopper/listing/${listingId}`);
    return res.data;
  }

  public async recallFeed(
    lat: number,
    lng: number,
    radiusKm: number,
    mix: Record<string, number>
  ): Promise<JsonObject> {
    const res = await this.axios.post('/shopper/feed/recall', {
      lat,
      lng,
      radius_km: radiusKm,
      mix,
    });
    return res.data;
  }

  public async rankFeed(
    lat: number,
    lng: number,
    candidateIds: string[],
    sessionItemsShown: string[]
  ): Promise<JsonObject> {
    const res = await this.axios.post('/shopper/feed/rank', {
      lat,
      lng,
      candidate_ids: candidateIds,
      session_items_shown: sessionItemsShown,
    });
    return res.data;
  }

  public async logSeaiEvent(
    eventType: string,
    listingId: string,
    userLat: number,
    userLng: number,
    position: number
  ): Promise<void> {
    try {
      await this.axios.post('/seai/events', {
        event_type: eventType,
        listing_id: listingId,
        user_lat: userLat,
        user_lng: userLng,
        position,
      });
    } catch {
      // fire-and-forget
    }
  }

  public async getSaveStatus(listingId: string): Promise<boolean> {
    try {
      const res = await this.axios.get(`/shopper/save/${listingId}/status`);
      return (res.data.saved as boolean) ?? false;
    } catch {
      return false;
    }
  }

  public async saveListing(listingId: string): Promise<void> {
    await this.axios.post(`/shopper/save/${listingId}`);
  }

  public async unsaveListing(listingId: string): Promise<void> {
    await this.axios.delete(`/shopper/save/${listingId}`);
  }

  // ======================== PROMOTIONS ========================
  public async getPromotions(): Promise<JsonArray> {
    const res = await this.axios.get('/admin/promotions');
    return res.data;
  }

  // ======================== SEAI ========================
  public async search(
    query: string,
    lat: number,
    lng: number,
    radiusKm = 10,
    page = 0,
    limit = 20
  ): Promise<JsonArray> {
    const res = await this.axios.post('/seai/search', {
      query,
      lat,
      lng,
      radius_km: radiusKm,
      page,
      limit,
    });
    return res.data;
  }

  public async *seaiAsk(
    query: string,
    lat = 6.5244,
    lng = 3.3792,
    radiusKm = 10,
    conversationHistory: Array<{ role: string; content: string }> = [],
    mode?: 'gpt' | 'agent'
  ): AsyncGenerator<string, void, unknown> {
    const body: JsonObject = {
      query,
      lat,
      lng,
      radius_km: radiusKm,
      conversation_history: conversationHistory,
    };
    if (mode) body.mode = mode;

    const response = await fetch(`${ApiService.baseUrl}/seai/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this._token ? `Bearer ${this._token}` : '',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('ReadableStream not supported');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      while (buffer.includes('\n\n')) {
        const idx = buffer.indexOf('\n\n');
        yield buffer.slice(0, idx + 2);
        buffer = buffer.slice(idx + 2);
      }
    }
    if (buffer) yield buffer;
  }

  public async seaiLens(): Promise<never> {
    throw new Error(
      'Use seaiLensWithFile(image: File, lat, lng, radiusKm) instead'
    );
  }

  public async seaiLensWithFile(
    image: File,
    lat: number,
    lng: number,
    radiusKm = 10
  ): Promise<JsonObject> {
    const form = new FormData();
    form.append('image', image);
    form.append('lat', lat.toString());
    form.append('lng', lng.toString());
    form.append('radius_km', radiusKm.toString());
    const res = await this.axios.post('/seai/lens', form);
    return res.data;
  }

  public async transcribeAudio(audioFile: File): Promise<JsonObject> {
    const form = new FormData();
    form.append('audio', audioFile);
    const res = await this.axios.post('/seai/transcribe', form);
    return res.data;
  }

  // ======================== MAP ========================
  public async getMapLocations(): Promise<JsonArray> {
    const res = await this.axios.get('/map/locations');
    return res.data;
  }

  // ======================== SERVICES ========================
  public async createService(
    title: string,
    category: string,
    description: string,
    price: number,
    durationMinutes = 60,
    lat = 6.5244,
    lng = 3.3792
  ): Promise<JsonObject> {
    const res = await this.axios.post('/services/', {
      title,
      category,
      description,
      price,
      duration_minutes: durationMinutes,
      location_lat: lat,
      location_lng: lng,
    });
    return res.data;
  }

  public async listServices(): Promise<JsonArray> {
    const res = await this.axios.get('/services/');
    return res.data;
  }

  public async getService(serviceId: string): Promise<JsonObject> {
    const res = await this.axios.get(`/services/${serviceId}`);
    return res.data;
  }

  public async bookService(
    serviceId: string,
    scheduledFor?: string,
    notes?: string,
    lat?: number,
    lng?: number
  ): Promise<JsonObject> {
    const res = await this.axios.post(`/services/${serviceId}/book`, {
      scheduled_for: scheduledFor,
      notes,
      location_lat: lat,
      location_lng: lng,
    });
    return res.data;
  }

  public async confirmServiceBooking(bookingId: string): Promise<JsonObject> {
    const res = await this.axios.post(`/services/bookings/${bookingId}/confirm`);
    return res.data;
  }

  public async completeServiceBooking(bookingId: string): Promise<JsonObject> {
    const res = await this.axios.post(`/services/bookings/${bookingId}/complete`);
    return res.data;
  }

  public async getServiceBookings(): Promise<JsonArray> {
    const res = await this.axios.get('/services/bookings');
    return res.data;
  }

  public async getServiceBookingDetail(bookingId: string): Promise<JsonObject> {
    const res = await this.axios.get(`/services/bookings/${bookingId}`);
    return res.data;
  }

  public async instantServicePay(
    serviceId: string,
    providerId: string,
    amount: number
  ): Promise<JsonObject> {
    const res = await this.axios.post('/services/instant-pay', {
      service_id: serviceId,
      provider_id: providerId,
      amount,
    });
    return res.data;
  }

  public async getProviderServices(): Promise<JsonArray> {
    const res = await this.axios.get('/services/provider');
    return res.data;
  }

  public async getProviderBookings(): Promise<JsonArray> {
    const res = await this.axios.get('/services/bookings/provider');
    return res.data;
  }

  public async getProviderStats(): Promise<JsonObject> {
    const res = await this.axios.get('/services/providers/stats');
    return res.data;
  }

  public async updateProviderAvailability(isAvailable: boolean): Promise<void> {
    await this.axios.put('/services/providers/availability', { is_available: isAvailable });
  }

  public async deleteService(serviceId: string): Promise<void> {
    await this.axios.delete(`/services/${serviceId}`);
  }

  public async toggleServiceActive(serviceId: string): Promise<JsonObject> {
    const res = await this.axios.post(`/services/${serviceId}/toggle`);
    return res.data;
  }

  public async confirmBooking(bookingId: string): Promise<JsonObject> {
    return this.confirmServiceBooking(bookingId);
  }

  public async completeBooking(bookingId: string): Promise<JsonObject> {
    return this.completeServiceBooking(bookingId);
  }

  // ======================== COURIER ========================
  public async registerCourier(
    name: string,
    vehicleType: string,
    lat: number,
    lng: number
  ): Promise<JsonObject> {
    const res = await this.axios.post('/courier/register', {
      courier_id: '',
      name,
      vehicle_type: vehicleType,
      lat,
      lng,
    });
    return res.data;
  }

  public async setCourierOnline(online: boolean): Promise<JsonObject> {
    const res = await this.axios.post('/courier/online', {
      courier_id: '',
      online,
    });
    return res.data;
  }

  public async matchCourier(
    orderId: string,
    storekeeperId: string,
    pickupLat: number,
    pickupLng: number,
    dropoffLat: number,
    dropoffLng: number
  ): Promise<JsonObject> {
    const res = await this.axios.post('/courier/match', {
      order_id: orderId,
      storekeeper_id: storekeeperId,
      pickup_lat: pickupLat,
      pickup_lng: pickupLng,
      dropoff_lat: dropoffLat,
      dropoff_lng: dropoffLng,
    });
    return res.data;
  }

  public async acceptCourierJob(jobId: string): Promise<JsonObject> {
    const res = await this.axios.post('/courier/accept-job', { job_id: jobId });
    return res.data;
  }

  public async declineCourierJob(jobId: string): Promise<JsonObject> {
    const res = await this.axios.post('/courier/decline-job', { job_id: jobId });
    return res.data;
  }

  public async updateCourierLocation(lat: number, lng: number): Promise<JsonObject> {
    const res = await this.axios.post('/courier/location', { lat, lng });
    return res.data;
  }

  public async updateCourierJobStatus(jobId: string, status: string): Promise<JsonObject> {
    const res = await this.axios.post('/courier/status', {
      job_id: jobId,
      status,
    });
    return res.data;
  }

  public async getCourierJobs(): Promise<JsonArray> {
    const res = await this.axios.get('/courier/jobs');
    return res.data;
  }

  // ======================== FLIPPER ========================
  public async createFlipperListing(
    title: string,
    description: string,
    price: number,
    source = 'thrift',
    condition = 'Used',
    imageUrl?: string,
    lat = 6.5244,
    lng = 3.3792
  ): Promise<JsonObject> {
    const res = await this.axios.post('/flipper/listings', {
      title,
      description,
      price,
      source,
      condition,
      image_url: imageUrl,
      lat,
      lng,
    });
    return res.data;
  }

  public async getFlipperListings(): Promise<JsonArray> {
    const res = await this.axios.get('/flipper/listings');
    return res.data;
  }

  public async getFlipperListing(listingId: string): Promise<JsonObject> {
    const res = await this.axios.get(`/flipper/listings/${listingId}`);
    return res.data;
  }

  public async scanResell(
    barcode?: string,
    image?: File,
    lat = 6.5244,
    lng = 3.3792,
    radiusKm = 10
  ): Promise<JsonObject> {
    const form = new FormData();
    if (barcode) form.append('barcode', barcode);
    if (image) form.append('image', image);
    form.append('lat', lat.toString());
    form.append('lng', lng.toString());
    form.append('radius_km', radiusKm.toString());
    const res = await this.axios.post('/flipper/scan-resell', form);
    return res.data;
  }

  // ======================== KYC ========================
  public async fetchKycDetails(nationalId: string): Promise<JsonObject> {
    const form = new FormData();
    form.append('national_id', nationalId);
    const res = await this.axios.post('/kyc/fetch-id', form);
    return res.data;
  }

  public async uploadKycDocuments(idImage: File, selfieImage: File): Promise<JsonObject> {
    const form = new FormData();
    form.append('id_image', idImage);
    form.append('selfie_image', selfieImage);
    const res = await this.axios.post('/kyc/upload-documents', form);
    return res.data;
  }

  public async startLiveness(): Promise<JsonObject> {
    const res = await this.axios.post('/kyc/start-liveness');
    return res.data;
  }

  public async submitLivenessVideo(video: File, actions: string[]): Promise<JsonObject> {
    const form = new FormData();
    form.append('video', video);
    form.append('actions', actions.join(','));
    const res = await this.axios.post('/kyc/liveness-video', form);
    return res.data;
  }

  public async verifyFace(): Promise<JsonObject> {
    const res = await this.axios.post('/kyc/verify-face');
    return res.data;
  }

  public async getKycStatus(): Promise<JsonObject> {
    const res = await this.axios.get('/kyc/status');
    return res.data;
  }

  // ======================== CHAT ========================
  public async sendMessage(receiverId: string, text: string, imageUrl?: string): Promise<JsonObject> {
    const res = await this.axios.post('/chat/send', {
      receiver_id: receiverId,
      text,
      image_url: imageUrl,
    });
    return res.data;
  }

  public async sendVoiceNote(receiverId: string, audioFile: File): Promise<JsonObject> {
    const form = new FormData();
    form.append('receiver_id', receiverId);
    form.append('audio', audioFile);
    const res = await this.axios.post('/chat/send-voice', form);
    return res.data;
  }

  public async getConversations(): Promise<JsonArray> {
    const res = await this.axios.get('/chat/conversations');
    return res.data;
  }

  public async getMessages(conversationId: string, limit = 50, beforeId?: number): Promise<JsonObject> {
    const params: Record<string, string | number> = { limit };
    if (beforeId) params.before_id = beforeId;
    const res = await this.axios.get(`/chat/messages/${conversationId}`, { params });
    return res.data;
  }

  public async sendCallOffer(
    conversationId: string,
    receiverId: string,
    data: string
  ): Promise<void> {
    await this.axios.post('/chat/call/offer', {
      conversation_id: conversationId,
      receiver_id: receiverId,
      data,
    });
  }

  public async sendCallAnswer(
    conversationId: string,
    receiverId: string,
    data: string
  ): Promise<void> {
    await this.axios.post('/chat/call/answer', {
      conversation_id: conversationId,
      receiver_id: receiverId,
      data,
    });
  }

  public async sendIceCandidate(
    conversationId: string,
    receiverId: string,
    data: string
  ): Promise<void> {
    await this.axios.post('/chat/call/ice-candidate', {
      conversation_id: conversationId,
      receiver_id: receiverId,
      data,
    });
  }

  public async pollCallSignals(conversationId: string): Promise<JsonArray> {
    const res = await this.axios.get(`/chat/call/signals/${conversationId}`);
    return res.data;
  }

  public async getUserProfile(userId: string): Promise<JsonObject> {
    const res = await this.axios.get(`/users/${userId}`);
    return res.data;
  }

  // ======================== ADMIN ========================
  public async adminGetUsers(search?: string, limit = 50, offset = 0): Promise<JsonArray> {
    const params: Record<string, string | number> = { limit, offset };
    if (search) params.search = search;
    const res = await this.axios.get('/admin/users', { params });
    return res.data;
  }

  public async adminGetUser(userId: string): Promise<JsonObject> {
    const res = await this.axios.get(`/admin/users/${userId}`);
    return res.data;
  }

  public async adminGetUserFull(userId: string): Promise<JsonObject> {
    const res = await this.axios.get(`/admin/users/${userId}/full`);
    return res.data;
  }

  public async adminDeleteUser(userId: string): Promise<void> {
    await this.axios.delete(`/admin/users/${userId}`);
  }

  public async adminSuspendUser(userId: string): Promise<void> {
    await this.axios.post(`/admin/users/${userId}/suspend`);
  }

  public async adminUnsuspendUser(userId: string): Promise<void> {
    await this.axios.post(`/admin/users/${userId}/unsuspend`);
  }

  public async adminGetStores(
    search?: string,
    status?: string,
    limit = 50,
    offset = 0
  ): Promise<JsonArray> {
    const params: Record<string, string | number> = { limit, offset };
    if (search && search.trim()) params.search = search;
    if (status && status !== 'All') params.status = status;
    const res = await this.axios.get('/admin/stores', { params });
    return res.data;
  }

  public async adminGetStoreDetail(storeId: string): Promise<JsonObject> {
    const res = await this.axios.get(`/admin/stores/${storeId}`);
    return res.data;
  }

  public async adminDeleteStore(storeId: string): Promise<void> {
    await this.axios.delete(`/admin/stores/${storeId}`);
  }

  public async adminVerifyStore(storeId: string): Promise<void> {
    await this.axios.post(`/admin/stores/${storeId}/verify`);
  }

  public async adminSuspendStore(storeId: string): Promise<void> {
    await this.axios.post(`/admin/stores/${storeId}/suspend`);
  }

  public async adminGetOrders(
    search?: string,
    status?: string,
    limit = 50,
    offset = 0
  ): Promise<JsonArray> {
    const params: Record<string, string | number> = { limit, offset };
    if (search && search.trim()) params.search = search;
    if (status && status !== 'All') params.status = status;
    const res = await this.axios.get('/admin/orders', { params });
    return res.data;
  }

  public async adminGetOrderDetail(orderId: string): Promise<JsonObject> {
    const res = await this.axios.get(`/admin/orders/${orderId}`);
    return res.data;
  }

  public async adminDeleteOrder(orderId: string): Promise<void> {
    await this.axios.delete(`/admin/orders/${orderId}`);
  }

  public async adminUpdateOrderStatus(orderId: string, status: string): Promise<void> {
    await this.axios.post(`/admin/orders/${orderId}/status`, null, {
      params: { status },
    });
  }

  public async adminGetListings(search?: string, limit = 50, offset = 0): Promise<JsonArray> {
    const params: Record<string, string | number> = { limit, offset };
    if (search && search.trim()) params.search = search;
    const res = await this.axios.get('/admin/listings', { params });
    return res.data;
  }

  public async adminDeleteListing(listingId: string): Promise<void> {
    await this.axios.delete(`/admin/listings/${listingId}`);
  }

  public async adminGetCouriers(search?: string, limit = 50, offset = 0): Promise<JsonArray> {
    const params: Record<string, string | number> = { limit, offset };
    if (search && search.trim()) params.search = search;
    const res = await this.axios.get('/admin/couriers', { params });
    return res.data;
  }

  public async adminDeleteCourier(courierId: string): Promise<void> {
    await this.axios.delete(`/admin/couriers/${courierId}`);
  }

  public async adminGetFlippers(search?: string, limit = 50, offset = 0): Promise<JsonArray> {
    const params: Record<string, string | number> = { limit, offset };
    if (search && search.trim()) params.search = search;
    const res = await this.axios.get('/admin/flippers', { params });
    return res.data;
  }

  public async adminDeleteFlipper(userId: string): Promise<void> {
    await this.axios.delete(`/admin/flippers/${userId}`);
  }

  public async adminGetServices(search?: string, limit = 50, offset = 0): Promise<JsonArray> {
    const params: Record<string, string | number> = { limit, offset };
    if (search && search.trim()) params.search = search;
    const res = await this.axios.get('/admin/services', { params });
    return res.data;
  }

  public async adminDeleteService(serviceId: string): Promise<void> {
    await this.axios.delete(`/admin/services/${serviceId}`);
  }

  public async adminGetServiceProviders(search?: string, limit = 50, offset = 0): Promise<JsonArray> {
    const params: Record<string, string | number> = { limit, offset };
    if (search && search.trim()) params.search = search;
    const res = await this.axios.get('/admin/service-providers', { params });
    return res.data;
  }

  public async adminDeleteServiceProvider(userId: string): Promise<void> {
    await this.axios.delete(`/admin/service-providers/${userId}`);
  }

  public async adminGetTransactions(limit = 100, offset = 0): Promise<JsonArray> {
    const res = await this.axios.get('/admin/transactions', { params: { limit, offset } });
    return res.data;
  }

  public async adminGetStats(): Promise<JsonObject> {
    const res = await this.axios.get('/admin/stats');
    return res.data;
  }

  public async getFeatureFlags(): Promise<JsonObject> {
    try {
      const res = await this.axios.get('/settings/feature-flags');
      return res.data;
    } catch {
      return {
        enable_delivery: false,
        enable_courier: false,
        enable_flipper: false,
        maintenance_mode: false,
        app_version: '1.0.0',
      };
    }
  }

  public async updateFeatureFlag(key: string, value: string): Promise<void> {
    await this.axios.post('/settings/admin/update-setting', null, {
      params: { key, value },
    });
  }

  public async isAdminUser(): Promise<boolean> {
    try {
      const profile = await this.getMyProfile();
      return profile.role === 'admin';
    } catch {
      return false;
    }
  }

  // SEAI Conversations
  public async getRecentConversations(): Promise<JsonArray> {
    const res = await this.axios.get('/chat/seai/conversations');
    return res.data;
  }

  public async getConversationMessages(conversationId: string): Promise<JsonObject> {
    const res = await this.axios.get(`/chat/messages/${conversationId}`);
    return res.data;
  }

  public async saveSeaiExchange(userText: string, aiText: string): Promise<void> {
    await this.axios.post('/chat/seai/save', {
      user_text: userText,
      ai_text: aiText,
    });
  }

  // Basket & Reservations
  public async getWalletOrders(status?: string[]): Promise<JsonArray> {
    const params: Record<string, string> = {};
    if (status && status.length) params.status = status.join(',');
    const res = await this.axios.get('/wallet/orders', { params });
    return res.data;
  }

  public async getBasket(): Promise<JsonObject> {
    const res = await this.axios.get('/basket/');
    return res.data;
  }

  public async addToBasket(listingId: string, storeId: string, quantity = 1): Promise<void> {
    await this.axios.post('/basket/add', { listing_id: listingId, store_id: storeId, quantity });
  }

  public async removeBasketItem(itemId: number): Promise<void> {
    await this.axios.delete(`/basket/item/${itemId}`);
  }

  public async updateBasketItem(itemId: number, quantity: number): Promise<void> {
    await this.axios.put(`/basket/item/${itemId}`, { quantity });
  }

  public async clearBasket(): Promise<void> {
    await this.axios.delete('/basket/clear');
  }

  public async checkoutBasket(): Promise<JsonObject> {
    const res = await this.axios.post('/basket/checkout', {});
    return res.data;
  }

  // Notifications
  public async saveFcmToken(token: string): Promise<void> {
    try {
      await this.axios.post('/notifications/register-device', { fcm_token: token });
    } catch (e) {
      console.warn('Failed to save FCM token:', e);
    }
  }

  public async getProviderServicesByUserId(providerId: string): Promise<JsonArray> {
    const res = await this.axios.get(`/services/provider/${providerId}`);
    return res.data;
  }

  public async getProviderProfile(): Promise<JsonObject> {
    const res = await this.axios.get('/service-provider/profile');
    return res.data;
  }

  public async updateProviderBusinessName(name: string): Promise<void> {
    await this.axios.put('/service-provider/profile', { business_name: name });
  }

  public async uploadProviderAvatar(image: File): Promise<void> {
    const form = new FormData();
    form.append('avatar', image);
    await this.axios.post('/service-provider/avatar', form);
  }

  public async uploadServiceImage(serviceId: string, image: File): Promise<void> {
    const form = new FormData();
    form.append('image', image, 'service.jpg');
    await this.axios.post(`/services/${serviceId}/image`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }

  public async uploadServiceImageBytes(serviceId: string, imageBytes: Uint8Array): Promise<void> {
    const buffer = imageBytes.buffer.slice(imageBytes.byteOffset, imageBytes.byteOffset + imageBytes.byteLength) as ArrayBuffer;
    const blob = new Blob([buffer], { type: 'image/jpeg' });
    const file = new File([blob], 'service.jpg', { type: 'image/jpeg' });
    return this.uploadServiceImage(serviceId, file);
  }

  public async uploadServiceVideo(serviceId: string, videoFile: File): Promise<void> {
    const form = new FormData();
    form.append('video', videoFile, 'service.mp4');
    await this.axios.post(`/services/${serviceId}/video`, form);
  }

  public async uploadServiceVideoBytes(serviceId: string, videoBytes: Uint8Array): Promise<void> {
    const buffer = videoBytes.buffer.slice(videoBytes.byteOffset, videoBytes.byteOffset + videoBytes.byteLength) as ArrayBuffer;
    const blob = new Blob([buffer], { type: 'video/mp4' });
    const file = new File([blob], 'service.mp4', { type: 'video/mp4' });
    return this.uploadServiceVideo(serviceId, file);
  }

  public async updateProfile(displayName: string): Promise<void> {
    await this.axios.put('/profile/update', { display_name: displayName });
  }

  public async uploadAvatar(imageFile: File): Promise<void> {
    const form = new FormData();
    form.append('avatar', imageFile, 'avatar.jpg');
    await this.axios.post('/profile/upload-avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }

  public async uploadAvatarBytes(imageBytes: Uint8Array): Promise<void> {
    const buffer = imageBytes.buffer.slice(imageBytes.byteOffset, imageBytes.byteOffset + imageBytes.byteLength) as ArrayBuffer;
    const blob = new Blob([buffer], { type: 'image/jpeg' });
    const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
    return this.uploadAvatar(file);
  }

  public async updateProviderProfile(displayName: string, businessName: string): Promise<void> {
    await this.axios.put('/profile/update-provider-profile', {
      display_name: displayName,
      business_name: businessName,
    });
  }

  public async uploadBusinessImage(imageFile: File): Promise<void> {
    const form = new FormData();
    form.append('image', imageFile, 'business.jpg');
    await this.axios.post('/profile/upload-business-image', form);
  }

  public async uploadBusinessImageBytes(bytes: Uint8Array): Promise<void> {
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const blob = new Blob([buffer], { type: 'image/jpeg' });
    const file = new File([blob], 'business.jpg', { type: 'image/jpeg' });
    return this.uploadBusinessImage(file);
  }

  public async getNotifications(limit = 50, offset = 0): Promise<JsonArray> {
    const res = await this.axios.get('/notifications/', { params: { limit, offset } });
    return res.data;
  }

  // ─── SEAI Suggest (autocomplete) ──────────────────────────────
  public async suggest(
    q: string,
    lat: number,
    lng: number,
    radiusKm = 10,
    limit = 10
  ): Promise<JsonArray> {
    const res = await this.axios.get('/seai/suggest', {
      params: { q, lat, lng, radius_km: radiusKm, limit },
    });
    return res.data;
  }

  // ─── Chat: get messages by user ────────────────────────────────
  public async getMessagesByUser(
    userId: string,
    limit = 50,
    beforeId?: number
  ): Promise<JsonObject> {
    const params: Record<string, string | number> = { limit };
    if (beforeId) params.before_id = beforeId;
    const res = await this.axios.get(`/chat/messages/user/${userId}`, { params });
    return res.data;
  }

  // ─── Storekeeper: AI Analyze Image ────────────────────────────
  public async analyzeImage(image: File): Promise<JsonObject> {
    const form = new FormData();
    form.append('image', image, 'product.jpg');
    const res = await this.axios.post('/storekeeper/analyze-image', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  }

  // ─── Notifications: mark as read ────────────────────────────
  public async markNotificationRead(id: number): Promise<void> {
    await this.axios.post(`/notifications/read/${id}`);
  }

  public async post(path: string, data: JsonObject): Promise<JsonObject> {
    const res = await this.axios.post(path, data);
    return res.data;
  }

  public async getWalletTransactions(limit = 20, offset = 0): Promise<JsonArray> {
    const res = await this.axios.get('/wallet/transactions', {
      params: { limit, offset },
    });
    return res.data;
  }

  // ─── Card Management ─────────────────────────────────────────
  public async getWalletCards(): Promise<Card[]> {
    const res = await this.axios.get('/wallet/cards');
    return res.data as Card[];
  }

  public async addWalletCard(card: {
    card_token: string;
    last4: string;
    expiry_month: string;
    expiry_year: string;
    brand: string;
    cardholder_name?: string;
  }): Promise<JsonObject> {
    const res = await this.axios.post('/wallet/cards', card);
    return res.data;
  }

  public async verifyAndSaveCard(reference: string): Promise<Card> {
    const res = await this.axios.post('/wallet/cards/verify', { reference });
    return res.data as Card;
  }

  public async deleteWalletCard(cardId: number): Promise<void> {
    await this.axios.delete(`/wallet/cards/${cardId}`);
  }

  public async getOrderDetail(orderId: string): Promise<JsonObject> {
  const res = await this.axios.get(`/wallet/order/${orderId}`);
  return res.data;
}
}

export default ApiService.getInstance();