import * as THREE from 'three'

export async function thumbnailFromScene(scene: THREE.Scene, focus: THREE.Object3D, opts?: { w?: number, h?: number }): Promise<string> {
  const w = opts?.w ?? 480
  const h = opts?.h ?? 270
  const renderer = new THREE.WebGLRenderer({ preserveDrawingBuffer: true, antialias: true })
  renderer.setSize(w, h)
  const camera = new THREE.PerspectiveCamera(40, w/h, 0.1, 100)
  camera.position.set(2.2,1.6,2.6)
  camera.lookAt(focus.position)
  scene.add(camera)
  renderer.render(scene, camera)
  const data = renderer.domElement.toDataURL('image/png')
  renderer.dispose()
  return data
}
