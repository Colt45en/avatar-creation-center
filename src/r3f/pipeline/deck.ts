import { create } from 'zustand'
import * as THREE from 'three'

export type AvatarItem = {
  id: string
  name: string
  mesh: THREE.Mesh
  thumbnail?: string
}

export type TransformMode = 'translate' | 'rotate' | 'scale' | null;

type DeckState = {
  avatars: AvatarItem[]
  focusedId?: string
  transformMode: TransformMode
  setFocused: (id?: string) => void
  setTransformMode: (mode: TransformMode) => void
  addAvatar: (input: { mesh: THREE.Mesh; name: string }) => Promise<string>
  removeAvatar: (id: string) => void
}

export const useDeck = create<DeckState>((set, get) => ({
  avatars: [],
  focusedId: undefined,
  transformMode: null,
  setFocused: (focusedId) => set({ focusedId }),
  setTransformMode: (transformMode) => set({ transformMode }),
  addAvatar: async ({ mesh, name }) => {
    const id = crypto.randomUUID()
    const item: AvatarItem = { id, name, mesh }
    set(s => ({ avatars: [item, ...s.avatars] }))
    try {
      const thumb = await quickThumb(mesh)
      set(s => ({ avatars: s.avatars.map(a => a.id === id ? { ...a, thumbnail: thumb } : a) }))
    } catch {}
    return id
  },
  removeAvatar: (id) => set(s => ({ 
    avatars: s.avatars.filter(a => a.id !== id), 
    focusedId: s.focusedId === id ? undefined : s.focusedId 
  }))
}))

async function quickThumb(mesh: THREE.Mesh): Promise<string> {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(40, 16/9, 0.1, 100)
  camera.position.set(2.2, 1.6, 2.6)
  camera.lookAt(0, 1, 0)
  const light = new THREE.DirectionalLight(0xffffff, 1.2)
  light.position.set(2,3,1)
  scene.add(light)
  scene.add(new THREE.AmbientLight(0xffffff, 0.35))
  scene.add(mesh.clone())
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
  renderer.setSize(480, 270)
  renderer.setPixelRatio(1)
  renderer.setClearColor(0x0a0a0a)
  renderer.render(scene, camera)
  const data = renderer.domElement.toDataURL('image/png')
  renderer.dispose()
  return data
}
