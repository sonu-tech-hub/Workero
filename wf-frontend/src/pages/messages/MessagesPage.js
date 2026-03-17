/**
 * MessagesPage.js
 * Left panel: conversation list with last message + unread badge
 * Right panel: full chat thread with send + optional media upload
 * Logic: polls unread count, marks as read on open, auto-scroll on new message
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  getConversationList, getConversation,
  sendMessage, markAsRead
} from '../../api/messageAPI';
import Spinner from '../../components/common/Spinner';
import { timeAgo, extractError } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';

const MessagesPage = () => {
  const { user } = useAuth();
  const { setUnreadMessages } = useNotification();
  const [searchParams] = useSearchParams();
  const preSelectedUser = searchParams.get('with');

  const [conversations, setConvList]    = useState([]);
  const [activeUserId,  setActiveUserId]= useState(preSelectedUser || null);
  const [messages,      setMessages]    = useState([]);
  const [msgText,       setMsgText]     = useState('');
  const [mediaFile,     setMediaFile]   = useState(null);
  const [sending,       setSending]     = useState(false);
  const [loading,       setLoading]     = useState(true);
  const [chatLoading,   setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  // Load conversation list
  const loadConversations = useCallback(async () => {
    try {
      const { data } = await getConversationList();
      setConvList(data.data || []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Load chat thread
  const loadChat = useCallback(async (uid) => {
    if (!uid) return;
    setChatLoading(true);
    try {
      const { data } = await getConversation(uid, { limit: 50 });
      setMessages(data.data?.messages || []);
      await markAsRead(uid);
      // Update global unread count
      setUnreadMessages((c) => Math.max(0, c - (conversations.find((x) => String(x.other_user_id) === String(uid))?.unread_count || 0)));
      // Refresh conversation list to clear badge
      loadConversations();
    } catch {}
    finally { setChatLoading(false); }
  }, [conversations, loadConversations, setUnreadMessages]);

  useEffect(() => {
    if (activeUserId) loadChat(activeUserId);
  }, [activeUserId]);

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!msgText.trim() && !mediaFile) return;
    setSending(true);
    try {
      let payload;
      if (mediaFile) {
        const fd = new FormData();
        fd.append('receiver_id', activeUserId);
        fd.append('message_text', msgText || '📎');
        fd.append('media', mediaFile);
        payload = fd;
      } else {
        payload = { receiver_id: parseInt(activeUserId), message_text: msgText };
      }
      await sendMessage(payload);
      setMsgText('');
      setMediaFile(null);
      loadChat(activeUserId);
    } catch (e) {
      alert(extractError(e));
    } finally {
      setSending(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div style={{ display:'flex', gap:0, height:'calc(100vh - 120px)', background:'#fff', borderRadius:16, overflow:'hidden', boxShadow:'0 2px 12px rgba(0,0,0,.08)' }}>
      {/* Sidebar */}
      <div style={{ width:280, borderRight:'1px solid #e5e7eb', overflowY:'auto', flexShrink:0 }}>
        <div style={{ padding:'16px 16px 8px', borderBottom:'1px solid #f3f4f6' }}>
          <h3 style={{ margin:0, fontSize:16, fontWeight:700 }}>💬 Messages</h3>
        </div>
        {conversations.length === 0 && (
          <div style={{ padding:20, color:'#9ca3af', fontSize:14, textAlign:'center' }}>No conversations yet</div>
        )}
        {conversations.map((c) => (
          <div
            key={c.other_user_id}
            onClick={() => setActiveUserId(String(c.other_user_id))}
            style={{
              padding:'12px 16px', cursor:'pointer',
              background: String(activeUserId) === String(c.other_user_id) ? '#eef2ff' : '#fff',
              borderBottom:'1px solid #f3f4f6',
              display:'flex', gap:10, alignItems:'center',
            }}
          >
            <div style={{ width:40, height:40, borderRadius:'50%', background:'#e5e7eb', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>
              {c.other_user_photo ? <img src={c.other_user_photo} alt="" style={{ width:'100%', height:'100%', borderRadius:'50%', objectFit:'cover' }} /> : '👤'}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:600, fontSize:14, color:'#1f2937', display:'flex', justifyContent:'space-between' }}>
                <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.other_user_name}</span>
                {c.unread_count > 0 && (
                  <span style={{ background:'#6366f1', color:'#fff', fontSize:11, borderRadius:10, padding:'1px 6px', flexShrink:0 }}>{c.unread_count}</span>
                )}
              </div>
              <div style={{ fontSize:12, color:'#9ca3af', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {c.last_message || 'No messages yet'}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Chat area */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
        {!activeUserId ? (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#9ca3af' }}>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:48 }}>💬</div>
              <p>Select a conversation to start messaging</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ padding:'12px 20px', borderBottom:'1px solid #e5e7eb', display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ fontWeight:600, fontSize:15 }}>
                {conversations.find((c) => String(c.other_user_id) === String(activeUserId))?.other_user_name || `User #${activeUserId}`}
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex:1, overflowY:'auto', padding:'16px 20px', display:'flex', flexDirection:'column', gap:8 }}>
              {chatLoading ? <Spinner size={28} /> : messages.map((m) => {
                const isMe = m.sender_id === user?.id;
                return (
                  <div key={m.id} style={{ display:'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth:'70%', padding:'10px 14px', borderRadius:12, fontSize:14,
                      background: isMe ? '#6366f1' : '#f3f4f6',
                      color: isMe ? '#fff' : '#1f2937',
                      borderBottomRightRadius: isMe ? 4 : 12,
                      borderBottomLeftRadius:  isMe ? 12 : 4,
                    }}>
                      {m.message_text && <div>{m.message_text}</div>}
                      {m.media_url && (
                        <a href={m.media_url} target="_blank" rel="noreferrer" style={{ color: isMe ? '#c7d2fe' : '#6366f1', display:'block', marginTop:4, fontSize:12 }}>
                          📎 Attachment
                        </a>
                      )}
                      <div style={{ fontSize:10, marginTop:4, opacity:0.7 }}>{timeAgo(m.created_at)}</div>
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend} style={{ padding:'12px 16px', borderTop:'1px solid #e5e7eb', display:'flex', gap:8, alignItems:'center' }}>
              <label style={{ cursor:'pointer', fontSize:18, color:'#9ca3af' }} title="Attach file">
                📎
                <input type="file" style={{ display:'none' }} onChange={(e) => setMediaFile(e.target.files[0])} />
              </label>
              {mediaFile && <span style={{ fontSize:12, color:'#6366f1' }}>{mediaFile.name} ✕</span>}
              <input
                value={msgText} onChange={(e) => setMsgText(e.target.value)}
                placeholder="Type a message…"
                style={{ flex:1, padding:'10px 14px', borderRadius:24, border:'1.5px solid #d1d5db', fontSize:14, outline:'none' }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); }}}
              />
              <button type="submit" disabled={sending || (!msgText.trim() && !mediaFile)}
                style={{ padding:'10px 18px', background:'#6366f1', color:'#fff', border:'none', borderRadius:24, cursor:'pointer', fontWeight:600 }}>
                {sending ? '…' : '→'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default MessagesPage;
