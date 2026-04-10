import React, { Suspense, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, Grid, StatsGl, TransformControls } from '@react-three/drei'
import { Effects } from './postfx/Effects'
import { useDeck } from './pipeline/deck'
import * as THREE from 'three'

function AvatarMesh() {
  const { focusedId, avatars, transformMode } = useDeck()
  const avatar = useMemo(() => avatars.find(a => a.id === focusedId), [focusedId, avatars])
  if (!avatar) return null

  return (
    <group>
      {transformMode ? (
        <TransformControls mode={transformMode}>
          <primitive object={avatar.mesh} />
        </TransformControls>
      ) : (
        <primitive object={avatar.mesh} />
      )}
    </group>
  )
}

export function AvatarScene() {
  return (
    <Canvas camera={{ position: [2.5, 1.5, 3.5], fov: 45 }} dpr={[1, 2]}>
      <color attach="background" args={[0.02, 0.02, 0.03]} />
      <fog attach="fog" args={[new THREE.Fog(0x040507, 6, 22)] as any} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[4, 6, 2]} intensity={1.2} castShadow />
      <Suspense fallback={null}>
        <AvatarMesh />
        <Environment preset="studio" />
      </Suspense>
      <Grid args={[20, 20]} cellSize={0.5} sectionSize={2} infiniteGrid />
      <OrbitControls makeDefault enableDamping target={[0, 1, 0]} />
      <Effects />
      <StatsGl />
    </Canvas>
  )
}
