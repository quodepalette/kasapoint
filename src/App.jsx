import { useState, useEffect, useRef } from 'react';

// ─── CONFIG ────────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://maczzisuufzycdgfizeo.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hY3p6aXN1dWZ6eWNkZ2ZpemVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NTcwMDgsImV4cCI6MjA5MjQzMzAwOH0.WQBuMsYKwuW4VeRe6ZG_OA_rf59YfDVg327i4MObuFA';

// ─── ADMIN CONFIG ──────────────────────────────────────────────────────────────
const ADMIN_EMAIL = 'jo.erl444@gmail.com';
const ADMIN_USERNAME = 'JoErl';
// Welcome DM sender — this ID will be fetched dynamically but we keep the email as reference
const ADMIN_WELCOME_DM = {
  username: ADMIN_USERNAME,
  message: `👋 Akwaaba to KasaPoint! I'm JoErl, the founder of this platform.\n\nHere are a few things to keep in mind:\n\n📋 Community Rules\n• Treat everyone with respect — no hate speech, bullying, or harassment.\n• No sharing of explicit, adult, or NSFW material of any kind.\n• No posting of external links, referral codes, or promotional content.\n• Do not share personal information (phone numbers, addresses, etc.) publicly.\n• Spam and repetitive messages are not allowed.\n• Impersonating other users or KasaPoint staff is strictly prohibited.\n\n🗺️ How to Navigate\n• Lobby — your home base. See all rooms and recent DMs.\n• Rooms — tap any room card to join the conversation.\n• Messages (💬) — use the sidebar tab to search for any user and start a private chat.\n• Profile — your name and settings appear in the sidebar. You can change your username once, and update your password anytime.\n\nWelcome to the family — enjoy the vibes! 🇬🇭✨`,
};

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
  // Resolve a username to its email so sign-in-by-username works
  async getEmailByUsername(username) {
    const trimmed = username.trim();
    // Try exact case-insensitive match first
    const attempts = [
      `${SUPABASE_URL}/rest/v1/profiles?username=ilike.${encodeURIComponent(trimmed)}&select=id,email&limit=1`,
      `${SUPABASE_URL}/rest/v1/profiles?username=eq.${encodeURIComponent(trimmed)}&select=id,email&limit=1`,
    ];
    for (const url of attempts) {
      try {
        const r = await fetch(url, {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
          },
        });
        if (r.ok) {
          const data = await r.json();
          if (Array.isArray(data) && data.length > 0 && data[0].email)
            return data[0].email;
        }
      } catch {}
    }
    // Last resort: try RPC lookup
    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/rpc/get_email_by_username`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ uname: trimmed.toLowerCase() }),
        },
      );
      if (r.ok) {
        const email = await r.json();
        if (typeof email === 'string' && email.includes('@')) return email;
      }
    } catch {}
    return null;
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
  async sendMessage(token, roomId, userId, username, content, replyTo) {
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
        reply_to_id: replyTo?.id || null,
        reply_to_username: replyTo?.username || null,
        reply_to_content: replyTo?.content || null,
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
  async sendDM(
    token,
    fromId,
    toId,
    fromUsername,
    toUsername,
    content,
    replyTo,
  ) {
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
        reply_to_id: replyTo?.id || null,
        reply_to_username: replyTo?.username || null,
        reply_to_content: replyTo?.content || null,
      }),
    });
    return r.json();
  },
  async usernameAvailable(username) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/username_available`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ uname: username.trim().toLowerCase() }),
    });
    return r.json(); // returns true if available
  },
  async searchUsers(token, query) {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/search_users_by_username`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ search_query: query.trim().toLowerCase() }),
      },
    );
    // Fallback: try querying profiles table directly
    if (!r.ok) {
      const r2 = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?username=ilike.*${encodeURIComponent(query)}*&select=id,username&limit=10`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: SUPABASE_ANON_KEY,
          },
        },
      );
      if (r2.ok) return r2.json();
      return [];
    }
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
  async editMessage(token, id, content) {
    await fetch(`${SUPABASE_URL}/rest/v1/messages?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ content, edited_at: new Date().toISOString() }),
    });
  },
  async deleteMessage(token, id) {
    await fetch(`${SUPABASE_URL}/rest/v1/messages?id=eq.${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
      },
    });
  },
  async editDM(token, id, content) {
    await fetch(`${SUPABASE_URL}/rest/v1/direct_messages?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ content, edited_at: new Date().toISOString() }),
    });
  },
  async deleteDM(token, id) {
    await fetch(`${SUPABASE_URL}/rest/v1/direct_messages?id=eq.${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
      },
    });
  },
  async forgotPassword(email) {
    const redirectTo = encodeURIComponent(
      window.location.origin + window.location.pathname + '?reset_password=1',
    );
    const r = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        email,
        redirect_to: decodeURIComponent(redirectTo),
      }),
    });
    return r.json();
  },
  async resetPasswordWithToken(accessToken, newPassword) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ password: newPassword }),
    });
    return r.json();
  },
  async getUserByEmail(token, email) {
    // Search profiles by email via RPC or fallback
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=id,username&limit=1`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: SUPABASE_ANON_KEY,
        },
      },
    );
    if (r.ok) {
      const data = await r.json();
      if (Array.isArray(data) && data.length > 0) return data[0];
    }
    return null;
  },
  async changePassword(token, newPassword) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ password: newPassword }),
    });
    return r.json();
  },
  async updateUsername(token, newUsername) {
    // 1. Update Supabase Auth user_metadata (display_name in the Auth dashboard)
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        data: {
          username: newUsername,
          full_name: newUsername,
          display_name: newUsername,
          username_changed: true,
        },
      }),
    });
    const result = await r.json();
    // 2. Mirror the change into public.profiles so sign-in-by-username,
    //    DM search, and message display all stay in sync.
    if (result?.id) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${result.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ username: newUsername }),
        });
      } catch {}
    }
    return result;
  },
  async deleteAccount(token) {
    // Step 1: Get user info first
    let userId = null;
    try {
      const u = await this.getUser(token);
      userId = u?.id;
    } catch {}

    // Step 2: Mark messages as from deleted user in profiles
    if (userId) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            username: '[deleted]',
            email: null,
            deleted: true,
          }),
        });
      } catch {}
    }

    // Step 3: Call the RPC to delete the auth user
    const rpcRes = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/delete_own_account`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({}),
      },
    );

    // If RPC succeeded or returned a known ok status, we're good
    if (rpcRes.ok || rpcRes.status === 204) return true;

    // Step 4: Fallback — mark metadata as deleted so UI reflects it
    try {
      await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          data: { account_deleted: true, username: '[deleted]' },
        }),
      });
    } catch {}

    return true;
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
  { id: '3', name: '⚽ Football', description: 'Football fans unite' },
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
    'linear-gradient(135deg,#1a1aff,#D4AF37)',
    'linear-gradient(135deg,#9b59b6,#D4AF37)',
    'linear-gradient(135deg,#e67e22,#CE1126)',
    'linear-gradient(135deg,#16a085,#D4AF37)',
    'linear-gradient(135deg,#2980b9,#006B3F)',
    'linear-gradient(135deg,#8e44ad,#CE1126)',
    'linear-gradient(135deg,#27ae60,#1a1aff)',
    'linear-gradient(135deg,#d35400,#9b59b6)',
    'linear-gradient(135deg,#c0392b,#2980b9)',
    'linear-gradient(135deg,#f39c12,#006B3F)',
    'linear-gradient(135deg,#1abc9c,#CE1126)',
    'linear-gradient(135deg,#2c3e50,#D4AF37)',
    'linear-gradient(135deg,#6c3483,#27ae60)',
    'linear-gradient(135deg,#117a65,#f39c12)',
    'linear-gradient(135deg,#b7950b,#2980b9)',
    'linear-gradient(135deg,#922b21,#1abc9c)',
    'linear-gradient(135deg,#1f618d,#e67e22)',
    'linear-gradient(135deg,#6e2f1a,#D4AF37)',
    'linear-gradient(135deg,#0b5345,#d35400)',
    'linear-gradient(135deg,#4a235a,#27ae60)',
    'linear-gradient(135deg,#154360,#D4AF37)',
    'linear-gradient(135deg,#784212,#16a085)',
    'linear-gradient(135deg,#1b2631,#f39c12)',
    'linear-gradient(135deg,#2e4053,#CE1126)',
    'linear-gradient(135deg,#4d5656,#D4AF37)',
    'linear-gradient(135deg,#7d6608,#2980b9)',
    'linear-gradient(135deg,#512e5f,#e67e22)',
  ];
  // FNV-1a-inspired hash for better distribution
  let h = 2166136261;
  const n = name || '?';
  for (let i = 0; i < n.length; i++) {
    h ^= n.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return c[h % c.length];
}
function isAdmin(user) {
  if (!user) return false;
  const email = (user.email || '').toLowerCase();
  const uname = (
    user.user_metadata?.username ||
    user.user_metadata?.full_name ||
    user.user_metadata?.display_name ||
    ''
  ).toLowerCase();
  // Check by email, username, or explicit is_admin flag
  return (
    email === ADMIN_EMAIL.toLowerCase() ||
    uname === ADMIN_USERNAME.toLowerCase() ||
    user.user_metadata?.is_admin === true ||
    user.app_metadata?.is_admin === true
  );
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
  @media(max-width:600px){
    .modal-overlay{align-items:stretch;padding:0;background:var(--bg);backdrop-filter:none}
    .modal{border-radius:0;min-height:100dvh;height:auto;max-height:none;padding:72px 24px 56px;overflow-y:auto;box-shadow:none;animation:fadeIn .25s ease}
    .modal-close{position:fixed;top:16px;left:16px;right:auto;z-index:10;background:var(--sur2)}
  }
  .modal-close{position:absolute;top:16px;right:16px;width:36px;height:36px;border-radius:50%;border:none;background:var(--sur2);cursor:pointer;font-size:.85rem;font-weight:700;display:flex;align-items:center;justify-content:center;transition:background .2s;color:var(--soft)}.modal-close:hover{background:var(--bdr)}
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
  /* username availability indicator */
  .username-status{position:absolute;right:12px;top:50%;transform:translateY(-50%);font-size:.82rem;font-weight:700;pointer-events:none}
  .username-status.ok{color:var(--green)}
  .username-status.taken{color:var(--red)}
  .username-status.checking{color:var(--muted);letter-spacing:1px}

  /* ── APP LAYOUT ── */
  .app-layout{display:flex;height:100dvh;overflow:hidden;background:var(--bg)}

  /* ── SIDEBAR ── */
  .sidebar{width:300px;flex-shrink:0;background:var(--sur);border-right:1px solid var(--bdr);display:flex;flex-direction:column;transition:transform .3s;height:100dvh;overflow:hidden}
  .sidebar-top{padding:0 20px;border-bottom:1px solid var(--bdr);flex-shrink:0}
  .sidebar-brand{display:flex;align-items:center;justify-content:space-between;height:58px}
  .sidebar-logo{font-family:'GFS Didot',serif;font-weight:900;font-size:1.1rem}.sidebar-logo span{color:var(--gold)}
  .profile-card{background:linear-gradient(135deg,#1A1A1A,#2D2A22);border-radius:16px;padding:16px;margin:0 0 14px;position:relative;overflow:hidden}
  .profile-card::before{content:'';position:absolute;top:-30px;right:-30px;width:100px;height:100px;border-radius:50%;background:rgba(212,175,55,.15)}
  .profile-avatar{width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1rem;color:#fff;border:2px solid rgba(212,175,55,.5);margin-bottom:8px;position:relative}
  .profile-name{font-weight:700;font-size:.9rem;color:#fff}.profile-joined{font-size:.7rem;color:rgba(212,175,55,.8);margin-top:6px}
  .online-pill{display:inline-flex;align-items:center;gap:5px;background:rgba(0,107,63,.25);color:#4ade80;font-size:.7rem;font-weight:600;padding:3px 10px;border-radius:100px;margin-top:6px}
  .online-pill::before{content:'';width:6px;height:6px;background:#4ade80;border-radius:50%}

  /* ── SIDEBAR TABS ── */
  .sidebar-tabs{display:flex;padding:8px 10px 0;gap:4px;border-bottom:1px solid var(--bdr);flex-shrink:0}
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
  .sidebar-footer{padding:12px 20px;border-top:1px solid var(--bdr);flex-shrink:0}
  .signout-btn{width:100%;padding:9px;border-radius:10px;border:1.5px solid var(--bdr);background:transparent;color:var(--soft);font-family:'Outfit',sans-serif;font-size:.8rem;font-weight:500;cursor:pointer;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:8px}
  .signout-btn:hover{border-color:var(--red);color:var(--red);background:rgba(206,17,38,.04)}
  .delete-account-btn{width:100%;padding:9px;border-radius:10px;border:1.5px solid rgba(206,17,38,.3);background:transparent;color:var(--red);font-family:'Outfit',sans-serif;font-size:.8rem;font-weight:500;cursor:pointer;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:8px;margin-top:6px}
  .delete-account-btn:hover{border-color:var(--red);background:rgba(206,17,38,.08)}

  /* ── CHAT AREA ── */
  .chat-area{flex:1;display:flex;flex-direction:column;min-width:0;background:var(--bg);overflow:hidden;height:100dvh}
  .chat-header{flex-shrink:0;padding:12px 24px;border-bottom:1px solid var(--bdr);background:var(--sur);display:flex;align-items:center;gap:14px;box-shadow:0 1px 4px rgba(0,0,0,.04);z-index:10}
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
  .messages-area{flex:1;overflow-y:auto;overflow-x:hidden;padding:16px 24px;display:flex;flex-direction:column;gap:2px;min-height:0;-webkit-overflow-scrolling:touch}
  .msg-date-divider{text-align:center;font-size:.72rem;color:var(--muted);margin:10px 0;display:flex;align-items:center;gap:12px}
  .msg-date-divider::before,.msg-date-divider::after{content:'';flex:1;height:1px;background:var(--bdr)}
  .msg-group{margin-bottom:12px}
  .msg-sender-row{display:flex;align-items:center;gap:8px;margin-bottom:4px}
  .msg-avatar{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.6rem;color:#fff;flex-shrink:0}
  .msg-sender-name{font-size:.75rem;font-weight:600;color:var(--soft);cursor:pointer;transition:color .15s}.msg-sender-name:hover{color:var(--gold-d)}
  .msg-sender-time{font-size:.7rem;color:var(--muted)}
  .msg-row{display:flex;align-items:flex-start;gap:10px}
  .msg-bubble{background:var(--sur);border:1px solid var(--bdr);border-radius:4px 16px 16px 16px;padding:9px 13px;max-width:min(600px,calc(100% - 10px));font-size:.875rem;line-height:1.55;color:var(--txt);box-shadow:0 1px 3px rgba(0,0,0,.04);animation:fadeUp .15s ease;word-break:break-word;overflow-wrap:anywhere;min-width:0}
  .msg-bubble.own{background:linear-gradient(135deg,var(--gold),#E8C040);border-color:transparent;color:#1A1A1A;border-radius:16px 4px 16px 16px;margin-left:auto}
  .msg-own-row{justify-content:flex-end}
  .msg-indent{margin-left:36px}
  .msg-time-small{font-size:.67rem;color:var(--muted);margin-top:2px}
  .msg-avatar-clickable{cursor:pointer;transition:opacity .15s}.msg-avatar-clickable:hover{opacity:.8}

 /* ── LOBBY AREA ── */
.lobby-area {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 24px;
  background: var(--bg);
  min-height: 0;

  /* FIX: prevent centering from parent flex layouts */
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

/* ── GREETING ── */
.lobby-greeting {
  margin-bottom: 24px;
}

.lobby-greeting h2 {
  font-family: 'GFS Didot', serif;
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 4px;
}

.lobby-greeting p {
  font-size: .875rem;
  color: var(--muted);
}

/* ── SECTION LABEL ── */
.lobby-section-label {
  font-size: .7rem;
  font-weight: 700;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 12px;
}

/* ── ROOMS GRID ── */
.lobby-rooms-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
  margin-bottom: 28px;

  /* FIX: force grid alignment to left */
  justify-content: start;
  width: 100%;
}

/* ── ROOM CARD ── */
.lobby-room-card {
  background: var(--sur);
  border: 1.5px solid var(--bdr);
  border-radius: 18px;
  padding: 18px 14px 14px;
  cursor: pointer;
  transition: all .22s;

  display: flex;
  flex-direction: column;
  gap: 8px;
  position: relative;

  /* FIX: ensure text is left aligned */
  text-align: left;

  /* FIX: prevent shrinking weird centering effects */
  width: 100%;
}

.lobby-room-card:hover {
  border-color: var(--gold);
  box-shadow: 0 6px 24px rgba(212,175,55,.18);
  transform: translateY(-2px);
}

/* ── ROOM CONTENT ── */
.lobby-room-emoji {
  font-size: 1.6rem;
  line-height: 1;
}

.lobby-room-name {
  font-size: .8rem;
  font-weight: 600;
  color: var(--txt);
  line-height: 1.3;
}

.lobby-room-desc {
  font-size: .7rem;
  color: var(--muted);
  line-height: 1.4;
}

/* ── BADGE ── */
.lobby-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  background: var(--red);
  color: #fff;
  font-size: .6rem;
  font-weight: 700;
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  animation: badgePop .3s ease;
}
@keyframes badgePop{from{transform:scale(0)}to{transform:scale(1)}}

/* ── DMS ── */
.lobby-dms-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.lobby-dm-card {
  background: var(--sur);
  border: 1.5px solid var(--bdr);
  border-radius: 14px;
  padding: 12px 14px;
  cursor: pointer;
  transition: all .2s;

  display: flex;
  align-items: center;
  gap: 10px;
  position: relative;
  width: 100%;
  min-width: 0;
  text-align: left;
}

.lobby-dm-card:hover {
  border-color: var(--gold);
  box-shadow: 0 4px 16px rgba(212,175,55,.12);
}

.lobby-dm-info {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-align: left;
}

.lobby-dm-name {
  font-size: .85rem;
  font-weight: 600;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lobby-dm-preview {
  font-size: .75rem;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  text-align: left;
}

.lobby-dm-time {
  font-size: .68rem;
  color: var(--muted);
  flex-shrink: 0;
  text-align: right;
}

  /* ── REPLY SYSTEM ── */
  .msg-row-wrap{position:relative;display:flex;flex-direction:column}
  .msg-row-wrap:hover .msg-actions{opacity:1}

  /* ── MESSAGE ACTIONS (reply · edit · delete) ── */
  .msg-actions{opacity:0;display:flex;align-items:center;gap:3px;flex-shrink:0;transition:opacity .15s}
  @media(max-width:700px){.msg-actions{opacity:1}}
  .msg-reply-btn{background:var(--sur);border:1px solid var(--bdr);border-radius:7px;padding:0;width:26px;height:26px;font-size:.78rem;cursor:pointer;color:var(--soft);transition:all .15s;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .msg-reply-btn:hover{background:var(--sur2);color:var(--txt);border-color:var(--gold)}
  .msg-act-btn{width:26px;height:26px;border-radius:7px;border:1px solid var(--bdr);background:var(--sur);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;color:var(--muted);padding:0;flex-shrink:0}
  .msg-act-btn:hover{background:var(--sur2);color:var(--txt);border-color:var(--gold)}
  .msg-act-btn.del:hover{background:rgba(206,17,38,.08);color:var(--red);border-color:var(--red)}
  .msg-act-btn svg,.msg-reply-btn svg{width:13px;height:13px;fill:currentColor;display:block}

  /* ── INLINE EDIT ── */
  .msg-edit-wrap{display:flex;flex-direction:column;gap:6px;min-width:200px;max-width:min(520px,calc(100% - 8px))}
  .msg-edit-input{padding:9px 12px;border:1.5px solid var(--gold);border-radius:12px;font-family:'Outfit',sans-serif;font-size:.875rem;background:var(--bg);color:var(--txt);outline:none;resize:none;line-height:1.55;box-shadow:0 0 0 3px rgba(212,175,55,.1)}
  .msg-edit-actions{display:flex;gap:6px;justify-content:flex-end}
  .msg-edit-save{padding:5px 16px;background:var(--gold);color:#fff;border:none;border-radius:8px;font-family:'Outfit',sans-serif;font-size:.75rem;font-weight:600;cursor:pointer;transition:background .15s}
  .msg-edit-save:hover{background:var(--gold-d)}
  .msg-edit-cancel{padding:5px 12px;background:var(--sur2);color:var(--soft);border:1px solid var(--bdr);border-radius:8px;font-family:'Outfit',sans-serif;font-size:.75rem;cursor:pointer;transition:background .15s}
  .msg-edit-cancel:hover{background:var(--bdr)}
  .msg-edited-tag{font-size:.62rem;color:var(--muted);font-style:italic;margin-left:4px}
  .reply-preview{background:var(--sur2);border-left:3px solid var(--gold);border-radius:0 8px 8px 0;padding:5px 10px;margin-bottom:4px;font-size:.75rem;color:var(--soft);max-width:min(420px,100%);cursor:pointer;min-width:0;overflow:hidden}
  .reply-preview:hover{background:var(--bdr)}
  .reply-preview .reply-author{font-weight:600;color:var(--gold-d);margin-bottom:1px;font-size:.7rem}
  .reply-preview .reply-text{color:var(--soft);overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;max-width:100%}
  .reply-bar{flex-shrink:0;background:var(--sur2);border-top:1px solid var(--bdr);padding:8px 16px;display:flex;align-items:center;gap:10px;font-size:.8rem;color:var(--soft)}
  .reply-bar-content{flex:1;min-width:0}
  .reply-bar-author{font-weight:600;color:var(--gold-d);font-size:.75rem}
  .reply-bar-text{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:.78rem;color:var(--muted)}
  .reply-bar-close{background:none;border:none;cursor:pointer;color:var(--muted);font-size:1.1rem;padding:2px 6px;transition:color .15s}.reply-bar-close:hover{color:var(--red)}
  .reply-bar-icon{font-size:1rem;flex-shrink:0;color:var(--gold)}
  .chat-input{flex:1;padding:10px 18px;border:1.5px solid var(--bdr);border-radius:100px;font-family:'Outfit',sans-serif;font-size:.875rem;background:var(--bg);color:var(--txt);outline:none;transition:border-color .2s}
  .chat-input:focus{border-color:var(--gold)}
  .send-btn{width:40px;height:40px;border-radius:50%;background:var(--gold);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;flex-shrink:0;box-shadow:0 2px 8px rgba(212,175,55,.4)}
  .send-btn:hover{background:var(--gold-d);transform:scale(1.06)}.send-btn:disabled{opacity:.5;cursor:not-allowed;transform:none}
  .send-btn svg{width:15px;height:15px;fill:#fff}

  /* ── CHAT INPUT WRAPPER ── */
.chat-input-area {
  display: flex;
  align-items: center;
  gap: 10px;

  padding: 10px 12px;
  border-top: 1px solid var(--bdr);
  background: var(--bg);

  /* IMPORTANT: prevents full-width stacking issues */
  width: 100%;
  box-sizing: border-box;
}

/* ── INPUT ── */
.chat-input {
  flex: 1;
  min-width: 0; /* IMPORTANT: prevents overflow pushing button down */

  padding: 10px 18px;
  border: 1.5px solid var(--bdr);
  border-radius: 999px;

  font-family: 'Outfit', sans-serif;
  font-size: .875rem;

  background: var(--sur);
  color: var(--txt);

  outline: none;
  transition: border-color .2s;
}

.chat-input:focus {
  border-color: var(--gold);
}

/* ── SEND BUTTON ── */
.send-btn {
  flex-shrink: 0; /* IMPORTANT: prevents wrapping under input */

  width: 42px;
  height: 42px;

  border-radius: 50%;
  border: 1.5px solid var(--bdr);
  background: var(--sur);

  display: flex;
  align-items: center;
  justify-content: center;

  cursor: pointer;

  transition: all .2s ease;
}

.send-btn:hover {
  border-color: var(--gold);
  box-shadow: 0 4px 14px rgba(212, 175, 55, .15);
}

.send-btn:disabled {
  opacity: .4;
  cursor: not-allowed;
}

.send-btn svg {
  width: 18px;
  height: 18px;
  fill: var(--txt);
}

  /* ── DM SEARCH ── */
  .dm-search-wrap{padding:10px 12px 6px;position:relative}
  .dm-search-input{width:100%;padding:8px 14px 8px 34px;border:1.5px solid var(--bdr);border-radius:100px;font-family:'Outfit',sans-serif;font-size:.82rem;background:var(--sur2);color:var(--txt);outline:none;transition:border-color .2s,background .2s}
  .dm-search-input:focus{border-color:var(--gold);background:var(--sur)}
  .dm-search-icon{position:absolute;left:22px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:.85rem;pointer-events:none}
  .dm-search-clear{position:absolute;right:22px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--muted);font-size:.9rem;padding:2px 4px;line-height:1;transition:color .15s}.dm-search-clear:hover{color:var(--txt)}
  .dm-search-results{padding:4px 10px}
  .dm-search-item{display:flex;align-items:center;gap:10px;padding:9px 12px;cursor:pointer;border-radius:10px;border:none;background:transparent;width:100%;text-align:left;transition:background .15s;margin-bottom:2px}
  .dm-search-item:hover{background:var(--sur2)}
  .dm-search-label{font-size:.72rem;color:var(--muted);padding:6px 14px 2px;font-weight:600;text-transform:uppercase;letter-spacing:.08em}
  .dm-search-new-badge{font-size:.65rem;background:var(--sur3);color:var(--soft);padding:2px 7px;border-radius:100px;margin-left:auto;flex-shrink:0}

  /* ── USERNAME CHANGE ── */
  .change-username-btn{margin-top:8px;padding:5px 12px;border-radius:100px;border:1px solid rgba(212,175,55,.5);background:rgba(212,175,55,.12);color:var(--gold-l);font-family:'Outfit',sans-serif;font-size:.7rem;font-weight:600;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:5px}
  .change-username-btn:hover{background:rgba(212,175,55,.22);border-color:var(--gold)}
  .change-username-btn:disabled{opacity:.45;cursor:not-allowed}
  .username-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;z-index:600;padding:20px;animation:fadeIn .15s ease}
  .username-modal{background:var(--sur);border-radius:20px;padding:28px 24px;width:100%;max-width:380px;box-shadow:0 20px 60px rgba(0,0,0,.2);animation:slideUp .25s ease;position:relative}
  .username-modal h3{font-family:'GFS Didot',serif;font-size:1.1rem;font-weight:700;margin-bottom:4px}
  .username-modal .um-sub{font-size:.8rem;color:var(--muted);margin-bottom:18px;line-height:1.5}
  .um-warning{background:rgba(212,175,55,.1);border:1px solid rgba(212,175,55,.3);border-radius:10px;padding:10px 12px;font-size:.78rem;color:var(--gold-d);margin-bottom:16px;line-height:1.5}
  .um-actions{display:flex;gap:8px;margin-top:18px}
  .um-cancel{flex:1;padding:10px;border-radius:12px;border:1.5px solid var(--bdr);background:transparent;color:var(--soft);font-family:'Outfit',sans-serif;font-size:.875rem;cursor:pointer;transition:all .2s}.um-cancel:hover{border-color:var(--txt);color:var(--txt)}
  .um-save{flex:1;padding:10px;border-radius:12px;background:var(--gold);color:#fff;border:none;font-family:'Outfit',sans-serif;font-size:.875rem;font-weight:600;cursor:pointer;transition:all .2s}.um-save:hover{background:var(--gold-d)}.um-save:disabled{opacity:.5;cursor:not-allowed}

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
    .app-layout{height:100dvh;overflow:hidden}
    .sidebar{position:fixed;left:0;top:0;bottom:0;z-index:200;transform:translateX(-100%);height:100dvh}
    .sidebar.open{transform:translateX(0);box-shadow:4px 0 24px rgba(0,0,0,.15)}
    .hamburger{display:flex}
    .sidebar-overlay{display:block;position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:199;opacity:0;pointer-events:none;transition:opacity .3s}
    .sidebar-overlay.visible{opacity:1;pointer-events:all}
    .chat-area{height:100dvh;display:flex;flex-direction:column;overflow:hidden}
    .chat-header{flex-shrink:0;padding:10px 14px}
    .messages-area{flex:1;min-height:0;overflow-y:auto;padding:12px 14px}
    .lobby-area{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:16px 14px}
    .chat-input-area{flex-shrink:0;padding:10px 14px}
    .reply-bar{flex-shrink:0}
    .welcome-banner{margin:10px 14px 0;flex-shrink:0}
    .notif-banner{margin:10px 14px 0;flex-shrink:0}
    .cta-section{margin:0 12px 60px;padding:48px 24px}
  }


  /* ── ADMIN / PREMIUM BADGE ── */
  .badge-premium{display:inline-flex;align-items:center;gap:3px;background:linear-gradient(135deg,#D4AF37,#F0CF6A,#B8941F);color:#fff;font-size:.58rem;font-weight:700;padding:2px 7px;border-radius:100px;text-transform:uppercase;letter-spacing:.06em;vertical-align:middle;margin-left:5px;box-shadow:0 1px 6px rgba(212,175,55,.5);flex-shrink:0;white-space:nowrap}
  .badge-admin{display:inline-flex;align-items:center;gap:3px;background:linear-gradient(135deg,#CE1126,#a30e1e);color:#fff;font-size:.58rem;font-weight:700;padding:2px 7px;border-radius:100px;text-transform:uppercase;letter-spacing:.06em;vertical-align:middle;margin-left:5px;box-shadow:0 1px 6px rgba(206,17,38,.4);flex-shrink:0;white-space:nowrap}
  .msg-sender-badges{display:inline-flex;align-items:center;gap:3px;margin-left:4px}
  .admin-panel-btn{padding:5px 12px;border-radius:100px;border:1px solid rgba(206,17,38,.4);background:rgba(206,17,38,.1);color:#CE1126;font-family:'Outfit',sans-serif;font-size:.7rem;font-weight:600;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:5px;margin-top:6px}
  .admin-panel-btn:hover{background:rgba(206,17,38,.2)}

  /* ── FORGOT PASSWORD ── */
  .forgot-link{display:block;text-align:right;margin-top:-4px;margin-bottom:10px;font-size:.75rem;color:var(--gold-d);cursor:pointer;text-decoration:none;background:none;border:none;font-family:'Outfit',sans-serif;padding:0}
  .forgot-link:hover{color:var(--gold);text-decoration:underline}
  .reset-pw-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;animation:fadeIn .15s ease}
  .reset-pw-box{background:var(--sur);border-radius:20px;padding:32px 28px;width:100%;max-width:400px;box-shadow:0 20px 60px rgba(0,0,0,.25);animation:slideUp .25s ease;position:relative}
  .reset-pw-box h3{font-family:'GFS Didot',serif;font-size:1.2rem;font-weight:700;margin-bottom:6px}
  .reset-pw-box .sub{font-size:.82rem;color:var(--muted);margin-bottom:20px;line-height:1.5}

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
  const [usernameStatus, setUsernameStatus] = useState(null); // null|'checking'|'available'|'taken'
  const [showForgot, setShowForgot] = useState(false);

  const strength = pwStrength(password);
  const strengthColors = ['#bbb', '#CE1126', '#f59e0b', '#D4AF37', '#006B3F'];
  const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong'];

  // Debounced live username availability check
  useEffect(() => {
    if (
      tab !== 'signup' ||
      username.length < 3 ||
      !/^[a-zA-Z0-9_]+$/.test(username)
    ) {
      setUsernameStatus(null);
      return;
    }
    setUsernameStatus('checking');
    const t = setTimeout(async () => {
      try {
        const ok = await sb.usernameAvailable(username);
        setUsernameStatus(ok ? 'available' : 'taken');
      } catch {
        setUsernameStatus(null);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [username, tab]);

  async function handleSubmit() {
    setError('');
    setSuccess('');

    // ── Sign-up validation ──────────────────────────────────────────────────
    if (tab === 'signup') {
      if (!username.trim()) {
        setError('Please choose a username');
        return;
      }
      if (username.trim().length < 3) {
        setError('Username must be at least 3 characters');
        return;
      }
      if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) {
        setError('Username can only use letters, numbers, and underscores (_)');
        return;
      }
      if (usernameStatus === 'taken') {
        setError('That username is already taken - please choose another');
        return;
      }
      if (password !== confirmPw) {
        setError('Passwords do not match');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
    }

    // ── Login: allow email OR username ──────────────────────────────────────
    let loginEmail = email.trim();
    if (tab === 'login') {
      if (!loginEmail) {
        setError('Please enter your email or username');
        return;
      }
      if (!loginEmail.includes('@')) {
        // Treat as username — resolve to email via profiles table
        const resolved = await sb.getEmailByUsername(loginEmail);
        if (!resolved) {
          setError('No account found with that username');
          return;
        }
        loginEmail = resolved;
      }
    }

    // ── Email format check (signup only — login already resolved above) ─────
    if (tab === 'signup') {
      const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(email.trim())) {
        setError('Please enter a valid email address');
        return;
      }
    }

    if (!password) {
      setError('Please enter your password');
      return;
    }

    setLoading(true);
    try {
      // Final uniqueness guard right before account creation
      if (tab === 'signup') {
        const ok = await sb.usernameAvailable(username.trim());
        if (!ok) {
          setError('That username was just taken - please pick another');
          setLoading(false);
          return;
        }
      }

      const data =
        tab === 'login'
          ? await sb.signIn(loginEmail, password)
          : await sb.signUp(email.trim(), password, username.trim());

      const raw = data.error?.message || data.error_description || data.msg;
      if (raw) {
        const msg = raw.toLowerCase();
        if (
          msg.includes('already registered') ||
          msg.includes('already been registered')
        ) {
          setError('This email is already registered - try signing in instead');
        } else if (
          msg.includes('invalid login credentials') ||
          msg.includes('invalid credentials')
        ) {
          setError('Incorrect email/username or password - please try again');
        } else if (msg.includes('email not confirmed')) {
          setError(
            "Your email isn't confirmed yet - check your inbox for the confirmation link",
          );
        } else if (msg.includes('rate limit') || msg.includes('too many')) {
          setError('Too many attempts - please wait a moment and try again');
        } else {
          setError(raw);
        }
        setLoading(false);
        return;
      }

      // Email confirmation pending (Supabase returns no access_token until confirmed)
      if (!data.access_token) {
        setSuccess(
          'Account created! 🎉 Check your email for a confirmation link. Click it to activate your account, then sign in.',
        );
        setLoading(false);
        return;
      }

      const user = data.user;
      if (!user.user_metadata) user.user_metadata = {};
      // Ensure username is always populated in the local user object
      if (!user.user_metadata.username) {
        user.user_metadata.username =
          tab === 'signup'
            ? username.trim()
            : user.user_metadata.full_name ||
              user.user_metadata.name ||
              loginEmail.split('@')[0];
      }
      const store = stayIn ? localStorage : sessionStorage;
      store.setItem('gchat_token', data.access_token);
      store.setItem('gchat_user', JSON.stringify(user));

      // Send welcome DM from admin to new users (non-blocking)
      if (tab === 'signup') {
        try {
          const adminProfiles = await fetch(
            `${SUPABASE_URL}/rest/v1/profiles?username=ilike.${encodeURIComponent(ADMIN_USERNAME)}&select=id,username&limit=1`,
            {
              headers: {
                Authorization: `Bearer ${data.access_token}`,
                apikey: SUPABASE_ANON_KEY,
              },
            },
          ).then((r) => r.json());
          if (Array.isArray(adminProfiles) && adminProfiles.length > 0) {
            const adminId = adminProfiles[0].id;
            // Send DM with new user's token (RLS: from_user_id must equal auth.uid()).
            // We set from_username = ADMIN_USERNAME so the conversation shows as
            // being with JoErl in the new user's DM list.
            await sb.sendDM(
              data.access_token,
              user.id,
              adminId,
              ADMIN_WELCOME_DM.username,
              username.trim(),
              ADMIN_WELCOME_DM.message,
              null,
            );
          }
        } catch {}
      }

      onAuth(user, data.access_token);
    } catch {
      setError('Network error - please check your connection and try again');
    }
    setLoading(false);
  }

  function switchTab(t) {
    setTab(t);
    setError('');
    setSuccess('');
    setUsernameStatus(null);
  }

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal">
        {/* Back/close button — fixed top-left on mobile, top-right on desktop */}
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ←
        </button>

        {showForgot && (
          <ForgotPasswordModal
            onClose={() => setShowForgot(false)}
            onSwitchToLogin={() => {
              setShowForgot(false);
              switchTab('login');
            }}
          />
        )}

        <div className="modal-logo">
          Kasa<span>Point</span> &bull;
        </div>
        <p className="modal-sub">
          {tab === 'login'
            ? "Welcome back, m'adamfo!"
            : "Join Ghana's favourite chat platform"}
        </p>

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
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                type="text"
                placeholder="e.g. kofi_mensah"
                value={username}
                onChange={(e) =>
                  setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))
                }
                maxLength={30}
                style={{
                  paddingRight: 36,
                  borderColor:
                    usernameStatus === 'taken'
                      ? 'var(--red)'
                      : usernameStatus === 'available'
                        ? 'var(--green)'
                        : undefined,
                }}
                autoComplete="username"
              />
              {usernameStatus === 'checking' && (
                <span className="username-status checking">···</span>
              )}
              {usernameStatus === 'available' && (
                <span className="username-status ok">✓</span>
              )}
              {usernameStatus === 'taken' && (
                <span className="username-status taken">✕</span>
              )}
            </div>
            {usernameStatus === 'taken' && (
              <div
                style={{
                  fontSize: '.72rem',
                  color: 'var(--red)',
                  marginTop: 4,
                }}
              >
                Username already taken
              </div>
            )}
            {usernameStatus === 'available' && (
              <div
                style={{
                  fontSize: '.72rem',
                  color: 'var(--green)',
                  marginTop: 4,
                }}
              >
                ✓ Username available
              </div>
            )}
          </div>
        )}

        <div className="form-group">
          <label className="form-label">
            {tab === 'login' ? 'Email or Username' : 'Email Address'}
          </label>
          <input
            className="form-input"
            type={tab === 'login' ? 'text' : 'email'}
            placeholder={
              tab === 'login'
                ? 'you@example.com or your username'
                : 'you@example.com'
            }
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
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
              autoComplete={
                tab === 'login' ? 'current-password' : 'new-password'
              }
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

        {tab === 'login' && (
          <button
            type="button"
            className="forgot-link"
            onClick={() => setShowForgot(true)}
          >
            Forgot password?
          </button>
        )}

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
                      : confirmPw && confirmPw === password
                        ? 'var(--green)'
                        : undefined,
                }}
                autoComplete="new-password"
              />
            </div>
          </div>
        )}

        {error && <div className="form-error">⚠ {error}</div>}
        {success && <div className="form-success">{success}</div>}

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
          disabled={loading || (tab === 'signup' && usernameStatus === 'taken')}
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

// ─── CHANGE USERNAME MODAL ─────────────────────────────────────────────────────
function ChangeUsernameModal({ token, currentUsername, onSave, onClose }) {
  const [newUsername, setNewUsername] = useState('');
  const [status, setStatus] = useState(null); // null|'checking'|'available'|'taken'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (newUsername.length < 3 || !/^[a-zA-Z0-9_]+$/.test(newUsername)) {
      setStatus(null);
      return;
    }
    setStatus('checking');
    const t = setTimeout(async () => {
      try {
        const ok = await sb.usernameAvailable(newUsername.trim());
        setStatus(ok ? 'available' : 'taken');
      } catch {
        setStatus(null);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [newUsername]);

  async function handleSave() {
    if (!newUsername.trim() || status !== 'available') return;
    setLoading(true);
    setError('');
    try {
      const res = await sb.updateUsername(token, newUsername.trim());
      if (res?.user_metadata?.username || res?.id) {
        onSave(newUsername.trim());
      } else {
        setError('Could not update username. Please try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  }

  return (
    <div
      className="username-modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="username-modal">
        <button className="pp-close" onClick={onClose}>
          ✕
        </button>
        <h3>Change Username</h3>
        <p className="um-sub">
          Current: <strong>@{currentUsername}</strong>
        </p>
        <div className="um-warning">
          ⚠ You can only change your username <strong>once</strong>. Choose
          carefully!
        </div>
        <div className="form-group" style={{ position: 'relative' }}>
          <label className="form-label">New Username</label>
          <input
            className="form-input"
            type="text"
            placeholder="e.g. kofi_mensah"
            value={newUsername}
            onChange={(e) =>
              setNewUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))
            }
            maxLength={30}
            style={{
              paddingRight: 36,
              borderColor:
                status === 'taken'
                  ? 'var(--red)'
                  : status === 'available'
                    ? 'var(--green)'
                    : undefined,
            }}
            autoFocus
          />
          {status === 'checking' && (
            <span className="username-status checking">...</span>
          )}
          {status === 'available' && (
            <span className="username-status ok">✓</span>
          )}
          {status === 'taken' && (
            <span className="username-status taken">✕</span>
          )}
        </div>
        {status === 'taken' && (
          <div
            style={{
              fontSize: '.75rem',
              color: 'var(--red)',
              marginTop: -8,
              marginBottom: 8,
            }}
          >
            Username already taken
          </div>
        )}
        {error && <div className="form-error">⚠ {error}</div>}
        <div className="um-actions">
          <button className="um-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="um-save"
            onClick={handleSave}
            disabled={loading || status !== 'available'}
          >
            {loading ? 'Saving...' : 'Save Username'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CHANGE PASSWORD MODAL ────────────────────────────────────────────────────
function ChangePasswordModal({ token, onClose, onToast }) {
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const strength = pwStrength(newPw);
  const strengthColors = ['#bbb', '#CE1126', '#f59e0b', '#D4AF37', '#006B3F'];
  const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong'];

  async function handleSave() {
    if (!newPw || newPw !== confirmPw) {
      setError('Passwords do not match.');
      return;
    }
    if (newPw.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await sb.changePassword(token, newPw);
      if (res?.id || res?.email) {
        onToast({ msg: '🔒 Password updated successfully!', type: 'success' });
        onClose();
      } else {
        setError(
          res?.msg || res?.message || 'Could not update password. Try again.',
        );
      }
    } catch {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  }

  return (
    <div
      className="username-modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="username-modal">
        <button className="pp-close" onClick={onClose}>
          ✕
        </button>
        <h3>Change Password</h3>
        <p className="um-sub">Choose a strong new password for your account.</p>
        <div className="form-group">
          <label className="form-label">New Password</label>
          <div className="pw-wrap">
            <input
              className="form-input"
              type={showPw ? 'text' : 'password'}
              placeholder="••••••••"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              style={{ paddingRight: 52 }}
              autoFocus
              autoComplete="new-password"
            />
            <button
              className="pw-toggle"
              type="button"
              onClick={() => setShowPw((v) => !v)}
            >
              {showPw ? '🙈' : '👁'}
            </button>
          </div>
          {newPw.length > 0 && (
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
        <div className="form-group">
          <label className="form-label">Confirm New Password</label>
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
                  confirmPw && confirmPw !== newPw
                    ? 'var(--red)'
                    : confirmPw && confirmPw === newPw
                      ? 'var(--green)'
                      : undefined,
              }}
              autoComplete="new-password"
            />
          </div>
        </div>
        {error && <div className="form-error">⚠ {error}</div>}
        <div className="um-actions">
          <button className="um-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="um-save"
            onClick={handleSave}
            disabled={loading || !newPw || newPw !== confirmPw}
          >
            {loading ? 'Saving...' : 'Update Password'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── FORGOT PASSWORD MODAL ────────────────────────────────────────────────────
function ForgotPasswordModal({ onClose, onSwitchToLogin }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSend() {
    const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await sb.forgotPassword(email.trim());
      // Always show success to avoid email enumeration
      setSent(true);
    } catch {
      setError('Network error. Please check your connection and try again.');
    }
    setLoading(false);
  }

  return (
    <div
      className="reset-pw-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="reset-pw-box">
        <button className="pp-close" onClick={onClose}>
          ✕
        </button>
        <div className="modal-logo" style={{ marginBottom: 12 }}>
          Kasa<span>Point</span> &bull;
        </div>
        {sent ? (
          <>
            <h3>Check your inbox 📬</h3>
            <p className="sub">
              If an account exists for <strong>{email}</strong>, we've sent a
              password reset link. Click the link in the email to set a new
              password.
            </p>
            <p className="sub" style={{ marginTop: 8 }}>
              Didn't get it? Check your spam folder or try again in a few
              minutes.
            </p>
            <button
              className="btn btn-gold btn-full"
              style={{ marginTop: 16 }}
              onClick={onSwitchToLogin || onClose}
            >
              Back to Sign In
            </button>
          </>
        ) : (
          <>
            <h3>Reset Password</h3>
            <p className="sub">
              Enter your email address and we'll send you a link to reset your
              password.
            </p>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                className="form-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                autoFocus
                autoComplete="email"
              />
            </div>
            {error && <div className="form-error">⚠ {error}</div>}
            <button
              className="btn btn-gold btn-full"
              style={{ marginTop: 8 }}
              onClick={handleSend}
              disabled={loading}
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
            <button
              className="forgot-link"
              style={{
                textAlign: 'center',
                marginTop: 12,
                display: 'block',
                width: '100%',
              }}
              onClick={onSwitchToLogin || onClose}
            >
              ← Back to Sign In
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── RESET PASSWORD MODAL (from email link) ────────────────────────────────────
function ResetPasswordModal({ accessToken, onClose, onToast }) {
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const strength = pwStrength(newPw);
  const strengthColors = ['#bbb', '#CE1126', '#f59e0b', '#D4AF37', '#006B3F'];
  const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong'];

  async function handleReset() {
    if (!newPw || newPw !== confirmPw) {
      setError('Passwords do not match.');
      return;
    }
    if (strength < 2) {
      setError('Please choose a stronger password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await sb.resetPasswordWithToken(accessToken, newPw);
      if (res?.id || res?.email) {
        onToast({
          msg: '🔒 Password reset successfully! Please sign in.',
          type: 'success',
        });
        onClose();
      } else {
        setError(
          res?.msg ||
            res?.message ||
            'Could not reset password. The link may have expired.',
        );
      }
    } catch {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  }

  return (
    <div className="reset-pw-overlay">
      <div className="reset-pw-box">
        <div className="modal-logo" style={{ marginBottom: 12 }}>
          Kasa<span>Point</span> &bull;
        </div>
        <h3>Set New Password</h3>
        <p className="sub">Choose a strong new password for your account.</p>
        <div className="form-group">
          <label className="form-label">New Password</label>
          <div className="pw-wrap">
            <input
              className="form-input"
              type={showPw ? 'text' : 'password'}
              placeholder="••••••••"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              style={{ paddingRight: 52 }}
              autoFocus
              autoComplete="new-password"
            />
            <button
              className="pw-toggle"
              type="button"
              onClick={() => setShowPw((v) => !v)}
            >
              {showPw ? '🙈' : '👁'}
            </button>
          </div>
          {newPw.length > 0 && (
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
        <div className="form-group">
          <label className="form-label">Confirm New Password</label>
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
                  confirmPw && confirmPw !== newPw
                    ? 'var(--red)'
                    : confirmPw && confirmPw === newPw
                      ? 'var(--green)'
                      : undefined,
              }}
              autoComplete="new-password"
            />
          </div>
        </div>
        {error && <div className="form-error">⚠ {error}</div>}
        <div className="um-actions">
          <button
            className="um-save"
            onClick={handleReset}
            disabled={loading || !newPw || newPw !== confirmPw}
          >
            {loading ? 'Saving...' : 'Set New Password'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CHAT SCREEN ───────────────────────────────────────────────────────────────
function ChatScreen({ user, token, onLogout, onToast }) {
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [sidebarTab, setSidebarTab] = useState('rooms'); // 'rooms' | 'dms'
  const [dmConversations, setDmConversations] = useState([]);
  const [activeDm, setActiveDm] = useState(null); // { userId, username }
  const [dmMessages, setDmMessages] = useState([]);
  const [view, setView] = useState(() => {
    try {
      return sessionStorage.getItem('kp_view') || 'lobby';
    } catch {
      return 'lobby';
    }
  });
  const [input, setInput] = useState('');
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState(null); // { id, username, content }
  const [editingMsg, setEditingMsg] = useState(null); // { id, type:'room'|'dm' }
  const [editInput, setEditInput] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profilePopup, setProfilePopup] = useState(null);
  const [notifDismissed, setNotifDismissed] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);
  const [roomUnread, setRoomUnread] = useState({}); // roomId -> count
  const [dmSearch, setDmSearch] = useState('');
  const [dmSearchResults, setDmSearchResults] = useState([]); // [{id, username}]
  const [dmSearchLoading, setDmSearchLoading] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [hasChangedUsernameLocal, setHasChangedUsernameLocal] = useState(
    !!user?.user_metadata?.username_changed,
  );
  const [displayUsername, setDisplayUsername] = useState(
    user?.user_metadata?.username ||
      user?.user_metadata?.full_name ||
      user?.email?.split('@')[0] ||
      'User',
  );
  // roomLastSeen: roomId -> ISO timestamp of last message seen, persisted in localStorage
  const [roomLastSeen, setRoomLastSeen] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('kp_room_last_seen') || '{}');
    } catch {
      return {};
    }
  });
  const roomLastSeenRef = useRef(roomLastSeen);

  const username = displayUsername;
  // Track if user already changed username — use local state so it updates instantly without reload
  const hasChangedUsername = hasChangedUsernameLocal;
  const bottomRef = useRef(null);
  const messagesAreaRef = useRef(null);
  const roomPollRef = useRef(null);
  const dmPollRef = useRef(null);
  const knownDmIds = useRef(new Set());
  const userScrolledUp = useRef(false);
  const firstUnreadRef = useRef(null);
  const notifPermission =
    typeof Notification !== 'undefined' ? Notification.permission : 'denied';

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

  // Persist view to sessionStorage so reload restores position
  function setViewPersisted(v) {
    try {
      sessionStorage.setItem('kp_view', v);
    } catch {}
    setView(v);
  }

  // Load rooms
  useEffect(() => {
    async function load() {
      try {
        const data = await sb.getRooms(token);
        const list =
          Array.isArray(data) && data.length > 0 ? data : FALLBACK_ROOMS;
        setRooms(list);
        // Restore active room from sessionStorage after rooms are loaded
        try {
          const savedRoom = sessionStorage.getItem('kp_active_room');
          const savedView = sessionStorage.getItem('kp_view');
          const savedDm = sessionStorage.getItem('kp_active_dm');
          if (savedView === 'room' && savedRoom) {
            const r = list.find((x) => x.id === savedRoom) || list[0];
            if (r) setActiveRoom(r);
          } else if (savedView === 'dm' && savedDm) {
            try {
              setActiveDm(JSON.parse(savedDm));
            } catch {}
            setSidebarTab('dms');
          }
        } catch {}
      } catch {
        setRooms(FALLBACK_ROOMS);
      }
      setLoadingRooms(false);
    }
    load();
  }, [token]);

  // Poll room messages
  useEffect(() => {
    if (!activeRoom || view !== 'room') return;
    clearInterval(roomPollRef.current);
    userScrolledUp.current = false;
    firstUnreadRef.current = null;
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
            // In-app toast for private messages
            onToast({
              msg: `💬 New message from ${m.from_username}`,
              type: '',
            });
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

  // 5-minute unread reminder toast
  useEffect(() => {
    const t = setInterval(
      () => {
        setTotalUnread((current) => {
          if (current > 0) {
            onToast({ msg: `🔔 Unread messages (${current})`, type: '' });
          }
          return current;
        });
      },
      5 * 60 * 1000,
    );
    return () => clearInterval(t);
  }, []);

  // Background room badge polling — runs on all views, every 20s
  useEffect(() => {
    if (rooms.length === 0) return;
    async function checkRoomUnread() {
      const newUnread = {};
      for (const room of rooms) {
        try {
          const msgs = await sb.getMessages(token, room.id);
          if (Array.isArray(msgs) && msgs.length > 0) {
            const lastSeen = roomLastSeenRef.current[room.id];
            if (lastSeen) {
              newUnread[room.id] = msgs.filter(
                (m) => new Date(m.created_at) > new Date(lastSeen),
              ).length;
            } else {
              newUnread[room.id] = 0;
            }
          }
        } catch {}
      }
      setRoomUnread(newUnread);
    }
    checkRoomUnread();
    const t = setInterval(checkRoomUnread, 20000);
    return () => clearInterval(t);
  }, [rooms, token]);

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
    userScrolledUp.current = false;
    const t = setInterval(fetchThread, 3000);
    // Mark read when opening conversation
    sb.markDMsRead(token, activeDm.userId, user.id).catch(() => {});
    return () => clearInterval(t);
  }, [activeDm, view, token, user.id]);

  // Smart auto-scroll: only scroll to bottom if user is already near bottom
  // Smart auto-scroll: scroll to first unread on initial room load, else bottom
  useEffect(() => {
    const el = messagesAreaRef.current;
    if (!el) return;
    if (!userScrolledUp.current) {
      // If we have a first-unread marker visible, scroll to it on initial load
      if (firstUnreadRef.current && view === 'room') {
        firstUnreadRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      } else {
        el.scrollTop = el.scrollHeight;
      }
    }
  }, [messages, dmMessages]);

  // When viewing a room and messages load, update lastSeen and clear unread badge
  useEffect(() => {
    if (view === 'room' && activeRoom && messages.length > 0 && !loadingMsgs) {
      const latest = messages[messages.length - 1].created_at;
      const updated = { ...roomLastSeenRef.current, [activeRoom.id]: latest };
      roomLastSeenRef.current = updated;
      setRoomLastSeen(updated);
      localStorage.setItem('kp_room_last_seen', JSON.stringify(updated));
      setRoomUnread((prev) => ({ ...prev, [activeRoom.id]: 0 }));
    }
  }, [messages, view, activeRoom, loadingMsgs]);

  async function sendMessage() {
    const content = input.trim();
    if (!content || sending) return;
    setInput('');
    const currentReply = replyTo;
    setReplyTo(null);
    setSending(true);
    if (view === 'room' && activeRoom) {
      const opt = {
        id: `opt-${Date.now()}`,
        username,
        content,
        created_at: new Date().toISOString(),
        optimistic: true,
        reply_to_id: currentReply?.id || null,
        reply_to_username: currentReply?.username || null,
        reply_to_content: currentReply?.content || null,
      };
      setMessages((p) => [...p, opt]);
      userScrolledUp.current = false;
      try {
        await sb.sendMessage(
          token,
          activeRoom.id,
          user.id,
          username,
          content,
          currentReply,
        );
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
        reply_to_id: currentReply?.id || null,
        reply_to_username: currentReply?.username || null,
        reply_to_content: currentReply?.content || null,
      };
      setDmMessages((p) => [...p, opt]);
      userScrolledUp.current = false;
      try {
        await sb.sendDM(
          token,
          user.id,
          activeDm.userId,
          username,
          activeDm.username,
          content,
          currentReply,
        );
        const fresh = await sb.getDMThread(token, user.id, activeDm.userId);
        if (Array.isArray(fresh)) setDmMessages(fresh);
      } catch {}
    }
    setSending(false);
  }

  async function handleEditMsg(id, type) {
    const content = editInput.trim();
    if (!content) return;
    setEditingMsg(null);
    const now = new Date().toISOString();
    if (type === 'room') {
      setMessages((p) =>
        p.map((m) => (m.id === id ? { ...m, content, edited_at: now } : m)),
      );
      try {
        await sb.editMessage(token, id, content);
      } catch {}
    } else {
      setDmMessages((p) =>
        p.map((m) => (m.id === id ? { ...m, content, edited_at: now } : m)),
      );
      try {
        await sb.editDM(token, id, content);
      } catch {}
    }
  }

  async function handleDeleteMsg(id, type) {
    if (type === 'room') {
      setMessages((p) => p.filter((m) => m.id !== id));
      try {
        await sb.deleteMessage(token, id);
      } catch {}
    } else {
      setDmMessages((p) => p.filter((m) => m.id !== id));
      try {
        await sb.deleteDM(token, id);
      } catch {}
    }
  }

  function startEdit(msg, type) {
    setEditingMsg({ id: msg.id, type });
    setEditInput(msg.content);
  }

  async function handleDeleteAccount() {
    setDeletingAccount(true);
    setDeleteError('');
    try {
      const result = await sb.deleteAccount(token);
      if (result) {
        // Clear all stored session data
        ['gchat_token', 'gchat_user'].forEach((k) => {
          localStorage.removeItem(k);
          sessionStorage.removeItem(k);
        });
        [
          'kp_view',
          'kp_active_room',
          'kp_active_dm',
          'kp_room_last_seen',
        ].forEach((k) => {
          try {
            localStorage.removeItem(k);
          } catch {}
          try {
            sessionStorage.removeItem(k);
          } catch {}
        });
        onLogout();
      } else {
        setDeleteError(
          'Could not delete account. Please try again or contact support.',
        );
        setDeletingAccount(false);
      }
    } catch (e) {
      setDeleteError(
        'Network error. Please check your connection and try again.',
      );
      setDeletingAccount(false);
    }
  }

  function handleMessagesScroll(e) {
    const el = e.currentTarget;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    // Consider user "scrolled up" if more than 120px from bottom
    // This threshold is larger for mobile fat-finger tolerance
    userScrolledUp.current = distFromBottom > 120;
  }

  // Debounced DM user search
  useEffect(() => {
    if (dmSearch.trim().length < 2) {
      setDmSearchResults([]);
      return;
    }
    setDmSearchLoading(true);
    const t = setTimeout(async () => {
      try {
        // Search through existing DM conversations first
        const localMatches = dmConversations.filter((c) =>
          c.username.toLowerCase().includes(dmSearch.trim().toLowerCase()),
        );
        // Also try server-side search for users not yet in DM list
        const serverResults = await sb.searchUsers(token, dmSearch.trim());
        const serverUsers = Array.isArray(serverResults)
          ? serverResults.filter(
              (u) =>
                u.id !== user.id &&
                !localMatches.find((c) => c.userId === u.id),
            )
          : [];
        // Merge: local DM contacts first, then new users from server
        const merged = [
          ...localMatches.map((c) => ({
            id: c.userId,
            username: c.username,
            inDms: true,
          })),
          ...serverUsers.map((u) => ({
            id: u.id,
            username: u.username,
            inDms: false,
          })),
        ];
        setDmSearchResults(merged);
      } catch {
        // Fallback: just filter existing conversations
        const localMatches = dmConversations
          .filter((c) =>
            c.username.toLowerCase().includes(dmSearch.trim().toLowerCase()),
          )
          .map((c) => ({ id: c.userId, username: c.username, inDms: true }));
        setDmSearchResults(localMatches);
      }
      setDmSearchLoading(false);
    }, 350);
    return () => clearTimeout(t);
  }, [dmSearch, dmConversations, token, user.id]);

  function openDm(userId, uname) {
    userScrolledUp.current = false;
    setActiveDm({ userId, username: uname });
    try {
      sessionStorage.setItem(
        'kp_active_dm',
        JSON.stringify({ userId, username: uname }),
      );
    } catch {}
    setViewPersisted('dm');
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

      {showUsernameModal && (
        <ChangeUsernameModal
          token={token}
          currentUsername={username}
          onSave={(newName) => {
            setDisplayUsername(newName);
            setShowUsernameModal(false);
            // Persist updated user to localStorage so hasChangedUsername is true on next render
            const stored =
              localStorage.getItem('gchat_user') ||
              sessionStorage.getItem('gchat_user');
            if (stored) {
              try {
                const u = JSON.parse(stored);
                if (!u.user_metadata) u.user_metadata = {};
                u.user_metadata.username = newName;
                u.user_metadata.username_changed = true;
                const updated = JSON.stringify(u);
                localStorage.setItem('gchat_user', updated);
                sessionStorage.setItem('gchat_user', updated);
              } catch {}
            }
            // Force hasChangedUsername to true immediately without reload
            setHasChangedUsernameLocal(true);
          }}
          onClose={() => setShowUsernameModal(false)}
        />
      )}

      {showPasswordModal && (
        <ChangePasswordModal
          token={token}
          onClose={() => setShowPasswordModal(false)}
          onToast={onToast}
        />
      )}

      {/* ── SIDEBAR ── */}
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="kente" />
        <div className="sidebar-top">
          <div className="sidebar-brand">
            <button
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
              onClick={() => {
                setViewPersisted('lobby');
                setSidebarOpen(false);
              }}
            >
              <span className="sidebar-logo">
                Kasa<span>Point</span> &bull;
              </span>
            </button>
          </div>
          <div className="profile-card">
            <div
              className="profile-avatar"
              style={{ background: avatarColor(username) }}
            >
              {getInitials(username)}
            </div>
            <div
              className="profile-name"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                flexWrap: 'wrap',
              }}
            >
              {username}
              {isAdmin(user) && (
                <>
                  <span className="badge-admin">👑 Admin</span>
                  <span className="badge-premium">⭐ Premium</span>
                </>
              )}
            </div>
            {joinedDate && (
              <div className="profile-joined">Joined {joinedDate}</div>
            )}
            <div className="online-pill">Online</div>&nbsp;&nbsp;
            <button
              className="change-username-btn"
              onClick={() => setShowUsernameModal(true)}
              disabled={hasChangedUsername}
              title={
                hasChangedUsername
                  ? 'Username can only be changed once'
                  : 'Change your username'
              }
            >
              ✏ {hasChangedUsername ? 'Username locked' : 'Change username'}
            </button>
            <button
              className="change-username-btn"
              style={{ marginLeft: 4 }}
              onClick={() => setShowPasswordModal(true)}
              title="Change your password"
            >
              🔒 Change password
            </button>
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
                    try {
                      sessionStorage.setItem('kp_active_room', r.id);
                    } catch {}
                    setViewPersisted('room');
                    setSidebarOpen(false);
                  }}
                >
                  <span className="room-item-icon">{r.name.split(' ')[0]}</span>
                  <span className="room-item-name">
                    {r.name.slice(r.name.indexOf(' ') + 1)}
                  </span>
                  {roomUnread[r.id] > 0 && (
                    <span
                      className="unread-badge"
                      style={{ marginLeft: 'auto' }}
                    >
                      {roomUnread[r.id] > 99 ? '99+' : roomUnread[r.id]}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              minHeight: 0,
            }}
          >
            {/* Search bar */}
            <div className="dm-search-wrap">
              <span className="dm-search-icon">🔍</span>
              <input
                className="dm-search-input"
                type="text"
                placeholder="Search by username..."
                value={dmSearch}
                onChange={(e) => setDmSearch(e.target.value)}
              />
              {dmSearch && (
                <button
                  className="dm-search-clear"
                  onClick={() => {
                    setDmSearch('');
                    setDmSearchResults([]);
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Search results OR conversation list */}
            {dmSearch.trim().length >= 2 ? (
              <div
                className="dm-search-results"
                style={{ flex: 1, overflowY: 'auto' }}
              >
                {dmSearchLoading ? (
                  <div className="loading-dots">
                    <span />
                    <span />
                    <span />
                  </div>
                ) : dmSearchResults.length === 0 ? (
                  <div className="dm-empty">
                    <div className="dm-empty-icon">🔎</div>
                    <p>No users found for &quot;{dmSearch}&quot;</p>
                  </div>
                ) : (
                  <>
                    <div className="dm-search-label">Users</div>
                    {dmSearchResults.map((u) => (
                      <button
                        key={u.id}
                        className="dm-search-item"
                        onClick={() => {
                          openDm(u.id, u.username);
                          setDmSearch('');
                          setDmSearchResults([]);
                        }}
                      >
                        <div
                          className="dm-av"
                          style={{ background: avatarColor(u.username) }}
                        >
                          {getInitials(u.username)}
                        </div>
                        <div className="dm-info">
                          <div className="dm-name">{u.username}</div>
                          <div className="dm-preview">
                            {u.inDms
                              ? 'Existing conversation'
                              : 'Start a new chat'}
                          </div>
                        </div>
                        {!u.inDms && (
                          <span className="dm-search-new-badge">New</span>
                        )}
                      </button>
                    ))}
                  </>
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
                      Search a username above to start a conversation.
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
                        <div
                          className="dm-name"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          {conv.username}
                          {conv.username === ADMIN_USERNAME && (
                            <span
                              className="badge-admin"
                              style={{ fontSize: '.52rem', padding: '1px 5px' }}
                            >
                              👑
                            </span>
                          )}
                        </div>
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
          </div>
        )}

        <div className="sidebar-footer">
          {isAdmin(user) && (
            <button
              className="admin-panel-btn"
              onClick={() => setShowAdminPanel(true)}
              style={{
                width: '100%',
                marginBottom: 6,
                justifyContent: 'center',
              }}
            >
              👑 Admin Panel
            </button>
          )}
          <button className="signout-btn" onClick={onLogout}>
            <span>&#x238B;</span> Sign Out
          </button>
          <button
            className="delete-account-btn"
            onClick={() => setShowDeleteWarning(true)}
          >
            🗑 Delete Account
          </button>
        </div>

        {/* Delete account warning dialog */}
        {showDeleteWarning && (
          <div
            className="username-modal-overlay"
            onClick={(e) =>
              e.target === e.currentTarget && setShowDeleteWarning(false)
            }
          >
            <div className="username-modal">
              <button
                className="pp-close"
                onClick={() => setShowDeleteWarning(false)}
              >
                ✕
              </button>
              <h3 style={{ color: 'var(--red)' }}>⚠ Delete Account</h3>
              <p className="um-sub" style={{ marginTop: 8 }}>
                This action is <strong>permanent and irreversible</strong>. Your
                account will be deleted and you will be signed out immediately.
              </p>
              <div
                className="um-warning"
                style={{
                  background: 'rgba(206,17,38,.08)',
                  borderColor: 'rgba(206,17,38,.3)',
                  color: 'var(--red)',
                }}
              >
                All your data will be lost. Your messages will show as{' '}
                <em>"Deleted account"</em> in chats.
              </div>
              {deleteError && <div className="form-error">⚠ {deleteError}</div>}
              <div className="um-actions">
                <button
                  className="um-cancel"
                  onClick={() => setShowDeleteWarning(false)}
                >
                  Cancel
                </button>
                <button
                  className="um-save"
                  style={{ background: 'var(--red)' }}
                  disabled={deletingAccount}
                  onClick={handleDeleteAccount}
                >
                  {deletingAccount ? 'Deleting...' : 'Yes, delete my account'}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Admin panel */}
        {showAdminPanel && (
          <div
            className="username-modal-overlay"
            onClick={(e) =>
              e.target === e.currentTarget && setShowAdminPanel(false)
            }
          >
            <div className="username-modal" style={{ maxWidth: 420 }}>
              <button
                className="pp-close"
                onClick={() => setShowAdminPanel(false)}
              >
                ✕
              </button>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="badge-admin">👑 Admin</span> Admin Panel
              </h3>
              <p className="um-sub" style={{ marginTop: 8 }}>
                Welcome, <strong>{username}</strong>. You have full admin access
                to KasaPoint.
              </p>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  marginTop: 14,
                }}
              >
                <div
                  style={{
                    background: 'var(--sur2)',
                    borderRadius: 12,
                    padding: '12px 14px',
                  }}
                >
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: '.82rem',
                      marginBottom: 4,
                    }}
                  >
                    🛡 Admin Privileges
                  </div>
                  <ul
                    style={{
                      listStyle: 'none',
                      padding: 0,
                      margin: 0,
                      fontSize: '.78rem',
                      color: 'var(--soft)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 5,
                    }}
                  >
                    <li>✓ Delete any message in any room</li>
                    <li>✓ Delete any direct message</li>
                    <li>✓ Pinned badge visible to all users</li>
                    <li>✓ Premium badge — early access to new features</li>
                    <li>✓ Auto welcome DM sent to every new user</li>
                    <li>✓ Future: user management & moderation tools</li>
                  </ul>
                </div>
                <div
                  style={{
                    background: 'rgba(212,175,55,.08)',
                    border: '1px solid rgba(212,175,55,.25)',
                    borderRadius: 12,
                    padding: '10px 14px',
                    fontSize: '.75rem',
                    color: 'var(--gold-d)',
                  }}
                >
                  ⭐ <strong>Premium</strong> — Your account is permanently
                  premium. Future paid features will be unlocked for you
                  automatically.
                </div>
              </div>
              <div className="um-actions" style={{ marginTop: 18 }}>
                <button
                  className="um-cancel"
                  onClick={() => setShowAdminPanel(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="chat-area">
        <div className="kente" style={{ flexShrink: 0 }} />

        {/* Header — always visible */}
        <div className="chat-header">
          <button className="hamburger" onClick={() => setSidebarOpen(true)}>
            <span />
            <span />
            <span />
          </button>
          {view === 'lobby' && (
            <>
              <div className="chat-room-icon">
                K<span style={{ color: 'var(--gold)' }}>P</span>
              </div>
              <div className="chat-header-info">
                <div className="chat-room-name">
                  Kasa<span style={{ color: 'var(--gold)' }}>Point</span> &bull;
                </div>
                <div className="chat-room-desc">
                  Choose a room or conversation
                </div>
              </div>
            </>
          )}
          {view === 'dm' && activeDm && (
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
                <button
                  className="back-btn"
                  onClick={() => setViewPersisted('lobby')}
                >
                  ← Home
                </button>
              </div>
            </>
          )}
          {view === 'room' && activeRoom && (
            <>
              <div className="chat-room-icon">
                {activeRoom.name.split(' ')[0]}
              </div>
              <div className="chat-header-info">
                <div className="chat-room-name">
                  {activeRoom.name.slice(
                    (activeRoom.name.indexOf(' ') ?? -1) + 1,
                  )}
                </div>
                <div className="chat-room-desc">{activeRoom.description}</div>
              </div>
              <div className="chat-header-right">
                <button
                  className="back-btn"
                  onClick={() => setViewPersisted('lobby')}
                >
                  ← Home
                </button>
                <span className="member-count">🟢 Live</span>
              </div>
            </>
          )}
        </div>

        {/* Notification permission banner */}
        {showNotifBanner && (
          <div className="notif-banner" style={{ flexShrink: 0 }}>
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

        {/* ── LOBBY VIEW ── */}
        {view === 'lobby' && (
          <div className="lobby-area">
            <div className="lobby-greeting">
              <h2>
                <span style={{ color: 'var(--gold)' }}>Akwaaba,</span>{' '}
                {username}!
              </h2>
              <p>Pick up where you left off or jump into a new conversation.</p>
            </div>

            <div className="lobby-section-label">Chat Rooms</div>
            {loadingRooms ? (
              <div className="loading-dots">
                <span />
                <span />
                <span />
              </div>
            ) : (
              <div className="lobby-rooms-grid">
                {rooms.map((r) => (
                  <button
                    key={r.id}
                    className="lobby-room-card"
                    onClick={() => {
                      setActiveRoom(r);
                      try {
                        sessionStorage.setItem('kp_active_room', r.id);
                      } catch {}
                      setViewPersisted('room');
                      setSidebarOpen(false);
                    }}
                  >
                    <div className="lobby-room-emoji">
                      {r.name.split(' ')[0]}
                    </div>
                    <div className="lobby-room-name">
                      {r.name.slice(r.name.indexOf(' ') + 1)}
                    </div>
                    {r.description && (
                      <div className="lobby-room-desc">{r.description}</div>
                    )}
                    {roomUnread[r.id] > 0 && (
                      <span className="lobby-badge">
                        {roomUnread[r.id] > 99 ? '99+' : roomUnread[r.id]}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {dmConversations.length > 0 && (
              <>
                <div className="lobby-section-label" style={{ marginTop: 8 }}>
                  Recent Messages
                </div>
                <div className="lobby-dms-list">
                  {dmConversations.slice(0, 5).map((conv) => (
                    <button
                      key={conv.userId}
                      className="lobby-dm-card"
                      onClick={() => openDm(conv.userId, conv.username)}
                    >
                      <div
                        className="dm-av"
                        style={{
                          background: avatarColor(conv.username),
                          width: 38,
                          height: 38,
                          fontSize: '.7rem',
                          flexShrink: 0,
                        }}
                      >
                        {getInitials(conv.username)}
                      </div>
                      <div className="lobby-dm-info">
                        <div
                          className="lobby-dm-name"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          {conv.username}
                          {conv.username === ADMIN_USERNAME && (
                            <span
                              className="badge-admin"
                              style={{ fontSize: '.52rem', padding: '1px 5px' }}
                            >
                              👑
                            </span>
                          )}
                        </div>
                        <div className="lobby-dm-preview">
                          {conv.lastMsg.from_user_id === user.id ? 'You: ' : ''}
                          {conv.lastMsg.content}
                        </div>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-end',
                          gap: 4,
                          flexShrink: 0,
                        }}
                      >
                        <span className="lobby-dm-time">
                          {timeAgo(conv.lastMsg.created_at)}
                        </span>
                        {conv.unread > 0 && (
                          <span className="unread-badge">{conv.unread}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── ROOM VIEW ── */}
        {view === 'room' && (
          <>
            {!loadingMsgs && messages.length === 0 && (
              <div className="welcome-banner" style={{ flexShrink: 0 }}>
                <div className="welcome-text">
                  <h3>Welcome to {activeRoom?.name}!</h3>
                  <p>Be the first to say something, {username}! 🎉</p>
                  <div className="welcome-kente" />
                </div>
              </div>
            )}
            <div
              className="messages-area"
              ref={messagesAreaRef}
              onScroll={handleMessagesScroll}
            >
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
                (() => {
                  const lastSeen = roomLastSeen[activeRoom?.id];
                  let unreadDividerShown = false;
                  return grouped.map((group, gi) => {
                    const isOwn = group.sender === username;
                    // Check if this group contains the first unread message
                    const isFirstUnreadGroup =
                      !unreadDividerShown &&
                      lastSeen &&
                      group.messages[0] &&
                      new Date(group.messages[0].created_at) >
                        new Date(lastSeen);
                    if (isFirstUnreadGroup) unreadDividerShown = true;
                    return (
                      <div key={gi}>
                        {isFirstUnreadGroup && (
                          <div
                            ref={firstUnreadRef}
                            className="msg-date-divider"
                            style={{ color: 'var(--red)', fontWeight: 700 }}
                          >
                            ── Unread Messages ──
                          </div>
                        )}
                        <div className="msg-group">
                          {!isOwn && (
                            <div className="msg-sender-row">
                              <div
                                className="msg-avatar msg-avatar-clickable"
                                style={{
                                  background:
                                    group.sender === '[deleted]'
                                      ? 'var(--muted)'
                                      : avatarColor(group.sender),
                                }}
                                onClick={() =>
                                  group.sender !== '[deleted]' &&
                                  setProfilePopup({
                                    username: group.sender,
                                    userId: group.userId,
                                  })
                                }
                              >
                                {group.sender === '[deleted]'
                                  ? '✕'
                                  : getInitials(group.sender)}
                              </div>
                              <span
                                className="msg-sender-name"
                                style={
                                  group.sender === '[deleted]'
                                    ? {
                                        color: 'var(--muted)',
                                        fontStyle: 'italic',
                                        cursor: 'default',
                                      }
                                    : {}
                                }
                                onClick={() =>
                                  group.sender !== '[deleted]' &&
                                  setProfilePopup({
                                    username: group.sender,
                                    userId: group.userId,
                                  })
                                }
                              >
                                {group.sender === '[deleted]'
                                  ? 'Deleted account'
                                  : group.sender}
                              </span>
                              {group.sender === ADMIN_USERNAME && (
                                <span className="msg-sender-badges">
                                  <span className="badge-admin">👑 Admin</span>
                                  <span className="badge-premium">
                                    ⭐ Premium
                                  </span>
                                </span>
                              )}
                              <span className="msg-sender-time">
                                {timeAgo(group.messages[0].created_at)}
                              </span>
                            </div>
                          )}
                          {group.messages.map((msg, mi) => (
                            <div
                              key={msg.id || mi}
                              className={`msg-row-wrap ${isOwn ? 'own' : ''}`}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: isOwn ? 'flex-end' : 'flex-start',
                                marginLeft: isOwn ? 0 : 36,
                                marginRight: isOwn ? 4 : 0,
                                position: 'relative',
                              }}
                            >
                              {msg.reply_to_id && (
                                <div
                                  className="reply-preview"
                                  style={{
                                    alignSelf: isOwn
                                      ? 'flex-end'
                                      : 'flex-start',
                                  }}
                                >
                                  <div className="reply-author">
                                    ↩ {msg.reply_to_username}
                                  </div>
                                  <div className="reply-text">
                                    {msg.reply_to_content}
                                  </div>
                                </div>
                              )}
                              {editingMsg?.id === msg.id ? (
                                <div
                                  className="msg-edit-wrap"
                                  style={{
                                    alignSelf: isOwn
                                      ? 'flex-end'
                                      : 'flex-start',
                                  }}
                                >
                                  <textarea
                                    className="msg-edit-input"
                                    value={editInput}
                                    onChange={(e) =>
                                      setEditInput(e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleEditMsg(msg.id, 'room');
                                      }
                                      if (e.key === 'Escape')
                                        setEditingMsg(null);
                                    }}
                                    autoFocus
                                    rows={2}
                                  />
                                  <div className="msg-edit-actions">
                                    <button
                                      className="msg-edit-cancel"
                                      onClick={() => setEditingMsg(null)}
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      className="msg-edit-save"
                                      onClick={() =>
                                        handleEditMsg(msg.id, 'room')
                                      }
                                    >
                                      Save
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    flexDirection: isOwn
                                      ? 'row-reverse'
                                      : 'row',
                                    maxWidth: '100%',
                                  }}
                                >
                                  <div
                                    className={`msg-bubble ${isOwn ? 'own' : ''}`}
                                  >
                                    {msg.content}
                                    {msg.edited_at && (
                                      <span className="msg-edited-tag">
                                        · edited
                                      </span>
                                    )}
                                  </div>
                                  <div className="msg-actions">
                                    <button
                                      className="msg-reply-btn"
                                      title="Reply"
                                      onClick={() =>
                                        setReplyTo({
                                          id: msg.id,
                                          username:
                                            msg.username || group.sender,
                                          content: msg.content,
                                        })
                                      }
                                    >
                                      <svg viewBox="0 0 24 24">
                                        <path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z" />
                                      </svg>
                                    </button>
                                    {(isOwn || isAdmin(user)) && (
                                      <>
                                        {isOwn && (
                                          <button
                                            className="msg-act-btn"
                                            title="Edit"
                                            onClick={() =>
                                              startEdit(msg, 'room')
                                            }
                                          >
                                            <svg viewBox="0 0 24 24">
                                              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                                            </svg>
                                          </button>
                                        )}
                                        <button
                                          className="msg-act-btn del"
                                          title={
                                            isAdmin(user) && !isOwn
                                              ? 'Delete (Admin)'
                                              : 'Delete'
                                          }
                                          onClick={() =>
                                            handleDeleteMsg(msg.id, 'room')
                                          }
                                        >
                                          <svg viewBox="0 0 24 24">
                                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                                          </svg>
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                          <div
                            className="msg-time-small"
                            style={
                              isOwn
                                ? { textAlign: 'right', marginRight: 4 }
                                : { marginLeft: 36 }
                            }
                          >
                            {timeAgo(
                              group.messages[group.messages.length - 1]
                                .created_at,
                            )}
                            {isOwn && ' · You'}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()
              )}
              <div ref={bottomRef} />
            </div>
          </>
        )}

        {/* ── DM VIEW ── */}
        {view === 'dm' && (
          <div
            className="messages-area"
            ref={messagesAreaRef}
            onScroll={handleMessagesScroll}
          >
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
                        style={{
                          background:
                            sender === '[deleted]'
                              ? 'var(--muted)'
                              : avatarColor(sender),
                        }}
                      >
                        {sender === '[deleted]' ? '✕' : getInitials(sender)}
                      </div>
                      <span
                        className="msg-sender-name"
                        style={
                          sender === '[deleted]'
                            ? { color: 'var(--muted)', fontStyle: 'italic' }
                            : {}
                        }
                      >
                        {sender === '[deleted]' ? 'Deleted account' : sender}
                      </span>
                      {sender === ADMIN_USERNAME && (
                        <span className="msg-sender-badges">
                          <span className="badge-admin">👑 Admin</span>
                          <span className="badge-premium">⭐ Premium</span>
                        </span>
                      )}
                      <span className="msg-sender-time">
                        {timeAgo(msg.created_at)}
                      </span>
                    </div>
                  )}
                  <div
                    className="msg-row-wrap"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isOwn ? 'flex-end' : 'flex-start',
                      marginLeft: isOwn ? 0 : 36,
                      marginRight: isOwn ? 4 : 0,
                    }}
                  >
                    {msg.reply_to_id && (
                      <div
                        className="reply-preview"
                        style={{ alignSelf: isOwn ? 'flex-end' : 'flex-start' }}
                      >
                        <div className="reply-author">
                          ↩ {msg.reply_to_username}
                        </div>
                        <div className="reply-text">{msg.reply_to_content}</div>
                      </div>
                    )}
                    {editingMsg?.id === msg.id ? (
                      <div
                        className="msg-edit-wrap"
                        style={{ alignSelf: isOwn ? 'flex-end' : 'flex-start' }}
                      >
                        <textarea
                          className="msg-edit-input"
                          value={editInput}
                          onChange={(e) => setEditInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleEditMsg(msg.id, 'dm');
                            }
                            if (e.key === 'Escape') setEditingMsg(null);
                          }}
                          autoFocus
                          rows={2}
                        />
                        <div className="msg-edit-actions">
                          <button
                            className="msg-edit-cancel"
                            onClick={() => setEditingMsg(null)}
                          >
                            Cancel
                          </button>
                          <button
                            className="msg-edit-save"
                            onClick={() => handleEditMsg(msg.id, 'dm')}
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          flexDirection: isOwn ? 'row-reverse' : 'row',
                          maxWidth: '100%',
                        }}
                      >
                        <div className={`msg-bubble ${isOwn ? 'own' : ''}`}>
                          {msg.content}
                          {msg.edited_at && (
                            <span className="msg-edited-tag">· edited</span>
                          )}
                        </div>
                        <div className="msg-actions">
                          <button
                            className="msg-reply-btn"
                            title="Reply"
                            onClick={() =>
                              setReplyTo({
                                id: msg.id,
                                username: isOwn ? username : msg.from_username,
                                content: msg.content,
                              })
                            }
                          >
                            <svg viewBox="0 0 24 24">
                              <path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z" />
                            </svg>
                          </button>
                          {(isOwn || isAdmin(user)) && (
                            <>
                              {isOwn && (
                                <button
                                  className="msg-act-btn"
                                  title="Edit"
                                  onClick={() => startEdit(msg, 'dm')}
                                >
                                  <svg viewBox="0 0 24 24">
                                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                                  </svg>
                                </button>
                              )}
                              <button
                                className="msg-act-btn del"
                                title={
                                  isAdmin(user) && !isOwn
                                    ? 'Delete (Admin)'
                                    : 'Delete'
                                }
                                onClick={() => handleDeleteMsg(msg.id, 'dm')}
                              >
                                <svg viewBox="0 0 24 24">
                                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                                </svg>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
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

        {/* Reply bar — shown when replying to a message */}
        {replyTo && view !== 'lobby' && (
          <div className="reply-bar">
            <span className="reply-bar-icon">↩</span>
            <div className="reply-bar-content">
              <div className="reply-bar-author">
                Replying to {replyTo.username}
              </div>
              <div className="reply-bar-text">{replyTo.content}</div>
            </div>
            <button
              className="reply-bar-close"
              onClick={() => setReplyTo(null)}
            >
              ✕
            </button>
          </div>
        )}

        {/* Input — hidden on lobby */}
        {view !== 'lobby' && (
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
              onKeyDown={(e) =>
                e.key === 'Enter' && !e.shiftKey && sendMessage()
              }
              autoFocus
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
        )}
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
      desc: 'Voice notes, file sharing, stickers & more - coming soon.',
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
          - in a safe, beautiful space.
        </p>
        <div className="hero-cta">
          <button
            className="btn btn-gold btn-hero"
            onClick={() => onShowAuth('signup')}
          >
            Join Free - m'adamfo!
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
          From football to food, music to money - there's a room for everyone.
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
            Free. No credit card needed. Just community.
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
  const [resetToken, setResetToken] = useState(null); // password reset flow

  // Restore session + handle Google OAuth callback
  useEffect(() => {
    async function init() {
      // Check for OAuth redirect (access_token in URL hash)
      const hash = window.location.hash;
      if (hash.includes('access_token')) {
        const params = new URLSearchParams(hash.slice(1));
        const t = params.get('access_token');
        const type = params.get('type'); // 'recovery' for password reset
        if (t) {
          // Password reset flow — don't log user in, show reset modal
          if (type === 'recovery') {
            setResetToken(t);
            window.history.replaceState(
              {},
              document.title,
              window.location.pathname,
            );
            setBooting(false);
            return;
          }
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
                msg: `Akwaaba ${u.user_metadata.username}!`,
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
      msg: `Akwaaba ${name}! Welcome to KasaPoint! 🎉`,
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
      {resetToken && (
        <ResetPasswordModal
          accessToken={resetToken}
          onClose={() => {
            setResetToken(null);
            setShowAuth('login');
          }}
          onToast={setToast}
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
        <ChatScreen
          user={user}
          token={token}
          onLogout={handleLogout}
          onToast={setToast}
        />
      ) : (
        <div style={{ minHeight: '100vh' }}>
          <div className="kente" />
          <nav className="nav">
            <div className="nav-logo">
              Kasa<span>Point</span> &bull;
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
