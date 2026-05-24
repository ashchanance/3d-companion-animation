import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils, VRM } from "@pixiv/three-vrm";
import {
  VRMAnimationLoaderPlugin,
  createVRMAnimationClip,
} from "@pixiv/three-vrm-animation";

let currentVrm: VRM | undefined;
let mixer: THREE.AnimationMixer | undefined;
const lookAtTarget = new THREE.Object3D();
let hasIdleAnimation = false;
let isInitialPoseApplied = false;

// ── Blink state ──────────────────────────────────────────────────────────────
let isBlinking = false;
let blinkProgress = 0;
let timeSinceLastBlink = 0;
let nextBlinkTime = randomBetween(1, 6);
const BLINK_DURATION = 0.15;

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpAngle(current: number, target: number, speed: number) {
  return lerp(current, target, 1 - Math.pow(speed, 1)); // exponential ease
}

function updateBlink(delta: number) {
  if (!currentVrm?.expressionManager) return;
  timeSinceLastBlink += delta;

  if (!isBlinking && timeSinceLastBlink >= nextBlinkTime) {
    isBlinking = true;
    blinkProgress = 0;
  }

  if (isBlinking) {
    blinkProgress += delta / BLINK_DURATION;
    const blinkValue = Math.sin(Math.PI * blinkProgress);
    currentVrm.expressionManager.setValue("blink", Math.min(blinkValue, 1));

    if (blinkProgress >= 1) {
      isBlinking = false;
      timeSinceLastBlink = 0;
      currentVrm.expressionManager.setValue("blink", 0);
      nextBlinkTime = randomBetween(2, 6);
    }
  }
}

// ── Idle eye saccade (subtle natural eye drift) ──────────────────────────────
let saccadeTimer = 0;
let saccadeTarget = { x: 0, y: 0 };
let saccadeCurrent = { x: 0, y: 0 };

function updateSaccade(delta: number) {
  saccadeTimer -= delta;
  if (saccadeTimer <= 0) {
    saccadeTarget.x = randomBetween(-0.4, 0.4);
    saccadeTarget.y = randomBetween(-0.2, 0.2);
    saccadeTimer = randomBetween(1.5, 4.0);
  }
  const speed = 0.08;
  saccadeCurrent.x = lerp(saccadeCurrent.x, saccadeTarget.x, speed);
  saccadeCurrent.y = lerp(saccadeCurrent.y, saccadeTarget.y, speed);
}

// ── Action/Expression state ───────────────────────────────────────────────────
export type AvatarAction = "idle" | "dance" | "think" | "speak";
let currentAction: AvatarAction = "idle";
let actionTime = 0;

// Smooth expression values (lerped towards target)
const expressionValues: Record<string, number> = {
  happy: 0,
  joy: 0,
  sad: 0,
  angry: 0,
  relaxed: 0,
  aa: 0,
  blink: 0,
};
const expressionTargets: Record<string, number> = { ...expressionValues };

function setExpressionTarget(name: string, value: number) {
  expressionTargets[name] = value;
}

function clearExpressionTargets(...except: string[]) {
  for (const key of Object.keys(expressionTargets)) {
    if (!except.includes(key)) expressionTargets[key] = 0;
  }
}

// Smooth bone targets (bone name → target rotation xyz)
const boneTargets: Record<string, THREE.Euler> = {};
const boneCurrent: Record<string, THREE.Euler> = {};

const BONE_NAMES = [
  "hips",
  "leftUpperArm",
  "leftLowerArm",
  "rightUpperArm",
  "rightLowerArm",
  "leftShoulder",
  "rightShoulder",
  "spine",
  "chest",
  "upperChest",
  "neck",
  "head",
] as const;

function getBoneTarget(name: string): THREE.Euler {
  if (!boneTargets[name]) boneTargets[name] = new THREE.Euler();
  if (!boneCurrent[name]) boneCurrent[name] = new THREE.Euler();
  return boneTargets[name];
}

// Robust fallback mapping for models where normalized humanoid arm bones are missing/misaligned
type ArmBoneKey =
  | "leftShoulder"
  | "leftUpperArm"
  | "leftLowerArm"
  | "rightShoulder"
  | "rightUpperArm"
  | "rightLowerArm";

