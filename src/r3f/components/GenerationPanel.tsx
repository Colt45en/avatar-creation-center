import React, { useRef, useState } from 'react'
import { useDeck, TransformMode } from '../pipeline/deck'
import { maskToMesh } from '../pipeline/maskToMesh'
import { normalizeMesh } from '../pipeline/normalize'
import { exportGLB } from '../utils/exportGLB'
import { createHeightfieldBust } from '../../avatar/extracted/HeightfieldBust'

export function GenerationPanel() {
  const fileRef = useRef<HTMLInputElement>(null)
  const heightfieldRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [exportBinary, setExportBinary] = useState(true)
  const [exportDraco, setExportDraco] = useState(false)
  const { addAvatar, focusedId, setFocused, transformMode, setTransformMode } = useDeck()
  
  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setBusy(true)
    try {
      const file = files[0]
      const url = URL.createObjectURL(file)
      const mesh = await maskToMesh(url, { algorithm: 'greedy', iso: 0.5, smooth: 1 })
      normalizeMesh(mesh, { unitSize: 1.8 })
      const id = await addAvatar({ mesh, name: file.name })
      setFocused(id)
    } catch (e) {
      console.error(e)
      alert('Generation failed — see console.')
    } finally {
      setBusy(false)
    }
  }

  const handleHeightfieldFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setBusy(true)
    try {
      const file = files[0]
      const url = URL.createObjectURL(file)
      const mesh = await createHeightfieldBust(url, 1.8)
      const id = await addAvatar({ mesh, name: `Bust_${file.name}` })
      setFocused(id)
    } catch (e) {
      console.error(e)
      alert('Heightfield generation failed — see console.')
    } finally {
      setBusy(false)
    }
  }

  const toggleMode = (mode: TransformMode) => {
    setTransformMode(transformMode === mode ? null : mode)
  }

  return (
    <div className="r3f-panel">
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <input ref={fileRef} type="file" accept="image/*" onChange={e => handleFiles(e.target.files)} style={{ display: 'none' }} />
        <button className="r3f-button" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? 'Processing...' : 'Import Mask → Mesh'}
        </button>
        
        <input ref={heightfieldRef} type="file" accept="image/*" onChange={e => handleHeightfieldFiles(e.target.files)} style={{ display: 'none' }} />
        <button className="r3f-button" disabled={busy} onClick={() => heightfieldRef.current?.click()}>
          {busy ? 'Processing...' : 'Import Depth → Bust'}
        </button>
        
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 8px', background: 'rgba(255,255,255,0.05)', borderRadius: 8 }}>
          <button 
            className="r3f-button" 
            style={{ background: transformMode === 'translate' ? '#4f46e5' : 'transparent', border: '1px solid rgba(255,255,255,0.2)' }} 
            disabled={!focusedId} 
            onClick={() => toggleMode('translate')}
          >
            Translate
          </button>
          <button 
            className="r3f-button" 
            style={{ background: transformMode === 'rotate' ? '#4f46e5' : 'transparent', border: '1px solid rgba(255,255,255,0.2)' }} 
            disabled={!focusedId} 
            onClick={() => toggleMode('rotate')}
          >
            Rotate
          </button>
          <button 
            className="r3f-button" 
            style={{ background: transformMode === 'scale' ? '#4f46e5' : 'transparent', border: '1px solid rgba(255,255,255,0.2)' }} 
            disabled={!focusedId} 
            onClick={() => toggleMode('scale')}
          >
            Scale
          </button>
        </div>
      </div>
      
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="checkbox" checked={exportBinary} onChange={e => setExportBinary(e.target.checked)} />
          Binary (.glb)
        </label>
        <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="checkbox" checked={exportDraco} onChange={e => setExportDraco(e.target.checked)} />
          Draco Compression
        </label>
        <button className="r3f-button" disabled={!focusedId} onClick={() => exportGLB({ binary: exportBinary, draco: exportDraco })}>
          Export
        </button>
      </div>
    </div>
  )
}
