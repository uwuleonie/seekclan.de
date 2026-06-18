'use client'

import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, useGLTF, Center } from '@react-three/drei'

type MobModelViewerProps = {
  modelFileName: string // ohne Pfad/Endung, z.B. 'cow' oder 'warm_cow'
}

function Model({ modelFileName }: MobModelViewerProps) {
  const { scene } = useGLTF(`/mob-models/${modelFileName}.glb`)
  return (
    <Center>
      <primitive object={scene} />
    </Center>
  )
}

function LoadingFallback() {
  return (
    <mesh>
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <meshStandardMaterial color="#888888" wireframe />
    </mesh>
  )
}

export default function MobModelViewer({ modelFileName }: MobModelViewerProps) {
  return (
    <div className="w-full h-full">
      <Canvas camera={{ position: [2.5, 2, 2.5], fov: 45 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 5, 2]} intensity={1.2} />
        <directionalLight position={[-3, 2, -2]} intensity={0.4} />
        <Suspense fallback={<LoadingFallback />}>
          <Model modelFileName={modelFileName} />
        </Suspense>
        <OrbitControls
          enablePan={false}
          minDistance={1.5}
          maxDistance={6}
          autoRotate
          autoRotateSpeed={2}
        />
      </Canvas>
    </div>
  )
}