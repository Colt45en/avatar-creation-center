import React, { useState, useEffect } from 'react';
import { Upload, Download, Settings as SettingsIcon, Image as ImageIcon, Layers, Clock, Play, Trash2, Box } from 'lucide-react';
import { AvatarPipelineController } from './avatar/controller/AvatarPipelineController';
import { AvatarSettings, ProcessedAvatar, AvatarLandmarks, Point2D } from './avatar/contracts/avatarTypes';
import { AvatarRuntimeStore } from './avatar/runtime/avatarStore';
import { processBatchZip } from './avatar/extracted/BatchZip';
import RuntimePreview from './components/RuntimePreview';
import R3FApp from './r3f/R3FApp';

type Tab = 'pipeline' | 'history' | 'runtime' | 'r3f';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('pipeline');
  const [file, setFile] = useState<File | null>(null);
  const [settings, setSettings] = useState<AvatarSettings>({
    mode: "white_on_alpha",
    centered: true,
    normalizedScale: true,
    poseLocked: false,
    threshold: 15,
    edgeCleanup: true,
    outputSize: 1024
  });
  const [processed, setProcessed] = useState<ProcessedAvatar | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [history, setHistory] = useState<ProcessedAvatar[]>([]);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const hist = await AvatarRuntimeStore.getHistory();
    setHistory(hist);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    await runPipeline(selected, settings);
  };

  const handleBatchUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsProcessing(true);
    try {
      await processBatchZip(Array.from(files), settings);
    } catch (err) {
      console.error("Batch processing failed", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const runPipeline = async (f: File, s: AvatarSettings) => {
    setIsProcessing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 50));
      const result = await AvatarPipelineController.process(f, s);
      setProcessed(result);
      await AvatarRuntimeStore.saveAvatar(result);
      await loadHistory();
      setActiveTab('runtime');
    } catch (err) {
      console.error("Pipeline failed", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSettingChange = (key: keyof AvatarSettings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    if (file) {
      runPipeline(file, newSettings);
    }
  };

  const handleExport = async () => {
    if (!processed) return;
    const blob = await AvatarPipelineController.exportBundle(processed);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${processed.manifest.avatarId}_bundle.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteHistory = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await AvatarRuntimeStore.deleteAvatar(id);
    if (processed?.manifest.avatarId === id) {
      setProcessed(null);
      setFile(null);
    }
    await loadHistory();
  };

  const selectFromHistory = (avatar: ProcessedAvatar) => {
    setProcessed(avatar);
    setSettings(avatar.manifest.settings);
    setActiveTab('pipeline');
  };

  const renderSkeleton = (landmarks: AvatarLandmarks, size: number) => {
    const toPct = (p: Point2D) => ({ x: `${(p.x / size) * 100}%`, y: `${(p.y / size) * 100}%` });
    
    const drawLine = (p1: Point2D, p2: Point2D, key: string) => {
      const start = toPct(p1);
      const end = toPct(p2);
      return (
        <line 
          key={key}
          x1={start.x} y1={start.y} 
          x2={end.x} y2={end.y} 
          stroke="#4ade80" strokeWidth="2" strokeOpacity="0.6" 
        />
      );
    };

    const drawPoint = (p: Point2D, key: string) => {
      const pos = toPct(p);
      return (
        <circle 
          key={key}
          cx={pos.x} cy={pos.y} 
          r="4" 
          fill="#22c55e" 
          stroke="#000" strokeWidth="1"
        />
      );
    };

    return (
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
        {drawLine(landmarks.head, landmarks.neck, 'spine1')}
        {drawLine(landmarks.neck, landmarks.chest, 'spine2')}
        {drawLine(landmarks.chest, landmarks.pelvis, 'spine3')}
        
        {drawLine(landmarks.neck, landmarks.leftShoulder, 'l-clavicle')}
        {drawLine(landmarks.leftShoulder, landmarks.leftElbow, 'l-uparm')}
        {drawLine(landmarks.leftElbow, landmarks.leftHand, 'l-lowarm')}
        
        {drawLine(landmarks.neck, landmarks.rightShoulder, 'r-clavicle')}
        {drawLine(landmarks.rightShoulder, landmarks.rightElbow, 'r-uparm')}
        {drawLine(landmarks.rightElbow, landmarks.rightHand, 'r-lowarm')}
        
        {drawLine(landmarks.pelvis, landmarks.leftKnee, 'l-upleg')}
        {drawLine(landmarks.leftKnee, landmarks.leftFoot, 'l-lowleg')}
        
        {drawLine(landmarks.pelvis, landmarks.rightKnee, 'r-upleg')}
        {drawLine(landmarks.rightKnee, landmarks.rightFoot, 'r-lowleg')}

        {Object.entries(landmarks).map(([key, point]) => drawPoint(point, `pt-${key}`))}
      </svg>
    );
  };

  return (
    <div className="flex h-screen w-screen bg-neutral-950 text-neutral-200 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-80 bg-neutral-900 border-r border-neutral-800 flex flex-col shadow-2xl z-10">
        <div className="p-6 border-b border-neutral-800">
          <h1 className="text-xl font-black tracking-tighter flex items-center gap-2 text-indigo-400">
            <Layers className="w-6 h-6" />
            NEXUS_AVATAR
          </h1>
          <p className="text-xs text-neutral-500 mt-1 font-mono tracking-tight">Phase 2: Runtime Integration</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-neutral-800">
          <button onClick={() => setActiveTab('pipeline')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'pipeline' ? 'text-indigo-400 border-b-2 border-indigo-400 bg-indigo-400/5' : 'text-neutral-500 hover:text-neutral-300'}`}>Pipeline</button>
          <button onClick={() => setActiveTab('history')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'history' ? 'text-indigo-400 border-b-2 border-indigo-400 bg-indigo-400/5' : 'text-neutral-500 hover:text-neutral-300'}`}>History</button>
          <button onClick={() => setActiveTab('runtime')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'runtime' ? 'text-indigo-400 border-b-2 border-indigo-400 bg-indigo-400/5' : 'text-neutral-500 hover:text-neutral-300'}`}>Runtime</button>
          <button onClick={() => setActiveTab('r3f')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'r3f' ? 'text-indigo-400 border-b-2 border-indigo-400 bg-indigo-400/5' : 'text-neutral-500 hover:text-neutral-300'}`}>R3F Deck</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {activeTab === 'pipeline' && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-neutral-400 flex items-center gap-2">
                  <ImageIcon size={16} /> Source Image
                </label>
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" id="file-upload" />
                <label htmlFor="file-upload" className="w-full py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer border border-neutral-700">
                  <Upload size={16} />
                  {file ? file.name : "Upload Image"}
                </label>
                
                <input type="file" accept="image/*" multiple onChange={handleBatchUpload} className="hidden" id="batch-upload" />
                <label htmlFor="batch-upload" className="w-full py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer border border-neutral-700 mt-2">
                  <Layers size={16} />
                  Batch Process (ZIP)
                </label>
              </div>

              <div className="space-y-4 pt-4 border-t border-neutral-800">
                <label className="text-sm font-semibold text-neutral-400 flex items-center gap-2">
                  <SettingsIcon size={16} /> Pipeline Settings
                </label>
                
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-neutral-500">
                    <span>Black Threshold</span>
                    <span>{settings.threshold}</span>
                  </div>
                  <input type="range" min="0" max="50" step="1" value={settings.threshold} onChange={e => handleSettingChange('threshold', Number(e.target.value))} className="w-full accent-indigo-500" />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-neutral-500">
                    <span>Output Size</span>
                    <span>{settings.outputSize}px</span>
                  </div>
                  <select value={settings.outputSize} onChange={e => handleSettingChange('outputSize', Number(e.target.value))} className="w-full bg-neutral-800 border border-neutral-700 rounded p-2 text-sm text-white">
                    <option value={512}>512x512</option>
                    <option value={1024}>1024x1024</option>
                    <option value={2048}>2048x2048</option>
                  </select>
                </div>

                <label className="flex items-center justify-between text-sm p-3 rounded-lg bg-neutral-800/50 border border-neutral-800 cursor-pointer">
                  <span className="text-neutral-300 font-medium">Auto-Center</span>
                  <input type="checkbox" checked={settings.centered} onChange={e => handleSettingChange('centered', e.target.checked)} className="accent-indigo-500 w-4 h-4" />
                </label>
              </div>

              {processed && (
                <div className="pt-4 border-t border-neutral-800">
                  <button onClick={handleExport} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/20">
                    <Download size={18} /> Export Bundle (ZIP)
                  </button>
                </div>
              )}
            </>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              <label className="text-sm font-semibold text-neutral-400 flex items-center gap-2">
                <Clock size={16} /> Local Cache
              </label>
              {history.length === 0 ? (
                <p className="text-xs text-neutral-500 text-center py-8">No avatars in cache.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {history.map(item => (
                    <div 
                      key={item.manifest.avatarId} 
                      onClick={() => selectFromHistory(item)}
                      className={`relative aspect-square rounded-lg border cursor-pointer overflow-hidden group ${processed?.manifest.avatarId === item.manifest.avatarId ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-neutral-700 hover:border-neutral-500'}`}
                    >
                      <img src={item.assets.thumb256} className="w-full h-full object-cover bg-neutral-900" alt="History thumb" />
                      <div className="absolute inset-x-0 bottom-0 bg-black/80 p-1.5 translate-y-full group-hover:translate-y-0 transition-transform flex justify-between items-center">
                        <span className="text-[10px] text-neutral-300 truncate">{new Date(item.manifest.createdAt).toLocaleTimeString()}</span>
                        <button onClick={(e) => handleDeleteHistory(item.manifest.avatarId, e)} className="text-red-400 hover:text-red-300 p-1">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'runtime' && (
            <div className="space-y-4">
              <label className="text-sm font-semibold text-neutral-400 flex items-center gap-2">
                <Play size={16} /> Engine Integration
              </label>
              <p className="text-xs text-neutral-500 leading-relaxed">
                This tab demonstrates the generated avatar assets loaded into a live Three.js environment.
              </p>
              <p className="text-xs text-neutral-500 leading-relaxed">
                The alpha texture is applied to a plane, and the landmark coordinates are mapped into 3D space to construct a debug skeleton.
              </p>
              {!processed && (
                <div className="p-4 bg-neutral-800/50 border border-neutral-800 rounded-lg text-xs text-neutral-400 text-center">
                  Process an avatar first to view it in the runtime.
                </div>
              )}
            </div>
          )}

          {activeTab === 'r3f' && (
            <div className="space-y-4">
              <label className="text-sm font-semibold text-neutral-400 flex items-center gap-2">
                <Box size={16} /> Phase 3: R3F Deck
              </label>
              <p className="text-xs text-neutral-500 leading-relaxed">
                This is the complete, minimal-yet-production-ready scaffold that turns front-side mask images into meshes, normalizes them, thumbnails them, slots them in a visual deck, and previews them in a postprocessed R3F scene.
              </p>
            </div>
          )}
        </div>
      </aside>

      {/* Main Preview Area */}
      <main className="flex-1 relative bg-neutral-950 p-0 overflow-hidden">
        {activeTab === 'r3f' ? (
          <R3FApp />
        ) : activeTab === 'runtime' ? (
          processed ? (
            <RuntimePreview avatar={processed} />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center text-neutral-600">
                <Play className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium">No Avatar Loaded</p>
              </div>
            </div>
          )
        ) : (
          <div className="p-8 h-full overflow-y-auto">
            {!processed && !isProcessing && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center text-neutral-600">
                  <Layers className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-medium">Awaiting Source Image</p>
                  <p className="text-sm opacity-60">Upload an image to run the pipeline</p>
                </div>
              </div>
            )}

            {isProcessing && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-indigo-500 animate-pulse font-mono">Processing Pipeline...</div>
              </div>
            )}

            {processed && !isProcessing && (
              <div className="max-w-5xl mx-auto space-y-8">
                <div className="grid grid-cols-2 gap-8">
                  {/* Alpha Preview with Skeleton */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-mono text-neutral-400 flex justify-between">
                      <span>avatar_alpha.png (Runtime Ready)</span>
                      <span className="text-green-400">Rig Detected</span>
                    </h3>
                    <div className="aspect-square rounded-xl border border-neutral-800 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjMjIyIi8+PHJlY3QgeD0iMTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iIzExMSIvPjxyZWN0IHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiMxMTEiLz48cmVjdCB4PSIxMCIgeT0iMTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iIzIyMiIvPjwvc3ZnPg==')] flex items-center justify-center overflow-hidden relative">
                      <img src={processed.assets.alpha} alt="Alpha" className="absolute inset-0 w-full h-full object-contain drop-shadow-2xl" />
                      {renderSkeleton(processed.landmarks, settings.outputSize)}
                    </div>
                  </div>

                  {/* Mask Preview */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-mono text-neutral-400">avatar_mask.png (Binary Silhouette)</h3>
                    <div className="aspect-square rounded-xl border border-neutral-800 bg-black flex items-center justify-center overflow-hidden">
                      <img src={processed.assets.mask} alt="Mask" className="max-w-full max-h-full object-contain" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-8">
                  {/* Base Preview */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-mono text-neutral-400">avatar_base.png</h3>
                    <div className="aspect-square rounded-xl border border-neutral-800 bg-black flex items-center justify-center overflow-hidden">
                      <img src={processed.assets.base} alt="Base" className="max-w-full max-h-full object-contain" />
                    </div>
                  </div>

                  {/* Model Preview */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-mono text-neutral-400">avatar.glb (3D Model)</h3>
                    <div className="aspect-square rounded-xl border border-neutral-800 bg-neutral-900 flex flex-col items-center justify-center overflow-hidden p-8 text-neutral-500">
                      <Box size={32} className="mb-2 opacity-50 text-indigo-400" />
                      <span className="text-xs font-medium text-indigo-300">Auto-Rigged GLB</span>
                      <span className="text-[10px] opacity-50 mt-1">Included in ZIP</span>
                    </div>
                  </div>

                  {/* Manifest */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-mono text-neutral-400">manifest.json</h3>
                    <div className="h-full rounded-xl border border-neutral-800 bg-neutral-900 p-4 overflow-auto">
                      <pre className="text-xs text-indigo-300 font-mono">
                        {JSON.stringify(processed.manifest, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
