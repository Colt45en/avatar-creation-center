import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DragControls } from 'three/examples/jsm/controls/DragControls.js';
import { ProcessedAvatar, AvatarLandmarks, Point2D } from '../avatar/contracts/avatarTypes';
import { AvatarAutoRigger } from '../avatar/rig/AvatarAutoRigger';
import { PhysicsRig } from '../avatar/rig/PhysicsRig';
import { AvatarAnimationController } from '../avatar/rig/AvatarAnimationController';
import { AvatarAnimationFactory } from '../avatar/rig/AvatarAnimationFactory';
import { AvatarIKController } from '../avatar/rig/AvatarIKController';
import { ProceduralWalkController } from '../avatar/rig/ProceduralWalkController';
import { WEGCPoseRetargeter, WEGC_JOINT_DEFS } from '../avatar/rig/WEGCPoseRetargeter';
import { Play, Pause, Bone, Grid, Activity, Film, Crosshair, Zap, Box, Mountain, Smile, MessageCircle, Eye, Edit3, Layers, FlipHorizontal } from 'lucide-react';
import { useAvatarFSM } from '../avatar/extracted/AvatarFSM';
import { addAutoMorphClips } from '../avatar/extracted/AutoAnimator';

interface RuntimePreviewProps {
  avatar: ProcessedAvatar;
}

