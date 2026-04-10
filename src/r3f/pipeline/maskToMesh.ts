import * as THREE from 'three'

export type MaskOptions = {
  algorithm: 'greedy' | 'marching'
  iso: number
  smooth: number
}

export async function maskToMesh(url: string, opts: MaskOptions): Promise<THREE.Mesh> {
  const img = await loadImage(url)
  const { data, width, height } = rasterToAlpha(img)
  
  const wSegs = Math.min(256, width - 1)
  const hSegs = Math.min(256, height - 1)
  const geo = new THREE.PlaneGeometry(1, height/width, wSegs, hSegs)
  
  const pos = geo.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = i % (wSegs + 1)
    const y = Math.floor(i / (wSegs + 1))
    const u = x / wSegs
    const v = y / hSegs
    const ix = Math.min(width - 1, Math.floor(u * (width - 1)))
    const iy = Math.min(height - 1, Math.floor((1 - v) * (height - 1)))
    const alpha = data[(iy * width + ix)] / 255
    const z = alpha > opts.iso ? (alpha - opts.iso) * 0.25 : 0
    pos.setZ(i, z)
  }
  geo.computeVertexNormals()
  
  if (opts.smooth > 0) laplacianSmooth(geo, opts.smooth)
  
  const shell = thicken(geo, 0.02)
  const mat = new THREE.MeshStandardMaterial({ color: 0x9ad7ff, metalness: 0.1, roughness: 0.6 })
  const mesh = new THREE.Mesh(shell, mat)
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.rotation.x = -Math.PI/2
  mesh.position.y = 1
  return mesh
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

function rasterToAlpha(img: HTMLImageElement) {
  const can = document.createElement('canvas')
  can.width = img.width
  can.height = img.height
  const ctx = can.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  const { data } = ctx.getImageData(0, 0, can.width, can.height)
  const out = new Uint8Array(can.width * can.height)
  for (let i = 0; i < out.length; i++) {
    const r = data[i*4+0]
    const g = data[i*4+1]
    const b = data[i*4+2]
    const a = data[i*4+3]
    out[i] = a > 0 ? a : (0.2126*r + 0.7152*g + 0.0722*b)
  }
  return { data: out, width: can.width, height: can.height }
}

function laplacianSmooth(geo: THREE.BufferGeometry, iterations = 1) {
  const pos = geo.attributes.position as THREE.BufferAttribute
  const tmp = pos.array.slice() as Float32Array
  const idx = geo.index?.array as Uint16Array | Uint32Array | null
  if (!idx) return
  const adjacency: number[][] = Array(pos.count).fill(null).map(() => [])
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i], b = idx[i+1], c = idx[i+2]
    adjacency[a].push(b, c); adjacency[b].push(a, c); adjacency[c].push(a, b)
  }
  for (let it = 0; it < iterations; it++) {
    for (let v = 0; v < pos.count; v++) {
      const nbrs = adjacency[v]
      let sx=0, sy=0, sz=0
      const n = nbrs.length
      for (let k = 0; k < n; k++) {
        const j = nbrs[k]
        sx += pos.getX(j); sy += pos.getY(j); sz += pos.getZ(j)
      }
      tmp[v*3+0] = sx / n
      tmp[v*3+1] = sy / n
      tmp[v*3+2] = sz / n
    }
    pos.array.set(tmp)
    pos.needsUpdate = true
    geo.computeVertexNormals()
  }
}

function thicken(geo: THREE.BufferGeometry, thickness: number) {
  const g1 = geo.clone()
  const g2 = geo.clone()
  pushAlongNormals(g2, -thickness)
  flipWinding(g2)
  return mergeGeometriesManual([g1, g2])
}

function pushAlongNormals(geo: THREE.BufferGeometry, d: number) {
  const pos = geo.attributes.position as THREE.BufferAttribute
  const nrm = geo.attributes.normal as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    pos.setX(i, pos.getX(i) + nrm.getX(i) * d)
    pos.setY(i, pos.getY(i) + nrm.getY(i) * d)
    pos.setZ(i, pos.getZ(i) + nrm.getZ(i) * d)
  }
  pos.needsUpdate = true
}

function flipWinding(geo: THREE.BufferGeometry) {
  const idx = geo.getIndex()
  if (!idx) return
  for (let i = 0; i < idx.count; i += 3) {
    const a = idx.getX(i), b = idx.getX(i+1), c = idx.getX(i+2)
    idx.setX(i, a); idx.setX(i+1, c); idx.setX(i+2, b)
  }
}

function mergeGeometriesManual(geos: THREE.BufferGeometry[]) {
  const g = geos[0].clone()
  for (let i = 1; i < geos.length; i++) g.merge(geos[i])
  return g
}
