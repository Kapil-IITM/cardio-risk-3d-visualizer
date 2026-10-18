import { Suspense, useMemo, useState } from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import * as THREE from "three";

// probability 0 -> green, 1 -> red
export const probColor = (p) => `hsl(${Math.round(120 * (1 - p))}, 78%, 48%)`;

const FILES = ["/models/heart.obj", "/models/lad.obj", "/models/lcx.obj",
               "/models/rca.obj", "/models/lm.obj"];
const ROT = [-Math.PI / 2, 0, 0];   // if the heart looks upside-down or sideways, change this

function Vessel({ id, src, color, selected, onSelect }) {
  const [hover, setHover] = useState(false);
  const obj = useMemo(() => {
    const o = src.clone(true);
    o.traverse((c) => {
      if (c.isMesh) {
        c.material = new THREE.MeshStandardMaterial({
          color, emissive: color, emissiveIntensity: selected || hover ? 0.95 : 0.35,
          roughness: 0.45,
        });
      }
    });
    return o;
  }, [src, color, selected, hover]);

  return (
    <primitive
      object={obj}
      onClick={(e) => { e.stopPropagation(); onSelect(id); }}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = "auto"; }}
    />
  );
}

function Scene({ probs, selected, onSelect }) {
  const [heart, lad, lcx, rca, lm] = useLoader(OBJLoader, FILES);
  const vessels = { LAD: lad, LCX: lcx, RCA: rca };

  // All parts share one coordinate frame: centre and scale everything by the heart's box
  const { scale, offset, labels } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(heart);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = 2.8 / Math.max(size.x, size.y, size.z);
    const offset = center.clone().negate();
    const rot = new THREE.Euler(...ROT);
    const labels = {};
    for (const id of Object.keys(vessels)) {
      const c = new THREE.Box3().setFromObject(vessels[id]).getCenter(new THREE.Vector3());
      labels[id] = c.add(offset).multiplyScalar(scale).applyEuler(rot).multiplyScalar(1.3);
    }
    return { scale, offset, labels };
  }, [heart, lad, lcx, rca]);

  const heartObj = useMemo(() => {
    const o = heart.clone(true);
    o.traverse((c) => {
      if (c.isMesh) {
        c.material = new THREE.MeshStandardMaterial({
          color: "#8fa3c4", transparent: true, opacity: 0.3, roughness: 0.8,
          depthWrite: false, side: THREE.DoubleSide,
        });
      }
    });
    return o;
  }, [heart]);

  const lmObj = useMemo(() => {
    const o = lm.clone(true);
    o.traverse((c) => {
      if (c.isMesh) c.material = new THREE.MeshStandardMaterial({ color: "#94a3b8" });
    });
    return o;
  }, [lm]);

  return (
    <>
      <group rotation={ROT}>
        <group scale={scale}>
          <group position={offset}>
            <primitive object={heartObj} />
            <primitive object={lmObj} />
            {Object.keys(vessels).map((id) => (
              <Vessel key={id} id={id} src={vessels[id]} color={probColor(probs[id])}
                      selected={selected === id} onSelect={onSelect} />
            ))}
          </group>
        </group>
      </group>

      {Object.keys(vessels).map((id) => (
        <Html key={id} position={labels[id]} center style={{ pointerEvents: "none" }}>
          <div className={`vlabel ${selected === id ? "vlabel-sel" : ""}`}>
            <b>{id}</b> {(probs[id] * 100).toFixed(0)}%
          </div>
        </Html>
      ))}
    </>
  );
}

export default function Heart3D({ probs, selected, onSelect }) {
  return (
    <div className="heart-wrap">
      <Canvas camera={{ position: [0, 0.2, 5.8], fov: 45 }} dpr={[1, 1.5]}
              onPointerMissed={() => onSelect(null)}>
        <ambientLight intensity={0.85} />
        <directionalLight position={[3, 4, 5]} intensity={1.1} />
        <directionalLight position={[-4, -2, -3]} intensity={0.4} />
        <Suspense fallback={<Html center><span className="muted">Loading 3D model...</span></Html>}>
          <Scene probs={probs} selected={selected} onSelect={onSelect} />
        </Suspense>
        <OrbitControls enablePan={false} minDistance={2.5} maxDistance={9} />
      </Canvas>

      <div className="heart-hint">Drag to rotate · Scroll to zoom · Click a vessel</div>
      <div className="heart-legend">
        <span>Low risk</span><div className="legend-bar" /><span>High risk</span>
      </div>
      <div className="heart-credit">3D model: BodyParts3D, © DBCLS, CC BY-SA 2.1 Japan</div>
    </div>
  );
}