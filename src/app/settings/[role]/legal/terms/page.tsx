'use client';

import { useRouter, useParams } from 'next/navigation';
import { useAuthGuard } from '../../../../../hooks/useAuthGuard';
import {
  LegalScreen,
  type LegalSection,
} from '../../../../../components/settings/LegalScreen';

const LAST_UPDATED = '28 September 2026';

const SECTIONS: LegalSection[] = [
  {
    id: 'acceptance',
    title: 'Acceptance of these terms',
    paragraphs: [
      'By creating an Admerce account or using any part of the Admerce platform — including the website, mobile web app, and any related services — you agree to be bound by these Terms and Conditions.',
      'If you do not agree with any part of these terms, do not use the platform. Continued use after changes are published constitutes acceptance of the updated terms.',
    ],
  },
  {
    id: 'eligibility',
    title: 'Who can use Admerce',
    paragraphs: [
      'You must be at least 18 years old and legally capable of entering into binding contracts under Nigerian law to use Admerce.',
      'By using Admerce you represent that the information you provide is accurate, that you will use the platform only for lawful purposes, and that you are not barred from using the service under any applicable law.',
    ],
  },
  {
    id: 'account',
    title: 'Your account',
    paragraphs: [
      'You are responsible for maintaining the confidentiality of your login credentials, phone number, email, OTP codes, and any wallet PIN you set.',
      'You agree to notify us immediately at support@admerce.ng if you suspect unauthorized access to your account. We are not liable for losses arising from your failure to protect your credentials.',
    ],
    bullets: [
      'One account per phone number and email',
      'Accurate personal and business information at all times',
      'No sharing of accounts between individuals',
      'No automated or bulk account creation',
    ],
  },
  {
    id: 'marketplace',
    title: 'Buying and selling',
    paragraphs: [
      'Admerce is a marketplace that connects buyers, storekeepers, service providers, and couriers. We are not a party to the transactions between users.',
      'Sellers are solely responsible for the accuracy of their listings, the legality of the items they list, and the fulfilment of orders. Buyers are responsible for inspecting items and confirming pickup or delivery.',
    ],
    bullets: [
      'Listings must describe the item or service accurately, including condition, price, and availability',
      'Sellers must not list counterfeit, stolen, illegal, or prohibited items',
      'Service providers must deliver services with reasonable skill and care',
      'All communication related to an order must stay within the Admerce platform',
    ],
  },
  {
    id: 'escrow',
    title: 'Escrow and payments',
    paragraphs: [
      'When you reserve an item or book a service, the total amount (item price plus any delivery fee) is held in escrow until you confirm pickup, completion, or the pickup window expires.',
      'Funds are released to the seller when the buyer confirms receipt, when the seller confirms delivery and the buyer does not dispute within the window, or when the automatic expiry rule applies.',
      'Wallet balances are held as a ledger for platform convenience and are not a bank deposit. Wallet withdrawals are currently processed manually and may be subject to verification.',
    ],
    bullets: [
      'Escrow protects both buyers and sellers from bad-faith transactions',
      'Disputes must be raised within 48 hours of the dispute event',
      'We may reverse a transaction where fraud, abuse, or error is confirmed',
    ],
  },
  {
    id: 'prohibited',
    title: 'Prohibited conduct',
    paragraphs: [
      'The following activities are strictly prohibited on Admerce and may result in immediate account suspension, permanent ban, and referral to law enforcement:',
    ],
    bullets: [
      'Fraud, scams, phishing, or misrepresentation of identity',
      'Harassment, threats, hate speech, or discriminatory conduct toward any user',
      'Listing of stolen, counterfeit, or illegal goods',
      'Attempts to circumvent escrow or transact off-platform to evade fees or protections',
      'Reverse engineering, scraping, or attacking the platform',
      'Impersonating Admerce staff or other users',
      'Creating duplicate accounts to evade a ban or suspension',
    ],
  },
  {
    id: 'intellectual-property',
    title: 'Intellectual property',
    paragraphs: [
      'The Admerce name, logo, brand assets, source code, and design system are owned by Admerce and its licensors. You may not copy, modify, or redistribute them without written permission.',
      'You retain ownership of the content you upload (photos, listings, descriptions). By uploading you grant Admerce a non-exclusive, worldwide, royalty-free license to display, distribute, and promote your content on the platform and in marketing material.',
    ],
  },
  {
    id: 'liability',
    title: 'Limitation of liability',
    paragraphs: [
      'Admerce provides the platform "as is" without warranties of any kind. To the maximum extent permitted by law, we disclaim all warranties, express or implied.',
      'We are not liable for indirect, incidental, special, consequential, or punitive damages, including lost profits, lost data, or business interruption, arising out of your use of Admerce.',
      'Where liability cannot be excluded, our total liability to you is limited to the greater of (a) the amount you paid to Admerce in the 6 months preceding the claim, or (b) ₦50,000.',
    ],
  },
  {
    id: 'termination',
    title: 'Suspension and termination',
    paragraphs: [
      'We may suspend or terminate your account at any time for violation of these terms, fraudulent activity, or where required by law.',
      'You may close your account at any time from Settings → Danger zone. Closing your account is permanent and removes your listings, chat history, and pending reservations. Wallet balances must be withdrawn before account closure.',
    ],
  },
  {
    id: 'changes',
    title: 'Changes to these terms',
    paragraphs: [
      'We may update these terms from time to time. When we make material changes we will notify you via the app before the change takes effect.',
      'Your continued use of Admerce after an update takes effect constitutes acceptance of the revised terms.',
    ],
  },
  {
    id: 'governing-law',
    title: 'Governing law',
    paragraphs: [
      'These terms are governed by the laws of the Federal Republic of Nigeria. Any dispute arising out of or in connection with these terms shall be subject to the exclusive jurisdiction of the courts of Nigeria.',
    ],
  },
  {
    id: 'contact',
    title: 'Contact us',
    paragraphs: [
      'Questions about these terms? Reach out:',
    ],
    bullets: [
      'Email: support@admerce.ng',
      'In-app: Settings → Help center → Contact support',
      'Postal: Admerce Inc., Owerri, Imo State, Nigeria',
    ],
  },
];

export default function TermsPage() {
  useAuthGuard();
  const router = useRouter();
  const params = useParams<{ role: string }>();
  const raw = (params?.role || 'shopper').toLowerCase();
  const role = raw === 'service-provider' ? 'service_provider' : raw;
  const roleSlug = role === 'service_provider' ? 'service-provider' : role;

  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(`/settings/${roleSlug}`);
    }
  };

  return (
    <LegalScreen
      title="Terms and Conditions"
      subtitle="The rules that govern your use of Admerce — buying, selling, and everything in between."
      lastUpdated={LAST_UPDATED}
      sections={SECTIONS}
      onBack={goBack}
      footerNote="These terms are provided in English. In case of conflict with any translation, the English version prevails."
    />
  );
}