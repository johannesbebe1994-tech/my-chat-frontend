import { useState, useEffect, useRef } from 'react'
import './App.css'

const API = 'https://my-chat-backend.johannesbebe1994.workers.dev'

function App() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sessionId, setSessionId] = useState(null)
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    async function init() {
      const res = await fetch(`${API}/sessions`)
      const sessions = await res.json()
      if (sessions.length > 0) {
        setSessionId(sessions[0].id)
        const msgRes = await fetch(`${API}/messages?session_id=${sessions[0].id}`)
        setMessages(await msgRes.json())
      } else {
        const res = await fetch(`${API}/sessions`, { method: 'POST' })
        const session = await res.json()
        setSessionId(session.id)
      }
    }
    init()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    if (!input.trim() || !sessionId || loading) return
    const text = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setLoading(true)
    try {
      const res = await fetch(`${API}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, message: text }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '发送失败，请重试' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      <div className="chat-container">
        <div className="messages">
          {messages.map((msg, i) => (
            <div key={i} className={`message ${msg.role}`}>
              <div className="bubble">{msg.content}</div>
            </div>
          ))}
          {loading && (
            <div className="message assistant">
              <div className="bubble thinking">思考中...</div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="input-area">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }}}
            placeholder="输入消息..."
            rows={1}
          />
          <button onClick={send} disabled={loading || !input.trim()}>发送</button>
        </div>
      </div>
    </div>
  )
}

export default App
