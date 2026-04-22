import { useState, useEffect, useRef } from 'react';

// ─── CONFIG ────────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://maczzisuufzycdgfizeo.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hY3p6aXN1dWZ6eWNkZ2ZpemVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NTcwMDgsImV4cCI6MjA5MjQzMzAwOH0.WQBuMsYKwuW4VeRe6ZG_OA_rf59YfDVg327i4MObuFA';

// ─── SUPABASE CLIENT ───────────────────────────────────────────────────────────
const sb = {
  async signUp(email, password, username) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
      },
      // full_name → appears as "Display name" in Supabase Auth dashboard
      body: JSON.stringify({
        email,
        password,
        data: { username, full_name: username, display_name: username },
      }),
    });
    return r.json();
  },
  async signIn(email, password) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email, password }),
    });
    return r.json();
  },
  async getUser(token) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
    });
    return r.json();
  },
  signInWithGoogle() {
    const redirect = encodeURIComponent(
      window.location.origin + window.location.pathname,
    );
    window.location.href = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${redirect}`;
  },
  async getRooms(token) {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/rooms?order=created_at.asc`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: SUPABASE_ANON_KEY,
        },
      },
    );
    return r.json();
  },
  async getMessages(token, roomId) {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/messages?room_id=eq.${roomId}&order=created_at.asc&limit=100`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: SUPABASE_ANON_KEY,
        },
      },
    );
    return r.json();
  },
  async sendMessage(token, roomId, userId, username, content) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        room_id: roomId,
        user_id: userId,
        username,
        content,
      }),
    });
    return r.json();
  },
  async getAllDMs(token, userId) {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/direct_messages?or=(from_user_id.eq.${userId},to_user_id.eq.${userId})&order=created_at.desc&limit=300`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: SUPABASE_ANON_KEY,
        },
      },
    );
    return r.json();
  },
  async getDMThread(token, myId, otherId) {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/direct_messages?or=(and(from_user_id.eq.${myId},to_user_id.eq.${otherId}),and(from_user_id.eq.${otherId},to_user_id.eq.${myId}))&order=created_at.asc&limit=100`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: SUPABASE_ANON_KEY,
        },
      },
    );
    return r.json();
  },
  async sendDM(token, fromId, toId, fromUsername, toUsername, content) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/direct_messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        from_user_id: fromId,
        to_user_id: toId,
        from_username: fromUsername,
        to_username: toUsername,
        content,
      }),
    });
    return r.json();
  },
  async markDMsRead(token, fromId, toId) {
    await fetch(
      `${SUPABASE_URL}/rest/v1/direct_messages?from_user_id=eq.${fromId}&to_user_id=eq.${toId}&is_read=eq.false`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ is_read: true }),
      },
    );
  },
};

// ─── FALLBACK DATA ─────────────────────────────────────────────────────────────
const FALLBACK_ROOMS = [
  {
    id: '1',
    name: '🇬🇭 General',
    description: 'Open discussion for all Ghanaians',
  },
  { id: '2', name: '🎵 Highlife & Afrobeats', description: 'Music talk' },
  { id: '3', name: '⚽ Black Stars', description: 'Ghana football forever' },
  {
    id: '4',
    name: '💼 Business & Hustle',
    description: 'Entrepreneurship & opportunities',
  },
  {
    id: '5',
    name: '🍲 Food & Culture',
    description: 'Jollof, kelewele & more',
  },
  { id: '6', name: '🌍 Diaspora Connect', description: 'Ghanaians abroad' },
];

// ─── HELPERS ───────────────────────────────────────────────────────────────────
function getInitials(n) {
  return (n || '?').slice(0, 2).toUpperCase();
}
function timeAgo(iso) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return 'just now';
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}
function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
function avatarColor(name) {
  const c = [
    'linear-gradient(135deg,#D4AF37,#CE1126)',
    'linear-gradient(135deg,#006B3F,#D4AF37)',
    'linear-gradient(135deg,#CE1126,#006B3F)',
    'linear-gradient(135deg,#B8941F,#2D6A4F)',
    'linear-gradient(135deg,#2D2A22,#D4AF37)',
  ];
  let h = 0;
  for (let i = 0; i < (name || '').length; i++)
    h = (h * 31 + name.charCodeAt(i)) % c.length;
  return c[h];
}
function pwStrength(p) {
  if (!p) return 0;
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p)) s++;
  if (/[0-9]/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return s; // 0–4
}
function groupDMConversations(msgs, myId) {
  const map = new Map();
  msgs.forEach((m) => {
    const isFromMe = m.from_user_id === myId;
    const otherId = isFromMe ? m.to_user_id : m.from_user_id;
    const otherName = isFromMe ? m.to_username : m.from_username;
    if (!map.has(otherId)) {
      map.set(otherId, {
        userId: otherId,
        username: otherName,
        lastMsg: m,
        unread: 0,
      });
    } else {
      const ex = map.get(otherId);
      if (new Date(m.created_at) > new Date(ex.lastMsg.created_at))
        ex.lastMsg = m;
    }
    if (!isFromMe && !m.is_read) map.get(otherId).unread++;
  });
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.lastMsg.created_at) - new Date(a.lastMsg.created_at),
  );
}

// ─── STYLES ────────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=GFS+Didot&family=Outfit:wght@300;400;500;600;700&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  :root{
    --gold:#D4AF37;--gold-l:#F0CF6A;--gold-d:#B8941F;
    --red:#CE1126;--green:#006B3F;
    --bg:#FAFAF7;--sur:#FFFFFF;--sur2:#F5F3EE;--sur3:#EEEADE;
    --bdr:#E8E3D8;--txt:#1A1A1A;--soft:#6B6560;--muted:#9E9890;
  }
  body{background:var(--bg);color:var(--txt);font-family:'Outfit',sans-serif}
  ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:var(--gold);border-radius:10px}

  .kente{height:4px;background:repeating-linear-gradient(90deg,var(--red) 0,var(--red) 16px,var(--gold) 16px,var(--gold) 32px,var(--green) 32px,var(--green) 48px,#1A1A1A 48px,#1A1A1A 64px)}

  /* ── BUTTONS ── */
  .btn{padding:9px 20px;border-radius:100px;border:none;cursor:pointer;font-family:'Outfit',sans-serif;font-size:.875rem;font-weight:500;transition:all .2s}
  .btn-ghost{background:transparent;color:var(--soft)}.btn-ghost:hover{background:var(--sur2);color:var(--txt)}
  .btn-gold{background:var(--gold);color:#fff;box-shadow:0 2px 8px rgba(212,175,55,.35)}.btn-gold:hover{background:var(--gold-d);transform:translateY(-1px)}.btn-gold:disabled{opacity:.6;cursor:not-allowed;transform:none}
  .btn-outline{background:transparent;color:var(--txt);border:1.5px solid var(--bdr)}.btn-outline:hover{border-color:var(--gold);color:var(--gold)}
  .btn-google{
    width:100%;padding:11px 16px;border-radius:12px;border:1.5px solid #dadce0;
    background:#fff;color:#3c4043;font-family:'Outfit',sans-serif;font-size:.875rem;font-weight:500;
    cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;
    transition:all .2s;margin-bottom:14px;
  }
  .btn-google:hover{background:#f8f9fa;border-color:#c6c6c6;box-shadow:0 1px 6px rgba(0,0,0,.1)}
  .divider{display:flex;align-items:center;gap:12px;margin-bottom:16px;color:var(--muted);font-size:.75rem}
  .divider::before,.divider::after{content:'';flex:1;height:1px;background:var(--bdr)}

  /* ── NAV ── */
  .nav{position:sticky;top:0;z-index:100;background:rgba(250,250,247,.92);backdrop-filter:blur(16px);border-bottom:1px solid var(--bdr);padding:0 24px;height:64px;display:flex;align-items:center;justify-content:space-between}
  .nav-logo{font-family:'GFS Didot',serif;font-size:1.4rem;font-weight:900;letter-spacing:-.5px}.nav-logo span{color:var(--gold)}
  .nav-actions{display:flex;gap:10px;align-items:center}

  /* ── HERO ── */
  .hero{min-height:92vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:60px 24px 80px;background:radial-gradient(ellipse 80% 50% at 50% -10%,rgba(212,175,55,.12) 0%,transparent 70%),var(--bg)}
  .hero-badge{display:inline-flex;align-items:center;gap:8px;background:var(--sur);border:1px solid var(--bdr);padding:6px 16px;border-radius:100px;font-size:.8rem;font-weight:500;color:var(--soft);margin-bottom:28px;animation:fadeUp .6s ease both}
  .hero-badge .dot{width:7px;height:7px;border-radius:50%;background:var(--green);animation:pulse 2s infinite}
  @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.4)}}
  .hero-title{font-family:'GFS Didot',serif;font-size:clamp(2.8rem,8vw,5.5rem);font-weight:900;line-height:1.05;letter-spacing:-2px;max-width:820px;animation:fadeUp .7s .1s ease both}
  .hero-title .accent{color:var(--gold);position:relative;display:inline-block}
  .hero-title .accent::after{content:'';position:absolute;bottom:-4px;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--red),var(--gold),var(--green));border-radius:2px}
  .hero-sub{font-size:clamp(1rem,2.5vw,1.2rem);color:var(--soft);max-width:520px;line-height:1.7;margin-top:20px;animation:fadeUp .7s .2s ease both}
  .hero-cta{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin-top:40px;animation:fadeUp .7s .3s ease both}
  .btn-hero{padding:14px 32px;font-size:1rem;border-radius:100px;font-weight:600}
  .hero-stats{display:flex;flex-wrap:wrap;gap:40px;justify-content:center;margin-top:64px;animation:fadeUp .7s .4s ease both}
  .stat-num{font-family:'GFS Didot',serif;font-size:2.2rem;font-weight:700}.stat-label{font-size:.8rem;color:var(--muted);margin-top:2px;text-transform:uppercase;letter-spacing:.08em}

  /* ── LANDING SECTIONS ── */
  .section{padding:80px 24px;max-width:1100px;margin:0 auto}
  .section-tag{display:inline-block;font-size:.75rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--gold);margin-bottom:12px}
  .section-title{font-family:'GFS Didot',serif;font-size:clamp(1.8rem,4vw,2.8rem);font-weight:700;line-height:1.2;max-width:600px}
  .features-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;margin-top:48px}
  .feature-card{background:var(--sur);border:1px solid var(--bdr);border-radius:20px;padding:28px;transition:all .3s;position:relative;overflow:hidden}
  .feature-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--red),var(--gold),var(--green));opacity:0;transition:opacity .3s}
  .feature-card:hover{box-shadow:0 8px 32px rgba(0,0,0,.08);transform:translateY(-2px)}.feature-card:hover::before{opacity:1}
  .feature-icon{font-size:2rem;margin-bottom:16px;width:52px;height:52px;display:flex;align-items:center;justify-content:center;background:var(--sur2);border-radius:14px}
  .feature-name{font-size:1rem;font-weight:600;margin-bottom:8px}.feature-desc{font-size:.875rem;color:var(--soft);line-height:1.6}
  .feature-coming{opacity:.6}.badge-soon{position:absolute;top:12px;right:12px;background:var(--sur2);border:1px solid var(--bdr);font-size:.65rem;padding:2px 8px;border-radius:100px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.05em}
  .rooms-preview{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px;margin-top:40px}
  .room-card{background:var(--sur);border:1px solid var(--bdr);border-radius:16px;padding:20px;cursor:pointer;transition:all .25s;display:flex;align-items:flex-start;gap:14px}
  .room-card:hover{border-color:var(--gold);box-shadow:0 4px 20px rgba(212,175,55,.15);transform:translateY(-2px)}
  .room-icon{font-size:1.5rem}.room-name{font-weight:600;font-size:.925rem}.room-desc{font-size:.8rem;color:var(--muted);margin-top:3px}.room-users{font-size:.75rem;color:var(--green);margin-top:8px;font-weight:500}
  .cta-section{background:linear-gradient(135deg,#1A1A1A 0%,#2D2A22 100%);margin:0 24px 80px;border-radius:28px;padding:64px 40px;text-align:center;position:relative;overflow:hidden}
  .cta-section::before{content:'';position:absolute;top:-50%;left:-20%;right:-20%;bottom:-50%;background:radial-gradient(ellipse at center,rgba(212,175,55,.15) 0%,transparent 60%)}
  .cta-section *{position:relative}
  .cta-title{font-family:'GFS Didot',serif;font-size:clamp(1.8rem,4vw,2.8rem);font-weight:700;color:#fff;max-width:600px;margin:0 auto 16px}
  .cta-sub{color:rgba(255,255,255,.6);font-size:1rem;margin-bottom:32px}
  .footer{border-top:1px solid var(--bdr);padding:40px 24px;display:flex;flex-wrap:wrap;gap:20px;justify-content:space-between;align-items:center;font-size:.875rem;color:var(--muted)}
  .footer-logo{font-family:'GFS Didot',serif;font-weight:700;font-size:1.1rem;color:var(--txt)}.footer-logo span{color:var(--gold)}
  .footer-links{display:flex;gap:20px}.footer-links a{color:var(--muted);text-decoration:none;transition:color .2s}.footer-links a:hover{color:var(--gold)}

  /* ── MODAL ── */
  .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;z-index:1000;padding:20px;animation:fadeIn .2s ease}
  .modal{background:var(--sur);border-radius:24px;padding:36px 32px;width:100%;max-width:420px;box-shadow:0 24px 80px rgba(0,0,0,.2);animation:slideUp .3s ease;position:relative;max-height:90vh;overflow-y:auto}
  .modal-close{position:absolute;top:16px;right:16px;width:32px;height:32px;border-radius:50%;border:none;background:var(--sur2);cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;transition:background .2s}.modal-close:hover{background:var(--bdr)}
  .modal-logo{font-family:'GFS Didot',serif;font-size:1.6rem;font-weight:900;text-align:center;margin-bottom:6px}.modal-logo span{color:var(--gold)}
  .modal-sub{text-align:center;color:var(--muted);font-size:.875rem;margin-bottom:24px}
  .modal-tabs{display:flex;background:var(--sur2);border-radius:12px;padding:4px;margin-bottom:20px}
  .modal-tab{flex:1;padding:8px;text-align:center;border:none;background:transparent;border-radius:9px;cursor:pointer;font-family:'Outfit',sans-serif;font-size:.875rem;font-weight:500;color:var(--muted);transition:all .2s}
  .modal-tab.active{background:var(--sur);color:var(--txt);box-shadow:0 1px 4px rgba(0,0,0,.08)}
  .form-group{margin-bottom:14px}
  .form-label{font-size:.8rem;font-weight:600;color:var(--soft);margin-bottom:5px;display:block}
  .form-input{width:100%;padding:11px 14px;border:1.5px solid var(--bdr);border-radius:12px;font-family:'Outfit',sans-serif;font-size:.9rem;background:var(--bg);color:var(--txt);transition:border-color .2s,box-shadow .2s;outline:none}
  .form-input:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(212,175,55,.12)}
  .pw-wrap{position:relative}.pw-toggle{position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--muted);font-size:.8rem;padding:2px 6px}
  .pw-bar{height:3px;border-radius:2px;margin-top:6px;transition:all .3s;background:var(--bdr)}
  .pw-bar-fill{height:100%;border-radius:2px;transition:all .3s}
  .pw-hint{font-size:.72rem;color:var(--muted);margin-top:4px}
  .form-check{display:flex;align-items:center;gap:8px;margin-bottom:16px}
  .form-check input{accent-color:var(--gold);width:15px;height:15px}
  .form-check label{font-size:.85rem;color:var(--soft);cursor:pointer}
  .form-error{font-size:.8rem;color:var(--red);margin-top:6px;background:rgba(206,17,38,.06);padding:8px 12px;border-radius:8px}
  .form-success{font-size:.8rem;color:var(--green);margin-top:6px;background:rgba(0,107,63,.06);padding:8px 12px;border-radius:8px}
  .btn-full{width:100%;padding:13px;font-size:.95rem;border-radius:14px}
  .terms-note{font-size:.75rem;color:var(--muted);text-align:center;margin-top:14px;line-height:1.5}
  .terms-note a{color:var(--gold);text-decoration:none}

  /* ── APP LAYOUT ── */
  .app-layout{display:flex;height:100vh;overflow:hidden;background:var(--bg)}

  /* ── SIDEBAR ── */
  .sidebar{width:300px;flex-shrink:0;background:var(--sur);border-right:1px solid var(--bdr);display:flex;flex-direction:column;transition:transform .3s}
  .sidebar-top{padding:0 20px;border-bottom:1px solid var(--bdr)}
  .sidebar-brand{display:flex;align-items:center;justify-content:space-between;height:58px}
  .sidebar-logo{font-family:'GFS Didot',serif;font-weight:900;font-size:1.1rem}.sidebar-logo span{color:var(--gold)}
  .profile-card{background:linear-gradient(135deg,#1A1A1A,#2D2A22);border-radius:16px;padding:16px;margin:0 0 14px;position:relative;overflow:hidden}
  .profile-card::before{content:'';position:absolute;top:-30px;right:-30px;width:100px;height:100px;border-radius:50%;background:rgba(212,175,55,.15)}
  .profile-avatar{width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1rem;color:#fff;border:2px solid rgba(212,175,55,.5);margin-bottom:8px;position:relative}
  .profile-name{font-weight:700;font-size:.9rem;color:#fff}.profile-joined{font-size:.7rem;color:rgba(212,175,55,.8);margin-top:6px}
  .online-pill{display:inline-flex;align-items:center;gap:5px;background:rgba(0,107,63,.25);color:#4ade80;font-size:.7rem;font-weight:600;padding:3px 10px;border-radius:100px;margin-top:6px}
  .online-pill::before{content:'';width:6px;height:6px;background:#4ade80;border-radius:50%}

  /* ── SIDEBAR TABS ── */
  .sidebar-tabs{display:flex;padding:8px 10px 0;gap:4px;border-bottom:1px solid var(--bdr)}
  .stab{flex:1;padding:8px 4px;border:none;background:transparent;cursor:pointer;font-family:'Outfit',sans-serif;font-size:.78rem;font-weight:600;color:var(--muted);border-bottom:2px solid transparent;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:5px;margin-bottom:-1px}
  .stab.active{color:var(--gold-d);border-bottom-color:var(--gold)}
  .stab:hover:not(.active){color:var(--txt)}
  .unread-badge{background:var(--red);color:#fff;font-size:.65rem;font-weight:700;min-width:18px;height:18px;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;padding:0 5px}

  /* ── ROOM LIST ── */
  .sidebar-section-label{padding:12px 20px 5px;font-size:.68rem;font-weight:700;color:var(--muted);letter-spacing:.12em;text-transform:uppercase}
  .rooms-list{flex:1;overflow-y:auto;padding:4px 10px}
  .room-item{display:flex;align-items:center;gap:10px;padding:9px 12px;cursor:pointer;transition:background .15s;border-radius:10px;border:none;background:transparent;width:100%;text-align:left;margin-bottom:2px}
  .room-item:hover{background:var(--sur2)}.room-item.active{background:rgba(212,175,55,.12)}
  .room-item.active .room-item-name{color:var(--gold-d);font-weight:600}
  .room-item-icon{font-size:1.1rem;flex-shrink:0;width:28px;text-align:center}
  .room-item-name{font-size:.875rem;color:var(--txt)}

  /* ── DM LIST ── */
  .dm-list{flex:1;overflow-y:auto;padding:4px 10px}
  .dm-item{display:flex;align-items:center;gap:10px;padding:10px 12px;cursor:pointer;transition:background .15s;border-radius:10px;border:none;background:transparent;width:100%;text-align:left;margin-bottom:2px}
  .dm-item:hover{background:var(--sur2)}.dm-item.active{background:rgba(212,175,55,.12)}
  .dm-av{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.65rem;color:#fff;flex-shrink:0}
  .dm-info{flex:1;min-width:0}
  .dm-name{font-size:.85rem;font-weight:600;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .dm-preview{font-size:.73rem;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}
  .dm-meta{display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0}
  .dm-time{font-size:.68rem;color:var(--muted)}
  .dm-empty{padding:20px 16px;text-align:center;color:var(--muted);font-size:.8rem;line-height:1.6}
  .dm-empty .dm-empty-icon{font-size:2rem;margin-bottom:8px}

  /* ── SIDEBAR FOOTER ── */
  .sidebar-footer{padding:12px 20px;border-top:1px solid var(--bdr)}
  .signout-btn{width:100%;padding:9px;border-radius:10px;border:1.5px solid var(--bdr);background:transparent;color:var(--soft);font-family:'Outfit',sans-serif;font-size:.8rem;font-weight:500;cursor:pointer;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:8px}
  .signout-btn:hover{border-color:var(--red);color:var(--red);background:rgba(206,17,38,.04)}

  /* ── CHAT AREA ── */
  .chat-area{flex:1;display:flex;flex-direction:column;min-width:0;background:var(--bg)}
  .chat-header{padding:12px 24px;border-bottom:1px solid var(--bdr);background:var(--sur);display:flex;align-items:center;gap:14px;box-shadow:0 1px 4px rgba(0,0,0,.04)}
  .chat-room-icon{font-size:1.5rem}
  .chat-header-info{flex:1}
  .chat-room-name{font-weight:700;font-size:.95rem}.chat-room-desc{font-size:.75rem;color:var(--muted)}
  .chat-header-right{display:flex;align-items:center;gap:8px}
  .member-count{font-size:.75rem;color:var(--muted);background:var(--sur2);padding:4px 10px;border-radius:100px}
  .back-btn{padding:6px 10px;background:var(--sur2);border:none;border-radius:8px;cursor:pointer;color:var(--soft);font-size:.8rem;display:flex;align-items:center;gap:4px;transition:background .2s}.back-btn:hover{background:var(--bdr)}

  /* ── NOTIF BANNER ── */
  .notif-banner{margin:14px 24px 0;background:linear-gradient(135deg,#1A1A1A,#2D2A22);border-radius:14px;padding:12px 16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;animation:fadeUp .3s ease}
  .notif-banner-text{color:#fff;font-size:.8rem;flex:1}.notif-banner-text strong{color:var(--gold)}
  .notif-enable-btn{padding:6px 14px;border-radius:100px;background:var(--gold);color:#1a1a1a;border:none;cursor:pointer;font-family:'Outfit',sans-serif;font-size:.75rem;font-weight:600;transition:background .2s;white-space:nowrap}
  .notif-enable-btn:hover{background:var(--gold-l)}
  .notif-dismiss{background:none;border:none;color:rgba(255,255,255,.4);cursor:pointer;font-size:1rem;padding:2px 6px;transition:color .2s}.notif-dismiss:hover{color:#fff}

  /* ── WELCOME BANNER ── */
  .welcome-banner{margin:16px 24px 0;background:linear-gradient(135deg,#1A1A1A,#2D2A22);border-radius:14px;padding:18px 22px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
  .welcome-text{color:#fff}.welcome-text h3{font-family:'GFS Didot',serif;font-size:1rem;margin-bottom:3px}.welcome-text p{font-size:.78rem;color:rgba(255,255,255,.55)}
  .welcome-kente{height:3px;border-radius:2px;margin-top:10px;background:repeating-linear-gradient(90deg,var(--red) 0,var(--red) 12px,var(--gold) 12px,var(--gold) 24px,var(--green) 24px,var(--green) 36px,#fff 36px,#fff 48px)}

  /* ── MESSAGES ── */
  .messages-area{flex:1;overflow-y:auto;padding:16px 24px;display:flex;flex-direction:column;gap:2px}
  .msg-date-divider{text-align:center;font-size:.72rem;color:var(--muted);margin:10px 0;display:flex;align-items:center;gap:12px}
  .msg-date-divider::before,.msg-date-divider::after{content:'';flex:1;height:1px;background:var(--bdr)}
  .msg-group{margin-bottom:12px}
  .msg-sender-row{display:flex;align-items:center;gap:8px;margin-bottom:4px}
  .msg-avatar{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.6rem;color:#fff;flex-shrink:0}
  .msg-sender-name{font-size:.75rem;font-weight:600;color:var(--soft);cursor:pointer;transition:color .15s}.msg-sender-name:hover{color:var(--gold-d)}
  .msg-sender-time{font-size:.7rem;color:var(--muted)}
  .msg-row{display:flex;align-items:flex-start;gap:10px}
  .msg-bubble{background:var(--sur);border:1px solid var(--bdr);border-radius:4px 16px 16px 16px;padding:9px 13px;max-width:560px;font-size:.875rem;line-height:1.55;color:var(--txt);box-shadow:0 1px 3px rgba(0,0,0,.04);animation:fadeUp .15s ease}
  .msg-bubble.own{background:linear-gradient(135deg,var(--gold),#E8C040);border-color:transparent;color:#1A1A1A;border-radius:16px 4px 16px 16px;margin-left:auto}
  .msg-own-row{justify-content:flex-end}
  .msg-indent{margin-left:36px}
  .msg-time-small{font-size:.67rem;color:var(--muted);margin-top:2px}
  .msg-avatar-clickable{cursor:pointer;transition:opacity .15s}.msg-avatar-clickable:hover{opacity:.8}

  /* ── CHAT INPUT ── */
  .chat-input-area{padding:12px 24px;background:var(--sur);border-top:1px solid var(--bdr);display:flex;align-items:center;gap:10px}
  .chat-input{flex:1;padding:10px 18px;border:1.5px solid var(--bdr);border-radius:100px;font-family:'Outfit',sans-serif;font-size:.875rem;background:var(--bg);color:var(--txt);outline:none;transition:border-color .2s}
  .chat-input:focus{border-color:var(--gold)}
  .send-btn{width:40px;height:40px;border-radius:50%;background:var(--gold);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;flex-shrink:0;box-shadow:0 2px 8px rgba(212,175,55,.4)}
  .send-btn:hover{background:var(--gold-d);transform:scale(1.06)}.send-btn:disabled{opacity:.5;cursor:not-allowed;transform:none}
  .send-btn svg{width:15px;height:15px;fill:#fff}

  /* ── PROFILE POPUP ── */
  .profile-popup-overlay{position:fixed;inset:0;z-index:500;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.3);backdrop-filter:blur(4px);animation:fadeIn .15s ease}
  .profile-popup{background:var(--sur);border-radius:20px;padding:28px 24px;width:100%;max-width:320px;box-shadow:0 16px 60px rgba(0,0,0,.18);animation:slideUp .2s ease;position:relative}
  .pp-close{position:absolute;top:12px;right:12px;width:28px;height:28px;border-radius:50%;border:none;background:var(--sur2);cursor:pointer;font-size:.875rem;display:flex;align-items:center;justify-content:center;transition:background .2s}.pp-close:hover{background:var(--bdr)}
  .pp-avatar{width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1.4rem;color:#fff;margin:0 auto 12px;border:3px solid var(--sur)}
  .pp-name{font-weight:700;font-size:1.1rem;text-align:center}
  .pp-username{font-size:.8rem;color:var(--muted);text-align:center;margin-top:2px}
  .pp-joined{font-size:.75rem;color:var(--soft);text-align:center;margin-top:6px}
  .pp-actions{display:flex;gap:8px;margin-top:16px}
  .pp-dm-btn{flex:1;padding:9px;border-radius:12px;background:var(--gold);color:#fff;border:none;cursor:pointer;font-family:'Outfit',sans-serif;font-size:.85rem;font-weight:600;transition:all .2s}
  .pp-dm-btn:hover{background:var(--gold-d)}

  /* ── LOADING / EMPTY ── */
  .loading-dots{display:flex;gap:4px;align-items:center;justify-content:center;padding:20px}
  .loading-dots span{width:7px;height:7px;border-radius:50%;background:var(--gold);animation:bounce .8s ease infinite}
  .loading-dots span:nth-child(2){animation-delay:.15s}.loading-dots span:nth-child(3){animation-delay:.3s}
  @keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-8px)}}
  .empty-state{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--muted);text-align:center;padding:40px;gap:10px}
  .empty-state .big-emoji{font-size:3rem}

  /* ── TOAST ── */
  .toast{position:fixed;bottom:24px;right:24px;background:#1A1A1A;color:#fff;padding:12px 20px;border-radius:12px;font-size:.875rem;z-index:9999;animation:slideUp .3s ease;box-shadow:0 8px 32px rgba(0,0,0,.2);max-width:320px}
  .toast.success{background:var(--green)}.toast.error{background:var(--red)}

  /* ── MOBILE ── */
  .hamburger{display:none;background:none;border:none;cursor:pointer;flex-direction:column;gap:5px;padding:4px}
  .hamburger span{display:block;width:22px;height:2px;background:var(--txt);border-radius:2px}
  .sidebar-overlay{display:none}
  @media(max-width:700px){
    .sidebar{position:fixed;left:0;top:0;bottom:0;z-index:200;transform:translateX(-100%)}
    .sidebar.open{transform:translateX(0);box-shadow:4px 0 24px rgba(0,0,0,.15)}
    .hamburger{display:flex}
    .sidebar-overlay{display:block;position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:199;opacity:0;pointer-events:none;transition:opacity .3s}
    .sidebar-overlay.visible{opacity:1;pointer-events:all}
    .chat-header{padding:10px 14px}.chat-input-area{padding:10px 14px}
    .messages-area{padding:12px 14px}.welcome-banner{margin:10px 14px 0}
    .notif-banner{margin:10px 14px 0}
    .cta-section{margin:0 12px 60px;padding:48px 24px}
  }

  /* ── ANIMATIONS ── */
  @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes slideUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
`;

// ─── TOAST ─────────────────────────────────────────────────────────────────────
function Toast({ msg, type, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, []);
  return <div className={`toast ${type}`}>{msg}</div>;
}

// ─── USER PROFILE POPUP ────────────────────────────────────────────────────────
function UserProfilePopup({ profile, myUsername, onDm, onClose }) {
  return (
    <div
      className="profile-popup-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="profile-popup">
        <button className="pp-close" onClick={onClose}>
          ✕
        </button>
        <div
          className="pp-avatar"
          style={{ background: avatarColor(profile.username) }}
        >
          {getInitials(profile.username)}
        </div>
        <div className="pp-name">{profile.username}</div>
        <div className="pp-username">@{profile.username}</div>
        {profile.joinedAt && (
          <div className="pp-joined">
            Member since {formatDate(profile.joinedAt)}
          </div>
        )}
        {profile.username !== myUsername && (
          <div className="pp-actions">
            <button className="pp-dm-btn" onClick={onDm}>
              💬 Send Message
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── AUTH MODAL ────────────────────────────────────────────────────────────────
function AuthModal({ onClose, onAuth, defaultTab = 'login' }) {
  const [tab, setTab] = useState(defaultTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [username, setUsername] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [stayIn, setStayIn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const strength = pwStrength(password);
  const strengthColors = ['#bbb', '#CE1126', '#f59e0b', '#D4AF37', '#006B3F'];
  const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong'];

  async function handleSubmit() {
    setError('');
    setSuccess('');
    if (tab === 'signup') {
      if (!username.trim()) {
        setError('Please choose a username');
        return;
      }
      if (username.trim().length < 3) {
        setError('Username must be at least 3 characters');
        return;
      }
      if (password !== confirmPw) {
        setError('Passwords do not match');
        return;
      }
      if (strength < 2) {
        setError('Please choose a stronger password');
        return;
      }
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const data =
        tab === 'login'
          ? await sb.signIn(email, password)
          : await sb.signUp(email, password, username);

      const errMsg = data.error?.message || data.error_description || data.msg;
      if (errMsg) {
        setError(errMsg);
        setLoading(false);
        return;
      }

      if (!data.access_token) {
        setSuccess(
          'Account created! Check your email to confirm, then sign in.',
        );
        setLoading(false);
        return;
      }

      const user = data.user;
      if (!user.user_metadata) user.user_metadata = {};
      if (!user.user_metadata.username) {
        user.user_metadata.username =
          tab === 'signup'
            ? username
            : user.user_metadata.full_name || email.split('@')[0];
      }
      const store = stayIn ? localStorage : sessionStorage;
      store.setItem('gchat_token', data.access_token);
      store.setItem('gchat_user', JSON.stringify(user));
      onAuth(user, data.access_token);
    } catch {
      setError('Network error — please check your connection.');
    }
    setLoading(false);
  }

  function switchTab(t) {
    setTab(t);
    setError('');
    setSuccess('');
  }

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal">
        <button className="modal-close" onClick={onClose}>
          ✕
        </button>
        <div className="modal-logo">
          Kasa<span>Point</span>
        </div>
        <p className="modal-sub">
          {tab === 'login'
            ? "Welcome back, m'adamfo!"
            : "Join Ghana's favourite chat platform"}
        </p>

        <button className="btn-google" onClick={() => sb.signInWithGoogle()}>
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </button>
        <div className="divider">or</div>

        <div className="modal-tabs">
          <button
            className={`modal-tab ${tab === 'login' ? 'active' : ''}`}
            onClick={() => switchTab('login')}
          >
            Sign In
          </button>
          <button
            className={`modal-tab ${tab === 'signup' ? 'active' : ''}`}
            onClick={() => switchTab('signup')}
          >
            Create Account
          </button>
        </div>

        {tab === 'signup' && (
          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              className="form-input"
              placeholder="e.g. KofiAccra"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
        )}
        <div className="form-group">
          <label className="form-label">Email Address</label>
          <input
            className="form-input"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Password</label>
          <div className="pw-wrap">
            <input
              className="form-input"
              type={showPw ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) =>
                e.key === 'Enter' && !e.shiftKey && handleSubmit()
              }
              style={{ paddingRight: 52 }}
            />
            <button
              className="pw-toggle"
              type="button"
              onClick={() => setShowPw((v) => !v)}
            >
              {showPw ? '🙈' : '👁'}
            </button>
          </div>
          {tab === 'signup' && password.length > 0 && (
            <>
              <div className="pw-bar">
                <div
                  className="pw-bar-fill"
                  style={{
                    width: `${strength * 25}%`,
                    background: strengthColors[strength],
                  }}
                />
              </div>
              <div
                className="pw-hint"
                style={{ color: strengthColors[strength] }}
              >
                {strengthLabels[strength]}
              </div>
            </>
          )}
        </div>
        {tab === 'signup' && (
          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <div className="pw-wrap">
              <input
                className="form-input"
                type={showPw ? 'text' : 'password'}
                placeholder="••••••••"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                style={{
                  paddingRight: 52,
                  borderColor:
                    confirmPw && confirmPw !== password
                      ? 'var(--red)'
                      : undefined,
                }}
              />
            </div>
          </div>
        )}

        {error && <div className="form-error">⚠ {error}</div>}
        {success && <div className="form-success">✓ {success}</div>}

        <div className="form-check" style={{ marginTop: 12 }}>
          <input
            type="checkbox"
            id="stay"
            checked={stayIn}
            onChange={(e) => setStayIn(e.target.checked)}
          />
          <label htmlFor="stay">Stay signed in on this device</label>
        </div>

        <button
          className="btn btn-gold btn-full"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading
            ? 'Please wait...'
            : tab === 'login'
              ? 'Sign In'
              : 'Create Account'}
        </button>
        <p className="terms-note">
          By continuing you agree to our <a href="#">Terms</a> &amp;{' '}
          <a href="#">Privacy Policy</a>
        </p>
      </div>
    </div>
  );
}

// ─── CHAT SCREEN ───────────────────────────────────────────────────────────────
function ChatScreen({ user, token, onLogout }) {
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [sidebarTab, setSidebarTab] = useState('rooms'); // 'rooms' | 'dms'
  const [dmConversations, setDmConversations] = useState([]);
  const [activeDm, setActiveDm] = useState(null); // { userId, username }
  const [dmMessages, setDmMessages] = useState([]);
  const [view, setView] = useState('room'); // 'room' | 'dm'
  const [input, setInput] = useState('');
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profilePopup, setProfilePopup] = useState(null);
  const [notifDismissed, setNotifDismissed] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);
  const bottomRef = useRef(null);
  const roomPollRef = useRef(null);
  const dmPollRef = useRef(null);
  const knownDmIds = useRef(new Set());
  const notifPermission =
    typeof Notification !== 'undefined' ? Notification.permission : 'denied';

  const username =
    user?.user_metadata?.username ||
    user?.user_metadata?.full_name ||
    user?.email?.split('@')[0] ||
    'User';
  const joinedDate = user?.created_at ? formatDate(user.created_at) : null;

  function showBrowserNotif(title, body) {
    if (
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted' &&
      document.hidden
    ) {
      const n = new Notification(title, { body });
      n.onclick = () => window.focus();
    }
  }

  function requestNotifPermission() {
    if (
      typeof Notification !== 'undefined' &&
      Notification.permission === 'default'
    ) {
      Notification.requestPermission();
    }
  }

  // Load rooms
  useEffect(() => {
    async function load() {
      try {
        const data = await sb.getRooms(token);
        const list =
          Array.isArray(data) && data.length > 0 ? data : FALLBACK_ROOMS;
        setRooms(list);
        setActiveRoom(list[0]);
      } catch {
        setRooms(FALLBACK_ROOMS);
        setActiveRoom(FALLBACK_ROOMS[0]);
      }
      setLoadingRooms(false);
    }
    load();
  }, [token]);

  // Poll room messages
  useEffect(() => {
    if (!activeRoom || view !== 'room') return;
    clearInterval(roomPollRef.current);
    async function fetch() {
      try {
        const data = await sb.getMessages(token, activeRoom.id);
        if (Array.isArray(data)) setMessages(data);
      } catch {}
    }
    setLoadingMsgs(true);
    setMessages([]);
    fetch().then(() => setLoadingMsgs(false));
    roomPollRef.current = setInterval(fetch, 3000);
    return () => clearInterval(roomPollRef.current);
  }, [activeRoom, token, view]);

  // Poll DMs
  useEffect(() => {
    clearInterval(dmPollRef.current);
    async function fetchDMs() {
      try {
        const data = await sb.getAllDMs(token, user.id);
        if (!Array.isArray(data)) return;
        const convs = groupDMConversations(data, user.id);
        setDmConversations(convs);
        const unread = convs.reduce((s, c) => s + c.unread, 0);
        setTotalUnread(unread);

        // Detect new incoming DMs for notifications
        const newMsgs = data.filter(
          (m) => m.to_user_id === user.id && !knownDmIds.current.has(m.id),
        );
        newMsgs.forEach((m) => {
          if (!knownDmIds.current.has(m.id)) {
            knownDmIds.current.add(m.id);
            showBrowserNotif(`New message from ${m.from_username}`, m.content);
          }
        });
        // Initialize known IDs on first load
        if (knownDmIds.current.size === 0) {
          data.forEach((m) => knownDmIds.current.add(m.id));
        }
      } catch {}
    }
    fetchDMs();
    dmPollRef.current = setInterval(fetchDMs, 4000);
    return () => clearInterval(dmPollRef.current);
  }, [token, user.id]);

  // Poll active DM thread
  useEffect(() => {
    if (!activeDm || view !== 'dm') return;
    async function fetchThread() {
      try {
        const data = await sb.getDMThread(token, user.id, activeDm.userId);
        if (Array.isArray(data)) setDmMessages(data);
      } catch {}
    }
    setDmMessages([]);
    fetchThread();
    const t = setInterval(fetchThread, 3000);
    // Mark read when opening conversation
    sb.markDMsRead(token, activeDm.userId, user.id).catch(() => {});
    return () => clearInterval(t);
  }, [activeDm, view, token, user.id]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, dmMessages]);

  async function sendMessage() {
    const content = input.trim();
    if (!content || sending) return;
    setInput('');
    setSending(true);
    if (view === 'room' && activeRoom) {
      const opt = {
        id: `opt-${Date.now()}`,
        username,
        content,
        created_at: new Date().toISOString(),
        optimistic: true,
      };
      setMessages((p) => [...p, opt]);
      try {
        await sb.sendMessage(token, activeRoom.id, user.id, username, content);
        const fresh = await sb.getMessages(token, activeRoom.id);
        if (Array.isArray(fresh)) setMessages(fresh);
      } catch {}
    } else if (view === 'dm' && activeDm) {
      const opt = {
        id: `opt-${Date.now()}`,
        from_user_id: user.id,
        from_username: username,
        content,
        created_at: new Date().toISOString(),
      };
      setDmMessages((p) => [...p, opt]);
      try {
        await sb.sendDM(
          token,
          user.id,
          activeDm.userId,
          username,
          activeDm.username,
          content,
        );
        const fresh = await sb.getDMThread(token, user.id, activeDm.userId);
        if (Array.isArray(fresh)) setDmMessages(fresh);
      } catch {}
    }
    setSending(false);
  }

  function openDm(userId, uname) {
    setActiveDm({ userId, username: uname });
    setView('dm');
    setSidebarTab('dms');
    setProfilePopup(null);
    setSidebarOpen(false);
  }

  function groupMessages(msgs) {
    const groups = [];
    let i = 0;
    while (i < msgs.length) {
      const g = {
        sender: msgs[i].username,
        messages: [msgs[i]],
        date: msgs[i].created_at,
        userId: msgs[i].user_id,
      };
      while (i + 1 < msgs.length && msgs[i + 1].username === msgs[i].username) {
        i++;
        g.messages.push(msgs[i]);
      }
      groups.push(g);
      i++;
    }
    return groups;
  }

  const grouped = groupMessages(view === 'room' ? messages : []);
  const showNotifBanner = !notifDismissed && notifPermission === 'default';

  return (
    <div className="app-layout">
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {profilePopup && (
        <UserProfilePopup
          profile={profilePopup}
          myUsername={username}
          onDm={() =>
            profilePopup.userId &&
            openDm(profilePopup.userId, profilePopup.username)
          }
          onClose={() => setProfilePopup(null)}
        />
      )}

      {/* ── SIDEBAR ── */}
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="kente" />
        <div className="sidebar-top">
          <div className="sidebar-brand">
            <span className="sidebar-logo">
              Kasa<span>Point</span>
            </span>
          </div>
          <div className="profile-card">
            <div
              className="profile-avatar"
              style={{ background: avatarColor(username) }}
            >
              {getInitials(username)}
            </div>
            <div className="profile-name">{username}</div>
            {joinedDate && (
              <div className="profile-joined">Joined {joinedDate}</div>
            )}
            <div className="online-pill">Online</div>
          </div>
        </div>

        <div className="sidebar-tabs">
          <button
            className={`stab ${sidebarTab === 'rooms' ? 'active' : ''}`}
            onClick={() => setSidebarTab('rooms')}
          >
            🏠 Rooms
          </button>
          <button
            className={`stab ${sidebarTab === 'dms' ? 'active' : ''}`}
            onClick={() => setSidebarTab('dms')}
          >
            💬 Messages
            {totalUnread > 0 && (
              <span className="unread-badge">
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
          </button>
        </div>

        {sidebarTab === 'rooms' ? (
          <div className="rooms-list">
            {loadingRooms ? (
              <div className="loading-dots">
                <span />
                <span />
                <span />
              </div>
            ) : (
              rooms.map((r) => (
                <button
                  key={r.id}
                  className={`room-item ${view === 'room' && activeRoom?.id === r.id ? 'active' : ''}`}
                  onClick={() => {
                    setActiveRoom(r);
                    setView('room');
                    setSidebarOpen(false);
                  }}
                >
                  <span className="room-item-icon">{r.name.split(' ')[0]}</span>
                  <span className="room-item-name">
                    {r.name.slice(r.name.indexOf(' ') + 1)}
                  </span>
                </button>
              ))
            )}
          </div>
        ) : (
          <div className="dm-list">
            {dmConversations.length === 0 ? (
              <div className="dm-empty">
                <div className="dm-empty-icon">💬</div>
                <p>
                  No messages yet.
                  <br />
                  Click a username in a chat to start a conversation.
                </p>
              </div>
            ) : (
              dmConversations.map((conv) => (
                <button
                  key={conv.userId}
                  className={`dm-item ${view === 'dm' && activeDm?.userId === conv.userId ? 'active' : ''}`}
                  onClick={() => openDm(conv.userId, conv.username)}
                >
                  <div
                    className="dm-av"
                    style={{ background: avatarColor(conv.username) }}
                  >
                    {getInitials(conv.username)}
                  </div>
                  <div className="dm-info">
                    <div className="dm-name">{conv.username}</div>
                    <div className="dm-preview">
                      {conv.lastMsg.from_user_id === user.id ? 'You: ' : ''}
                      {conv.lastMsg.content}
                    </div>
                  </div>
                  <div className="dm-meta">
                    <span className="dm-time">
                      {timeAgo(conv.lastMsg.created_at)}
                    </span>
                    {conv.unread > 0 && (
                      <span className="unread-badge">{conv.unread}</span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        <div className="sidebar-footer">
          <button className="signout-btn" onClick={onLogout}>
            <span>⎋</span> Sign Out
          </button>
        </div>
      </div>

      {/* ── MAIN AREA ── */}
      <div className="chat-area">
        <div className="kente" />

        {/* Header */}
        <div className="chat-header">
          <button className="hamburger" onClick={() => setSidebarOpen(true)}>
            <span />
            <span />
            <span />
          </button>
          {view === 'dm' && activeDm ? (
            <>
              <div
                className="msg-avatar"
                style={{
                  background: avatarColor(activeDm.username),
                  width: 36,
                  height: 36,
                  fontSize: '.75rem',
                }}
              >
                {getInitials(activeDm.username)}
              </div>
              <div className="chat-header-info">
                <div className="chat-room-name">{activeDm.username}</div>
                <div className="chat-room-desc">Private conversation</div>
              </div>
              <div className="chat-header-right">
                <button className="back-btn" onClick={() => setView('room')}>
                  ← Rooms
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="chat-room-icon">
                {activeRoom?.name.split(' ')[0]}
              </div>
              <div className="chat-header-info">
                <div className="chat-room-name">
                  {activeRoom?.name.slice(
                    (activeRoom?.name.indexOf(' ') ?? -1) + 1,
                  )}
                </div>
                <div className="chat-room-desc">{activeRoom?.description}</div>
              </div>
              <div className="chat-header-right">
                <span className="member-count">🟢 Live</span>
              </div>
            </>
          )}
        </div>

        {/* Notification permission banner */}
        {showNotifBanner && (
          <div className="notif-banner">
            <span style={{ fontSize: '1.2rem' }}>🔔</span>
            <div className="notif-banner-text">
              <strong>Enable notifications</strong> to know when you receive
              private messages
            </div>
            <button
              className="notif-enable-btn"
              onClick={() => {
                requestNotifPermission();
                setNotifDismissed(true);
              }}
            >
              Enable
            </button>
            <button
              className="notif-dismiss"
              onClick={() => setNotifDismissed(true)}
            >
              ✕
            </button>
          </div>
        )}

        {/* ── ROOM VIEW ── */}
        {view === 'room' && (
          <>
            {!loadingMsgs && messages.length === 0 && (
              <div className="welcome-banner">
                <div className="welcome-text">
                  <h3>Welcome to {activeRoom?.name}!</h3>
                  <p>Be the first to say something, {username}! 🎉</p>
                  <div className="welcome-kente" />
                </div>
              </div>
            )}
            <div className="messages-area">
              {loadingMsgs ? (
                <div
                  style={{
                    display: 'flex',
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div className="loading-dots">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              ) : (
                grouped.map((group, gi) => {
                  const isOwn = group.sender === username;
                  return (
                    <div key={gi} className="msg-group">
                      {!isOwn && (
                        <div className="msg-sender-row">
                          <div
                            className="msg-avatar msg-avatar-clickable"
                            style={{ background: avatarColor(group.sender) }}
                            onClick={() =>
                              setProfilePopup({
                                username: group.sender,
                                userId: group.userId,
                              })
                            }
                          >
                            {getInitials(group.sender)}
                          </div>
                          <span
                            className="msg-sender-name"
                            onClick={() =>
                              setProfilePopup({
                                username: group.sender,
                                userId: group.userId,
                              })
                            }
                          >
                            {group.sender}
                          </span>
                          <span className="msg-sender-time">
                            {timeAgo(group.messages[0].created_at)}
                          </span>
                        </div>
                      )}
                      {group.messages.map((msg, mi) => (
                        <div
                          key={msg.id || mi}
                          className={`msg-row ${isOwn ? 'msg-own-row' : 'msg-indent'}`}
                        >
                          <div className={`msg-bubble ${isOwn ? 'own' : ''}`}>
                            {msg.content}
                          </div>
                        </div>
                      ))}
                      <div
                        className={`msg-time-small ${isOwn ? 'msg-indent' : 'msg-indent'}`}
                        style={
                          isOwn ? { textAlign: 'right', marginRight: 4 } : {}
                        }
                      >
                        {timeAgo(
                          group.messages[group.messages.length - 1].created_at,
                        )}
                        {isOwn && ' · You'}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>
          </>
        )}

        {/* ── DM VIEW ── */}
        {view === 'dm' && (
          <div className="messages-area">
            {dmMessages.length === 0 && (
              <div className="empty-state">
                <div className="big-emoji">💬</div>
                <p>
                  Start your conversation with{' '}
                  <strong>{activeDm?.username}</strong>
                </p>
              </div>
            )}
            {dmMessages.map((msg, i) => {
              const isOwn = msg.from_user_id === user.id;
              const sender = isOwn ? username : msg.from_username;
              const showMeta =
                i === 0 || dmMessages[i - 1].from_user_id !== msg.from_user_id;
              return (
                <div key={msg.id || i} className="msg-group">
                  {!isOwn && showMeta && (
                    <div className="msg-sender-row">
                      <div
                        className="msg-avatar"
                        style={{ background: avatarColor(sender) }}
                      >
                        {getInitials(sender)}
                      </div>
                      <span className="msg-sender-name">{sender}</span>
                      <span className="msg-sender-time">
                        {timeAgo(msg.created_at)}
                      </span>
                    </div>
                  )}
                  <div
                    className={`msg-row ${isOwn ? 'msg-own-row' : 'msg-indent'}`}
                  >
                    <div className={`msg-bubble ${isOwn ? 'own' : ''}`}>
                      {msg.content}
                    </div>
                  </div>
                  {(i === dmMessages.length - 1 ||
                    dmMessages[i + 1]?.from_user_id !== msg.from_user_id) && (
                    <div
                      className="msg-time-small msg-indent"
                      style={
                        isOwn ? { textAlign: 'right', marginRight: 4 } : {}
                      }
                    >
                      {timeAgo(msg.created_at)}
                      {isOwn && ' · You'}
                      {!isOwn && msg.is_read ? ' · Seen' : ''}
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}

        {/* Input */}
        <div className="chat-input-area">
          <input
            className="chat-input"
            placeholder={
              view === 'dm'
                ? `Message ${activeDm?.username ?? ''}...`
                : `Message ${activeRoom?.name ?? ''}...`
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          />
          <button
            className="send-btn"
            onClick={sendMessage}
            disabled={!input.trim() || sending}
          >
            <svg viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── LANDING PAGE ──────────────────────────────────────────────────────────────
function HomePage({ onShowAuth }) {
  const features = [
    {
      icon: '🔒',
      name: 'Secure by Default',
      desc: 'Row Level Security ensures your messages stay private. Email addresses are never shared.',
    },
    {
      icon: '🇬🇭',
      name: 'Built for Ghana',
      desc: 'Rooms for Ghanaians everywhere. Celebrate culture, language, and community every day.',
    },
    {
      icon: '💬',
      name: 'Private Messaging',
      desc: 'Messages are end-to-end encrypted. Only you and the recipient can read.',
    },
    {
      icon: '📱',
      name: 'Mobile-First',
      desc: 'Designed for your phone first. Works beautifully on all screen sizes.',
    },
    {
      icon: '🔔',
      name: 'Smart Notifications',
      desc: 'Browser notifications for private messages so you never miss a conversation.',
    },
    {
      icon: '👑',
      name: 'KasaPoint Pro',
      desc: 'Voice notes, file sharing, stickers & more — coming soon.',
      soon: true,
    },
  ];
  return (
    <>
      <section className="hero">
        <div className="hero-badge">
          <span className="dot" />
          <span>Live Now</span>
        </div>
        <h1 className="hero-title">
          Ghana's Premier
          <br />
          <span className="accent">Secure Chat</span>
          <br />
          Platform
        </h1>
        <p className="hero-sub">
          Connect with Ghanaians at home and abroad. Chat publicly or privately
          — in a safe, beautiful space.
        </p>
        <div className="hero-cta">
          <button
            className="btn btn-gold btn-hero"
            onClick={() => onShowAuth('signup')}
          >
            Join Free — m'adamfo!
          </button>
          <button
            className="btn btn-outline btn-hero"
            onClick={() => onShowAuth('login')}
          >
            Sign In
          </button>
        </div>
        <div className="hero-stats">
          {[
            ['50+', 'Active Users'],
            ['6', 'Chat Rooms'],
            ['24/7', 'Always On'],
          ].map(([n, l]) => (
            <div key={l}>
              <div className="stat-num">{n}</div>
              <div className="stat-label">{l}</div>
            </div>
          ))}
        </div>
      </section>
      <section className="section">
        <span className="section-tag">Explore</span>
        <h2 className="section-title">Find your community</h2>
        <p style={{ color: '#6B6560', marginTop: 12, fontSize: '.95rem' }}>
          From football to food, music to money — there's a room for everyone.
        </p>
        <div className="rooms-preview">
          {FALLBACK_ROOMS.map((r) => (
            <div
              key={r.id}
              className="room-card"
              onClick={() => onShowAuth('signup')}
            >
              <div className="room-icon">{r.name.split(' ')[0]}</div>
              <div>
                <div className="room-name">
                  {r.name.slice(r.name.indexOf(' ') + 1)}
                </div>
                <div className="room-desc">{r.description}</div>
                <div className="room-users">● Join to chat</div>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="section">
        <span className="section-tag">Why KasaPoint</span>
        <h2 className="section-title">Everything you need to stay connected</h2>
        <div className="features-grid">
          {features.map((f) => (
            <div
              key={f.name}
              className={`feature-card ${f.soon ? 'feature-coming' : ''}`}
            >
              {f.soon && <span className="badge-soon">Coming Soon</span>}
              <div className="feature-icon">{f.icon}</div>
              <div className="feature-name">{f.name}</div>
              <div className="feature-desc">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>
      <div>
        <div className="cta-section">
          <h2 className="cta-title">Ready to join the conversation?</h2>
          <p className="cta-sub">
            Free forever. No credit card needed. Just community.
          </p>
          <button
            className="btn btn-gold btn-hero"
            onClick={() => onShowAuth('signup')}
          >
            Create Free Account
          </button>
        </div>
      </div>
      <div className="kente" />
      <footer className="footer">
        <div>
          <div className="footer-logo">
            Kasa<span>Point</span>
          </div>
          <div style={{ fontSize: '.75rem', marginTop: 4 }}>
            Built by JoErl · {new Date().getFullYear()}
          </div>
        </div>
        <div className="footer-links">
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
          <a href="#">About</a>
          <a href="#">Contact</a>
        </div>
      </footer>
    </>
  );
}

// ─── ROOT APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [showAuth, setShowAuth] = useState(null);
  const [toast, setToast] = useState(null);
  const [booting, setBooting] = useState(true);

  // Restore session + handle Google OAuth callback
  useEffect(() => {
    async function init() {
      // Check for OAuth redirect (access_token in URL hash)
      const hash = window.location.hash;
      if (hash.includes('access_token')) {
        const params = new URLSearchParams(hash.slice(1));
        const t = params.get('access_token');
        if (t) {
          try {
            const u = await sb.getUser(t);
            if (u && u.id) {
              if (!u.user_metadata) u.user_metadata = {};
              if (!u.user_metadata.username) {
                u.user_metadata.username =
                  u.user_metadata.full_name ||
                  u.user_metadata.name ||
                  u.email?.split('@')[0] ||
                  'User';
              }
              localStorage.setItem('gchat_token', t);
              localStorage.setItem('gchat_user', JSON.stringify(u));
              setToken(t);
              setUser(u);
              window.history.replaceState(
                {},
                document.title,
                window.location.pathname,
              );
              setBooting(false);
              setToast({
                msg: `Akwaaba ${u.user_metadata.username}! 🇬🇭`,
                type: 'success',
              });
              return;
            }
          } catch {}
        }
      }
      // Restore from storage
      const t =
        localStorage.getItem('gchat_token') ||
        sessionStorage.getItem('gchat_token');
      const u =
        localStorage.getItem('gchat_user') ||
        sessionStorage.getItem('gchat_user');
      if (t && u) {
        try {
          setToken(t);
          setUser(JSON.parse(u));
        } catch {}
      }
      setBooting(false);
    }
    init();
  }, []);

  function handleAuth(u, t) {
    setUser(u);
    setToken(t);
    setShowAuth(null);
    const name = u.user_metadata?.username || u.email?.split('@')[0];
    setToast({
      msg: `Akwaaba ${name}! Welcome to KasaPoint 🇬🇭`,
      type: 'success',
    });
  }

  function handleLogout() {
    ['gchat_token', 'gchat_user'].forEach((k) => {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    });
    setUser(null);
    setToken(null);
    setToast({ msg: 'Signed out. Come back soon! 👋', type: '' });
  }

  if (booting)
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div className="loading-dots">
          <span />
          <span />
          <span />
        </div>
      </div>
    );

  return (
    <>
      <style>{css}</style>
      {toast && (
        <Toast
          msg={toast.msg}
          type={toast.type}
          onDone={() => setToast(null)}
        />
      )}
      {showAuth && (
        <AuthModal
          defaultTab={showAuth}
          onClose={() => setShowAuth(null)}
          onAuth={handleAuth}
        />
      )}
      {user && token ? (
        <ChatScreen user={user} token={token} onLogout={handleLogout} />
      ) : (
        <div style={{ minHeight: '100vh' }}>
          <div className="kente" />
          <nav className="nav">
            <div className="nav-logo">
              Kasa<span>Point</span>
            </div>
            <div className="nav-actions">
              <button
                className="btn btn-ghost"
                onClick={() => setShowAuth('login')}
              >
                Sign In
              </button>
              <button
                className="btn btn-gold"
                onClick={() => setShowAuth('signup')}
              >
                Join Free
              </button>
            </div>
          </nav>
          <HomePage onShowAuth={setShowAuth} />
        </div>
      )}
    </>
  );
}
