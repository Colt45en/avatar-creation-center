import React from 'react'
import { EffectComposer, Bloom, ChromaticAberration, Vignette } from '@react-three/postprocessing'

export function Effects() {
  return (
    <EffectComposer multisampling={4}>
      <Bloom intensity={0.6} luminanceThreshold={0.2} luminanceSmoothing={0.15} mipmapBlur />
      <ChromaticAberration offset={[0.0015, 0.001] as any} radialModulation modulationOffset={0.75} />
      <Vignette eskil={false} offset={0.25} darkness={0.6} />
    </EffectComposer>
  )
}
