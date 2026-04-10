import React, { useEffect } from 'react'
import * as THREE from 'three'
import { DeckView } from './components/DeckView'
import { GenerationPanel } from './components/GenerationPanel'
import { AvatarScene } from './AvatarScene'
import { useDeck } from './pipeline/deck'
import './styles.css'

export default function R3FApp() {
  const { avatars, addAvatar, setFocused } = useDeck()

  useEffect(() => {
    if (avatars.length === 0) {
      // Provide a default mesh so there is something to test immediately
      const geometry = new THREE.TorusKnotGeometry(0.6, 0.2, 128, 32)
      const material = new THREE.MeshStandardMaterial({ 
        color: 0x4f46e5, 
        roughness: 0.3, 
        metalness: 0.7 
      })
      const mesh = new THREE.Mesh(geometry, material)
      
      addAvatar({ mesh, name: 'Test Shape.png' }).then(id => {
        setFocused(id)
      })
    }
  }, [avatars.length, addAvatar, setFocused])

  return (
    <div className="r3f-container">
      <GenerationPanel />
      <DeckView />
      <AvatarScene />
    </div>
  )
}
