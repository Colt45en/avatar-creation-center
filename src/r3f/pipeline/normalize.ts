import * as THREE from 'three'

export function normalizeMesh(mesh: THREE.Mesh, opts: { unitSize: number } = { unitSize: 2 }) {
  mesh.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(mesh)
  const size = new THREE.Vector3()
  box.getSize(size)
  const center = new THREE.Vector3()
  box.getCenter(center)
  const maxDim = Math.max(size.x, size.y, size.z)
  const scale = opts.unitSize / (maxDim || 1)
  mesh.position.sub(center) // center at origin
  mesh.scale.multiplyScalar(scale)
  mesh.updateMatrixWorld(true)
}
