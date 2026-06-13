import { useState, useEffect, useRef } from 'react'
import './App.css'
const API = 'https://my-chat-backend.johannesbebe1994.workers.dev'
function App() {
 const [sessions, setSessions] = useState([])
 const [currentSession, setCurrentSession] = useState(null)
 const [messages, setMessages] = useState([])
 const [input, setInput] = useState('')
 const [loading, setLoading] = useState(false)
 const [sidebarOpen, setSidebarOpen] = useState(false)
 const [showSettings, setShowSettings] = useState(false)
 const [settings, setSettings] = useState(null)
 const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark')
 const [editingIdx, setEditingIdx] = useState(null)
 const [editText, setEditText] = useState('')
 const [editingTitle, setEditingTitle] = useState(false)
 const [titleText, setTitleText] = useState('')
 const [searchQuery, setSearchQuery] = useState('')
 const [searchResults, setSearchResults] = useState([])
 const [isSearching, setIsSearching] = useState(false)
 const [showScrollTop, setShowScrollTop] = useState(false)
 const [userAvatar, setUserAvatar] = useState(localStorage.getItem('user_avatar') || '')
 const [aiAvatar, setAiAvatar] = useState(localStorage.getItem('ai_avatar') || '')
 const [chatBg, setChatBg] = useState(localStorage.getItem('chat_bg') || '')
 const [themeIconDark, setThemeIconDark] = useState(localStorage.getItem('theme_icon_dark') || '')
 const [themeIconLight, setThemeIconLight] = useState(localStorage.getItem('theme_icon_light') || '')
 const [copiedIdx, setCopiedIdx] = useState(null)
 const messagesEndRef = useRef(null)
 const messagesContainerRef = useRef(null)
 useEffect(() => { loadSessions(); loadSettings(); document.documentElement.setAttribute('data-theme', theme) }, [])
 useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
 useEffect(() => { document.documentElement.setAttribute('data-theme', theme); localStorage.setItem('theme', theme) }, [theme])
 useEffect(() => {
 const c = messagesContainerRef.current; if (!c) return
 const h = () => setShowScrollTop(c.scrollTop > 300)
 c.addEventListener('scroll', h); return () => c.removeEventListener('scroll', h)
 }, [])
 async function loadSessions() { const r = await fetch(`${API}/sessions`); const d = await r.json(); setSessions(d); if (d.length > 0) selectSession(d[0]) }
 async function loadSettings() { const r = await fetch(`${API}/settings`); setSettings(await r.json()) }
 async function saveSettings() { await fetch(`${API}/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) }); setShowSettings(false) }
 async function selectSession(session) { setCurrentSession(session); setSidebarOpen(false); setEditingTitle(false); const r = await fetch(`${API}/messages?session_id=${session.id}`); setMessages(await r.json()) }
 async function createSession() { const r = await fetch(`${API}/sessions`, { method: 'POST' }); const s = await r.json(); setSessions(p => [s, ...p]); setCurrentSession(s); setMessages([]); setSidebarOpen(false) }
 async function deleteSession(e, id) { e.stopPropagation(); await fetch(`${API}/sessions/${id}`, { method: 'DELETE' }); setSessions(p => p.filter(s => s.id !== id)); if (currentSession?.id === id) { setCurrentSession(null); setMessages([]) } }
 // === 流式聊天核⼼ ===
 async function streamChat(sessionId, message, isRetry = false) {
 setLoading(true)
 try {
 const res = await fetch(`${API}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: sessionId, message, is_retry: isRetry }) })
 if (!res.ok) throw new Error('请求失败')
 const reader = res.body.getReader()
 const decoder = new TextDecoder()
 let aiReply = '', buf = ''
 setMessages(p => [...p, { role: 'assistant', content: '', created_at: new Date().toISOString() }])
 while (true) {
 const { done, value } = await reader.read()
 if (done) break
 buf += decoder.decode(value, { stream: true })
 const lines = buf.split('\n'); buf = lines.pop()
 for (const line of lines) {
 if (!line.startsWith('data: ')) continue
 try {
 const data = JSON.parse(line.slice(6))
 if (data.content) {
 aiReply += data.content
 setMessages(p => { const u = [...p]; u[u.length - 1] = { ...u[u.length - 1], content: aiReply }; return u })
 }
 if (data.done && data.title) {
 setCurrentSession(p => ({ ...p, name: data.title }))
 setSessions(p => p.map(s => s.id === sessionId ? { ...s, name: data.title } : s))
 }
 if (data.error) {
 setMessages(p => { const u = [...p]; u[u.length - 1] = { ...u[u.length - 1], content: `出错了: ${data.error}` }; return u })
 }
 } catch {}
 }
 }
 if (!aiReply) setMessages(p => { const u = [...p]; u[u.length - 1] = { ...u[u.length - 1], content: '未收到回复，请重试' }; return u })
 } catch {
 setMessages(p => { const last = p[p.length - 1]; if (last?.role === 'assistant' && !last.content) { const u = [...p]; u[u.length - 1] = { ...u[u.length - 1], content: '发送失败，请重试' }; return u } return [...p, { role: 'assistant', content: '发送失败，请重试' }] })
 } finally { setLoading(false) }
 }
 async function send() {
 if (!input.trim() || !currentSession || loading) return
 const text = input.trim(); setInput('')
 setMessages(p => [...p, { role: 'user', content: text, created_at: new Date().toISOString() }])
 await streamChat(currentSession.id, text)
 }
 async function retry() {
 if (loading || messages.length < 2 || !currentSession) return
 const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
 if (!lastUserMsg) return
 setMessages(p => p.slice(0, p.length - 1))
 await streamChat(currentSession.id, lastUserMsg.content, true)
 }
 function startEdit(idx) { setEditingIdx(idx); setEditText(messages[idx].content) }
 function cancelEdit() { setEditingIdx(null); setEditText('') }
 async function submitEdit() {
 if (!editText.trim() || loading || !currentSession) return
 const text = editText.trim(), kc = editingIdx
 setEditingIdx(null); setEditText('')
 setMessages(p => [...p.slice(0, kc), { role: 'user', content: text, created_at: new Date().toISOString() }])
 await fetch(`${API}/messages/truncate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: currentSession.id, keep_count: kc }) })
 await streamChat(currentSession.id, text)
 }
 function startEditTitle() { if (!currentSession) return; setEditingTitle(true); setTitleText(currentSession.name || '') }
 function cancelEditTitle() { setEditingTitle(false); setTitleText('') }
 async function saveTitle() { if (!titleText.trim() || !currentSession) return; const n = titleText.trim(); setEditingTitle(false); try { await fetch(`${API}/sessions/${currentSession.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: n }) }); setCurrentSession(p => ({ ...p, name: n })); setSessions(p => p.map(s => s.id === currentSession.id ? { ...s, name: n } : s)) } catch {} }
 async function searchMessages(q) { if (!q.trim()) { setSearchResults([]); setIsSearching(false); return }; setIsSearching(true); try { const r = await fetch(`${API}/messages/search?q=${encodeURIComponent(q.trim())}`); setSearchResults(await r.json()) } catch { setSearchResults([]) } }
 function clearSearch() { setSearchQuery(''); setSearchResults([]); setIsSearching(false) }
 function scrollToTop() { messagesContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' }) }
 function scrollToBottom() { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }
 async function copyMessage(content, idx) { try { await navigator.clipboard.writeText(content); setCopiedIdx(idx); setTimeout(() => setCopiedIdx(null), 1500) } catch {} }
 function exportChat(format) {
 if (!currentSession || messages.length === 0) return
 let content, filename
 if (format === 'json') {
 content = JSON.stringify({ session: currentSession.name, exported_at: new Date().toISOString(), messages: messages.map(m => ({ role: m.role, content: m.content, time: m.created_at })) }, null, 2)
 filename = `${currentSession.name}.json`
 } else {
 content = messages.map(m => { const t = m.created_at ? new Date(m.created_at).toLocaleString('zh-CN') : ''; return `[${m.role === 'user' ? '我' : 'AI'}] ${t}\n${m.content}` }).join('\n\n---\n\n')
 filename = `${currentSession.name}.txt`
 }
 const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
 const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); URL.revokeObjectURL(a.href)
 }
 function handleImageUpload(e, key, setter, maxSize) {
 const file = e.target.files[0]; if (!file) return
 const reader = new FileReader()
 reader.onload = (ev) => { const img = new Image(); img.onload = () => { const canvas = document.createElement('canvas'); let w = img.width, h = img.height; if (w > maxSize || h > maxSize) { if (w > h) { h = (h / w) * maxSize; w = maxSize } else { w = (w / h) * maxSize; h = maxSize } }; canvas.width = w; canvas.height = h; canvas.getContext('2d').drawImage(img, 0, 0, w, h); const d = canvas.toDataURL('image/png', 0.9); setter(d); localStorage.setItem(key, d) }; img.src = ev.target.result }
 reader.readAsDataURL(file); e.target.value = ''
 }
 function clearImage(key, setter) { setter(''); localStorage.removeItem(key) }
 function formatTime(t) { if (!t) return ''; const d = new Date(t), now = new Date(), h = d.getHours().toString().padStart(2, '0'), m = d.getMinutes().toString().padStart(2, '0'); return d.toDateString() === now.toDateString() ? `${h}:${m}` : `${d.getMonth() + 1}/${d.getDate()} ${h}:${m}` }
 const themeIcon = theme === 'dark' ? themeIconLight : themeIconDark
 return (
 <div className="app">
 {sidebarOpen && <div className="overlay" onClick={() => setSidebarOpen(false)} />}
 <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
 <div className="sidebar-header"><span>对话列表</span><button className="new-chat-btn" onClick={createSession}>+</button></div>
 <div className="search-box">
 <input className="search-input" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') searchMessages(searchQuery) }} placeholder="搜索聊天记录..." />
 {searchQuery && <button className="search-clear" onClick={clearSearch}>✕</button>}
 </div>
 {isSearching ? (
 <div className="session-list">{searchResults.length === 0 ? <div className="no-results">没有找到相关内容</div> : searchResults.map((r, i) => (
 <div key={i} className="search-result-item" onClick={() => { selectSession({ id: r.session_id, name: r.session_name }); clearSearch() }}>
 <div className="search-result-title">{r.session_name}</div>
 <div className="search-result-preview">{r.role === 'user' ? '你: ' : 'AI: '}{r.content.length > 50 ? r.content.substring(0, 50) + '...' : r.content}</div>
 </div>
 ))}</div>
 ) : (
 <div className="session-list">{sessions.map(s => (
 <div key={s.id} className={`session-item ${currentSession?.id === s.id ? 'active' : ''}`} onClick={() => selectSession(s)}>
 <span className="session-name">{s.name}</span><button className="delete-btn" onClick={e => deleteSession(e, s.id)}>×</button>
 </div>
 ))}</div>
 )}
 <div className="sidebar-footer"><button className="settings-btn" onClick={() => { setShowSettings(true); setSidebarOpen(false) }}>⚙ 设置</button></div>
 </div>
 <div className="chat-container">
 <div className="chat-header">
 <button className="menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
 {editingTitle ? (
 <div className="title-edit-area">
 <input className="title-edit-input" value={titleText} onChange={e => setTitleText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') cancelEditTitle() }} autoFocus />
 <button className="title-save-btn" onClick={saveTitle}>✓</button><button className="title-cancel-btn" onClick={cancelEditTitle}>✕</button>
 </div>
 ) : (<><span className="chat-title">{currentSession?.name || '选择对话'}</span>{currentSession && <button className="title-edit-btn" onClick={startEditTitle}>✎</button>}</>)}
 <button className="theme-toggle" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>{themeIcon ? <img src={themeIcon} alt="" /> : <span className="theme-symbol">◐</span>}</button>
 </div>
 <div className="messages" ref={messagesContainerRef} style={chatBg ? { backgroundImage: `linear-gradient(var(--bg-overlay), var(--bg-overlay)), url(${chatBg})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'local' } : {}}>
 {messages.map((msg, i) => (
 <div key={i} className={`message ${msg.role}`}>
 {msg.role === 'user' && editingIdx === i ? (
 <div className="edit-area">
 <textarea className="edit-input" value={editText} onChange={e => setEditText(e.target.value)} rows={3} />
 <div className="edit-actions"><button className="cancel-edit-btn" onClick={cancelEdit}>取消</button><button className="save-edit-btn" onClick={submitEdit}>发送</button></div>
 </div>
 ) : (<>
 <div className="message-header">
 <div className="avatar">{msg.role === 'assistant' ? (aiAvatar ? <img src={aiAvatar} alt="" /> : ' ') : (userAvatar ? <img src={userAvatar} alt="" /> : ' ')}</div>
 {msg.role === 'user' && !loading && <button className="edit-btn" onClick={() => startEdit(i)} title="编辑">✎</button>}
 </div>
 <div className={`bubble ${msg.role}`}>{msg.content}</div>
 {msg.created_at && <span className="message-time">{formatTime(msg.created_at)}</span>}
 {msg.role === 'assistant' && !loading && msg.content && (
 <div className="message-actions">
 <button className="action-btn" onClick={() => copyMessage(msg.content, i)}>{copiedIdx === i ? '已复制 ✓' : '复制'}</button>
 {i === messages.length - 1 && <button className="action-btn" onClick={retry}>重新⽣成</button>}
 </div>
 )}
 </>)}
 </div>
 ))}
 {loading && messages[messages.length - 1]?.role !== 'assistant' && (
 <div className="message assistant">
 <div className="message-header"><div className="avatar">{aiAvatar ? <img src={aiAvatar} alt="" /> : ' '}</div></div>
 <div className="bubble assistant thinking">思考中...</div>
 </div>
 )}
 <div ref={messagesEndRef} />
 </div>
 {showScrollTop && <button className="scroll-top-btn" onClick={scrollToTop}>↑</button>}
 <div className="input-area">
 <textarea value={input} onChange={e => setInput(e.target.value)} onFocus={scrollToBottom} placeholder="输⼊消息..." rows={1} />
 <button onClick={send} disabled={loading || !input.trim()}>发送</button>
 </div>
 </div>
 {showSettings && settings && (<>
 <div className="overlay" onClick={() => setShowSettings(false)} />
 <div className="settings-panel">
 <h3>设置</h3>
 <label>系统提示词（全局）</label>
 <textarea className="prompt-input" value={settings.system_prompt} onChange={e => setSettings({ ...settings, system_prompt: e.target.value })} rows={6} placeholder="定义AI的⼈格和⾏为⽅式..." />
 <div className="toggle-row">
 <label>叠加提示词</label>
 <button className={`toggle-btn ${settings.overlay_enabled ? 'on' : ''}`} onClick={() => setSettings({ ...settings, overlay_enabled: !settings.overlay_enabled })}>{settings.overlay_enabled ? '开' : '关'}</button>
 </div>
 {settings.overlay_enabled && <textarea className="prompt-input" value={settings.overlay_prompt || ''} onChange={e => setSettings({ ...settings, overlay_prompt: e.target.value })} rows={4} placeholder="场景/模式提示词，叠加在全局之上..." />}
 <div className="toggle-row">
 <label>时间感知</label>
 <button className={`toggle-btn ${settings.time_aware ? 'on' : ''}`} onClick={() => setSettings({ ...settings, time_aware: !settings.time_aware })}>{settings.time_aware ? '开' : '关'}</button>
 </div>
 <label>温度 ({settings.temperature})</label>
 <input type="range" min="0" max="2" step="0.1" value={settings.temperature} onChange={e => setSettings({ ...settings, temperature: parseFloat(e.target.value) })} />
 <div className="settings-actions"><button className="cancel-btn" onClick={() => setShowSettings(false)}>取消</button><button className="save-btn" onClick={saveSettings}>保存</button></div>
 <hr className="settings-divider" />
 <label>导出当前对话</label>
 <div className="export-row">
 <button className="export-btn" onClick={() => exportChat('txt')}>导出 TXT</button>
 <button className="export-btn" onClick={() => exportChat('json')}>导出 JSON</button>
 </div>
 <hr className="settings-divider" />
 <label>外观（上传后⽴即⽣效）</label>
 <div className="appearance-settings">
 <div className="appearance-item"><span>⽤户头像</span><div className="avatar-preview">{userAvatar ? <img src={userAvatar} alt="" /> : ' '}</div><label className="upload-label">上传<input type="file" accept="image/*" hidden onChange={e => handleImageUpload(e, 'user_avatar', setUserAvatar, 100)} /></label>{userAvatar && <button className="clear-btn" onClick={() => clearImage('user_avatar', setUserAvatar)}>清除</button>}</div>
 <div className="appearance-item"><span>AI 头像</span><div className="avatar-preview">{aiAvatar ? <img src={aiAvatar} alt="" /> : ' '}</div><label className="upload-label">上传<input type="file" accept="image/*" hidden onChange={e => handleImageUpload(e, 'ai_avatar', setAiAvatar, 100)} /></label>{aiAvatar && <button className="clear-btn" onClick={() => clearImage('ai_avatar', setAiAvatar)}>清除</button>}</div>
 <div className="appearance-item"><span>聊天背景</span><div className="bg-preview">{chatBg ? <img src={chatBg} alt="" /> : '⽆'}</div><label className="upload-label">上传<input type="file" accept="image/*" hidden onChange={e => handleImageUpload(e, 'chat_bg', setChatBg, 800)} /></label>{chatBg && <button className="clear-btn" onClick={() => clearImage('chat_bg', setChatBg)}>清除</button>}</div>
 <div className="appearance-item"><span>深⾊图标</span><div className="avatar-preview small">{themeIconDark ? <img src={themeIconDark} alt="" /> : '◐'}</div><label className="upload-label">上传<input type="file" accept="image/*" hidden onChange={e => handleImageUpload(e, 'theme_icon_dark', setThemeIconDark, 64)} /></label>{themeIconDark && <button className="clear-btn" onClick={() => clearImage('theme_icon_dark', setThemeIconDark)}>清除</button>}</div>
 <div className="appearance-item"><span>浅⾊图标</span><div className="avatar-preview small">{themeIconLight ? <img src={themeIconLight} alt="" /> : '◐'}</div><label className="upload-label">上传<input type="file" accept="image/*" hidden onChange={e => handleImageUpload(e, 'theme_icon_light', setThemeIconLight, 64)} /></label>{themeIconLight && <button className="clear-btn" onClick={() => clearImage('theme_icon_light', setThemeIconLight)}>清除</button>}</div>
 </div>
 </div>
 </>)}
 </div>
 )
}
export default App