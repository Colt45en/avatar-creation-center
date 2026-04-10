import React from 'react'
import { useDeck } from '../pipeline/deck'
import { AvatarCard } from './AvatarCard'

export function DeckView() {
  const { avatars } = useDeck()
  return (
    <div className="r3f-deck">
      {avatars.map(a => <AvatarCard key={a.id} id={a.id} />)}
    </div>
  )
}
