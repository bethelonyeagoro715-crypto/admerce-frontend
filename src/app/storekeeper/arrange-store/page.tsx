'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '../../../services/api';
import {
  MdDevicesOther, MdBakeryDining, MdHealthAndSafety, MdCheckroom,
  MdBuild, MdChair, MdToys, MdSportsSoccer, MdDirectionsCar,
  MdMenuBook, MdCategory, MdImage, MdArrowUpward, MdArrowDownward, MdSave,
} from 'react-icons/md';
import type { IconType } from 'react-icons';

export const dynamic = 'force-dynamic';

// ─── Types ───────────────────────────────────────────────────────────────────
interface StoreItem {
  listing_id: string;
  title?: string;
  price?: number | string;
  image_url?: string;
  category?: string;
  sort_order?: number;
  [key: string]: unknown;
}
interface ShelfStyle {
  label: string; icon: IconType;
  primaryColor: string; backgroundColor: string;
  border?: string; boxShadow?: string;
}

const CATEGORY_STYLES: Record<string, ShelfStyle> = {
  tech_electronics:   { label:'Tech & Electronics',   icon:MdDevicesOther,   primaryColor:'#1A73E8', backgroundColor:'#EEF4FF', border:'1px solid rgba(26,115,232,0.25)' },
  food_beverage:      { label:'Food & Drinks',         icon:MdBakeryDining,   primaryColor:'#D84315', backgroundColor:'#FFF3E0', border:'1px solid rgba(216,67,21,0.2)' },
  health_beauty:      { label:'Health & Beauty',       icon:MdHealthAndSafety,primaryColor:'#7B1FA2', backgroundColor:'#F5EDFC', border:'1px solid rgba(123,31,162,0.2)' },
  fashion_apparel:    { label:'Fashion & Apparel',     icon:MdCheckroom,      primaryColor:'#E91E63', backgroundColor:'#FDE8F0', border:'1px solid rgba(233,30,99,0.2)' },
  building_industrial:{ label:'Building & Hardware',   icon:MdBuild,          primaryColor:'#607D8B', backgroundColor:'#ECEFF1', border:'1px solid rgba(96,125,139,0.25)' },
  home_garden:        { label:'Home & Garden',         icon:MdChair,          primaryColor:'#388E3C', backgroundColor:'#E8F5E9', border:'1px solid rgba(56,142,60,0.25)' },
  kids_toys:          { label:'Kids & Toys',           icon:MdToys,           primaryColor:'#F57C00', backgroundColor:'#FFF3E0', border:'1px solid rgba(245,124,0,0.3)', boxShadow:'0 2px 6px rgba(245,124,0,0.12)' },
  sports_outdoors:    { label:'Sports & Outdoors',     icon:MdSportsSoccer,   primaryColor:'#2E7D32', backgroundColor:'#E8F5E9', border:'1px solid rgba(46,125,50,0.25)' },
  automotive:         { label:'Automotive',            icon:MdDirectionsCar,  primaryColor:'#455A64', backgroundColor:'#ECEFF1', border:'1px solid rgba(69,90,100,0.3)' },
  media_office:       { label:'Media & Office',        icon:MdMenuBook,       primaryColor:'#5D4037', backgroundColor:'#EFEBE9', border:'1px solid rgba(93,64,55,0.25)' },
};
const DEFAULT_STYLE: ShelfStyle = { label:'Other', icon:MdCategory, primaryColor:'#9E9E9E', backgroundColor:'#F5F5F5', border:'1px solid #ddd' };

function resolveImageUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${process.env.NEXT_PUBLIC_API_BASE || ''}${url}`;
}
function isStoreItem(v: unknown): v is StoreItem {
  return !!v && typeof v === 'object' && typeof (v as StoreItem).listing_id === 'string';
}

// ─── Content ──────────────────────────────────────────────────────────────────
function ArrangeStoreContent() {
  const searchParams = useSearchParams();
  const storeId      = searchParams.get('store_id') || '';

  const [items, setItems]           = useState<StoreItem[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [toast, setToast]           = useState('');

  const loadItems = async () => {
    setIsLoading(true);
    try {
      let sid = storeId;
      if (!sid) { const s = (await api.getMyStore()) as { store_id?:string }|null; sid = s?.store_id || ''; }
      if (sid) { const d = await api.getStoreItems(sid); setItems(Array.isArray(d) ? d.filter(isStoreItem) : []); }
      else setItems([]);
    } catch { setItems([]); } finally { setIsLoading(false); }
  };

  useEffect(() => { const t = setTimeout(loadItems, 0); return () => clearTimeout(t); }, []);

  const saveOrder = async (ids: string[]) => {
    try { await api.updateItemOrder(ids); showToast('Shelf saved ✓'); }
    catch { showToast('Failed to save'); }
  };

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2200); };

  const moveItem = async (index: number, dir: 'up' | 'down') => {
    const next = dir === 'up' ? index - 1 : index + 1;
    if (next < 0 || next >= items.length) return;
    const arr = [...items];
    const [moved] = arr.splice(index, 1);
    arr.splice(next, 0, moved);
    setItems(arr);
    await saveOrder(arr.map(i => i.listing_id));
  };

  if (isLoading) return (
    <main style={S.center}>
      <div style={S.spinner} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </main>
  );

  if (items.length === 0) return (
    <main style={S.center}>
      <MdImage size={48} color="#ccc" />
      <p style={{ color:'#999', marginTop:10, fontSize:14 }}>No items in your store yet.</p>
    </main>
  );

  return (
    <main style={S.container}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={S.header}>
        <h1 style={S.headerTitle}>Arrange Store</h1>
        <button style={S.saveBtn} onClick={() => saveOrder(items.map(i => i.listing_id))}>
          <MdSave size={18} color="#fff" />
          <span style={{ fontSize:13, fontWeight:600, color:'#fff', marginLeft:6 }}>Save</span>
        </button>
      </div>

      <div style={S.scrollArea}>
        {items.map((item, index) => {
          const cat    = item.category || '';
          const sh     = CATEGORY_STYLES[cat] || DEFAULT_STYLE;
          const prevCat = index > 0 ? items[index-1].category : null;
          const firstOfCat = cat !== prevCat;
          const imgUrl = resolveImageUrl(item.image_url);
          const title  = item.title || 'Untitled';
          const price  = item.price != null ? `₦${Number(item.price).toFixed(0)}` : '';

          return (
            <div key={item.listing_id}>
              {firstOfCat && (
                <div style={{ display:'flex', alignItems:'center', gap:6, marginTop: index===0?0:16, marginBottom:8 }}>
                  <div style={{ width:28, height:28, borderRadius:'50%', backgroundColor:sh.primaryColor, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <sh.icon size={15} color="#fff" />
                  </div>
                  <span style={{ fontSize:13, fontWeight:700, color:sh.primaryColor, letterSpacing:0.3 }}>{sh.label}</span>
                </div>
              )}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                backgroundColor: sh.backgroundColor,
                border: sh.border,
                borderRadius: 14,
                boxShadow: sh.boxShadow || '0 1px 4px rgba(0,0,0,0.06)',
                padding: '10px 10px 10px 10px',
                marginBottom: 8,
              }}>
                <div style={{
                  width: 56, height: 56,
                  minWidth: 56,
                  borderRadius: 10,
                  backgroundColor: '#fff',
                  border: '1px solid rgba(0,0,0,0.08)',
                  overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {imgUrl
                    ? <img src={imgUrl} alt={title} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    : <MdImage size={26} color="#CCCCCC" />
                  }
                </div>

                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{
                    fontSize: 14, fontWeight: 600, color: '#1A1A1A',
                    margin: 0, lineHeight: 1.35,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{title}</p>
                  {price && (
                    <p style={{ fontSize:13, fontWeight:700, color:sh.primaryColor, margin:'3px 0 0' }}>{price}</p>
                  )}
                </div>

                <div style={{ display:'flex', flexDirection:'column', gap:2, flexShrink:0 }}>
                  <button
                    onClick={() => moveItem(index, 'up')}
                    disabled={index === 0}
                    style={S.arrowBtn}
                    title="Move up"
                  >
                    <MdArrowUpward size={18} color={index === 0 ? '#D0D0D0' : sh.primaryColor} />
                  </button>
                  <button
                    onClick={() => moveItem(index, 'down')}
                    disabled={index === items.length - 1}
                    style={S.arrowBtn}
                    title="Move down"
                  >
                    <MdArrowDownward size={18} color={index === items.length-1 ? '#D0D0D0' : sh.primaryColor} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {toast && (
        <div style={S.toast}>{toast}</div>
      )}
    </main>
  );
}

export default function ArrangeStorePage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading store arrangement…</div>}>
      <ArrangeStoreContent />
    </Suspense>
  );
}

const S: Record<string, React.CSSProperties> = {
  container: { display:'flex', flexDirection:'column', height:'100vh', backgroundColor:'#F7F3EE' },
  center:    { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', backgroundColor:'#F7F3EE' },
  spinner:   { width:34, height:34, border:'4px solid #eee', borderTopColor:'#0504AA', borderRadius:'50%', animation:'spin 0.8s linear infinite' },
  header:    { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', backgroundColor:'#F7F3EE', borderBottom:'1px solid #E5DDD4' },
  headerTitle:{ fontSize:18, fontWeight:700, color:'#3E2723', margin:0 },
  saveBtn:   { display:'flex', alignItems:'center', backgroundColor:'#0504AA', border:'none', borderRadius:10, padding:'8px 14px', cursor:'pointer' },
  scrollArea:{ flex:1, overflowY:'auto', padding:'12px 16px' },
  arrowBtn:  { background:'none', border:'none', cursor:'pointer', padding:4, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:6 },
  toast:     { position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', backgroundColor:'#323232', color:'#fff', padding:'10px 20px', borderRadius:10, fontSize:13, fontWeight:500, zIndex:99, whiteSpace:'nowrap' },
};