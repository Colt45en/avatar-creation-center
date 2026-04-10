import * as THREE from 'three';

export class AvatarAnimationController {
  private mixer: THREE.AnimationMixer;
  private actions: Map<string, THREE.AnimationAction> = new Map();
  private currentAction: THREE.AnimationAction | null = null;

  constructor(root: THREE.Object3D) {
    this.mixer = new THREE.AnimationMixer(root);
  }

  addClip(name: string, clip: THREE.AnimationClip) {
    const action = this.mixer.clipAction(clip);
    action.setLoop(THREE.LoopRepeat, Infinity);
    this.actions.set(name, action);
  }

  play(name: string, fadeDuration: number = 0.3) {
    const nextAction = this.actions.get(name);
    if (!nextAction) {
      console.warn(`Animation "${name}" not found.`);
      return;
    }

    if (this.currentAction === nextAction) return;

    nextAction.reset();
    nextAction.play();

    if (this.currentAction) {
      nextAction.crossFadeFrom(this.currentAction, fadeDuration, true);
    }

    this.currentAction = nextAction;
  }

  update(delta: number) {
    this.mixer.update(delta);
  }

  stopAll() {
    this.mixer.stopAllAction();
    this.currentAction = null;
  }
}
