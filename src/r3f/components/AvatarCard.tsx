import React from 'react'
import { useDeck } from '../pipeline/deck'

export function AvatarCard({ id }: { id: string }) {
  const { avatars, setFocused, removeAvatar, focusedId } = useDeck()
  const a = avatars.find(x => x.id === id)
  if (!a) return null
  return (
    <div className="r3f-card" style={{ outline: focusedId === id ? '2px solid #1f8efa' : 'none' }}>
      {a.thumbnail && <img src={a.thumbnail} width={288} height={162} style={{ borderRadius: 8, width: '100%', height: 'auto' }} alt="thumb" />}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button className="r3f-button" onClick={() => setFocused(id)}>Focus</button>
        <button className="r3f-button" onClick={() => removeAvatar(id)} style={{ background: '#ff4977' }}>Delete</button>
      </div>
      <div style={{ opacity: 0.8, marginTop: 4, fontSize: 12 }}>{a.name}</div>
    </div>
  )
}