const armBoneFallbackNodes: Partial<Record<ArmBoneKey, THREE.Object3D>> = {};

function findFirstBoneNodeByRegex(root: THREE.Object3D, patterns: RegExp[]) {
  let found: THREE.Object3D | undefined;
  root.traverse((obj) => {
    if (found) return;
    const name = (obj.name || "").toLowerCase();
    if (!name) return;
    if (patterns.some((re) => re.test(name))) {
      found = obj;
    }
  });
  return found;
}

function refreshArmBoneFallbackMap(vrm: VRM) {
  armBoneFallbackNodes.leftShoulder = findFirstBoneNodeByRegex(vrm.scene, [
    /(^|[_\-.])left([_\-.])shoulder($|[_\-.])/i,
    /(^|[_\-.])l([_\-.])shoulder($|[_\-.])/i,
    /(^|[_\-.])shoulder([_\-.])l($|[_\-.])/i,
  ]);
  armBoneFallbackNodes.leftUpperArm = findFirstBoneNodeByRegex(vrm.scene, [
    /(^|[_\-.])left([_\-.])(upper)?arm($|[_\-.])/i,
    /(^|[_\-.])l([_\-.])(upper)?arm($|[_\-.])/i,
    /(^|[_\-.])arm([_\-.])l($|[_\-.])/i,
  ]);
  armBoneFallbackNodes.leftLowerArm = findFirstBoneNodeByRegex(vrm.scene, [
    /(^|[_\-.])left([_\-.])(lower)?(forearm|arm)$|(^|[_\-.])left([_\-.])forearm($|[_\-.])/i,
    /(^|[_\-.])l([_\-.])(lower)?(forearm|arm)$|(^|[_\-.])l([_\-.])forearm($|[_\-.])/i,
  ]);

  armBoneFallbackNodes.rightShoulder = findFirstBoneNodeByRegex(vrm.scene, [
    /(^|[_\-.])right([_\-.])shoulder($|[_\-.])/i,
    /(^|[_\-.])r([_\-.])shoulder($|[_\-.])/i,
    /(^|[_\-.])shoulder([_\-.])r($|[_\-.])/i,
  ]);
  armBoneFallbackNodes.rightUpperArm = findFirstBoneNodeByRegex(vrm.scene, [
    /(^|[_\-.])right([_\-.])(upper)?arm($|[_\-.])/i,
    /(^|[_\-.])r([_\-.])(upper)?arm($|[_\-.])/i,
    /(^|[_\-.])arm([_\-.])r($|[_\-.])/i,
  ]);
  armBoneFallbackNodes.rightLowerArm = findFirstBoneNodeByRegex(vrm.scene, [
    /(^|[_\-.])right([_\-.])(lower)?(forearm|arm)$|(^|[_\-.])right([_\-.])forearm($|[_\-.])/i,
    /(^|[_\-.])r([_\-.])(lower)?(forearm|arm)$|(^|[_\-.])r([_\-.])forearm($|[_\-.])/i,
  ]);
}

function lerpBones(speed: number) {
  if (!currentVrm) return;
  for (const name of BONE_NAMES) {
    const target = boneTargets[name];
    let node = currentVrm.humanoid?.getNormalizedBoneNode(name as any);

    if (
      !node &&
      (name === "leftShoulder" ||
        name === "leftUpperArm" ||
        name === "leftLowerArm" ||
        name === "rightShoulder" ||
        name === "rightUpperArm" ||
        name === "rightLowerArm")
    ) {
      node = armBoneFallbackNodes[name as ArmBoneKey] ?? null;
    }

    if (!target || !node) continue;
    if (!boneCurrent[name]) boneCurrent[name] = new THREE.Euler();
    boneCurrent[name].x = lerpAngle(boneCurrent[name].x, target.x, speed);
    boneCurrent[name].y = lerpAngle(boneCurrent[name].y, target.y, speed);
    boneCurrent[name].z = lerpAngle(boneCurrent[name].z, target.z, speed);
    node.rotation.x = boneCurrent[name].x;
    node.rotation.y = boneCurrent[name].y;
    node.rotation.z = boneCurrent[name].z;
  }
}

function setBoneTarget(name: string, x: number, y: number, z: number) {
  getBoneTarget(name).set(x, y, z);
}