export default function RuntimePreview({ avatar }: RuntimePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<any>(null);
  const clockRef = useRef(new THREE.Clock());
  
  const [isPlaying, setIsPlaying] = useState(true);
  const [usePhysics, setUsePhysics] = useState(false);
  const [useIK, setUseIK] = useState(false);
  const [showBones, setShowBones] = useState(true);
  const [showWireframe, setShowWireframe] = useState(false);
  const [isHologram, setIsHologram] = useState(false);
  const [isVoxel, setIsVoxel] = useState(false);
  const [useProceduralWalk, setUseProceduralWalk] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isMirrored, setIsMirrored] = useState(false);
  const [localLandmarks, setLocalLandmarks] = useState<AvatarLandmarks | null>(null);
  const [lodInfo, setLodInfo] = useState({ level: 0, polygons: 0 });
  
  const [blendShapes, setBlendShapes] = useState<Record<string, number>>({
    'Muscular': 0,
    'Big Head': 0,
    'Wavy': 0
  });
  const [currentAnim, setCurrentAnim] = useState('idle');
  const fsm = useAvatarFSM();

  const isPlayingRef = useRef(isPlaying);
  const usePhysicsRef = useRef(usePhysics);
  const useIKRef = useRef(useIK);
  const useProceduralWalkRef = useRef(useProceduralWalk);
  const showBonesRef = useRef(showBones);
  const showWireframeRef = useRef(showWireframe);
  const isEditModeRef = useRef(isEditMode);
  const isMirroredRef = useRef(isMirrored);
  
  const skeletonRef = useRef<THREE.Skeleton | null>(null);
  const meshRef = useRef<THREE.SkinnedMesh | null>(null);
  const lodRef = useRef<THREE.LOD | null>(null);
  const helperRef = useRef<THREE.SkeletonHelper | null>(null);
  const physicsRigRef = useRef<PhysicsRig | null>(null);
  const animControllerRef = useRef<AvatarAnimationController | null>(null);
  const ikControllerRef = useRef<AvatarIKController | null>(null);
  const proceduralWalkRef = useRef<ProceduralWalkController | null>(null);

  useEffect(() => {
    if (avatar && avatar.landmarks) {
      setLocalLandmarks(avatar.landmarks);
    }
  }, [avatar]);

  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { useIKRef.current = useIK; }, [useIK]);
  useEffect(() => { 
    useProceduralWalkRef.current = useProceduralWalk; 
    if (!useProceduralWalk && proceduralWalkRef.current) {
      proceduralWalkRef.current.reset();
    }
  }, [useProceduralWalk]);
  useEffect(() => { showBonesRef.current = showBones; }, [showBones]);
  useEffect(() => { showWireframeRef.current = showWireframe; }, [showWireframe]);
  useEffect(() => { isEditModeRef.current = isEditMode; }, [isEditMode]);
  useEffect(() => { isMirroredRef.current = isMirrored; }, [isMirrored]);

  // Mirror Mode effect
  useEffect(() => {
    if (engineRef.current && engineRef.current.group) {
      engineRef.current.group.scale.x = isMirrored ? -1 : 1;
    }
  }, [isMirrored]);

  // Handle FSM State to Blend Shapes mapping
  useEffect(() => {
    if (fsm.blink) setBlendShapes(prev => ({ ...prev, 'Blink': 1 }));
    else setBlendShapes(prev => ({ ...prev, 'Blink': 0 }));
    
    if (fsm.smile) setBlendShapes(prev => ({ ...prev, 'Smile': 1 }));
    else setBlendShapes(prev => ({ ...prev, 'Smile': 0 }));
    
    if (fsm.talking) setBlendShapes(prev => ({ ...prev, 'MouthOpen': 0.8 }));
    else setBlendShapes(prev => ({ ...prev, 'MouthOpen': 0 }));
  }, [fsm.blink, fsm.smile, fsm.talking]);

  // Hologram Anchor Points
  useEffect(() => {
    if (!skeletonRef.current) return;

    if (isHologram) {
      const sphereGeo = new THREE.SphereGeometry(0.4, 16, 16);
      const sphereMat = new THREE.MeshBasicMaterial({ 
        color: 0x00ffff, 
        transparent: true, 
        opacity: 0.8,
        blending: THREE.AdditiveBlending
      });

      skeletonRef.current.bones.forEach(bone => {
        const sphere = new THREE.Mesh(sphereGeo, sphereMat);
        sphere.name = 'hologramPoint';
        bone.add(sphere);
      });
    } else {
      skeletonRef.current.bones.forEach(bone => {
        const spheres = bone.children.filter(c => c.name === 'hologramPoint');
        spheres.forEach(s => bone.remove(s));
      });
    }
    
    return () => {
      if (skeletonRef.current) {
        skeletonRef.current.bones.forEach(bone => {
          const spheres = bone.children.filter(c => c.name === 'hologramPoint');
          spheres.forEach(s => bone.remove(s));
        });
      }
    };
  }, [isHologram, localLandmarks]);

  // Handle Blend Shapes
  useEffect(() => {
    if (lodRef.current) {
      lodRef.current.levels.forEach(level => {
        const mesh = level.object as THREE.SkinnedMesh;
        if (mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
          Object.entries(blendShapes).forEach(([name, value]) => {
            const idx = mesh.morphTargetDictionary![name];
            if (idx !== undefined) {
              mesh.morphTargetInfluences![idx] = value as number;
            }
          });
        }
      });
    } else if (meshRef.current && meshRef.current.morphTargetDictionary && meshRef.current.morphTargetInfluences) {
      Object.entries(blendShapes).forEach(([name, value]) => {
        const idx = meshRef.current!.morphTargetDictionary![name];
        if (idx !== undefined) {
          meshRef.current!.morphTargetInfluences![idx] = value as number;
        }
      });
    }
  }, [blendShapes]);

  // Handle Material Updates (Hologram / Voxel)
  useEffect(() => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;
    const texture = mesh.material.map;
    
    const mat = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.1,
      side: THREE.DoubleSide,
      wireframe: showWireframe,
      color: isHologram ? 0x00aaff : 0xffffff,
      emissive: isHologram ? 0x0044aa : 0x000000,
      emissiveIntensity: isHologram ? 1.5 : 0.0,
      blending: isHologram ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: !isHologram,
      roughness: 0.8,
      metalness: 0.2,
      flatShading: isVoxel
    });

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.time = { value: 0 };
      mat.userData.shader = shader;
      
      let fragmentShader = shader.fragmentShader;
      let vertexShader = shader.vertexShader;
      
      if (isVoxel) {
        fragmentShader = fragmentShader.replace(
          `#include <map_fragment>`,
          `
          float pixels = 35.0;
          vec2 voxelUv = floor(vMapUv * pixels + 0.5) / pixels;
          vec4 sampledDiffuseColor = texture2D( map, voxelUv );
          diffuseColor *= sampledDiffuseColor;
          `
        );

        vertexShader = vertexShader.replace(
          `#include <project_vertex>`,
          `
          float gridSize = 0.6;
          transformed = floor(transformed / gridSize + 0.5) * gridSize;
          #include <project_vertex>
          `
        );
      }
      
      if (isHologram) {
        // Inject custom emissive and alpha logic for the hologram
        fragmentShader = fragmentShader.replace(
          `#include <emissivemap_fragment>`,
          `#include <emissivemap_fragment>
           
           // High frequency scanlines
           float scanline = sin(vMapUv.y * 400.0 - time * 30.0) * 0.5 + 0.5;
           float slowScan = sin(vMapUv.y * 10.0 - time * 2.0) * 0.5 + 0.5;
           
           // Fresnel / Rim Lighting effect
           vec3 viewDir = normalize(vViewPosition);
           float rim = 1.0 - max(abs(dot(viewDir, normal)), 0.0);
           float rimGlow = smoothstep(0.3, 1.0, rim);
           
           // Outline effect based on alpha gradient (partial extrude outline)
           float alpha = texture2D(map, vMapUv).a;
           float outline = 0.0;
           if (alpha > 0.05 && alpha < 0.8) {
             outline = 1.0;
           }
           
           // Add scanlines and rim light to emissive output
           totalEmissiveRadiance += vec3(0.0, 0.6, 1.0) * scanline * 1.0;
           totalEmissiveRadiance += vec3(0.0, 0.8, 1.0) * slowScan * 0.5;
           totalEmissiveRadiance += vec3(0.2, 0.8, 1.0) * rimGlow * 3.0;
           totalEmissiveRadiance += vec3(0.0, 1.0, 0.8) * outline * 4.0; // Glowing outline
           
           // Glitch effect (color shift and intensity spike)
           bool isGlitching = mod(time, 4.0) > 3.8 && sin(vMapUv.y * 50.0 + time * 100.0) > 0.8;
           if (isGlitching) {
              totalEmissiveRadiance.r += 2.0; // Red shift
              totalEmissiveRadiance.b *= 0.5;
              totalEmissiveRadiance += vec3(1.0, 0.2, 0.8) * 3.0;
           }
          `
        );
        
        // Modulate alpha based on scanlines and rim
        fragmentShader = fragmentShader.replace(
          `#include <output_fragment>`,
          `#include <output_fragment>
           gl_FragColor.a *= 0.15 + scanline * 0.2 + slowScan * 0.2 + rimGlow * 0.8 + outline;
           if (isGlitching) {
             gl_FragColor.a *= 0.5 + sin(time * 50.0) * 0.5;
           }
          `
        );

        // Partial extrusion and glitch displacement in vertex shader
        vertexShader = vertexShader.replace(
          `#include <project_vertex>`,
          `
          // Partial extrude outline effect
          float extrude = sin(position.y * 10.0 + time * 5.0) * 0.2;
          transformed.z += extrude;
          
          // Glitch displacement
          if (mod(time, 4.0) > 3.8 && sin(position.y * 50.0 + time * 100.0) > 0.8) {
             transformed.x += sin(time * 200.0) * 0.5;
             transformed.z -= 0.2;
          }
          
          #include <project_vertex>
          `
        );
      }
      
      fragmentShader = fragmentShader.replace(
        `#include <common>`,
        `
        uniform float time;
        #include <common>
        `
      );
      
      shader.fragmentShader = fragmentShader;
      shader.vertexShader = vertexShader;
    };
    
    // Apply material to all LOD levels
    if (lodRef.current) {
      lodRef.current.levels.forEach(level => {
        if (level.object instanceof THREE.SkinnedMesh) {
          level.object.material = mat;
        }
      });
    } else {
      mesh.material = mat;
    }
    
    // Sync holoPlane visibility
    if (engineRef.current && engineRef.current.holoPlane) {
      engineRef.current.holoPlane.visible = isHologram;
    }
  }, [isHologram, isVoxel, showWireframe]);

  // Handle IK Toggle
  useEffect(() => {
    if (!useIK && ikControllerRef.current) {
      ikControllerRef.current.reset();
    }
  }, [useIK]);

  // Handle Physics Toggle
  useEffect(() => { 
    usePhysicsRef.current = usePhysics; 
    if (!usePhysics && skeletonRef.current && physicsRigRef.current) {
      physicsRigRef.current.resetSkeleton(skeletonRef.current);
    } else if (usePhysics && skeletonRef.current && physicsRigRef.current) {
      // Rebuild to snap physics bodies to current procedural pose
      physicsRigRef.current.build(skeletonRef.current, engineRef.current?.getTerrainHeight);
    }
  }, [usePhysics]);

  // Initialize Physics Engine
  useEffect(() => {
    const rig = new PhysicsRig();
    rig.init().then(() => {
      physicsRigRef.current = rig;
      if (skeletonRef.current && usePhysicsRef.current) {
        rig.build(skeletonRef.current, engineRef.current?.getTerrainHeight);
      }
    });
    return () => rig.dispose();
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);
    scene.fog = new THREE.FogExp2(0x0a0a0a, 0.02);

    const camera = new THREE.PerspectiveCamera(45, containerRef.current.clientWidth / containerRef.current.clientHeight, 0.1, 1000);
    camera.position.set(0, 10, 30);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 10, 0);
    controls.autoRotate = true; // Auto-rotate to prove it's a 3D volume, not a still image
    controls.autoRotateSpeed = 2.0;

    // Environment - Math Grid Floor
    const gridGeo = new THREE.PlaneGeometry(200, 200);
    gridGeo.rotateX(-Math.PI / 2);
    const gridMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        color1: { value: new THREE.Color(0x444444) },
        color2: { value: new THREE.Color(0x222222) },
        size1: { value: 1 },
        size2: { value: 10 },
        distance: { value: 50.0 }
      },
      vertexShader: `
        varying vec3 worldPosition;
        void main() {
          vec4 pos = modelMatrix * vec4(position, 1.0);
          worldPosition = pos.xyz;
          gl_Position = projectionMatrix * viewMatrix * pos;
        }
      `,
      fragmentShader: `
        varying vec3 worldPosition;
        uniform vec3 color1;
        uniform vec3 color2;
        uniform float size1;
        uniform float size2;
        uniform float distance;
        
        float getGrid(float size) {
          vec2 r = worldPosition.xz / size;
          vec2 grid = abs(fract(r - 0.5) - 0.5) / fwidth(r);
          float line = min(grid.x, grid.y);
          return 1.0 - min(line, 1.0);
        }
        
        void main() {
          float g1 = getGrid(size1);
          float g2 = getGrid(size2);
          
          float d = length(cameraPosition - worldPosition);
          float fade = max(0.0, 1.0 - d / distance);
          
          vec3 color = mix(color2, color1, g1);
          float alpha = max(g1, g2) * fade;
          if (alpha < 0.01) discard;
          
          gl_FragColor = vec4(color, alpha * 0.5);
        }
      `,
      extensions: { derivatives: true }
    });
    const gridMesh = new THREE.Mesh(gridGeo, gridMat);
    scene.add(gridMesh);

    // Procedural Terrain (Hidden, kept for physics/walk logic)
    const getTerrainHeight = (x: number, z: number) => {
      return 0; // Flat floor for the math grid
    };

    // Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3); // Reduced ambient
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(5, 10, 7);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    const backLight = new THREE.DirectionalLight(0xaabbff, 1.0);
    backLight.position.set(-5, 5, -7);
    scene.add(backLight);

    // Spotlight for dramatic effect
    const spotLight = new THREE.SpotLight(0xffffff, 150.0);
    spotLight.position.set(0, 25, 10);
    spotLight.angle = Math.PI / 6;
    spotLight.penumbra = 0.5;
    spotLight.decay = 2;
    spotLight.distance = 100;
    spotLight.castShadow = true;
    spotLight.shadow.mapSize.width = 1024;
    spotLight.shadow.mapSize.height = 1024;
    scene.add(spotLight);
    
    // Add a subtle colored point light near the ground
    const pointLight = new THREE.PointLight(0xff00aa, 50.0, 50);
    pointLight.position.set(0, 2, 5);
    scene.add(pointLight);

    const group = new THREE.Group();
    scene.add(group);

    engineRef.current = { scene, camera, renderer, controls, group, getTerrainHeight };

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      
      const delta = clockRef.current.getDelta();
      const time = Date.now() * 0.003;

      // Animation Loop
      if (skeletonRef.current) {
        
        if (usePhysicsRef.current && physicsRigRef.current) {
          // 1. Physics-driven Ragdoll Animation
          physicsRigRef.current.update(time);
        } else if (useProceduralWalkRef.current && proceduralWalkRef.current) {
          // 2. Procedural Walking (IK + Terrain)
          proceduralWalkRef.current.update(delta, time);
          
          // Make camera follow the avatar
          const pelvis = skeletonRef.current.bones.find(b => b.name === 'pelvis');
          if (pelvis) {
            controls.target.copy(pelvis.position);
            camera.position.z = pelvis.position.z + 30;
            camera.position.x = pelvis.position.x;
          }
        } else {
          // 3. Keyframed Animation Controller
          if (isPlayingRef.current && animControllerRef.current) {
            animControllerRef.current.update(delta);
          }
          
          // 4. Inverse Kinematics (Overrides animation for specific limbs)
          if (useIKRef.current && ikControllerRef.current) {
            const ik = ikControllerRef.current;
            
            // Procedurally animate IK targets (e.g., reaching out)
            const lHandBase = ik.basePositions['lHandIK'];
            if (lHandBase) {
              ik.setTargetPosition('lHandIK', new THREE.Vector3(
                lHandBase.x + Math.sin(time * 3) * 4,
                lHandBase.y + Math.cos(time * 3) * 4,
                lHandBase.z
              ));
            }
            
            const rHandBase = ik.basePositions['rHandIK'];
            if (rHandBase) {
              ik.setTargetPosition('rHandIK', new THREE.Vector3(
                rHandBase.x - Math.sin(time * 3) * 4,
                rHandBase.y + Math.cos(time * 3) * 4,
                rHandBase.z
              ));
            }
            
            ik.update();
          }
        }
      }

      // Sync UI Toggles
      if (helperRef.current) {
        helperRef.current.visible = showBonesRef.current;
      }
      if (meshRef.current && meshRef.current.material.userData.shader) {
        meshRef.current.material.userData.shader.uniforms.time.value = time;
      }
      if (engineRef.current && engineRef.current.holoPlane) {
        engineRef.current.holoPlane.material.uniforms.time.value = time;
      }
      if (lodRef.current) {
        lodRef.current.update(camera);
        
        // Track LOD level and polygon count
        const currentLevel = lodRef.current.getCurrentLevel();
        const activeMesh = lodRef.current.levels[currentLevel].object as THREE.SkinnedMesh;
        const polyCount = activeMesh.geometry.index ? activeMesh.geometry.index.count / 3 : activeMesh.geometry.attributes.position.count / 3;
        
        // Only update state if it changed to avoid excessive re-renders
        setLodInfo(prev => {
          if (prev.level !== currentLevel || prev.polygons !== polyCount) {
            return { level: currentLevel, polygons: polyCount };
          }
          return prev;
        });
      }

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current) return;
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (containerRef.current) containerRef.current.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    if (!engineRef.current || !avatar || !localLandmarks) return;
    const { group, camera, renderer, controls } = engineRef.current;
    
    let ignore = false;

    // Clear previous
    while(group.children.length > 0) { 
      const child = group.children[0];
      group.remove(child); 
    }

    // Clean up previous drag controls
    if (engineRef.current.dragControls) {
      engineRef.current.dragControls.dispose();
      engineRef.current.dragControls = null;
    }

    // Load Avatar Texture and Auto-Rig
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(avatar.assets.alpha, (texture) => {
      if (ignore) return;
      
      texture.colorSpace = THREE.SRGBColorSpace;
      
      const aspect = texture.image.width / texture.image.height;
      const height = 20;
      const width = height * aspect;
      
      // Execute Phase 2 Auto-Rigger
      const { lod, skinnedMesh, skeleton, iks, material } = AvatarAutoRigger.createRiggedAvatar(
        texture, 
        localLandmarks, 
        width, 
        height, 
        avatar.manifest.settings.outputSize
      );
      
      lod.position.y = height / 2;
      group.add(lod);

      // Add Reference Hologram Image Plane
      const planeGeo = new THREE.PlaneGeometry(width, height);
      const planeMat = new THREE.ShaderMaterial({
        uniforms: {
          tDiffuse: { value: texture },
          time: { value: 0 }
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D tDiffuse;
          uniform float time;
          varying vec2 vUv;
          void main() {
            vec4 texColor = texture2D(tDiffuse, vUv);
            if (texColor.a < 0.1) discard;
            
            // Hologram scanlines
            float scanline = sin(vUv.y * 100.0 - time * 5.0) * 0.1 + 0.9;
            
            // Glowing cyan tint
            vec3 holoColor = mix(texColor.rgb, vec3(0.0, 0.8, 1.0), 0.5);
            
            gl_FragColor = vec4(holoColor * scanline, texColor.a * 0.4);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
      });
      
      const planeMesh = new THREE.Mesh(planeGeo, planeMat);
      planeMesh.position.y = height / 2;
      planeMesh.position.z = 0; // Exactly at the anchor point
      group.add(planeMesh);
      
      // Store reference to update time uniform
      engineRef.current.holoPlane = planeMesh;
      
      // Update initial visibility
      planeMesh.visible = isHologram;

      // Add visual skeleton helper
      const skeletonHelper = new THREE.SkeletonHelper(lod);
      (skeletonHelper.material as THREE.LineBasicMaterial).linewidth = 3;
      group.add(skeletonHelper);

      // Store refs for animation loop
      skeletonRef.current = skeleton;
      meshRef.current = skinnedMesh; // Keep high-res mesh for IK and shaders
      lodRef.current = lod;
      helperRef.current = skeletonHelper;

      // Initialize Animation Controller
      const animController = new AvatarAnimationController(lod);
      animController.addClip('idle', AvatarAnimationFactory.createIdle());
      animController.addClip('walk', AvatarAnimationFactory.createWalk());
      animController.addClip('wave', AvatarAnimationFactory.createWave());
      animController.play('idle');
      animControllerRef.current = animController;
      setCurrentAnim('idle');

      // Initialize IK Controller
      ikControllerRef.current = new AvatarIKController(skinnedMesh, iks);

      if (engineRef.current && engineRef.current.getTerrainHeight) {
        proceduralWalkRef.current = new ProceduralWalkController(ikControllerRef.current, skeleton, engineRef.current.getTerrainHeight);
      }

      // Build physics rig if enabled
      if (usePhysicsRef.current && physicsRigRef.current) {
        physicsRigRef.current.build(skeleton, engineRef.current?.getTerrainHeight);
      }

      // Rig Edit Mode Logic
      if (isEditModeRef.current) {
        const sphereGeo = new THREE.SphereGeometry(0.3, 16, 16);
        const sphereMat = new THREE.MeshBasicMaterial({ color: 0xff0000, depthTest: false });
        const dragObjects: THREE.Mesh[] = [];
        
        const mapPoint = (p: Point2D) => {
          const x = (p.x / avatar.manifest.settings.outputSize - 0.5) * width;
          const y = -(p.y / avatar.manifest.settings.outputSize - 0.5) * height + height / 2;
          return new THREE.Vector3(x, y, 0);
        };
        
        Object.entries(localLandmarks).forEach(([key, point]) => {
          const sphere = new THREE.Mesh(sphereGeo, sphereMat);
          sphere.position.copy(mapPoint(point));
          sphere.userData = { key };
          group.add(sphere);
          dragObjects.push(sphere);
        });
        
        const dragControls = new DragControls(dragObjects, camera, renderer.domElement);
        engineRef.current.dragControls = dragControls;
        
        dragControls.addEventListener('dragstart', () => {
          controls.enabled = false;
        });
        
        dragControls.addEventListener('dragend', (event) => {
          controls.enabled = true;
          const sphere = event.object;
          const key = sphere.userData.key;
          
          const unmapPoint = (v: THREE.Vector3) => {
            const x = (v.x / width + 0.5) * avatar.manifest.settings.outputSize;
            const y = (-(v.y - height / 2) / height + 0.5) * avatar.manifest.settings.outputSize;
            return { x, y };
          };
          
          const newPoint = unmapPoint(sphere.position);
          
          setLocalLandmarks(prev => {
            if (!prev) return prev;
            return { ...prev, [key]: newPoint };
          });
        });
      }
    });

    return () => {
      ignore = true;
    };
  }, [avatar, localLandmarks, isEditMode]);

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden border border-neutral-800 shadow-2xl">
      <div ref={containerRef} className="absolute inset-0" />
      
      {/* LOD Info Overlay */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 flex gap-4 z-10 bg-neutral-900/80 px-4 py-2 rounded-xl border border-neutral-800 backdrop-blur-md shadow-xl">
        <div className="flex items-center gap-2 text-xs font-bold text-neutral-300">
          <Layers size={14} className="text-indigo-400" />
          LOD Level: <span className="text-white">{lodInfo.level}</span>
        </div>
        <div className="w-px h-4 bg-neutral-700" />
        <div className="flex items-center gap-2 text-xs font-bold text-neutral-300">
          <Grid size={14} className="text-indigo-400" />
          Polygons: <span className="text-white">{lodInfo.polygons.toLocaleString()}</span>
        </div>
      </div>

      {/* Animation Selector Overlay */}
      <div className="absolute top-6 left-6 flex gap-2 z-10 bg-neutral-900/80 p-2 rounded-xl border border-neutral-800 backdrop-blur-md shadow-xl">
        <div className="flex items-center px-3 text-neutral-500 border-r border-neutral-700 mr-1">
          <Film size={16} />
        </div>
        {['idle', 'walk', 'wave', 'autoClips'].map(anim => (
          <button
            key={anim}
            onClick={() => {
              if (anim === 'autoClips' && meshRef.current) {
                const clip = addAutoMorphClips(meshRef.current);
                if (clip && animControllerRef.current) {
                  animControllerRef.current.addClip('autoClips', clip);
                }
              }
              setCurrentAnim(anim);
              animControllerRef.current?.play(anim);
              if (usePhysics) setUsePhysics(false);
              if (!isPlaying) setIsPlaying(true);
            }}
            aria-pressed={currentAnim === anim}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${currentAnim === anim && !usePhysics ? 'bg-indigo-600 text-white' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}
          >
            {anim === 'autoClips' ? 'Auto Morphs' : anim}
          </button>
        ))}
      </div>

      {/* Blend Shapes & FSM Overlay */}
      <div className="absolute top-6 right-6 flex flex-col gap-2 z-10 w-64">
        <div className="bg-neutral-900/80 p-4 rounded-xl border border-neutral-800 backdrop-blur-md shadow-xl flex flex-col gap-4">
          <h3 className="text-white text-sm font-bold uppercase tracking-wider">FSM Expressions</h3>
          <div className="flex gap-2">
            <button 
              onClick={() => fsm.setState('blink', true, 300)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${fsm.blink ? 'bg-indigo-600 text-white' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}
            >
              <Eye size={14} className="inline mr-1" /> Blink
            </button>
            <button 
              onClick={() => fsm.setState('smile', true, 1200)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${fsm.smile ? 'bg-indigo-600 text-white' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}
            >
              <Smile size={14} className="inline mr-1" /> Smile
            </button>
            <button 
              onClick={() => fsm.setState('talking', !fsm.talking)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${fsm.talking ? 'bg-indigo-600 text-white' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}
            >
              <MessageCircle size={14} className="inline mr-1" /> Talk
            </button>
          </div>

          <hr className="border-neutral-800" />

          <h3 className="text-white text-sm font-bold uppercase tracking-wider">Blend Shapes</h3>
          {Object.keys(blendShapes).map(key => (
            <div key={key} className="flex flex-col gap-2">
              <div className="flex justify-between text-xs font-medium text-neutral-400">
                <span>{key}</span>
                <span className="text-indigo-400">{Math.round(blendShapes[key] * 100)}%</span>
              </div>
              <input 
                type="range" 
                min="0" max="1" step="0.01" 
                value={blendShapes[key]}
                onChange={(e) => setBlendShapes(prev => ({...prev, [key]: parseFloat(e.target.value)}))}
                className="w-full accent-indigo-500 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                aria-label={`${key} blend shape`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Runtime Controls Overlay */}
      <div className="absolute bottom-6 left-6 flex gap-3 z-10">
        <button 
          onClick={() => setIsPlaying(!isPlaying)}
          disabled={usePhysics || isEditMode}
          aria-pressed={isPlaying}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${usePhysics || isEditMode ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed' : isPlaying ? 'bg-indigo-600 text-white' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          {isPlaying ? 'Pause Anim' : 'Play Anim'}
        </button>

        <button 
          onClick={() => setUsePhysics(!usePhysics)}
          disabled={isEditMode}
          aria-pressed={usePhysics}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${isEditMode ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed' : usePhysics ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/20' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}
        >
          <Activity size={16} />
          {usePhysics ? 'Physics: ON' : 'Physics: OFF'}
        </button>

        <button 
          onClick={() => setUseIK(!useIK)}
          disabled={usePhysics || isEditMode}
          aria-pressed={useIK}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${usePhysics || isEditMode ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed' : useIK ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/20' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}
        >
          <Crosshair size={16} />
          {useIK ? 'IK: ON' : 'IK: OFF'}
        </button>

        <button 
          onClick={() => {
            setUseProceduralWalk(!useProceduralWalk);
            if (!useProceduralWalk) {
              setUsePhysics(false);
              setUseIK(false);
              setIsPlaying(false);
            }
          }}
          disabled={usePhysics || isEditMode}
          aria-pressed={useProceduralWalk}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${usePhysics || isEditMode ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed' : useProceduralWalk ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}
        >
          <Mountain size={16} />
          {useProceduralWalk ? 'Proc Walk: ON' : 'Proc Walk: OFF'}
        </button>

        <button 
          onClick={() => setShowBones(!showBones)}
          aria-pressed={showBones}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${showBones ? 'bg-green-600 text-white' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}
        >
          <Bone size={16} />
          Bones
        </button>

        <button 
          onClick={() => setShowWireframe(!showWireframe)}
          aria-pressed={showWireframe}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${showWireframe ? 'bg-blue-600 text-white' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}
        >
          <Grid size={16} />
          Wireframe
        </button>

        <button 
          onClick={() => setIsHologram(!isHologram)}
          aria-pressed={isHologram}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${isHologram ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-900/20' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}
        >
          <Zap size={16} />
          Hologram
        </button>

        <button 
          onClick={() => setIsVoxel(!isVoxel)}
          aria-pressed={isVoxel}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${isVoxel ? 'bg-pink-600 text-white shadow-lg shadow-pink-900/20' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}
        >
          <Box size={16} />
          Voxel
        </button>

        <button 
          onClick={() => setIsMirrored(!isMirrored)}
          aria-pressed={isMirrored}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${isMirrored ? 'bg-yellow-600 text-white shadow-lg shadow-yellow-900/20' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}
        >
          <FlipHorizontal size={16} />
          Mirror
        </button>

        <button 
          onClick={() => {
            setIsEditMode(!isEditMode);
            if (!isEditMode) {
              setIsPlaying(false);
              setUsePhysics(false);
              setUseIK(false);
              setUseProceduralWalk(false);
              setShowBones(true);
            }
          }}
          aria-pressed={isEditMode}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${isEditMode ? 'bg-red-600 text-white shadow-lg shadow-red-900/20' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}
        >
          <Edit3 size={16} />
          {isEditMode ? 'Rig Edit: ON' : 'Rig Edit: OFF'}
        </button>
      </div>
    </div>
  );
}
