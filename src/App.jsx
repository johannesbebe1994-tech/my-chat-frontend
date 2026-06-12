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
  const messagesEndRef = useRef(null)

  useEffect(() => { loadSessions(); loadSettings(); document.documentElement.setAttribute('data-theme', theme) }, [])
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); localStorage.setItem('theme', theme) }, [theme])

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

  function startEdit(idx) {
    setEditingIdx(idx)
    setEditText(messages[idx].content)
  }
  function cancelEdit() {
    setEditingIdx(null)
    setEditText('')
  }
  async function submitEdit() {
    if (!editText.trim() || loading || !currentSession) return
    const text = editText.trim()
    const keepCount = editingIdx

    setEditingIdx(null)
    setEditText('')
    setMessages(prev => [...prev.slice(0, editingIdx), { role: 'user', content: text }])
    setLoading(true)

    try {
      await fetch(`${API}/messages/truncate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: currentSession.id, keep_count: keepCount })
      })
      const res = await fetch(`${API}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: currentSession.id, message: text })
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
      if (data.title) {
        setCurrentSession(prev => ({ ...prev, name: data.title }))
        setSessions(prev => prev.map(s => s.id === currentSession.id ? { ...s, name: data.title } : s))
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '发送失败，请重试' }])
    } finally {
      setLoading(false)
    }
  }

  function startEditTitle() {
    if (!currentSession) return
    setEditingTitle(true)
    setTitleText(currentSession.name || '')
  }
  function cancelEditTitle() {
    setEditingTitle(false)
    setTitleText('')
  }
  async function saveTitle() {
    if (!titleText.trim() || !currentSession) return
    const newName = titleText.trim()
    setEditingTitle(false)
    try {
      await fetch(`${API}/sessions/${currentSession.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      })
      setCurrentSession(prev => ({ ...prev, name: newName }))
      setSessions(prev => prev.map(s => s.id === currentSession.id ? { ...s, name: newName } : s))
    } catch {}
  }

  return (
    <div className="app">
      {sidebarOpen && <div className="overlay" onClick={() => setSidebarOpen(false)} />}
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <span>对话列表</span>
          <button className="new-chat-btn" onClick={createSession}>+</button>
        </div>
        <div className="session-list">
          {sessions.map(s => (
            <div key={s.id} className={`session-item ${currentSession?.id === s.id ? 'active' : ''}`} onClick={() => selectSession(s)}>
              <span className="session-name">{s.name}</span>
              <button className="delete-btn" onClick={e => deleteSession(e, s.id)}>×</button>
            </div>
          ))}
        </div>
        <div className="sidebar-footer">
          <button className="settings-btn" onClick={() => { setShowSettings(true); setSidebarOpen(false) }}>⚙ 设置</button>
          <button className="theme-btn" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? '☀ 浅色' : '🌙 深色'}</button>
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
        </div>
        <div className="messages">
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
                  {msg.role === 'user' && !loading && (
                    <button className="edit-btn" onClick={() => startEdit(i)} title="编辑">✎</button>
                  )}
                  <div className="bubble">{msg.content}</div>
                  {msg.role === 'assistant' && i === messages.length - 1 && !loading && (
                    <button className="retry-btn" onClick={retry} title="重新生成">↻</button>
                  )}
                </>
              )}
            </div>
          ))}
          {loading && <div className="message assistant"><div className="bubble thinking">思考中...</div></div>}
          <div ref={messagesEndRef} />
        </div>
        <div className="input-area">
          <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }}} placeholder="输入消息..." rows={1} />
          <button onClick={send} disabled={loading || !input.trim()}>发送</button>
        </div>
      </div>
      {showSettings && settings && (<>
        <div className="overlay" onClick={() => setShowSettings(false)} />
        <div className="settings-panel">
          <h3>设置</h3>
          <label>系统提示词</label>
          <textarea className="prompt-input" value={settings.system_prompt} onChange={e => setSettings({ ...settings, system_prompt: e.target.value })} rows={8} placeholder="在这里写系统提示词，定义AI的人格和行为方式..." />
          <label>温度 ({settings.temperature})</label>
          <input type="range" min="0" max="2" step="0.1" value={settings.temperature} onChange={e => setSettings({ ...settings, temperature: parseFloat(e.target.value) })} />
          <div className="settings-actions">
            <button className="cancel-btn" onClick={() => setShowSettings(false)}>取消</button>
            <button className="save-btn" onClick={saveSettings}>保存</button>
          </div>
        </div>
      </>)}
    </div>
  )
}

export default App