function resetBoneTargets(...names: string[]) {
  for (const name of names) {
    if (boneTargets[name]) boneTargets[name].set(0, 0, 0);
    if (boneCurrent[name]) boneCurrent[name].set(0, 0, 0);
  }
}

function resetAllPoseTargets() {
  for (const name of BONE_NAMES) {
    resetBoneTargets(name);
  }
}

function setNeutralArmPose() {
  setBoneTarget("leftShoulder", 0, 0, 0);
  setBoneTarget("leftUpperArm", 0, 0, 0);
  setBoneTarget("leftLowerArm", 0, 0, 0);
  setBoneTarget("rightShoulder", 0, 0, 0);
  setBoneTarget("rightUpperArm", 0, 0, 0);
  setBoneTarget("rightLowerArm", 0, 0, 0);
}

// Natural A-pose for Arisa — arms hanging naturally at sides
function setArisaArmDownPoseTargets(time = 0) {
  // Counter-phase arm swing: left/right arms swing opposite each other (like breathing/weight shift)
  const leftSwing = Math.sin(time * 0.9) * 0.08;              // forward/back X rotation
  const rightSwing = Math.sin(time * 0.9 + Math.PI) * 0.08;    // opposite phase
  const vertBob = Math.sin(time * 1.8 + 0.7) * 0.025;       // subtle vertical variation

  // Shoulders: gentle roll following arm motion
  setBoneTarget("leftShoulder", 0.0, 0.0, -0.02 + leftSwing * 0.18);
  setBoneTarget("rightShoulder", 0.0, 0.0, 0.02 + rightSwing * 0.18);

  // Upper arms hang down (Z ±1.48 from T-pose reference → arms at sides)
  // X rotation provides counter-phase forward/back swing for natural look
  setBoneTarget("leftUpperArm", vertBob + leftSwing, -0.12, 1.48 + leftSwing * 0.1);
  setBoneTarget("rightUpperArm", -vertBob + rightSwing, 0.12, -1.48 + rightSwing * 0.1);

  // Elbow: natural bend that varies with the swing motion
  setBoneTarget("leftLowerArm", 0.2 + leftSwing * 0.12, leftSwing * 0.06, 0.0);
  setBoneTarget("rightLowerArm", -0.2 + rightSwing * 0.12, rightSwing * 0.06, 0.0);
}

function resetActionPose() {
  resetAllPoseTargets();
  setNeutralArmPose();
}

function setRelaxedPoseTargets(time = 0, gazeX = 0, gazeY = 0) {
  const breath = Math.sin(time * 1.35) * 0.04;                    // 2× previous amplitude
  const sway = Math.sin(time * 0.75 + 0.4) * 0.038;             // 2× previous amplitude
  const nod = Math.sin(time * 1.1 + 1.2) * 0.015;             // 2× previous amplitude
  const gazeYaw = THREE.MathUtils.clamp(gazeX, -1, 1) * 0.1;
  const gazePitch = THREE.MathUtils.clamp(gazeY, -1, 1) * 0.06;

  // Hips: gentle side-to-side sway for weight shift feeling
  setBoneTarget("hips", 0, sway * 0.35, sway * 0.6);
  setBoneTarget("spine", 0.04 + breath * 0.8, sway * 0.14 + gazeYaw * 0.04, -0.01 + sway * 0.06);
  setBoneTarget("chest", 0.03 + breath * 0.6, sway * 0.09 + gazeYaw * 0.02, 0.01);
  setBoneTarget("upperChest", 0.02 + breath * 0.4, gazeYaw * 0.015, sway * 0.045);
  setBoneTarget("neck", -0.02 + nod + gazePitch * 0.45, sway * 0.18 + gazeYaw * 0.16, 0);
  setBoneTarget("head", 0.05 + nod * 1.5 + gazePitch * 0.8, 0.05 + Math.sin(time * 0.7) * 0.025 + gazeYaw * 0.32, -0.02 + Math.sin(time * 0.9) * 0.012 + gazeYaw * 0.04);

  // Use natural arm-down pose
  setArisaArmDownPoseTargets(time);
}

