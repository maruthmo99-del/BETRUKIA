import { useState, useEffect } from "react";

// Convert a full name/username into privacy-friendly initials, e.g.
// "Moffat Mayaka" -> "M.M.", "FIDELIS" -> "F."
function getInitials(name) {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0].toUpperCase() + ".")
    .join("");
}

export default function ChatPanel({ chatMessages, onlineUsers, sendChat, isAdmin }) {
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 720);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  function submit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    sendChat(text.trim(), replyTo ?? null);
    setText("");
    setReplyTo(null);
    if (isMobile) setOpen(false);
  }

  // On desktop show inline panel; on mobile show a toggle button and overlay when open
  if (isMobile) {
    return (
      <>
        {!open && (
          <button className="chat-toggle-btn" onClick={() => setOpen(true)}>
            Chat ({chatMessages.length})
          </button>
        )}

        {open && (
          <aside className={`chat-panel open`}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div className="chat-header">Chat</div>
              <button className="link-btn" onClick={() => setOpen(false)}>Close</button>
            </div>

            <div className="chat-users">
              {onlineUsers.map((u) => (
                <div key={u.userId ?? u.username} className="chat-user">{getInitials(u.username)}</div>
              ))}
            </div>
            <div className="chat-messages">
              {chatMessages.map((m) => (
                <div key={m.id} className="chat-message">
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="chat-message-user">{getInitials(m.username)} • {new Date(m.created_at || m.createdAt).toLocaleTimeString()}:</span>
                    {isAdmin && !m.fromAdmin && (
                      <button className="link-btn" onClick={() => setReplyTo(m.id)}>Reply</button>
                    )}
                  </div>
                  <span className="chat-message-text">{m.text}</span>
                  {m.replyTo && <div className="chat-reply">in reply to #{m.replyTo}</div>}
                </div>
              ))}
            </div>
            <form className="chat-form" onSubmit={submit}>
              <input value={text} onChange={(e) => setText(e.target.value)} aria-label="Type a message" placeholder="Type a message" />
              <button type="submit">Send</button>
            </form>
          </aside>
        )}
      </>
    );
  }

  return (
    <aside className="chat-panel">
      <div className="chat-header">Chat</div>
      <div className="chat-users">
        {onlineUsers.map((u) => (
          <div key={u.userId ?? u.username} className="chat-user">{getInitials(u.username)}</div>
        ))}
      </div>
      <div className="chat-messages">
        {chatMessages.map((m) => (
          <div key={m.id} className="chat-message">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="chat-message-user">{getInitials(m.username)} • {new Date(m.created_at || m.createdAt).toLocaleTimeString()}:</span>
              {isAdmin && !m.fromAdmin && (
                <button className="link-btn" onClick={() => setReplyTo(m.id)}>Reply</button>
              )}
            </div>
            <span className="chat-message-text">{m.text}</span>
            {m.replyTo && <div className="chat-reply">in reply to #{m.replyTo}</div>}
          </div>
        ))}
      </div>
      <form className="chat-form" onSubmit={submit}>
        <input value={text} onChange={(e) => setText(e.target.value)} aria-label="Type a message" placeholder="Type a message" />
        <button type="submit">Send</button>
      </form>
    </aside>
  );
}