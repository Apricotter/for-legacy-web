import { useEffect, useRef } from "preact/hooks";
import { ClipboardList, Hand, UserCircle, Image, Palette, Folder, Film, Mic, FileText, Plus, Bot } from "lucide-react";
import "./Dashboard.css";

export default function Dashboard() {
    const starsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const sc = starsRef.current;
        if (!sc) return;
        for (let i = 0; i < 65; i++) {
            const s = document.createElement("div");
            s.className = "star";
            const sz = Math.random() * 2 + 0.4;
            s.style.cssText = `width:${sz}px;height:${sz}px;top:${Math.random() * 100}%;left:${Math.random() * 100}%;animation:twinkle ${2 + Math.random() * 3}s ${Math.random() * 4}s infinite alternate;`;
            sc.appendChild(s);
        }
    }, []);

    return (
        <div className="dash-root">
            <div className="bg-layer" />
            <div className="bg-overlay" />
            <div className="stars" ref={starsRef} />

            {/* TOPBAR */}
            <div className="topbar">
                <div className="logo">
                    <svg width="28" height="28" viewBox="0 0 28 28">
                        <circle cx="14" cy="14" r="13" fill="rgba(255,160,60,.12)" stroke="rgba(255,160,60,.45)" strokeWidth="1" />
                        <text x="14" y="19" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#F5A623" fontFamily="sans-serif">A</text>
                    </svg>
                    <div>
                        <div className="logo-text">APRICOTTER</div>
                        <div className="logo-sub">Client Portal</div>
                    </div>
                </div>
                <div className="topbar-right">
                    <div className="notif-btn">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FFA03C" strokeWidth="2">
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
                        </svg>
                        <div className="notif-dot" />
                    </div>
                    <div className="user-chip">
                        <div className="avatar">PH</div>
                        <span className="user-name">Paul Hollis</span>
                    </div>
                </div>
            </div>

            <div className="layout">
                {/* SIDENAV */}
                <div className="sidenav">
                    <div className="ni active">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
                        <div className="tip">Dashboard</div>
                    </div>
                    <div className="ni">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                        <div className="tip">Messages</div>
                    </div>
                    <div className="ni">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10M12 20V4M6 20v-6" /></svg>
                        <div className="tip">Analytics</div>
                    </div>
                    <div className="ni">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <div className="tip">Approvals</div>
                    </div>
                    <div className="ndiv" />
                    <div className="ni">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
                        <div className="tip">Content Library</div>
                    </div>
                    <div className="ni">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg>
                        <div className="tip">Media Assets</div>
                    </div>
                    <div className="ni">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                        <div className="tip">Blog & Posts</div>
                    </div>
                    <div className="ni">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                        <div className="tip">EIM</div>
                    </div>
                    <div className="ndiv" />
                    <div className="ni">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>
                        <div className="tip">My Account</div>
                    </div>
                </div>

                {/* MAIN CONTENT */}
                <div className="content">

                    {/* WELCOME BAR */}
                    <div className="welcome-bar">
                        <div className="welcome-text">
                            <h2>Welcome back, Paul <Hand size={20} style={{ display: "inline", verticalAlign: "middle", marginLeft: "4px" }} /></h2>
                            <p>Your campaign is running. Here's what needs your attention today.</p>
                            <div className="status-chips">
                                <span className="chip chip-green">All Systems Live</span>
                                <span className="chip chip-orange">3 Unread Messages</span>
                                <span className="chip chip-red">5 Posts Awaiting Approval</span>
                                <span className="chip chip-red">2 Ads Need Your OK</span>
                            </div>
                        </div>
                        <div className="otto-wrap">
                            <img src="/otto-astronaut.png" alt="Otto" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                        </div>
                    </div>

                    {/* APPROVAL BANNER */}
                    <div className="approval-banner">
                        <div style={{ display: "flex", alignItems: "center", gap: "11px" }}>
                            <div className="appr-icon"><ClipboardList size={19} /></div>
                            <div>
                                <div className="appr-title">You have <span style={{ color: "#FFA03C" }}>5 posts</span> waiting for your approval</div>
                                <div className="appr-sub">Posts won't go live until you review them — takes less than 2 minutes</div>
                            </div>
                        </div>
                        <button className="appr-btn">Review Posts →</button>
                    </div>

                    {/* 4-CARD WINS BAR */}
                    <div className="wins-bar">
                        <div className="win-card wc-orange">
                            <div className="win-label">Books Sold · This Month</div>
                            <div className="win-number" style={{ color: "#FFA03C" }}>72</div>
                            <div className="win-delta">↑ from 2 when we started</div>
                            <div className="more-pill mp-orange">Full analytics →</div>
                        </div>
                        <div className="win-card wc-blue">
                            <div className="win-label">Total Followers</div>
                            <div className="win-number" style={{ color: "#60a5fa" }}>101K</div>
                            <div className="win-delta">↑ 2.4K this week</div>
                            <div className="more-pill mp-blue">Platform breakdown →</div>
                        </div>
                        <div className="win-card wc-green">
                            <div className="win-label">Posts Live · This Week</div>
                            <div className="win-number" style={{ color: "#4ade80" }}>60</div>
                            <div className="win-delta">Across 6 platforms</div>
                            <div className="more-pill mp-green">View calendar →</div>
                        </div>
                        <div className="win-card wc-pink">
                            <div className="win-label">Ad Performance · This Month</div>
                            <div className="win-number" style={{ color: "#f472b6" }}>3.8×</div>
                            <div className="win-delta">↑ ROAS · $420 spend · $1,596 return</div>
                            <div style={{ display: "flex", gap: "6px", marginTop: "7px", flexWrap: "wrap" }}>
                                <div className="more-pill mp-pink">128 conversions →</div>
                            </div>
                        </div>
                    </div>

                    {/* MID ROW */}
                    <div className="mid-grid">
                        <div className="card co">
                            <div className="ctitle to">Messages</div>
                            <div className="msg-row">
                                <div className="msg-av" style={{ background: "rgba(255,160,60,.18)", color: "#FFA03C" }}>AP</div>
                                <div className="msg-body">
                                    <div className="msg-from">Your Apricotter Team<span className="msg-new">NEW</span></div>
                                    <div className="msg-preview">Week 18 content plan is ready for review...</div>
                                    <div className="msg-time">1 hour ago</div>
                                </div>
                                <div className="unread-dot" />
                            </div>
                            <div className="msg-row">
                                <div className="msg-av" style={{ background: "rgba(96,165,250,.15)", color: "#60a5fa" }}>AP</div>
                                <div className="msg-body">
                                    <div className="msg-from">Your Apricotter Team<span className="msg-new">NEW</span></div>
                                    <div className="msg-preview">New dialogue mini-movie assets are ready...</div>
                                    <div className="msg-time">Yesterday</div>
                                </div>
                                <div className="unread-dot" />
                            </div>
                            <div className="msg-row">
                                <div className="msg-av" style={{ background: "rgba(167,139,250,.12)", color: "#a78bfa" }}>AP</div>
                                <div className="msg-body">
                                    <div className="msg-from">Your Apricotter Team</div>
                                    <div className="msg-preview">April analytics summary — great month!</div>
                                    <div className="msg-time">3 days ago</div>
                                </div>
                            </div>
                            <div className="more-link">View all messages →</div>
                        </div>

                        <div className="card cp">
                            <div className="ctitle tp">Blog & Education Posts</div>
                            <div className="blog-item">
                                <div className="blog-icon">✍️</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div className="blog-title">5 Reasons Spy Thriller Readers Never Sleep</div>
                                    <div className="blog-meta">SEO blog · Ready for approval</div>
                                </div>
                                <div style={{ display: "flex", gap: "4px" }}><div className="ba">Approve</div><div className="bp">Preview</div></div>
                            </div>
                            <div className="blog-item">
                                <div className="blog-icon">📚</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div className="blog-title">Behind the Series: Writing The Hollow Man</div>
                                    <div className="blog-meta">Author story · Ready for approval</div>
                                </div>
                                <div style={{ display: "flex", gap: "4px" }}><div className="ba">Approve</div><div className="bp">Preview</div></div>
                            </div>
                            <div className="blog-item">
                                <div className="blog-icon">🎓</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div className="blog-title">How to Find Your Next Favorite Spy Novel</div>
                                    <div className="blog-meta">Reader guide · Published Apr 22</div>
                                </div>
                                <div><div className="bp">View</div></div>
                            </div>
                        </div>

                        <div className="card cpi">
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                                <div className="ctitle tpi" style={{ marginBottom: 0 }}>Ad Campaigns</div>
                                <span style={{ fontSize: "9px", padding: "2px 8px", borderRadius: "9px", background: "rgba(248,113,113,.1)", color: "#f87171", border: "1px solid rgba(248,113,113,.2)" }}>2 Need Approval</span>
                            </div>
                            <div className="ad-item">
                                <div className="ad-platform" style={{ background: "rgba(24,119,242,.15)" }}>📘</div>
                                <div className="ad-info">
                                    <div className="ad-name">Facebook — Hollow Man Series</div>
                                    <div className="ad-meta">$15/day · Spy thriller readers · Runs May 1–14</div>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                    <div className="ad-spend" style={{ color: "#4ade80" }}>$210</div>
                                    <div className="ad-live-badge" style={{ marginTop: "4px" }}>Live</div>
                                </div>
                            </div>
                            <div className="ad-item" style={{ borderColor: "rgba(255,160,60,.25)" }}>
                                <div className="ad-platform" style={{ background: "rgba(225,48,108,.15)" }}>📸</div>
                                <div className="ad-info">
                                    <div className="ad-name">Instagram — Book 3 Launch</div>
                                    <div className="ad-meta">$20/day · 30-44, thriller fans · Starts May 5</div>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                    <div className="ad-spend" style={{ color: "#FFA03C" }}>$300 budget</div>
                                    <div style={{ marginTop: "4px" }}><button className="ad-approve-btn">Approve →</button></div>
                                </div>
                            </div>
                            <div className="ad-item" style={{ borderColor: "rgba(255,160,60,.25)" }}>
                                <div className="ad-platform" style={{ background: "rgba(29,155,240,.15)" }}>🐦</div>
                                <div className="ad-info">
                                    <div className="ad-name">X / Twitter — Series Promo</div>
                                    <div className="ad-meta">$10/day · Espionage readers · Starts May 8</div>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                    <div className="ad-spend" style={{ color: "#FFA03C" }}>$140 budget</div>
                                    <div style={{ marginTop: "4px" }}><button className="ad-approve-btn">Approve →</button></div>
                                </div>
                            </div>
                            <div className="more-link">View all campaigns + spend history →</div>
                        </div>
                    </div>

                    {/* BOTTOM ROW */}
                    <div className="bot-grid">
                        <div className="card co">
                            <div className="ctitle to">Content Library</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "9px", padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                                    <div style={{ width: "32px", height: "42px", borderRadius: "4px", background: "rgba(255,160,60,.12)", border: "1px solid rgba(255,160,60,.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", flexShrink: 0 }}>📕</div>
                                    <div style={{ flex: 1 }}><div style={{ fontSize: "11px", color: "#dde", fontWeight: 500 }}>Surviving Prague</div><div style={{ fontSize: "9px", color: "#667", marginTop: "2px" }}>HMS #1 · 4 books total</div></div>
                                    <span style={{ fontSize: "9px", padding: "2px 7px", borderRadius: "9px", background: "rgba(74,222,128,.1)", color: "#4ade80", border: "1px solid rgba(74,222,128,.2)" }}>Active</span>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "9px", padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                                    <div style={{ width: "32px", height: "42px", borderRadius: "4px", background: "rgba(96,165,250,.1)", border: "1px solid rgba(96,165,250,.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", flexShrink: 0 }}>📗</div>
                                    <div style={{ flex: 1 }}><div style={{ fontSize: "11px", color: "#dde", fontWeight: 500 }}>The Prague Directive</div><div style={{ fontSize: "9px", color: "#667", marginTop: "2px" }}>HMS #2</div></div>
                                    <span style={{ fontSize: "9px", padding: "2px 7px", borderRadius: "9px", background: "rgba(74,222,128,.1)", color: "#4ade80", border: "1px solid rgba(74,222,128,.2)" }}>Active</span>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "9px", padding: "7px 0" }}>
                                    <div style={{ width: "32px", height: "42px", borderRadius: "4px", background: "rgba(167,139,250,.1)", border: "1px solid rgba(167,139,250,.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", flexShrink: 0 }}>📘</div>
                                    <div style={{ flex: 1 }}><div style={{ fontSize: "11px", color: "#dde", fontWeight: 500 }}>Cold Station Vienna</div><div style={{ fontSize: "9px", color: "#667", marginTop: "2px" }}>HMS #3</div></div>
                                    <span style={{ fontSize: "9px", padding: "2px 7px", borderRadius: "9px", background: "rgba(74,222,128,.1)", color: "#4ade80", border: "1px solid rgba(74,222,128,.2)" }}>Active</span>
                                </div>
                            </div>
                            <div className="more-link">Manage library →</div>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            <div className="eim-btn">
                                <div style={{ fontSize: "24px" }}>✍️</div>
                                <div>
                                    <div className="eim-btn-text">Help me write gooder</div>
                                    <div className="eim-sub">Editorial Intelligence Module — AI writing assistant</div>
                                </div>
                                <div style={{ fontSize: "18px", color: "rgba(167,139,250,.5)" }}>→</div>
                            </div>
                            <div className="card cb" style={{ flex: 1 }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "9px" }}>
                                    <div className="ctitle tb" style={{ marginBottom: 0 }}>Media Assets</div>
                                    <span style={{ fontSize: "9px", color: "#556" }}>14 files · 2 days ago</span>
                                </div>
                                <div className="asset-grid">
                                    <div className="asset-tile"><UserCircle size={18} /><div className="tile-lbl">Author Photo</div></div>
                                    <div className="asset-tile"><Image size={18} /><div className="tile-lbl">Book Covers</div></div>
                                    <div className="asset-tile"><Film size={18} /><div className="tile-lbl">Video Clips</div></div>
                                    <div className="asset-tile"><Mic size={18} /><div className="tile-lbl">Voiceovers</div></div>
                                    <div className="asset-tile"><Palette size={18} /><div className="tile-lbl">Brand Kit</div></div>
                                    <div className="asset-tile"><FileText size={18} /><div className="tile-lbl">Press Kit</div></div>
                                    <div className="asset-tile upload-tile"><Plus size={18} style={{ color: "#F5A623" }} /><div className="tile-lbl" style={{ color: "#F5A623" }}>Upload</div></div>
                                    <div className="asset-tile"><Folder size={18} /><div className="tile-lbl">All Files</div></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ACCOUNT ROW */}
                    <div className="card co">
                        <div style={{ display: "flex", gap: "18px", alignItems: "flex-start" }}>
                            <div style={{ flex: 1 }}>
                                <div className="ctitle to">My Account</div>
                                <div className="acct-row"><span className="acct-label">Name</span><span className="acct-val">Paul Hollis</span><span className="acct-edit">Edit</span></div>
                                <div className="acct-row"><span className="acct-label">Plan</span><span className="acct-val">Full Automation</span><span className="acct-edit">View</span></div>
                                <div className="acct-row"><span className="acct-label">Next billing</span><span className="acct-val">May 1, 2026</span><span className="acct-edit">Manage</span></div>
                                <div className="acct-row"><span className="acct-label">Account Manager</span><span className="acct-val">Pamela Erickson</span><span className="acct-edit">Message</span></div>
                            </div>
                            <div className="vdiv" />
                            <div style={{ flex: 1 }}>
                                <div className="ctitle tb">Active Platforms</div>
                                <div className="platform-row"><div className="pdot" style={{ background: "#1d9bf0" }} /><span className="pname">X / Twitter</span><span className="sl">Live</span></div>
                                <div className="platform-row"><div className="pdot" style={{ background: "#e1306c" }} /><span className="pname">Instagram</span><span className="sl">Live</span></div>
                                <div className="platform-row"><div className="pdot" style={{ background: "#1877f2" }} /><span className="pname">Facebook</span><span className="sl">Live</span></div>
                                <div className="platform-row"><div className="pdot" style={{ background: "#ff0050" }} /><span className="pname">TikTok</span><span className="sl">Live</span></div>
                                <div className="platform-row"><div className="pdot" style={{ background: "#0a66c2" }} /><span className="pname">LinkedIn</span><span className="sl">Live</span></div>
                                <div className="platform-row"><div className="pdot" style={{ background: "#0085ff" }} /><span className="pname">BlueSky</span><span className="sp">Pending</span></div>
                            </div>
                            <div className="vdiv" />
                            <div style={{ width: "130px" }}>
                                <div className="ctitle to">Otto Support</div>
                                <div className="otto-support">
                                    <div style={{ animation: "float 3s ease-in-out infinite", display: "flex", justifyContent: "center", color: "#F5A623" }}><Bot size={36} /></div>
                                    <div className="otto-bubble">Hi Paul! Got questions?<br />I'm right here.</div>
                                    <button className="chat-btn">Chat with Otto</button>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