export function setAvatarAction(action: AvatarAction) {
  if (currentAction === action) return;
  currentAction = action;
  actionTime = 0;

  resetActionPose();
  clearExpressionTargets("blink");

  if (action === "idle") {
    if (mixer) {
      (mixer as any)._actions?.forEach((a: any) => {
        a.paused = false;
        a.enabled = true;
        if (!a.isRunning()) a.play();
      });
    }
  } else {
    if (mixer) {
      (mixer as any)._actions?.forEach((a: any) => {
        a.paused = true;
      });
    }
  }
}

// ── Mouse head tracking state ─────────────────────────────────────────────────
let mouseOffsetX = 0;
let mouseOffsetY = 0;

let animationFrameId: number | undefined;
let abortController: AbortController | undefined;

export async function initVRM(
  containerId: string,
  modelUrl: string = "/Janna/_VRM/Janna.vrm",
  idleAnimationUrl: string = "/assets/vrm/animations/idle_loop.vrma",
) {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = undefined;
  }
  if (abortController) {
    abortController.abort();
  }
  abortController = new AbortController();
  const { signal } = abortController;

  isInitialPoseApplied = false;
  hasIdleAnimation = false;
  currentVrm = undefined;
  mixer = undefined;

  const container = document.getElementById(containerId);
  if (!container) return;

  // ── Renderer ──────────────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  let renderWidth = Math.max(1, container.clientWidth);
  let renderHeight = Math.max(1, container.clientHeight);
  renderer.setSize(renderWidth, renderHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  container.innerHTML = "";
  container.appendChild(renderer.domElement);

  // ── Camera ────────────────────────────────────────────────────────────────
  const camera = new THREE.PerspectiveCamera(
    30.0,
    renderWidth / renderHeight,
    0.1,
    20.0,
  );
  camera.position.set(0.0, 1.3, 3.0);

  // VRM lookAt target — placed in front of camera
  camera.add(lookAtTarget);
  lookAtTarget.position.set(0, 0, -2);

  // ── Scene ─────────────────────────────────────────────────────────────────
  const scene = new THREE.Scene();
  scene.add(camera);

  const dirLight = new THREE.DirectionalLight(0xffffff, 2);
  dirLight.position.set(1.0, 1.0, 1.0).normalize();
  scene.add(dirLight);
  scene.add(new THREE.AmbientLight(0xffffff, 1));

  // ── Loader ────────────────────────────────────────────────────────────────
  const loader = new GLTFLoader();
  loader.crossOrigin = "anonymous";
  loader.register((parser) => new VRMLoaderPlugin(parser));
  loader.register((parser) => new VRMAnimationLoaderPlugin(parser));

  // ── Load VRM model ────────────────────────────────────────────────────────
  try {
    console.log("[VRM] Loading model from", modelUrl);
    const gltf = await loader.loadAsync(modelUrl);

    const vrm = gltf.userData.vrm as VRM;

    if (!vrm) {
      console.error("[VRM] Loaded GLTF is not a VRM file");
      return;
    }

    VRMUtils.removeUnnecessaryVertices(gltf.scene);
    VRMUtils.combineSkeletons(gltf.scene);
    vrm.scene.traverse((obj) => {
      obj.frustumCulled = false;
    });

    // VRM 0.x models face +Z (away from camera) — rotate 180°
    const vrmGroup = new THREE.Group();
    vrmGroup.add(vrm.scene);
    vrmGroup.rotation.y = Math.PI;
    scene.add(vrmGroup);
    currentVrm = vrm;
    refreshArmBoneFallbackMap(vrm);

    // Attach native lookAt tracking
    if (currentVrm.lookAt) {
      currentVrm.lookAt.target = lookAtTarget;
    }

    console.log("[VRM] Model loaded from", modelUrl);

    // ── Idle clip disabled for hero: force natural static idle pose ───────
    hasIdleAnimation = false;
    mixer = undefined;

    const loadingOverlay = document.getElementById("loadingOverlay");
    if (loadingOverlay) loadingOverlay.classList.add("hidden");
  } catch (err) {
    console.error("[VRM] Failed to load VRM model:", err);
    const loadingOverlay = document.getElementById("loadingOverlay");
    if (loadingOverlay) loadingOverlay.classList.add("hidden");
    return;
  }

  // ── Poke state ────────────────────────────────────────────────────────────
  let isPoked = false;

  // Apply explicit startup pose immediately so model never appears in T-pose
  if (!isInitialPoseApplied) {
    resetAllPoseTargets();
    setRelaxedPoseTargets();
    setArisaArmDownPoseTargets();
    isInitialPoseApplied = true;
  }

  // ── Smooth lookAt position ────────────────────────────────────────────────
  let lookAtCurrentX = 0;
  let lookAtCurrentY = 0;

  // ── Animation loop ────────────────────────────────────────────────────────
  const clock = new THREE.Clock();

  const updateRendererSize = () => {
    const nextWidth = Math.max(1, container.clientWidth);
    const nextHeight = Math.max(1, container.clientHeight);
    if (nextWidth === renderWidth && nextHeight === renderHeight) return;
    renderWidth = nextWidth;
    renderHeight = nextHeight;
    camera.aspect = renderWidth / renderHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(renderWidth, renderHeight);
  };

  function animate() {
    animationFrameId = requestAnimationFrame(animate);
    updateRendererSize();
    const delta = Math.min(clock.getDelta(), 0.05); // clamp to avoid stutters

    // Update idle mixer only when idle & not poked
    if (mixer && currentAction === "idle" && !isPoked) {
      mixer.update(delta);
    }

    if (currentVrm) {
      // ── Head/Eye mouse tracking (smooth) ───────────────────────────
      const TRACK_SPEED = 0.085;
      const gazeX = THREE.MathUtils.clamp(mouseOffsetX, -1, 1);
      const gazeY = THREE.MathUtils.clamp(mouseOffsetY, -1, 1);
      lookAtCurrentX = lerp(lookAtCurrentX, gazeX * 4.4, TRACK_SPEED);
      lookAtCurrentY = lerp(lookAtCurrentY, -gazeY * 3.6, TRACK_SPEED);
      lookAtTarget.position.x = lookAtCurrentX;
      lookAtTarget.position.y = lookAtCurrentY;

      // ── Idle Eye Saccade ───────────────────────────────────────────
      if (currentAction === "idle" && !isPoked) {
        updateSaccade(delta);
        // saccade subtly shifts lookAtTarget
        lookAtTarget.position.x += saccadeCurrent.x;
        lookAtTarget.position.y += saccadeCurrent.y;
      }

      // ── Expressions ───────────────────────────────────────────────
      if (isPoked) {
        setExpressionTarget("happy", 1.0);
        setExpressionTarget("joy", 1.0);
        setExpressionTarget("aa", 0.4);
        setExpressionTarget("blink", 0);
      } else if (currentAction === "idle") {
        updateBlink(delta);
        clearExpressionTargets("blink");
        setExpressionTarget("relaxed", 0.38 + Math.sin(actionTime * 1.1) * 0.03);
        setExpressionTarget("happy", 0.05 + (Math.sin(actionTime * 0.85 + 0.6) + 1) * 0.02);
        setExpressionTarget("joy", 0.02 + (Math.sin(actionTime * 1.1 + 1.1) + 1) * 0.01);
      }

      // Lerp all expression values toward targets
      const EXPR_SPEED = 0.1;
      for (const key of Object.keys(expressionValues)) {
        expressionValues[key] = lerp(
          expressionValues[key],
          expressionTargets[key] ?? 0,
          EXPR_SPEED,
        );
        currentVrm.expressionManager?.setValue(key, expressionValues[key]);
      }

      // ── Procedural Actions ─────────────────────────────────────────
      actionTime += delta;
      const BONE_SPEED = 0.3;

      // Subtle idle root motion keeps the avatar from feeling frozen in place.
      if (currentAction === "idle" && !isPoked) {
        const idleFloat = Math.sin(actionTime * 1.2) * 0.022;
        const idleShift = Math.sin(actionTime * 0.75 + 0.5) * 0.012;
        const idleTilt = Math.sin(actionTime * 0.9) * 0.016;
        currentVrm.scene.position.set(idleShift, idleFloat, 0);
        currentVrm.scene.rotation.z = idleTilt;
      } else {
        currentVrm.scene.position.set(0, 0, 0);
        currentVrm.scene.rotation.z = 0;
      }

      if (currentAction === "dance") {
        setExpressionTarget("joy", 0.8);
        const sway = Math.sin(actionTime * 4.5) * 0.12;
        const bounce = Math.sin(actionTime * 7.5) * 0.06;
        setBoneTarget("spine", bounce * 0.35, sway * 0.12, sway * 0.18);
        setBoneTarget("neck", -bounce * 0.12, -sway * 0.08, -sway * 0.12);
        setBoneTarget("leftShoulder", 0.04, 0, -0.02);
        setBoneTarget(
          "leftUpperArm",
          0.12 + Math.sin(actionTime * 4 + 1.2) * 0.08,
          0.02,
          -0.12 + Math.sin(actionTime * 3.2) * 0.05,
        );
        setBoneTarget(
          "leftLowerArm",
          0.04,
          0,
          -0.03 + Math.sin(actionTime * 5.2) * 0.04,
        );
        setBoneTarget("rightShoulder", -0.04, 0, 0.02);
        setBoneTarget(
          "rightUpperArm",
          -0.12 + Math.sin(actionTime * 4) * 0.08,
          -0.02,
          0.12 + Math.sin(actionTime * 3.2 + 0.8) * 0.05,
        );
        setBoneTarget(
          "rightLowerArm",
          -0.04,
          0,
          0.03 + Math.sin(actionTime * 5.2 + 1.1) * 0.04,
        );
      } else if (currentAction === "think") {
        setExpressionTarget("relaxed", 0.5);
        setBoneTarget("spine", 0.08, 0, -0.05);
        setBoneTarget("rightShoulder", -0.08, 0, 0.02);
        setBoneTarget("rightUpperArm", -0.55, -0.05, 0.08);
        setBoneTarget("rightLowerArm", -0.68, 0, 0.18);
        setBoneTarget("head", 0.18, 0.18, -0.08);
      } else if (currentAction === "speak") {
        const mouthOpen = (Math.sin(actionTime * 15) + 1) / 2;
        setExpressionTarget("aa", mouthOpen * 0.7);
        setExpressionTarget("happy", 0.12);
        // Keep arms naturally hanging down — same as relaxed idle
        setArisaArmDownPoseTargets(actionTime);
        // Subtle torso breathing
        const breath = Math.sin(actionTime * 1.35) * 0.015;
        const sway = Math.sin(actionTime * 0.75 + 0.4) * 0.014;
        setBoneTarget("spine", 0.03 + breath * 0.6, sway * 0.1, -0.01);
        setBoneTarget("chest", 0.02 + breath * 0.5, sway * 0.06, 0.01);
        setBoneTarget("upperChest", 0.015 + breath * 0.3, 0, sway * 0.03);
        // Natural head nod while speaking
        setBoneTarget(
          "neck",
          Math.sin(actionTime * 2.4) * 0.025,
          Math.sin(actionTime * 1.8) * 0.025,
          0,
        );
        setBoneTarget(
          "head",
          0.04 + Math.sin(actionTime * 1.6) * 0.018,
          Math.sin(actionTime * 0.7) * 0.012,
          0,
        );
      } else if (currentAction === "idle") {
        // Force relaxed idle pose (hands naturally down) for hero section
        setRelaxedPoseTargets(actionTime, gazeX, gazeY);
      } else {
        resetActionPose();
      }

      lerpBones(BONE_SPEED);

      // ── VRM subsystem updates ──────────────────────────────────────
      currentVrm.lookAt?.update?.(delta);
      currentVrm.humanoid?.update();
      currentVrm.expressionManager?.update();
      currentVrm.nodeConstraintManager?.update();
      currentVrm.springBoneManager?.update(delta);
    }

    renderer.render(scene, camera);
  }

  animate();

  // ── Mouse tracking ────────────────────────────────────────────────────────
  document.addEventListener(
    "mousemove",
    (e) => {
      const rect = container.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      mouseOffsetX = (e.clientX - centerX) / (window.innerWidth / 2);
      mouseOffsetY = (e.clientY - centerY) / (window.innerHeight / 2);
    },
    { signal },
  );

  // ── Click / Poke ──────────────────────────────────────────────────────────
  container.addEventListener(
    "click",
    () => {
      if (!currentVrm?.expressionManager || isPoked) return;
      isPoked = true;
      setTimeout(() => {
        isPoked = false;
        clearExpressionTargets("blink");
      }, 2500);
    },
    { signal },
  );

  // ── Resize ────────────────────────────────────────────────────────────────
  window.addEventListener(
    "resize",
    () => {
      updateRendererSize();
    },
    { signal },
  );
}
