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
 const messagesEndRef = useRef(null)
 const messagesContainerRef = useRef(null)
 useEffect(() => { loadSessions(); loadSettings(); document.documentElement.setAttribute('data-theme', theme) }, [])
 useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
 useEffect(() => { document.documentElement.setAttribute('data-theme', theme); localStorage.setItem('theme', theme) }, [theme])
 useEffect(() => {
 const container = messagesContainerRef.current
 if (!container) return
 const handleScroll = () => setShowScrollTop(container.scrollTop > 300)
 container.addEventListener('scroll', handleScroll)
 return () => container.removeEventListener('scroll', handleScroll)
 }, [])
 async function loadSessions() {
 const res = await fetch(`${API}/sessions`)
 const data = await res.json()
 setSessions(data)
 if (data.length > 0) selectSession(data[0])
 }
 async function loadSettings() { const res = await fetch(`${API}/settings`); setSettings(await res.json()) }
 async function saveSettings() {
 await fetch(`${API}/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) })
 setShowSettings(false)
 }
 async function selectSession(session) {
 setCurrentSession(session); setSidebarOpen(false); setEditingTitle(false)
 const res = await fetch(`${API}/messages?session_id=${session.id}`)
 setMessages(await res.json())
 }
 async function createSession() {
 const res = await fetch(`${API}/sessions`, { method: 'POST' })
 const session = await res.json()
 setSessions(prev => [session, ...prev]); setCurrentSession(session); setMessages([]); setSidebarOpen(false)
 }
 async function deleteSession(e, id) {
 e.stopPropagation()
 await fetch(`${API}/sessions/${id}`, { method: 'DELETE' })
 setSessions(prev => prev.filter(s => s.id !== id))
 if (currentSession?.id === id) { setCurrentSession(null); setMessages([]) }
 }
 async function send() {
 if (!input.trim() || !currentSession || loading) return
 const text = input.trim(); setInput('')
 setMessages(prev => [...prev, { role: 'user', content: text }]); setLoading(true)
 try {
 const res = await fetch(`${API}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: currentSession.id, message: text }) })
 const data = await res.json()
 setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
 if (data.title) {
 setCurrentSession(prev => ({ ...prev, name: data.title }))
 setSessions(prev => prev.map(s => s.id === currentSession.id ? { ...s, name: data.title } : s))
 }
 } catch { setMessages(prev => [...prev, { role: 'assistant', content: '发送失败，请重试' }]) }
 finally { setLoading(false) }
 }
 async function retry() {
 if (loading || messages.length < 2 || !currentSession) return
 const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
 if (!lastUserMsg) return
 setMessages(prev => prev.slice(0, prev.length - 1))
 setLoading(true)
 try {
 const res = await fetch(`${API}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: currentSession.id, message: lastUserMsg.content, is_retry: true }) })
 const data = await res.json()
 setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
 } catch { setMessages(prev => [...prev, { role: 'assistant', content: '重试失败' }]) }
 finally { setLoading(false) }
 }
 function startEdit(idx) { setEditingIdx(idx); setEditText(messages[idx].content) }
 function cancelEdit() { setEditingIdx(null); setEditText('') }
 async function submitEdit() {
 if (!editText.trim() || loading || !currentSession) return
 const text = editText.trim()
 const keepCount = editingIdx
 setEditingIdx(null); setEditText('')
 setMessages(prev => [...prev.slice(0, editingIdx), { role: 'user', content: text }])
 setLoading(true)
 try {
 await fetch(`${API}/messages/truncate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: currentSession.id, keep_count: keepCount }) })
 const res = await fetch(`${API}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: currentSession.id, message: text }) })
 const data = await res.json()
 setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
 if (data.title) {
 setCurrentSession(prev => ({ ...prev, name: data.title }))
 setSessions(prev => prev.map(s => s.id === currentSession.id ? { ...s, name: data.title } : s))
 }
 } catch { setMessages(prev => [...prev, { role: 'assistant', content: '发送失败，请重试' }]) }
 finally { setLoading(false) }
 }
 function startEditTitle() { if (!currentSession) return; setEditingTitle(true); setTitleText(currentSession.name || '') }
 function cancelEditTitle() { setEditingTitle(false); setTitleText('') }
 async function saveTitle() {
 if (!titleText.trim() || !currentSession) return
 const newName = titleText.trim(); setEditingTitle(false)
 try {
 await fetch(`${API}/sessions/${currentSession.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName }) })
 setCurrentSession(prev => ({ ...prev, name: newName }))
 setSessions(prev => prev.map(s => s.id === currentSession.id ? { ...s, name: newName } : s))
 } catch {}
 }
 async function searchMessages(query) {
 if (!query.trim()) { setSearchResults([]); setIsSearching(false); return }
 setIsSearching(true)
 try {
 const res = await fetch(`${API}/messages/search?q=${encodeURIComponent(query.trim())}`)
 setSearchResults(await res.json())
 } catch { setSearchResults([]) }
 }
 function clearSearch() { setSearchQuery(''); setSearchResults([]); setIsSearching(false) }
 function scrollToTop() { messagesContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' }) }
 function handleImageUpload(e, key, setter, maxSize) {
 const file = e.target.files[0]
 if (!file) return
 const reader = new FileReader()
 reader.onload = (ev) => {
 const img = new Image()
 img.onload = () => {
 const canvas = document.createElement('canvas')
 let w = img.width, h = img.height
 if (w > maxSize || h > maxSize) {
 if (w > h) { h = (h / w) * maxSize; w = maxSize }
 else { w = (w / h) * maxSize; h = maxSize }
 }
 canvas.width = w; canvas.height = h
 canvas.getContext('2d').drawImage(img, 0, 0, w, h)
 const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
 setter(dataUrl)
 localStorage.setItem(key, dataUrl)
 }
 img.src = ev.target.result
 }
 reader.readAsDataURL(file)
 e.target.value = ''
 }
 function clearImage(key, setter) { setter(''); localStorage.removeItem(key) }
 return (
 <div className="app">
 {sidebarOpen && <div className="overlay" onClick={() => setSidebarOpen(false)} />}
 <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
 <div className="sidebar-header">
 <span>对话列表</span>
 <button className="new-chat-btn" onClick={createSession}>+</button>
 </div>
 <div className="search-box">
 <input className="search-input" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') searchMessages(searchQuery) }} placeholder="搜索聊天记录..." />
 {searchQuery && <button className="search-clear" onClick={clearSearch}>✕</button>}
 </div>
 {isSearching ? (
 <div className="session-list">
 {searchResults.length === 0 ? (
 <div className="no-results">没有找到相关内容</div>
 ) : (
 searchResults.map((r, i) => (
 <div key={i} className="search-result-item" onClick={() => { selectSession({ id: r.session_id, name: r.session_name }); clearSearch() }}>
 <div className="search-result-title">{r.session_name}</div>
 <div className="search-result-preview">{r.role === 'user' ? '你: ' : 'AI: '}{r.content.length > 50 ? r.content.substring(0, 50) + '...' : r.content}</div>
 </div>
 ))
 )}
 </div>
 ) : (
 <div className="session-list">
 {sessions.map(s => (
 <div key={s.id} className={`session-item ${currentSession?.id === s.id ? 'active' : ''}`} onClick={() => selectSession(s)}>
 <span className="session-name">{s.name}</span>
 <button className="delete-btn" onClick={e => deleteSession(e, s.id)}>×</button>
 </div>
 ))}
 </div>
 )}
 <div className="sidebar-footer">
 <button className="settings-btn" onClick={() => { setShowSettings(true); setSidebarOpen(false) }}>⚙ 设置</button>
 </div>
 </div>
 <div className="chat-container">
 <div className="chat-header">
 <button className="menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
 {editingTitle ? (
 <div className="title-edit-area">
 <input className="title-edit-input" value={titleText} onChange={e => setTitleText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') cancelEditTitle() }} autoFocus />
 <button className="title-save-btn" onClick={saveTitle}>✓</button>
 <button className="title-cancel-btn" onClick={cancelEditTitle}>✕</button>
 </div>
 ) : (
 <>
 <span className="chat-title">{currentSession?.name || '选择对话'}</span>
 {currentSession && <button className="title-edit-btn" onClick={startEditTitle}>✎</button>}
 </>
 )}
 <button className="theme-toggle" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? ' ' : ' '}</button>
 </div>
 <div className="messages" ref={messagesContainerRef} style={chatBg ? { backgroundImage: `url(${chatBg})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'local' } : {}}>
 {messages.map((msg, i) => (
 <div key={i} className={`message ${msg.role}`}>
 {msg.role === 'user' && editingIdx === i ? (
 <div className="edit-area">
 <textarea className="edit-input" value={editText} onChange={e => setEditText(e.target.value)} rows={3} />
 <div className="edit-actions">
 <button className="cancel-edit-btn" onClick={cancelEdit}>取消</button>
 <button className="save-edit-btn" onClick={submitEdit}>发送</button>
 </div>
 </div>
 ) : (
 <>
 <div className="message-header">
 <div className="avatar">{msg.role === 'assistant' ? (aiAvatar ? <img src={aiAvatar} alt="" /> : ' ') : (userAvatar ? <img src={userAvatar} alt="" /> : ' ')}</div>
 {msg.role === 'user' && !loading && <button className="edit-btn" onClick={() => startEdit(i)} title="编辑">✎</button>}
 {msg.role === 'assistant' && i === messages.length - 1 && !loading && <button className="retry-btn" onClick={retry} title="重新⽣成">↻</button>}
 </div>
 <div className={`bubble ${msg.role} ${chatBg ? 'has-bg' : ''}`}>{msg.content}</div>
 </>
 )}
 </div>
 ))}
 {loading && (
 <div className="message assistant">
 <div className="message-header">
 <div className="avatar">{aiAvatar ? <img src={aiAvatar} alt="" /> : ' '}</div>
 </div>
 <div className={`bubble assistant thinking ${chatBg ? 'has-bg' : ''}`}>思考中...</div>
 </div>
 )}
 <div ref={messagesEndRef} />
 </div>
 {showScrollTop && <button className="scroll-top-btn" onClick={scrollToTop}>↑</button>}
 <div className="input-area">
 <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }}} placeholder="输⼊消息..." rows={1} />
 <button onClick={send} disabled={loading || !input.trim()}>发送</button>
 </div>
 </div>
 {showSettings && settings && (<>
 <div className="overlay" onClick={() => setShowSettings(false)} />
 <div className="settings-panel">
 <h3>设置</h3>
 <label>系统提示词</label>
 <textarea className="prompt-input" value={settings.system_prompt} onChange={e => setSettings({ ...settings, system_prompt: e.target.value })} rows={8} placeholder="在这⾥写系统提示词，定义AI的⼈格和⾏为⽅式..." />
 <label>温度 ({settings.temperature})</label>
 <input type="range" min="0" max="2" step="0.1" value={settings.temperature} onChange={e => setSettings({ ...settings, temperature: parseFloat(e.target.value) })} />
 <div className="settings-actions">
 <button className="cancel-btn" onClick={() => setShowSettings(false)}>取消</button>
 <button className="save-btn" onClick={saveSettings}>保存</button>
 </div>
 <hr className="settings-divider" />
 <label>外观（上传后⽴即⽣效）</label>
 <div className="appearance-settings">
 <div className="appearance-item">
 <span>⽤户头像</span>
 <div className="avatar-preview">{userAvatar ? <img src={userAvatar} alt="" /> : ' '}</div>
 <label className="upload-label">上传<input type="file" accept="image/*" hidden onChange={e => handleImageUpload(e, 'user_avatar', setUserAvatar, 100)} /></label>
 {userAvatar && <button className="clear-btn" onClick={() => clearImage('user_avatar', setUserAvatar)}>清除</button>}
 </div>
 <div className="appearance-item">
 <span>AI 头像</span>
 <div className="avatar-preview">{aiAvatar ? <img src={aiAvatar} alt="" /> : ' '}</div>
 <label className="upload-label">上传<input type="file" accept="image/*" hidden onChange={e => handleImageUpload(e, 'ai_avatar', setAiAvatar, 100)} /></label>
 {aiAvatar && <button className="clear-btn" onClick={() => clearImage('ai_avatar', setAiAvatar)}>清除</button>}
 </div>
 <div className="appearance-item">
 <span>聊天背景</span>
 <div className="bg-preview">{chatBg ? <img src={chatBg} alt="" /> : '⽆'}</div>
 <label className="upload-label">上传<input type="file" accept="image/*" hidden onChange={e => handleImageUpload(e, 'chat_bg', setChatBg, 800)} /></label>
 {chatBg && <button className="clear-btn" onClick={() => clearImage('chat_bg', setChatBg)}>清除</button>}
 </div>
 </div>
 </div>
 </>)}
 </div>
 )
}
export default App