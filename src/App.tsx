/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Users, MapPin, Play, ShoppingCart, ChevronRight, X, Info, Star, Zap, Shield, Target, RotateCcw, LogIn, LogOut, User as UserIcon } from 'lucide-react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Stars, Environment, Float, Text, ContactShadows, useTexture, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { NBA_ROSTER } from './data/roster';
import { Player as PlayerType, CareerPlayer, CardTier, TutorialStep } from './types';
import { auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged } from './firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

// --- 3D Game Constants ---
const GRAVITY = -9.81;
const INITIAL_BALL_POS: [number, number, number] = [0, 1.2, 5];
const DRAG = 0.15;
const RESTITUTION = 0.75;
const FRICTION = 0.8;
const SPIN_BOUNCE_FACTOR = 0.15;
const BALL_RADIUS = 0.24;
const RIM_RADIUS = 0.23;
const RIM_THICKNESS = 0.02;
const HOOP_POS = new THREE.Vector3(0, 3.05, -4.6);
const BACKBOARD_POS = new THREE.Vector3(0, 3.5, -5.1);
const BACKBOARD_SIZE = new THREE.Vector3(1.8, 1.2, 0.05);

// --- 3D Components ---

function ShotMeter({ power, isShot, isGreen, coverage }: { power: number, isShot: boolean, isGreen: boolean, coverage: number }) {
  const [feedback, setFeedback] = useState<string | null>(null);
  
  useEffect(() => {
    if (isShot) {
      if (isGreen) setFeedback('Excellent');
      else if (power > 0.85) setFeedback('Late');
      else if (power < 0.75) setFeedback('Early');
      else setFeedback('Good');
      
      const timer = setTimeout(() => setFeedback(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [isShot, isGreen, power]);

  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50 flex flex-col items-center">
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.5, opacity: 0, y: -20 }}
            className={`text-2xl font-black italic uppercase tracking-tighter mb-4 ${feedback === 'Excellent' ? 'text-green-400 drop-shadow-[0_0_10px_rgba(74,222,128,0.5)]' : 'text-white'}`}
          >
            {feedback}
          </motion.div>
        )}
      </AnimatePresence>
      
      <div className="relative w-48 h-2 bg-white/10 rounded-full overflow-hidden border border-white/20">
        {/* Target Zone */}
        <div className="absolute left-[75%] w-[10%] h-full bg-yellow-400/50" />
        {/* Perfect Zone */}
        <div className="absolute left-[80%] w-[2%] h-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]" />
        
        {/* Progress */}
        <motion.div 
          animate={{ width: `${power * 100}%` }}
          className={`h-full ${power > 0.78 && power < 0.82 ? 'bg-green-500' : 'bg-[#ce1141]'}`}
        />
      </div>
      
      <div className="flex justify-between w-full mt-2 px-1">
        <span className="text-[8px] font-black uppercase tracking-widest text-white/40">Shot Timing</span>
        <span className="text-[8px] font-black uppercase tracking-widest text-[#ce1141]">{coverage.toFixed(0)}% Covered</span>
      </div>
    </div>
  );
}

function Basketball({ isShot, velocity, onReset, onScore, isGreen, initialPos }: { 
  isShot: boolean, 
  velocity: THREE.Vector3, 
  onReset: () => void,
  onScore: () => void,
  isGreen: boolean,
  initialPos: [number, number, number]
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const pos = useRef(new THREE.Vector3(...initialPos));
  const vel = useRef(new THREE.Vector3(0, 0, 0));
  const angVel = useRef(new THREE.Vector3(0, 0, 0));
  const [scored, setScored] = useState(false);

  useEffect(() => {
    if (isShot) {
      vel.current.copy(velocity);
      // Add backspin on shot
      angVel.current.set(-15, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 2);
      setScored(false);
    } else {
      pos.current.set(...initialPos);
      vel.current.set(0, 0, 0);
      angVel.current.set(0, 0, 0);
    }
  }, [isShot, velocity, initialPos]);

  useFrame((state, delta) => {
    if (!isShot || !meshRef.current) return;

    // 1. Gravity
    vel.current.y += GRAVITY * delta;

    // 2. Air Resistance (Drag)
    const dragForce = vel.current.clone().multiplyScalar(-DRAG * vel.current.length() * delta);
    vel.current.add(dragForce);

    // 3. Update Position
    pos.current.add(vel.current.clone().multiplyScalar(delta));
    
    // 4. Update Rotation (Visual and Physics)
    meshRef.current.position.copy(pos.current);
    meshRef.current.rotation.x += angVel.current.x * delta;
    meshRef.current.rotation.y += angVel.current.y * delta;
    meshRef.current.rotation.z += angVel.current.z * delta;

    // 5. Collision with ground
    if (pos.current.y < BALL_RADIUS) {
      pos.current.y = BALL_RADIUS;
      
      // Bounce with spin influence
      vel.current.y *= -RESTITUTION;
      
      // Spin affects horizontal velocity on bounce
      vel.current.x += angVel.current.z * SPIN_BOUNCE_FACTOR;
      vel.current.z -= angVel.current.x * SPIN_BOUNCE_FACTOR;
      
      // Ground friction
      vel.current.x *= FRICTION;
      vel.current.z *= FRICTION;
      
      // Ground affects spin
      angVel.current.x *= 0.8;
      angVel.current.z *= 0.8;
    }

    // 6. Collision with Backboard
    const bbMin = BACKBOARD_POS.clone().sub(BACKBOARD_SIZE.clone().multiplyScalar(0.5));
    const bbMax = BACKBOARD_POS.clone().add(BACKBOARD_SIZE.clone().multiplyScalar(0.5));
    
    if (pos.current.x > bbMin.x - BALL_RADIUS && pos.current.x < bbMax.x + BALL_RADIUS &&
        pos.current.y > bbMin.y - BALL_RADIUS && pos.current.y < bbMax.y + BALL_RADIUS &&
        pos.current.z > bbMin.z - BALL_RADIUS && pos.current.z < bbMax.z + BALL_RADIUS) {
      
      if (Math.abs(pos.current.z - BACKBOARD_POS.z) < BALL_RADIUS + 0.05) {
        vel.current.z *= -RESTITUTION;
        pos.current.z = BACKBOARD_POS.z + BALL_RADIUS + 0.06;
        angVel.current.add(new THREE.Vector3(Math.random() * 10, Math.random() * 10, 0));
      }
    }

    // 7. Collision with Rim
    const distToHoopCenter = new THREE.Vector2(pos.current.x - HOOP_POS.x, pos.current.z - HOOP_POS.z).length();
    const heightDiff = Math.abs(pos.current.y - HOOP_POS.y);

    if (heightDiff < BALL_RADIUS && Math.abs(distToHoopCenter - RIM_RADIUS) < BALL_RADIUS) {
      const normal = pos.current.clone().sub(HOOP_POS).normalize();
      vel.current.reflect(normal).multiplyScalar(RESTITUTION);
      pos.current.add(normal.multiplyScalar(0.05));
      angVel.current.multiplyScalar(0.5);
    }

    // 8. Scoring logic
    const distToHoop = pos.current.distanceTo(HOOP_POS);
    if (!scored && vel.current.y < 0 && distToHoop < 0.4 && pos.current.y > HOOP_POS.y) {
      setScored(true);
      onScore();
    }

    // 9. Reset if too far or too low
    if (pos.current.y < -5 || pos.current.z < -15 || pos.current.length() > 40) {
      onReset();
    }
  });

  return (
    <group>
      <mesh ref={meshRef} position={INITIAL_BALL_POS} castShadow>
        <sphereGeometry args={[BALL_RADIUS, 32, 32]} />
        <meshStandardMaterial 
          color="#f58220" 
          roughness={0.6} 
          metalness={0.1} 
          emissive="#f58220" 
          emissiveIntensity={0.1} 
        />
        {/* Ball Lines (Stylized) */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[BALL_RADIUS + 0.001, 0.005, 8, 64]} />
          <meshBasicMaterial color="black" />
        </mesh>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[BALL_RADIUS + 0.001, 0.005, 8, 64]} />
          <meshBasicMaterial color="black" />
        </mesh>
      </mesh>
      
      {/* Ball Trail */}
      {isShot && meshRef.current && (
        <group>
          <mesh position={meshRef.current.position.clone().sub(vel.current.clone().normalize().multiplyScalar(0.3))}>
            <sphereGeometry args={[0.22, 16, 16]} />
            <meshBasicMaterial color={isGreen ? "#4ade80" : "#f58220"} transparent opacity={0.3} />
          </mesh>
          <mesh position={meshRef.current.position.clone().sub(vel.current.clone().normalize().multiplyScalar(0.6))}>
            <sphereGeometry args={[0.18, 16, 16]} />
            <meshBasicMaterial color={isGreen ? "#4ade80" : "#f58220"} transparent opacity={0.1} />
          </mesh>
        </group>
      )}
    </group>
  );
}

function BroadcastScoreboard({ score, gameClock, shotClock, teamName }: { score: number, gameClock: number, shotClock: number, teamName: string }) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="absolute bottom-8 right-8 z-50 flex flex-col items-end">
      {/* Main Bar */}
      <div className="flex bg-black/90 border-b-4 border-[#ce1141] shadow-2xl overflow-hidden">
        {/* Team 1 */}
        <div className="flex items-center gap-4 px-6 py-3 bg-[#111] border-r border-white/10">
          <div className="w-8 h-8 bg-[#ce1141] flex items-center justify-center font-black italic text-xl">NBA</div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-widest text-white/40 leading-none mb-1">Team</span>
            <span className="text-xl font-black italic uppercase leading-none">{teamName.split(' ').pop()}</span>
          </div>
          <div className="text-4xl font-black italic ml-4">{score}</div>
        </div>
        
        {/* Team 2 (CPU) */}
        <div className="flex items-center gap-4 px-6 py-3 bg-[#0a0a0a]">
          <div className="text-4xl font-black italic mr-4 text-white/20">0</div>
          <div className="flex flex-col text-right">
            <span className="text-[10px] font-black uppercase tracking-widest text-white/20 leading-none mb-1">CPU</span>
            <span className="text-xl font-black italic uppercase leading-none text-white/20">OPP</span>
          </div>
          <div className="w-8 h-8 bg-white/5 flex items-center justify-center font-black italic text-xl text-white/10">CPU</div>
        </div>
      </div>
      
      {/* Clock Bar */}
      <div className="flex bg-[#ce1141] text-white px-4 py-1 gap-6 items-center shadow-lg">
        <div className="flex items-center gap-2">
          <span className="text-[8px] font-black uppercase tracking-widest opacity-60">1ST</span>
          <span className="text-sm font-black italic tabular-nums">{formatTime(gameClock)}</span>
        </div>
        <div className={`text-sm font-black italic tabular-nums px-2 ${shotClock <= 5 ? 'bg-white text-[#ce1141] animate-pulse' : ''}`}>
          {shotClock.toFixed(1)}
        </div>
      </div>
    </div>
  );
}

function PlayerIndicator({ position, stamina, takeoverMeter, isTakeoverActive }: { position: [number, number, number], stamina: number, takeoverMeter: number, isTakeoverActive: boolean }) {
  return (
    <group position={position}>
      {/* Circle on ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[0.5, 0.6, 32]} />
        <meshBasicMaterial color={isTakeoverActive ? "#ce1141" : "white"} transparent opacity={0.6} />
      </mesh>
      
      {/* Stamina Bar */}
      <mesh position={[0, 0.02, 0.7]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1, 0.05]} />
        <meshBasicMaterial color="black" transparent opacity={0.4} />
      </mesh>
      <mesh position={[-(1 - stamina/100)/2, 0.021, 0.7]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[stamina / 100, 0.05]} />
        <meshBasicMaterial color={stamina < 30 ? "#ce1141" : "#4ade80"} />
      </mesh>
      
      {/* Takeover Icon */}
      {takeoverMeter > 50 && (
        <group position={[0, 2.5, 0]}>
          <Text
            fontSize={0.2}
            color={isTakeoverActive ? "#ce1141" : "white"}
            font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGkyMZhrib2Bg-4.ttf"
            anchorX="center"
            anchorY="middle"
          >
            {isTakeoverActive ? "TAKEOVER" : "🔥"}
          </Text>
        </group>
      )}
    </group>
  );
}
function Defender({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Body */}
      <mesh position={[0, 1, 0]} castShadow>
        <capsuleGeometry args={[0.4, 1.2, 4, 8]} />
        <meshStandardMaterial color="#222" roughness={0.3} metalness={0.2} />
      </mesh>
      {/* Jersey (Opponent) */}
      <mesh position={[0, 1.2, 0.41]}>
        <planeGeometry args={[0.4, 0.5]} />
        <meshStandardMaterial color="#444" />
      </mesh>
      <mesh position={[0, 1.2, -0.41]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[0.4, 0.5]} />
        <meshStandardMaterial color="#444" />
      </mesh>
      {/* Arms up */}
      <mesh position={[0.4, 1.8, 0]} rotation={[0, 0, Math.PI / 4]} castShadow>
        <capsuleGeometry args={[0.1, 0.8, 4, 8]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh position={[-0.4, 1.8, 0]} rotation={[0, 0, -Math.PI / 4]} castShadow>
        <capsuleGeometry args={[0.1, 0.8, 4, 8]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      {/* Head */}
      <mesh position={[0, 2.2, 0]} castShadow>
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      {/* Indicator */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[0.5, 0.6, 32]} />
        <meshBasicMaterial color="#ce1141" transparent opacity={0.4} />
      </mesh>
    </group>
  );
}

function GameLog({ logs }: { logs: string[] }) {
  return (
    <div className="absolute top-32 right-8 w-64 flex flex-col gap-2 pointer-events-none z-50">
      <AnimatePresence mode="popLayout">
        {logs.map((log, i) => (
          <motion.div
            key={`${log}-${i}`}
            initial={{ opacity: 0, x: 20, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -20, scale: 0.9 }}
            className="bg-black/60 backdrop-blur-md border-r-4 border-[#ce1141] p-3 text-[10px] font-black uppercase italic tracking-tighter text-white/90 shadow-xl"
          >
            {log}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function CityView({ onEnterGame, onBack }: { onEnterGame: () => void, onBack: () => void }) {
  const locations = [
    { id: 'rec', name: 'The REC', icon: <Users size={24} />, pos: 'top-1/4 left-1/4', desc: '5v5 competitive play' },
    { id: 'theater', name: 'The Theater', icon: <Play size={24} />, pos: 'top-1/3 right-1/4', desc: 'Fast-paced 3v3 matchmaking' },
    { id: 'gym', name: 'Gatorade Gym', icon: <Zap size={24} />, pos: 'bottom-1/4 left-1/3', desc: 'Train your physical attributes' },
    { id: 'court', name: 'MyCOURT', icon: <MapPin size={24} />, pos: 'bottom-1/3 right-1/3', desc: 'Practice your jump shot' },
  ];

  return (
    <div className="relative h-screen w-full bg-[#050505] overflow-hidden">
      {/* Map Background */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#ce1141]/20 via-transparent to-transparent" />
        <div className="grid grid-cols-10 grid-rows-10 h-full w-full border border-white/5">
          {Array.from({ length: 100 }).map((_, i) => (
            <div key={i} className="border border-white/5" />
          ))}
        </div>
      </div>

      <div className="relative z-10 p-12">
        <h1 className="text-6xl font-black italic uppercase tracking-tighter mb-2">The <span className="text-[#ce1141]">City</span></h1>
        <p className="text-white/40 font-bold tracking-widest uppercase text-xs">Season 1: Rise to Greatness</p>
      </div>

      {/* Interactive Locations */}
      {locations.map((loc) => (
        <motion.button
          key={loc.id}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onEnterGame}
          className={`absolute ${loc.pos} group flex flex-col items-center`}
        >
          <div className="w-16 h-16 bg-black border-2 border-white/10 rounded-full flex items-center justify-center group-hover:border-[#ce1141] group-hover:shadow-[0_0_20px_rgba(206,17,65,0.4)] transition-all">
            <div className="text-white/60 group-hover:text-[#ce1141]">{loc.icon}</div>
          </div>
          <div className="mt-4 text-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="text-sm font-black uppercase italic">{loc.name}</div>
            <div className="text-[8px] font-bold text-white/40 uppercase tracking-widest">{loc.desc}</div>
          </div>
        </motion.button>
      ))}

      {/* Social Feed Overlay */}
      <div className="absolute bottom-12 left-12 w-80 bg-black/60 backdrop-blur-md border border-white/5 p-6">
        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#ce1141] mb-4">City Feed</h3>
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-white/10" />
            <div>
              <div className="text-[10px] font-black uppercase">Shake4ndBake</div>
              <p className="text-[10px] text-white/60">Just pulled a Dark Matter LeBron! 😱</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-white/10" />
            <div>
              <div className="text-[10px] font-black uppercase">2K_Insider</div>
              <p className="text-[10px] text-white/60">Double XP event starting in 2 hours at The REC.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Back Button */}
      <button 
        onClick={onBack}
        className="absolute top-32 left-12 bg-black/60 backdrop-blur-md border border-white/10 px-6 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all"
      >
        Back to MyCAREER
      </button>
    </div>
  );
}

function Hoop() {
  return (
    <group position={[0, 0, -5]}>
      {/* Post */}
      <mesh position={[0, 1.5, -0.5]} castShadow>
        <cylinderGeometry args={[0.1, 0.1, 3]} />
        <meshStandardMaterial color="#222" roughness={0.5} metalness={0.8} />
      </mesh>
      
      {/* Backboard */}
      <mesh position={[0, 3.5, -0.1]} receiveShadow castShadow>
        <boxGeometry args={[1.8, 1.2, 0.05]} />
        <meshStandardMaterial 
          color="white" 
          roughness={0.05} 
          metalness={0.1} 
          transparent 
          opacity={0.8} 
        />
      </mesh>
      {/* Backboard Frame */}
      <mesh position={[0, 3.5, -0.12]}>
        <boxGeometry args={[1.85, 1.25, 0.02]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {/* Inner Square */}
      <mesh position={[0, 3.3, 0]}>
        <boxGeometry args={[0.6, 0.45, 0.06]} />
        <meshStandardMaterial color="#ce1141" wireframe />
      </mesh>

      {/* Rim Support */}
      <mesh position={[0, 3.05, 0.1]} castShadow>
        <boxGeometry args={[0.1, 0.1, 0.3]} />
        <meshStandardMaterial color="#ce1141" />
      </mesh>

      {/* Rim */}
      <mesh position={[0, 3.05, 0.4]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.23, 0.02, 16, 100]} />
        <meshStandardMaterial color="#ce1141" roughness={0.3} metalness={0.5} />
      </mesh>

      {/* Net (Stylized) */}
      <mesh position={[0, 2.75, 0.4]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.23, 0.15, 0.6, 16, 4, true]} />
        <meshStandardMaterial color="white" wireframe opacity={0.6} transparent />
      </mesh>
    </group>
  );
}

function Court() {
  return (
    <group>
      {/* Floor - Polished Wood Look */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[24, 34]} />
        <meshStandardMaterial 
          color="#f5d5a0" 
          roughness={0.05} 
          metalness={0.1} 
        />
      </mesh>
      
      {/* Wood Grain Pattern (Procedural-ish) */}
      <gridHelper args={[24, 48, 0x000000, 0x000000]} position={[0, 0.005, 0]} rotation={[0, 0, 0]} />
      
      {/* Court Lines */}
      <group position={[0, 0.01, 0]}>
        {/* Perimeter */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[14.9, 15, 4, 1, Math.PI/4]} />
          <meshBasicMaterial color="white" />
        </mesh>
        {/* Half Court */}
        <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[24, 0.1]} />
          <meshBasicMaterial color="white" />
        </mesh>
        {/* Center Circle */}
        <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.8, 1.9, 64]} />
          <meshBasicMaterial color="white" />
        </mesh>
        {/* Three Point Line */}
        <mesh position={[0, 0, -5]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[6.6, 6.7, 64, 1, 0, Math.PI]} />
          <meshBasicMaterial color="white" />
        </mesh>
      </group>
      
      {/* Key area */}
      <mesh position={[0, 0.02, -5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4.9, 5.8]} />
        <meshStandardMaterial color="#ce1141" transparent opacity={0.15} />
      </mesh>
    </group>
  );
}

function Stadium() {
  return (
    <group>
      {/* Arena Walls */}
      <mesh position={[0, 10, -17]}>
        <planeGeometry args={[100, 40]} />
        <meshStandardMaterial color="#050505" />
      </mesh>
      <mesh position={[0, 10, 17]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[100, 40]} />
        <meshStandardMaterial color="#050505" />
      </mesh>
      <mesh position={[-20, 10, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[100, 40]} />
        <meshStandardMaterial color="#050505" />
      </mesh>
      <mesh position={[20, 10, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[100, 40]} />
        <meshStandardMaterial color="#050505" />
      </mesh>

      {/* Ceiling Lights */}
      <group position={[0, 18, 0]}>
        {Array.from({ length: 10 }).map((_, i) => (
          <mesh key={i} position={[(i - 5) * 4, 0, -10]}>
            <boxGeometry args={[2, 0.1, 0.5]} />
            <meshStandardMaterial emissive="white" emissiveIntensity={5} />
          </mesh>
        ))}
        {Array.from({ length: 10 }).map((_, i) => (
          <mesh key={i} position={[(i - 5) * 4, 0, 10]}>
            <boxGeometry args={[2, 0.1, 0.5]} />
            <meshStandardMaterial emissive="white" emissiveIntensity={5} />
          </mesh>
        ))}
      </group>

      {/* Crowd (Abstract) */}
      <group position={[0, 2, -16]}>
        {Array.from({ length: 50 }).map((_, i) => (
          <mesh key={i} position={[(Math.random() - 0.5) * 40, Math.random() * 5, 0]}>
            <sphereGeometry args={[0.1, 8, 8]} />
            <meshBasicMaterial color={Math.random() > 0.5 ? "#333" : "#111"} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function PlayerModel({ player, position }: { player: PlayerType, position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Simple Stylized Player */}
      <mesh position={[0, 0.9, 0]} castShadow>
        <capsuleGeometry args={[0.3, 1, 4, 8]} />
        <meshStandardMaterial color="#111" roughness={0.4} metalness={0.1} />
      </mesh>
      <mesh position={[0, 1.7, 0]} castShadow>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      
      {/* Jersey details */}
      <mesh position={[0, 1.2, 0.31]}>
        <planeGeometry args={[0.35, 0.45]} />
        <meshStandardMaterial color="#ce1141" emissive="#ce1141" emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[0, 1.2, -0.31]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[0.35, 0.45]} />
        <meshStandardMaterial color="#ce1141" />
      </mesh>
      
      {/* Player Name Tag */}
      <Text
        position={[0, 2.3, 0]}
        fontSize={0.2}
        color="white"
        font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff"
        anchorX="center"
        anchorY="middle"
      >
        {player.name.toUpperCase()}
      </Text>
      <Text
        position={[0, 2.1, 0]}
        fontSize={0.12}
        color="#ce1141"
        anchorX="center"
        anchorY="middle"
      >
        OVR {player.rating}
      </Text>
    </group>
  );
}

function MyTeamCard({ player, isSelected, onClick, showStats = true }: { 
  player: PlayerType, 
  isSelected?: boolean, 
  onClick?: () => void,
  showStats?: boolean
}) {
  const tierColors: Record<string, string> = {
    'Emerald': 'from-emerald-600 to-emerald-900',
    'Sapphire': 'from-blue-600 to-blue-900',
    'Ruby': 'from-red-600 to-red-900',
    'Amethyst': 'from-purple-600 to-purple-900',
    'Diamond': 'from-cyan-400 to-cyan-700',
    'Pink Diamond': 'from-pink-500 to-pink-800',
    'Galaxy Opal': 'from-white via-yellow-200 to-white',
    'Dark Matter': 'from-black via-purple-900 to-black'
  };

  const isHighTier = ['Galaxy Opal', 'Dark Matter'].includes(player.tier);

  return (
    <motion.div
      whileHover={{ scale: 1.05, y: -5 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`relative w-48 h-72 rounded-lg overflow-hidden cursor-pointer border-2 ${isSelected ? 'border-white shadow-[0_0_20px_rgba(255,255,255,0.5)]' : 'border-white/10'} transition-all`}
    >
      {/* Card Background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${tierColors[player.tier]} opacity-90`} />
      
      {/* Card Shine Effect for High Tiers */}
      {isHighTier && (
        <motion.div 
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12 z-10"
        />
      )}

      {/* Player Image */}
      <img 
        src={player.image} 
        alt={player.name} 
        className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-80"
        referrerPolicy="no-referrer"
      />

      {/* Card Info */}
      <div className="absolute inset-x-0 bottom-0 p-3 bg-black/60 backdrop-blur-sm z-20">
        <div className="flex justify-between items-end mb-1">
          <div className="text-[10px] font-black text-white/50 uppercase leading-none">{player.team.split(' ').pop()}</div>
          <div className={`text-xl font-black italic ${isHighTier ? 'text-yellow-400' : 'text-white'}`}>{player.rating}</div>
        </div>
        <div className="text-sm font-black uppercase tracking-tighter leading-none mb-2 truncate">{player.name}</div>
        
        {showStats && (
          <div className="grid grid-cols-4 gap-x-1 gap-y-2">
            {Object.entries(player.stats).map(([key, val]) => {
              const label = {
                shooting: 'SHO',
                speed: 'SPD',
                defense: 'DEF',
                playmaking: 'PLY',
                athleticism: 'ATH',
                iq: 'IQ',
                consistency: 'CON'
              }[key] || key.substring(0, 3).toUpperCase();
              
              return (
                <div key={key} className="text-center">
                  <div className="text-[6px] font-black text-white/40 uppercase leading-none mb-0.5">{label}</div>
                  <div className="text-[10px] font-black leading-none">{val}</div>
                </div>
              );
            })}
          </div>
        )}

        {player.badges && player.badges.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {player.badges.slice(0, 3).map((badge, i) => (
              <div key={i} className="w-4 h-4 rounded-sm bg-[#ce1141]/20 flex items-center justify-center" title={badge.name}>
                <Star size={8} className="text-[#ce1141]" fill={badge.level === 'Hall of Fame' ? '#ce1141' : 'none'} />
              </div>
            ))}
            {player.badges.length > 3 && (
              <div className="text-[6px] font-black text-white/40 self-center">+{player.badges.length - 3}</div>
            )}
          </div>
        )}
      </div>

      {/* Tier Label */}
      <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/80 rounded-full border border-white/20 z-20">
        <div className="text-[8px] font-black uppercase tracking-widest text-white/80">{player.tier}</div>
      </div>
    </motion.div>
  );
}

function TutorialOverlay({ steps, onComplete }: { steps: TutorialStep[], onComplete: () => void }) {
  const [currentStep, setCurrentStep] = useState(0);
  const step = steps[currentStep];

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-8"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          className="bg-[#151515] border border-[#ce1141]/50 p-8 max-w-md w-full relative overflow-hidden"
        >
          {/* Decorative background element */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#ce1141]/10 rounded-full blur-3xl" />
          
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#ce1141] mb-2">Tutorial Step {currentStep + 1}/{steps.length}</h3>
                <h2 className="text-3xl font-black italic uppercase tracking-tighter">{step.title}</h2>
              </div>
              <button onClick={onComplete} className="text-white/20 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <p className="text-white/60 text-sm leading-relaxed mb-8">
              {step.description}
            </p>
            
            <div className="flex justify-between items-center">
              <div className="flex gap-1">
                {steps.map((_, i) => (
                  <div 
                    key={i} 
                    className={`h-1 rounded-full transition-all ${i === currentStep ? 'w-4 bg-[#ce1141]' : 'w-1 bg-white/10'}`} 
                  />
                ))}
              </div>
              <button 
                onClick={nextStep}
                className="bg-white text-black px-6 py-2 font-black text-[10px] uppercase tracking-widest hover:bg-[#ce1141] hover:text-white transition-all flex items-center gap-2"
              >
                {currentStep === steps.length - 1 ? 'Finish' : 'Next'} <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// --- Main App Component ---

export default function App() {
  const [view, setView] = useState<'landing' | 'game' | 'roster' | 'myCareer' | 'myTeam' | 'store' | 'city'>('landing');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [vc, setVc] = useState(1500); // Starting VC
  const [isShot, setIsShot] = useState(false);
  const [isCharging, setIsCharging] = useState(false);
  const [isGreen, setIsGreen] = useState(false);
  const [shotCoverage, setShotCoverage] = useState(0);
  const [playerPos, setPlayerPos] = useState<[number, number, number]>([0, 0, 5.5]);
  const [shotVelocity, setShotVelocity] = useState(new THREE.Vector3(0, 0, 0));
  const [power, setPower] = useState(0);
  const [angle, setAngle] = useState(45);
  const [shotMeterSensitivity, setShotMeterSensitivity] = useState(1.0);
  const [isDribbling, setIsDribbling] = useState(false);
  const [dribbleType, setDribbleType] = useState<string | null>(null);
  
  // --- Game HUD States ---
  const [shotClock, setShotClock] = useState(24);
  const [gameClock, setGameClock] = useState(720); // 12 minutes
  const [stamina, setStamina] = useState(100);
  const [takeoverMeter, setTakeoverMeter] = useState(0);
  const [isTakeoverActive, setIsTakeoverActive] = useState(false);
  
  // --- Tutorial States ---
  const [activeTutorial, setActiveTutorial] = useState<TutorialStep[] | null>(null);
  const [completedTutorials, setCompletedTutorials] = useState<string[]>([]);

  const tutorials = {
    myCareer: [
      {
        title: "Welcome to MyCAREER",
        description: "This is where you build your legacy. Create your player, upgrade attributes, and rise to NBA stardom.",
        position: "center"
      },
      {
        title: "Attributes & Badges",
        description: "Use VC earned from games to upgrade your attributes. Unlock and equip badges to gain elite abilities on the court.",
        position: "center"
      },
      {
        title: "The City",
        description: "Explore the City to find pickup games, training facilities, and more. Your journey starts here.",
        position: "center"
      }
    ] as TutorialStep[],
    myTeam: [
      {
        title: "Welcome to MyTEAM",
        description: "Build your fantasy squad by collecting player cards. Open packs, complete challenges, and dominate the competition.",
        position: "center"
      },
      {
        title: "Lineup Management",
        description: "Assemble your best 5 starters. Mix and match players to find the perfect chemistry for your playstyle.",
        position: "center"
      },
      {
        title: "The Store",
        description: "Visit the store to spend your VC on new packs. Look out for limited-time drops and legendary players.",
        position: "center"
      }
    ] as TutorialStep[]
  };

  useEffect(() => {
    if (view === 'myCareer' && !completedTutorials.includes('myCareer')) {
      setActiveTutorial(tutorials.myCareer);
    } else if (view === 'myTeam' && !completedTutorials.includes('myTeam')) {
      setActiveTutorial(tutorials.myTeam);
    }
  }, [view, completedTutorials]);

  const completeTutorial = (tutorialKey: string) => {
    setCompletedTutorials(prev => {
      const updated = [...prev, tutorialKey];
      localStorage.setItem('completedTutorials', JSON.stringify(updated));
      return updated;
    });
    setActiveTutorial(null);
  };

  // --- Game Loop for HUD ---
  useEffect(() => {
    if (view !== 'game') return;
    addLog('Game Started');

    const timer = setInterval(() => {
      setGameClock(prev => Math.max(0, prev - 1));
      setShotClock(prev => {
        if (prev <= 5.1 && prev > 5.0) addLog('Shot Clock Warning!');
        if (prev <= 0.1) return 24;
        return prev - 0.1;
      });
      setStamina(prev => {
        const next = Math.min(100, prev + 0.5);
        if (prev < 20 && next >= 20) { /* Just for logic */ }
        return next;
      });
    }, 100);

    return () => clearInterval(timer);
  }, [view]);

  // --- Power Charging Logic ---
  useEffect(() => {
    let interval: any;
    if (isCharging && !isShot) {
      interval = setInterval(() => {
        setPower(p => {
          const next = p + 0.025;
          return next > 1 ? 0 : next;
        });
      }, 20);
    } else if (!isCharging && !isShot) {
      // Keep power for a moment or reset? 
      // Usually we reset after shot
    }
    return () => clearInterval(interval);
  }, [isCharging, isShot]);

  const movePlayer = () => {
    if (isShot) return;
    const spots: [number, number, number][] = [
      [0, 0, 5.5],    // Top of key
      [-4, 0, 4.5],   // Left wing
      [4, 0, 4.5],    // Right wing
      [-6, 0, 3],     // Left corner
      [6, 0, 3],      // Right corner
      [0, 0, 8.5],    // Deep 3
    ];
    // Cycle through spots
    const currentIndex = spots.findIndex(s => s[0] === playerPos[0] && s[2] === playerPos[2]);
    const nextIndex = (currentIndex + 1) % spots.length;
    setPlayerPos(spots[nextIndex]);
    
    // Adjust angle based on distance
    const dist = new THREE.Vector3(0, 0, -4.6).distanceTo(new THREE.Vector3(...spots[nextIndex]));
    setAngle(dist > 10 ? 35 : 45);
    
    handleReset();
    addLog(`Moved to ${dist > 10 ? 'Deep Range' : 'Shooting Spot'}`);
  };

  // --- Mobile Dribble Logic ---
  const performDribble = (move: string) => {
    if (isShot || stamina < 5) return;
    setIsDribbling(true);
    setDribbleType(move);
    addLog(`${activePlayer.name} performs a ${move}!`);
    setStamina(prev => Math.max(0, prev - 5));
    setTimeout(() => setIsDribbling(false), 500);
  };

  // --- Firebase Auth State ---
  const [user, setUser] = useState<any>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // --- Team Management State ---
  const [myTeam, setMyTeam] = useState<string[]>([]);
  const [activePlayerId, setActivePlayerId] = useState<string>(NBA_ROSTER[0].id);

  // --- MyTEAM State ---
  const [myCards, setMyCards] = useState<string[]>([]);
  const [myLineup, setMyLineup] = useState<string[]>([]);
  const [myTeamLevel, setMyTeamLevel] = useState(1);
  const [myTeamXP, setMyTeamXP] = useState(0);
  const [isOpeningPack, setIsOpeningPack] = useState(false);
  const [openedCards, setOpenedCards] = useState<PlayerType[]>([]);
  const [revealedCards, setRevealedCards] = useState<number[]>([]);

  // --- MyCAREER State ---
  const [careerPlayer, setCareerPlayer] = useState<CareerPlayer | null>(null);
  const [isCreatingPlayer, setIsCreatingPlayer] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isDeveloper, setIsDeveloper] = useState(false);
  const [loginSoundEnabled, setLoginSoundEnabled] = useState(true);
  const [show67Meme, setShow67Meme] = useState(false);
  const [gameLog, setGameLog] = useState<string[]>([]);

  const addLog = (message: string) => {
    setGameLog(prev => [message, ...prev].slice(0, 5));
  };

  const INFINITE_VC = 999999999;
  const MY_EMAIL = "ashleyseehusen022@gmail.com";

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Sync with Firestore
  useEffect(() => {
    const savedIsDev = localStorage.getItem('isDeveloper');
    if (savedIsDev) setIsDeveloper(savedIsDev === 'true');

    const savedSound = localStorage.getItem('loginSoundEnabled');
    if (savedSound) setLoginSoundEnabled(savedSound === 'true');

    const savedSensitivity = localStorage.getItem('shotMeterSensitivity');
    if (savedSensitivity) setShotMeterSensitivity(parseFloat(savedSensitivity));

    if (!user) {
      // Load from local storage if not logged in
      const savedPlayer = localStorage.getItem('myCareerPlayer');
      if (savedPlayer) setCareerPlayer(JSON.parse(savedPlayer));
      
      const savedVc = localStorage.getItem('vc');
      if (isDeveloper) {
        setVc(INFINITE_VC);
      } else if (savedVc) {
        setVc(parseInt(savedVc));
      }

      const savedHighScore = localStorage.getItem('highScore');
      if (savedHighScore) setHighScore(parseInt(savedHighScore));

      const savedCards = localStorage.getItem('myCards');
      if (savedCards) {
        setMyCards(JSON.parse(savedCards));
      } else {
        const starterCards = [NBA_ROSTER[20].id, NBA_ROSTER[21].id, NBA_ROSTER[22].id];
        setMyCards(starterCards);
        setMyLineup(starterCards);
      }

      const savedLineup = localStorage.getItem('myLineup');
      if (savedLineup) setMyLineup(JSON.parse(savedLineup));

      const savedLevel = localStorage.getItem('myTeamLevel');
      if (savedLevel) setMyTeamLevel(parseInt(savedLevel));

      const savedXP = localStorage.getItem('myTeamXP');
      if (savedXP) setMyTeamXP(parseInt(savedXP));

      const savedTutorials = localStorage.getItem('completedTutorials');
      if (savedTutorials) setCompletedTutorials(JSON.parse(savedTutorials));

      const savedMyTeam = localStorage.getItem('myTeam');
      if (savedMyTeam) setMyTeam(JSON.parse(savedMyTeam));

      const savedActivePlayer = localStorage.getItem('activePlayerId');
      if (savedActivePlayer) setActivePlayerId(savedActivePlayer);

      return;
    }

    // Load from Firestore
    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (user.email === MY_EMAIL) {
          setVc(INFINITE_VC);
        } else {
          setVc(data.vc || 0);
        }
        if (data.careerPlayer) setCareerPlayer(data.careerPlayer);
        if (data.myCards) setMyCards(data.myCards);
        if (data.myLineup) setMyLineup(data.myLineup);
        if (data.myTeamLevel) setMyTeamLevel(data.myTeamLevel);
        if (data.myTeamXP) setMyTeamXP(data.myTeamXP);
        if (data.highScore) setHighScore(data.highScore);
        if (data.myTeam) setMyTeam(data.myTeam);
        if (data.activePlayerId) setActivePlayerId(data.activePlayerId);
      } else {
        // Initialize new user doc
        const initialVc = user.email === MY_EMAIL ? INFINITE_VC : 1500;
        const starterCards = [NBA_ROSTER[20].id, NBA_ROSTER[21].id, NBA_ROSTER[22].id]; // Some low tier starters
        setDoc(userDocRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          vc: initialVc,
          myCards: starterCards,
          myLineup: starterCards,
          myTeamLevel: 1,
          myTeamXP: 0,
          createdAt: new Date().toISOString()
        });
        setVc(initialVc);
        setMyCards(starterCards);
        setMyLineup(starterCards);
        setMyTeamLevel(1);
        setMyTeamXP(0);
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Persist to Firestore/Local
  useEffect(() => {
    if (careerPlayer) {
      localStorage.setItem('myCareerPlayer', JSON.stringify(careerPlayer));
      if (user) {
        setDoc(doc(db, 'users', user.uid), { careerPlayer }, { merge: true });
      }
    }
  }, [careerPlayer, user]);

  useEffect(() => {
    localStorage.setItem('highScore', highScore.toString());
    if (user) {
      setDoc(doc(db, 'users', user.uid), { highScore }, { merge: true });
    }
  }, [highScore, user]);

  useEffect(() => {
    if (user && user.email === MY_EMAIL) {
      if (vc !== INFINITE_VC) setVc(INFINITE_VC);
    } else {
      localStorage.setItem('vc', vc.toString());
      localStorage.setItem('myCards', JSON.stringify(myCards));
      localStorage.setItem('myLineup', JSON.stringify(myLineup));
      localStorage.setItem('myTeamLevel', myTeamLevel.toString());
      localStorage.setItem('myTeamXP', myTeamXP.toString());
      localStorage.setItem('myTeam', JSON.stringify(myTeam));
      localStorage.setItem('activePlayerId', activePlayerId);
      
      if (user) {
        setDoc(doc(db, 'users', user.uid), { vc, myCards, myLineup, myTeamLevel, myTeamXP, myTeam, activePlayerId }, { merge: true });
      }
    }
  }, [vc, user, myCards, myLineup, myTeamLevel, myTeamXP, myTeam, activePlayerId]);

  useEffect(() => {
    localStorage.setItem('isDeveloper', isDeveloper.toString());
  }, [isDeveloper]);

  useEffect(() => {
    localStorage.setItem('loginSoundEnabled', loginSoundEnabled.toString());
  }, [loginSoundEnabled]);

  useEffect(() => {
    localStorage.setItem('shotMeterSensitivity', shotMeterSensitivity.toString());
  }, [shotMeterSensitivity]);

  const openPack = (price: number, type: string) => {
    if (vc < price && user?.email !== MY_EMAIL) return;
    
    if (user?.email !== MY_EMAIL) setVc(v => v - price);
    
    setIsOpeningPack(true);
    setOpenedCards([]);
    
    // Simulate pack opening
    const newCards: PlayerType[] = [];
    for (let i = 0; i < 3; i++) {
      const rand = Math.random();
      let pool: PlayerType[] = [];
      
      if (type === 'Galaxy Pack') {
        if (rand > 0.80) pool = NBA_ROSTER.filter(p => p.tier === 'Dark Matter');
        else if (rand > 0.40) pool = NBA_ROSTER.filter(p => p.tier === 'Galaxy Opal');
        else pool = NBA_ROSTER.filter(p => p.tier === 'Pink Diamond');
      } else if (type === 'Deluxe Pack') {
        if (rand > 0.95) pool = NBA_ROSTER.filter(p => p.tier === 'Dark Matter');
        else if (rand > 0.85) pool = NBA_ROSTER.filter(p => p.tier === 'Galaxy Opal');
        else if (rand > 0.60) pool = NBA_ROSTER.filter(p => p.tier === 'Pink Diamond');
        else pool = NBA_ROSTER.filter(p => p.tier === 'Diamond');
      } else {
        if (rand > 0.98) pool = NBA_ROSTER.filter(p => p.tier === 'Dark Matter');
        else if (rand > 0.95) pool = NBA_ROSTER.filter(p => p.tier === 'Galaxy Opal');
        else if (rand > 0.90) pool = NBA_ROSTER.filter(p => p.tier === 'Pink Diamond');
        else if (rand > 0.80) pool = NBA_ROSTER.filter(p => p.tier === 'Diamond');
        else if (rand > 0.60) pool = NBA_ROSTER.filter(p => p.tier === 'Amethyst');
        else if (rand > 0.40) pool = NBA_ROSTER.filter(p => p.tier === 'Ruby');
        else if (rand > 0.20) pool = NBA_ROSTER.filter(p => p.tier === 'Sapphire');
        else pool = NBA_ROSTER.filter(p => p.tier === 'Emerald');
      }
      
      if (pool.length === 0) pool = NBA_ROSTER; // Fallback
      
      const card = pool[Math.floor(Math.random() * pool.length)];
      newCards.push(card);
    }
    
    setOpenedCards(newCards);
    setMyCards(prev => {
      const updated = [...prev];
      newCards.forEach(c => {
        if (!updated.includes(c.id)) updated.push(c.id);
      });
      return updated;
    });
  };

  const toggleLineup = (id: string) => {
    setMyLineup(prev => {
      if (prev.includes(id)) return prev.filter(pId => pId !== id);
      if (prev.length >= 5) return prev; // Max 5 starters
      return [...prev, id];
    });
  };

  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        if (loginSoundEnabled) {
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3');
          audio.play();
        }
        setShow67Meme(true);
        setTimeout(() => setShow67Meme(false), 3000);
      }
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setView('landing');
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const activePlayer = view === 'myCareer' && careerPlayer 
    ? { 
        id: 'mp', 
        name: careerPlayer.name, 
        team: 'MyCAREER', 
        position: careerPlayer.position, 
        rating: Math.floor(careerPlayer.rating),
        stats: {
          shooting: careerPlayer.attributes.threePoint,
          speed: careerPlayer.attributes.speed,
          defense: careerPlayer.attributes.perimeterDefense,
          playmaking: careerPlayer.attributes.ballHandle,
          athleticism: Math.floor((careerPlayer.attributes.vertical + careerPlayer.attributes.strength) / 2),
          iq: Math.floor((careerPlayer.attributes.awareness + careerPlayer.attributes.passingAccuracy) / 2),
          consistency: careerPlayer.attributes.shootingConsistency
        },
        description: careerPlayer.archetype,
        image: '',
        tier: 'Emerald' as CardTier
      }
    : (NBA_ROSTER.find(p => p.id === activePlayerId) || NBA_ROSTER[0]);

  const toggleTeamMember = (id: string) => {
    setMyTeam(prev => 
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  };

  const handleShoot = () => {
    if (isShot || stamina < 15) return;
    
    const powerMult = isTakeoverActive ? 1.2 : 1;
    const rad = (angle * Math.PI) / 180;
    const p = (8 + (power * 8)) * powerMult; // Power scale
    
    // Direction towards hoop
    const hoopPos = new THREE.Vector3(0, 3.05, -4.6);
    const ballStartPos = new THREE.Vector3(playerPos[0], playerPos[1] + 1.2, playerPos[2] - 0.5);
    const dir = hoopPos.clone().sub(ballStartPos).normalize();
    
    // We want to shoot "up" and "towards" the hoop
    const horizontalDir = new THREE.Vector3(dir.x, 0, dir.z).normalize();
    
    const vy = Math.sin(rad) * p;
    const horizontalP = Math.cos(rad) * p;
    
    const vx = horizontalDir.x * horizontalP;
    const vz = horizontalDir.z * horizontalP;
    
    setShotVelocity(new THREE.Vector3(vx, vy, vz));
    setIsShot(true);
    setIsGreen(power > 0.78 && power < 0.82);
    
    // Calculate coverage based on defender distance (simulated)
    const coverage = Math.random() * 30; // 0-30% coverage
    setShotCoverage(coverage);
    
    addLog(`${activePlayer.name} takes the shot! (${coverage < 10 ? 'Wide Open' : coverage < 20 ? 'Open' : 'Contested'})`);
    
    setStamina(prev => Math.max(0, prev - 15));
    setShotClock(24);
  };

  const handleReset = () => {
    setIsShot(false);
  };

  const handleScore = () => {
    addLog(`${activePlayer.name} scores! (+2)`);
    setScore(s => {
      const newScore = s + 1;
      if (newScore > highScore) setHighScore(newScore);
      
      // Earn VC on score
      setVc(v => v + 50);
      
      // Earn MyTEAM XP
      setMyTeamXP(xp => {
        const newXP = xp + 50;
        if (newXP >= 1000) {
          setMyTeamLevel(l => l + 1);
          return newXP - 1000;
        }
        return newXP;
      });

      // Update Takeover
      setTakeoverMeter(prev => {
        const next = prev + 15;
        if (next >= 100) {
          setIsTakeoverActive(true);
          addLog('TAKEOVER ACTIVATED! 🔥');
          setTimeout(() => {
            setIsTakeoverActive(false);
            setTakeoverMeter(0);
          }, 15000); // 15 seconds of takeover
          return 100;
        }
        return next;
      });
      
      return newScore;
    });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-[#ce1141] selection:text-white overflow-x-hidden">
      {/* 67 Meme Overlay */}
      <AnimatePresence>
        {show67Meme && (
          <motion.div
            initial={{ scale: 0, opacity: 0, rotate: -45 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 5, opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
          >
            <h1 className="text-[30vw] font-black italic text-[#ce1141] drop-shadow-[0_0_50px_rgba(206,17,65,0.8)] select-none">
              67
            </h1>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl"
          >
            <div className="w-full max-w-md bg-[#111] border border-white/10 p-8 relative">
              <button 
                onClick={() => setShowSettings(false)}
                className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
              
              <h2 className="text-2xl font-black italic uppercase tracking-tighter mb-8 border-b border-white/10 pb-4">Settings</h2>
              
              <div className="space-y-8">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-widest">Login Sound</h3>
                    <p className="text-[10px] text-white/40 mt-1">Play a sound when you log in.</p>
                  </div>
                  <button 
                    onClick={() => setLoginSoundEnabled(!loginSoundEnabled)}
                    className={`w-12 h-6 rounded-full transition-all relative ${loginSoundEnabled ? 'bg-[#ce1141]' : 'bg-white/10'}`}
                  >
                    <motion.div 
                      animate={{ x: loginSoundEnabled ? 24 : 4 }}
                      className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full"
                    />
                  </button>
                </div>

                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-widest">Developer Mode</h3>
                    <p className="text-[10px] text-white/40 mt-1">Enable infinite VC in guest mode.</p>
                  </div>
                  <button 
                    onClick={() => {
                      const next = !isDeveloper;
                      setIsDeveloper(next);
                      if (!user && next) {
                        setVc(INFINITE_VC);
                      } else if (!user && !next) {
                        const savedVc = localStorage.getItem('vc');
                        setVc(savedVc ? parseInt(savedVc) : 1500);
                      }
                    }}
                    className={`w-12 h-6 rounded-full transition-all relative ${isDeveloper ? 'bg-[#ce1141]' : 'bg-white/10'}`}
                  >
                    <motion.div 
                      animate={{ x: isDeveloper ? 24 : 4 }}
                      className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full"
                    />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-black uppercase tracking-widest">Shot Sensitivity</h3>
                    <span className="text-xs font-black italic text-[#ce1141]">{shotMeterSensitivity.toFixed(1)}x</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.5" 
                    max="2.0" 
                    step="0.1" 
                    value={shotMeterSensitivity} 
                    onChange={(e) => setShotMeterSensitivity(parseFloat(e.target.value))}
                    className="w-full accent-[#ce1141]"
                  />
                  <p className="text-[10px] text-white/40">Adjust how fast the shot meter fills up.</p>
                </div>

                <div className="pt-8 border-t border-white/10">
                  <div className="text-[10px] font-bold text-white/20 uppercase tracking-[0.3em] mb-4">Account Info</div>
                  <div className="flex items-center gap-4 p-4 bg-white/5 border border-white/5">
                    <div className="w-12 h-12 rounded-full bg-[#ce1141]/20 flex items-center justify-center text-[#ce1141]">
                      <UserIcon size={24} />
                    </div>
                    <div>
                      <div className="text-xs font-black uppercase">{user?.displayName || 'Guest'}</div>
                      <div className="text-[10px] text-white/40">{user?.email || 'Not logged in'}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      {view !== 'game' && (
        <nav className="fixed top-0 w-full z-50 flex justify-between items-center px-8 py-6 bg-black/80 backdrop-blur-md border-b border-[#ce1141]/30">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-black tracking-tighter italic">
            NBA 2K<span className="text-[#ce1141]">26</span>
          </span>
        </div>
        <div className="hidden md:flex gap-8 text-[11px] font-bold tracking-widest uppercase opacity-70">
          <button 
            onClick={() => setView('landing')}
            className={`hover:text-[#ce1141] transition-colors ${view === 'landing' ? 'text-[#ce1141]' : ''}`}
          >
            News
          </button>
          <button 
            onClick={() => setView('roster')}
            className={`hover:text-[#ce1141] transition-colors ${view === 'roster' ? 'text-[#ce1141]' : ''}`}
          >
            Roster
          </button>
          {(user?.email === MY_EMAIL) && (
            <button 
              onClick={() => setView('myCareer')}
              className={`hover:text-[#ce1141] transition-colors ${view === 'myCareer' || view === 'city' ? 'text-[#ce1141]' : ''}`}
            >
              MyCAREER
            </button>
          )}
          <button 
            onClick={() => setView('myTeam')}
            className={`hover:text-[#ce1141] transition-colors ${view === 'myTeam' ? 'text-[#ce1141]' : ''}`}
          >
            MyTEAM
          </button>
          <button 
            onClick={() => setView('store')}
            className={`hover:text-[#ce1141] transition-colors ${view === 'store' ? 'text-[#ce1141]' : ''}`}
          >
            Store
          </button>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowSettings(true)}
            className="p-2 text-white/40 hover:text-white transition-colors"
            title="Settings"
          >
            <Info size={18} />
          </button>
          {user ? (
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-bold text-white/50 uppercase tracking-tighter">{user.displayName}</span>
                <button onClick={handleLogout} className="text-[9px] font-black text-[#ce1141] hover:underline uppercase">Logout</button>
              </div>
              {user.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full border border-[#ce1141]/50" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
                  <UserIcon size={14} />
                </div>
              )}
            </div>
          ) : (
            <button 
              onClick={handleLogin}
              className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-sm text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition-all"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Sign in with Google
            </button>
          )}
          <div className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded-sm border border-white/10">
            <span className="text-[10px] font-black text-[#f58220]">VC</span>
            <span className="text-xs font-bold tabular-nums">{vc.toLocaleString()}</span>
          </div>
          <button 
            onClick={() => setView(view === 'landing' ? 'game' : 'landing')}
            className="bg-[#ce1141] hover:bg-[#f0144c] px-6 py-2 rounded-sm text-xs font-bold tracking-widest uppercase transition-all transform hover:scale-105"
          >
            {view === 'landing' ? 'Play Now' : 'Exit Game'}
          </button>
        </div>
      </nav>
      )}

      <AnimatePresence mode="wait">
        {view === 'landing' ? (
          <motion.main
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pt-24"
          >
            {/* Hero Section */}
            <section className="relative h-[85vh] flex flex-col justify-center items-center text-center px-4 overflow-hidden">
              <div className="absolute inset-0 z-0">
                <img 
                  src="https://picsum.photos/seed/basketball-arena/1920/1080?blur=2" 
                  alt="Arena Background" 
                  className="w-full h-full object-cover opacity-40"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent" />
              </div>

              <motion.div 
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="relative z-10"
              >
                <h2 className="text-[12px] font-bold tracking-[0.5em] text-[#ce1141] uppercase mb-4">
                  The Next Evolution of Basketball
                </h2>
                <h1 className="text-6xl md:text-9xl font-black tracking-tighter italic leading-none mb-6">
                  PROPLAY <span className="text-[#ce1141]">EVOLUTION</span>
                </h1>
                <p className="max-w-2xl mx-auto text-lg text-white/60 font-medium mb-10">
                  Experience the most authentic gameplay in franchise history with all-new ProPlay technology, 
                  bringing real NBA movements directly to your controller.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  {(user?.email === MY_EMAIL) && (
                    <button 
                      onClick={() => setView('myCareer')}
                      className="group relative bg-white text-black px-10 py-4 font-black text-sm tracking-widest uppercase overflow-hidden"
                    >
                      <span className="relative z-10 flex items-center gap-2">
                        Start Your Journey <Play size={16} fill="black" />
                      </span>
                      <div className="absolute inset-0 bg-[#ce1141] translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                    </button>
                  )}
                  <button 
                    onClick={() => setView('roster')}
                    className="border border-white/20 hover:border-white px-10 py-4 font-black text-sm tracking-widest uppercase transition-colors"
                  >
                    View Roster
                  </button>
                </div>
              </motion.div>
            </section>

            {/* Features Grid */}
            <section className="max-w-7xl mx-auto px-8 py-24">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                  {
                    title: "MyCAREER",
                    desc: "Rise from the streets to the global stage in an all-new immersive narrative experience.",
                    icon: <Users className="text-[#ce1141]" />,
                    img: "https://picsum.photos/seed/career/800/600"
                  },
                  {
                    title: "MyTEAM",
                    desc: "Build your fantasy roster with all-new legends and compete in seasonal events.",
                    icon: <Trophy className="text-[#ce1141]" />,
                    img: "https://picsum.photos/seed/team/800/600"
                  },
                  {
                    title: "The City",
                    desc: "Explore expansive new courts, social hubs, and competitive districts in a living world.",
                    icon: <MapPin className="text-[#ce1141]" />,
                    img: "https://picsum.photos/seed/city/800/600"
                  }
                ].filter(f => (f.title !== "MyCAREER" && f.title !== "The City") || user?.email === MY_EMAIL).map((feature, i) => (
                  <motion.div 
                    key={i}
                    initial={{ y: 30, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="group bg-[#151515] border border-white/5 p-8 rounded-sm hover:border-[#ce1141]/50 transition-all cursor-pointer"
                  >
                    <div className="mb-6">{feature.icon}</div>
                    <h3 className="text-2xl font-black italic mb-4 uppercase tracking-tight">{feature.title}</h3>
                    <p className="text-white/50 text-sm leading-relaxed mb-8">{feature.desc}</p>
                    <div className="relative h-48 overflow-hidden rounded-sm">
                      <img 
                        src={feature.img} 
                        alt={feature.title} 
                        className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-110 transition-all duration-500"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-white/5 py-12 px-8 text-center text-[10px] tracking-widest uppercase text-white/30">
              <p>© 2026 Take-Two Interactive Software, Inc. All Rights Reserved.</p>
            </footer>
          </motion.main>
        ) : view === 'myTeam' ? (
          <motion.main
            key="myTeam"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pt-32 pb-24 px-8 max-w-7xl mx-auto"
          >
            <div className="flex justify-between items-end mb-12">
              <div>
                <h2 className="text-[12px] font-bold tracking-[0.5em] text-[#ce1141] uppercase mb-4">MyTEAM Management</h2>
                <h1 className="text-6xl font-black italic uppercase tracking-tighter">Fantasy <span className="text-[#ce1141]">Squad</span></h1>
              </div>
              <div className="flex items-center gap-8">
                <div className="text-right">
                  <div className="text-[10px] font-bold tracking-widest text-white/40 uppercase mb-1">Season Level</div>
                  <div className="text-4xl font-black italic text-[#ce1141]">{myTeamLevel}</div>
                  <div className="w-32 h-1 bg-white/10 mt-2 rounded-full overflow-hidden">
                    <div className="h-full bg-[#ce1141]" style={{ width: `${(myTeamXP / 1000) * 100}%` }} />
                  </div>
                </div>
                <button 
                  onClick={() => setView('store')}
                  className="group relative bg-white text-black px-8 py-4 font-black text-sm tracking-widest uppercase overflow-hidden"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    Visit Store <ShoppingCart size={16} />
                  </span>
                </button>
              </div>
            </div>

            {/* Lineup Section */}
            <div className="mb-16">
              <div className="flex items-center gap-4 mb-6">
                <Shield className="text-[#ce1141]" />
                <h3 className="text-2xl font-black italic uppercase tracking-tight">Active Lineup ({myLineup.length}/5)</h3>
              </div>
              <div className="flex flex-wrap gap-6 p-8 bg-white/5 border border-white/10 rounded-sm min-h-[320px]">
                {myLineup.length === 0 ? (
                  <div className="w-full flex flex-col items-center justify-center text-white/20">
                    <Users size={48} className="mb-4" />
                    <p className="font-bold uppercase tracking-widest">No players in lineup</p>
                  </div>
                ) : (
                  myLineup.map(id => {
                    const player = NBA_ROSTER.find(p => p.id === id);
                    if (!player) return null;
                    return (
                      <MyTeamCard 
                        key={id} 
                        player={player} 
                        isSelected 
                        onClick={() => toggleLineup(id)}
                      />
                    );
                  })
                )}
              </div>
            </div>

            {/* Collection Section */}
            <div>
              <div className="flex items-center gap-4 mb-6">
                <Trophy className="text-[#ce1141]" />
                <h3 className="text-2xl font-black italic uppercase tracking-tight">Your Collection</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {myCards.map(id => {
                  const player = NBA_ROSTER.find(p => p.id === id);
                  if (!player) return null;
                  const isInLineup = myLineup.includes(id);
                  return (
                    <MyTeamCard 
                      key={id} 
                      player={player} 
                      isSelected={isInLineup}
                      onClick={() => toggleLineup(id)}
                    />
                  );
                })}
              </div>
            </div>

            {/* Pack Opening Modal */}
            <AnimatePresence>
              {isOpeningPack && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl p-8"
                >
                  <div className="max-w-4xl w-full text-center">
                    <motion.h2 
                      initial={{ y: -20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className="text-4xl font-black italic uppercase tracking-tighter mb-12 text-[#ce1141]"
                    >
                      {openedCards.filter((_, i) => revealedCards.includes(i)).length === openedCards.length ? "Pack Opened!" : "Reveal Your Cards"}
                    </motion.h2>
                    
                    <div className="flex justify-center gap-8 mb-16">
                      {openedCards.map((card, i) => (
                        <motion.div
                          key={i}
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ delay: i * 0.1 }}
                          className="relative cursor-pointer"
                          onClick={() => {
                            if (!revealedCards.includes(i)) {
                              setRevealedCards(prev => [...prev, i]);
                            }
                          }}
                        >
                          <AnimatePresence mode="wait">
                            {!revealedCards.includes(i) ? (
                              <motion.div
                                key="back"
                                initial={{ rotateY: 0 }}
                                exit={{ rotateY: 90 }}
                                className="w-48 h-72 bg-gradient-to-br from-[#ce1141] to-[#800b28] border-4 border-white/20 rounded-xl flex items-center justify-center shadow-[0_0_30px_rgba(206,17,65,0.3)]"
                              >
                                <div className="text-white font-black italic text-4xl opacity-20">NBA</div>
                              </motion.div>
                            ) : (
                              <motion.div
                                key="front"
                                initial={{ rotateY: -90 }}
                                animate={{ rotateY: 0 }}
                                transition={{ type: "spring", damping: 12 }}
                              >
                                <MyTeamCard player={card} />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      ))}
                    </div>

                    {revealedCards.length === openedCards.length && (
                      <motion.button 
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        onClick={() => {
                          setIsOpeningPack(false);
                          setRevealedCards([]);
                        }}
                        className="bg-white text-black px-12 py-4 font-black text-sm tracking-widest uppercase hover:bg-[#ce1141] hover:text-white transition-all"
                      >
                        Collect All
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.main>
        ) : view === 'store' ? (
          <motion.main
            key="store"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pt-32 pb-24 px-8 max-w-7xl mx-auto"
          >
            <div className="mb-12">
              <h2 className="text-[12px] font-bold tracking-[0.5em] text-[#ce1141] uppercase mb-4">Marketplace</h2>
              <h1 className="text-6xl font-black italic uppercase tracking-tighter">The <span className="text-[#ce1141]">Store</span></h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { 
                  name: "Standard Pack", 
                  price: 500, 
                  desc: "Contains 3 random players. Chance for Emerald to Ruby.",
                  img: "https://picsum.photos/seed/pack1/400/600"
                },
                { 
                  name: "Deluxe Pack", 
                  price: 1500, 
                  desc: "Contains 3 players. Guaranteed 1 Sapphire or better.",
                  img: "https://picsum.photos/seed/pack2/400/600"
                },
                { 
                  name: "Galaxy Pack", 
                  price: 5000, 
                  desc: "Contains 3 players. High chance for Galaxy Opal.",
                  img: "https://picsum.photos/seed/pack3/400/600"
                }
              ].map((pack, i) => (
                <div key={i} className="bg-[#111] border border-white/5 p-8 flex flex-col group hover:border-[#ce1141]/50 transition-all">
                  <div className="relative h-64 mb-8 overflow-hidden">
                    <img src={pack.img} alt={pack.name} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
                    <div className="absolute bottom-4 left-4">
                      <h3 className="text-2xl font-black italic uppercase tracking-tight">{pack.name}</h3>
                    </div>
                  </div>
                  <p className="text-white/40 text-sm mb-8 flex-grow">{pack.desc}</p>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-[#f58220]">VC</span>
                      <span className="text-xl font-black">{pack.price.toLocaleString()}</span>
                    </div>
                    <button 
                      onClick={() => openPack(pack.price, pack.name)}
                      disabled={vc < pack.price && user?.email !== MY_EMAIL}
                      className="bg-[#ce1141] hover:bg-[#f0144c] px-6 py-3 text-xs font-black uppercase tracking-widest disabled:opacity-50"
                    >
                      Buy Pack
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.main>
        ) : view === 'city' ? (
          <CityView onEnterGame={() => setView('game')} onBack={() => setView('myCareer')} />
        ) : (view === 'myCareer' && user?.email === MY_EMAIL) ? (
          <motion.main
            key="myCareer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pt-32 pb-24 px-8 max-w-7xl mx-auto"
          >
            {!careerPlayer ? (
              <div className="max-w-3xl mx-auto text-center">
                <h2 className="text-[12px] font-bold tracking-[0.5em] text-[#ce1141] uppercase mb-4">Player Creation</h2>
                <h1 className="text-6xl font-black italic uppercase tracking-tighter mb-12">Build Your <span className="text-[#ce1141]">Legacy</span></h1>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                  <div className="bg-[#111] p-8 border border-white/5 hover:border-[#ce1141]/50 transition-all cursor-pointer"
                    onClick={() => setCareerPlayer({
                      name: "MP",
                      position: "Guard",
                      archetype: "3PT Shot Creator",
                      rating: 60,
                      attributes: { 
                        closeShot: 60, 
                        threePoint: 75, 
                        midRange: 70,
                        freeThrow: 75,
                        drivingDunk: 45,
                        drivingLayup: 60,
                        postControl: 35,
                        speed: 70, 
                        acceleration: 75,
                        ballHandle: 70, 
                        speedWithBall: 70,
                        passingAccuracy: 70,
                        perimeterDefense: 55, 
                        interiorDefense: 35,
                        steal: 50,
                        block: 30,
                        rebounding: 35,
                        vertical: 60,
                        strength: 50,
                        stamina: 85,
                        awareness: 65,
                        shootingConsistency: 75
                      },
                      badges: [{ name: "Limitless Range", level: "Bronze", description: "Increases the range from which a player can effectively shoot.", category: "Shooting" }],
                      level: 1,
                      xp: 0,
                      season: 1,
                      endorsements: [
                        { brand: "Nike", status: "Locked", bonus: "+10% VC per game" },
                        { brand: "Gatorade", status: "Locked", bonus: "+5 Speed" }
                      ],
                      socialFeed: [
                        { user: "@NBA_Insider", message: "MP is showing some flashes in the gym today. Could be a sleeper.", time: "2h ago" }
                      ],
                      inventory: []
                    })}
                  >
                    <div className="text-[#ce1141] mb-4"><Zap size={32} /></div>
                    <h3 className="text-2xl font-black italic uppercase mb-2">3PT Shot Creator</h3>
                    <p className="text-white/40 text-sm">Elite shooting from deep with the ability to create space off the dribble.</p>
                  </div>
                  
                  <div className="bg-[#111] p-8 border border-white/5 hover:border-[#ce1141]/50 transition-all cursor-pointer"
                    onClick={() => setCareerPlayer({
                      name: "MP",
                      position: "Forward",
                      archetype: "Slashing Playmaker",
                      rating: 60,
                      attributes: { 
                        closeShot: 70, 
                        threePoint: 55, 
                        midRange: 60,
                        freeThrow: 65,
                        drivingDunk: 80,
                        drivingLayup: 75,
                        postControl: 50,
                        speed: 80, 
                        acceleration: 85,
                        ballHandle: 75, 
                        speedWithBall: 80,
                        passingAccuracy: 75,
                        perimeterDefense: 60, 
                        interiorDefense: 55,
                        steal: 60,
                        block: 50,
                        rebounding: 60,
                        vertical: 80,
                        strength: 65,
                        stamina: 90,
                        awareness: 60,
                        shootingConsistency: 60
                      },
                      badges: [{ name: "Posterizer", level: "Bronze", description: "Increases the chances of throwing down a dunk on a defender.", category: "Finishing" }],
                      level: 1,
                      xp: 0,
                      season: 1,
                      endorsements: [
                        { brand: "Jordan", status: "Locked", bonus: "+10% VC per game" },
                        { brand: "Mountain Dew", status: "Locked", bonus: "+5 Vertical" }
                      ],
                      socialFeed: [
                        { user: "@HoopCentral", message: "MP's athleticism is off the charts. Can't wait to see him in a real game.", time: "1h ago" }
                      ],
                      inventory: []
                    })}
                  >
                    <div className="text-[#ce1141] mb-4"><Play size={32} /></div>
                    <h3 className="text-2xl font-black italic uppercase mb-2">Slashing Playmaker</h3>
                    <p className="text-white/40 text-sm">Explosive finisher at the rim with elite vision and transition speed.</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Player Profile Sidebar */}
                <div className="lg:col-span-4 space-y-6">
                  <div className="bg-[#111] p-8 border border-white/5">
                    <div className="flex justify-between items-start mb-8">
                      <div>
                        <div className="text-[10px] font-bold tracking-widest text-[#ce1141] uppercase mb-1">{careerPlayer.archetype}</div>
                        <h2 className="text-4xl font-black italic uppercase tracking-tighter">{careerPlayer.name}</h2>
                      </div>
                      <div className="bg-black border border-[#ce1141] p-4 text-center">
                        <div className="text-[10px] font-bold tracking-widest text-white/40 uppercase mb-1">OVR</div>
                        <div className="text-4xl font-black italic text-[#ce1141]">{careerPlayer.rating}</div>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-white/40 uppercase tracking-widest font-bold">Level {careerPlayer.level}</span>
                        <span className="text-white/60 font-bold">{careerPlayer.xp}/1000 XP</span>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-[#ce1141]" style={{ width: `${(careerPlayer.xp / 1000) * 100}%` }} />
                      </div>
                    </div>

                    <button 
                      onClick={() => setView('city')}
                      className="w-full mt-4 bg-[#ce1141] hover:bg-[#f0144c] py-4 flex items-center justify-center gap-3 text-sm font-black uppercase italic tracking-tighter transition-all shadow-[0_0_20px_rgba(206,17,65,0.2)]"
                    >
                      <MapPin size={18} /> Enter The City
                    </button>

                    <button 
                      onClick={() => {
                        if (confirm("Are you sure you want to delete your career? This cannot be undone.")) {
                          setCareerPlayer(null);
                          localStorage.removeItem('myCareerPlayer');
                        }
                      }}
                      className="w-full mt-4 border border-white/5 hover:border-[#ce1141] hover:text-[#ce1141] py-3 text-[8px] font-black uppercase tracking-[0.3em] transition-all"
                    >
                      Delete Player
                    </button>
                  </div>

                  <div className="bg-[#111] p-8 border border-white/5">
                    <h3 className="text-sm font-black italic uppercase tracking-widest mb-6 border-b border-white/10 pb-4">Badges</h3>
                    <div className="space-y-4">
                      {careerPlayer.badges.map((badge, i) => (
                        <div key={i} className="flex items-center gap-4 p-3 bg-white/5 border border-white/5">
                          <div className="w-10 h-10 flex items-center justify-center bg-[#ce1141]/20 text-[#ce1141]">
                            <Star size={20} fill={badge.level === 'Hall of Fame' ? '#ce1141' : 'none'} />
                          </div>
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-tight">{badge.name}</div>
                            <div className="text-[8px] font-bold text-[#ce1141] uppercase tracking-widest">{badge.level}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Main Career Content */}
                <div className="lg:col-span-8 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Attributes Upgrade */}
                      <div className="bg-[#111] p-8 border border-white/5">
                        <h3 className="text-sm font-black italic uppercase tracking-widest mb-8 flex justify-between items-center">
                          Attributes
                          <span className="text-[10px] text-white/40">Potential: 99 OVR</span>
                        </h3>
                        <div className="space-y-6">
                          {Object.entries(careerPlayer.attributes).map(([key, value]) => (
                            <div key={key} className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold tracking-widest uppercase text-white/60">{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</span>
                                <div className="flex items-center gap-4">
                                  <span className="text-sm font-black italic">{value}</span>
                                  <button 
                                    onClick={() => {
                                      if (vc >= 500 && value < 99) {
                                        if (user?.email !== MY_EMAIL) setVc(v => v - 500);
                                        setCareerPlayer(prev => prev ? ({
                                          ...prev,
                                          attributes: { ...prev.attributes, [key]: value + 1 },
                                          rating: Math.min(99, prev.rating + 0.2)
                                        }) : null);
                                      }
                                    }}
                                    disabled={(vc < 500 && user?.email !== MY_EMAIL) || value >= 99}
                                    className="bg-[#ce1141] hover:bg-[#f0144c] disabled:bg-white/5 disabled:text-white/10 px-3 py-1 text-[10px] font-black uppercase transition-all"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                              <div className="h-1 bg-white/5 rounded-full overflow-hidden relative">
                                <div className="h-full bg-[#ce1141]" style={{ width: `${value}%` }} />
                                {/* Potential Cap Marker */}
                                <div className="absolute top-0 bottom-0 w-0.5 bg-white/20" style={{ left: '99%' }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                    {/* Career Actions & Social */}
                    <div className="space-y-8">
                      <div className="bg-[#ce1141] p-8 cursor-pointer hover:bg-[#f0144c] transition-all group"
                        onClick={() => setView('game')}
                      >
                        <h3 className="text-2xl font-black italic uppercase tracking-tighter mb-2">Play Next Game</h3>
                        <p className="text-white/80 text-xs mb-6">Earn VC and XP by performing on the court.</p>
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                          Enter Arena <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>

                      {/* Social Feed */}
                      <div className="bg-[#111] p-6 border border-white/5">
                        <h3 className="text-[10px] font-black italic uppercase tracking-widest mb-4 text-[#ce1141]">Social Feed</h3>
                        <div className="space-y-4">
                          {careerPlayer.socialFeed.map((post, i) => (
                            <div key={i} className="border-b border-white/5 pb-3 last:border-0">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] font-bold text-white/60">{post.user}</span>
                                <span className="text-[8px] text-white/30">{post.time}</span>
                              </div>
                              <p className="text-[11px] text-white/80 leading-relaxed">{post.message}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Endorsements */}
                      <div className="bg-[#111] p-6 border border-white/5">
                        <h3 className="text-[10px] font-black italic uppercase tracking-widest mb-4 text-[#ce1141]">Endorsements</h3>
                        <div className="grid grid-cols-2 gap-4">
                          {careerPlayer.endorsements.map((end, i) => (
                            <div key={i} className={`p-4 border ${end.status === 'Active' ? 'border-[#ce1141] bg-[#ce1141]/5' : 'border-white/5 opacity-40'} text-center`}>
                              <div className="text-xs font-black uppercase mb-1">{end.brand}</div>
                              <div className="text-[8px] font-bold uppercase tracking-widest">{end.status}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* The City Hub */}
                  <div className="bg-[#111] p-8 border border-white/5">
                    <h3 className="text-sm font-black italic uppercase tracking-widest mb-8">The City</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="aspect-square bg-white/5 hover:bg-white/10 border border-white/10 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer group">
                        <MapPin size={24} className="text-[#ce1141] group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Rec Center</span>
                      </div>
                      <div className="aspect-square bg-white/5 hover:bg-white/10 border border-white/10 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer group">
                        <RotateCcw size={24} className="text-[#ce1141] group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Gatorade Gym</span>
                      </div>
                      <div className="aspect-square bg-white/5 hover:bg-white/10 border border-white/10 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer group">
                        <Trophy size={24} className="text-[#ce1141] group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-black uppercase tracking-widest">MyCOURT</span>
                      </div>
                      <div className="aspect-square bg-white/5 hover:bg-white/10 border border-white/10 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer group">
                        <ShoppingCart size={24} className="text-[#ce1141] group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-black uppercase tracking-widest">SWAG'S</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.main>
        ) : view === 'roster' ? (
          <motion.main
            key="roster"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="pt-32 pb-24 px-8 max-w-7xl mx-auto"
          >
            <div className="flex justify-between items-end mb-12">
              <div>
                <h2 className="text-[12px] font-bold tracking-[0.5em] text-[#ce1141] uppercase mb-2">Official Database</h2>
                <h1 className="text-6xl font-black italic uppercase tracking-tighter">NBA <span className="text-[#ce1141]">Roster</span></h1>
              </div>
              <div className="flex gap-8 text-right hidden md:flex">
                <div>
                  <div className="text-[10px] font-bold tracking-widest text-white/40 uppercase mb-1">My Team</div>
                  <div className="text-4xl font-black italic text-[#ce1141]">{myTeam.length}/5</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold tracking-widest text-white/40 uppercase mb-1">Total Players</div>
                  <div className="text-4xl font-black italic">{NBA_ROSTER.length}</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {NBA_ROSTER.map((player, i) => (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                >
                  <MyTeamCard 
                    player={player} 
                    isSelected={activePlayerId === player.id}
                    onClick={() => setActivePlayerId(player.id)}
                  />
                  <div className="mt-2 flex justify-center">
                    <button 
                      onClick={() => setActivePlayerId(player.id)}
                      className={`text-[10px] font-black uppercase tracking-widest px-4 py-1 rounded-full border ${activePlayerId === player.id ? 'bg-white text-black border-white' : 'bg-transparent text-white/40 border-white/20 hover:border-white/60'}`}
                    >
                      {activePlayerId === player.id ? 'Active' : 'Select'}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.main>
        ) : (
          <motion.main
            key="game"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-screen w-full relative bg-black overflow-hidden"
          >
            {/* Exit Button */}
            <button 
              onClick={() => setView('landing')}
              className="absolute top-8 left-8 bg-black/60 backdrop-blur-md border border-white/10 px-6 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all z-50"
            >
              Exit Game
            </button>

            {/* HUD */}
            <BroadcastScoreboard 
              score={score} 
              gameClock={gameClock} 
              shotClock={shotClock} 
              teamName={activePlayer.team} 
            />

            {/* Shot Meter */}
            <ShotMeter power={power} isShot={isShot} isGreen={isGreen} coverage={shotCoverage} />

            {/* Game Log */}
            <GameLog logs={gameLog} />

            {/* Dribble Feedback */}
            <AnimatePresence>
              {isDribbling && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="fixed bottom-1/4 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
                >
                  <div className="bg-[#ce1141] px-6 py-2 rounded-sm skew-x-[-12deg] shadow-[0_0_30px_rgba(206,17,65,0.5)]">
                    <span className="text-xl font-black italic uppercase tracking-tighter text-white">
                      {dribbleType}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Mobile Game HUD */}
            <div className="absolute bottom-12 left-0 right-0 z-50 flex justify-between px-12 items-end pointer-events-none">
              {/* Left Side: Move & Status */}
              <div className="flex flex-col gap-6 pointer-events-auto">
                {/* Status Bars */}
                <div className="space-y-3 bg-black/40 backdrop-blur-md p-4 rounded-2xl border border-white/5 w-48">
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[8px] font-black uppercase tracking-widest text-white/40">Stamina</span>
                      <span className="text-[10px] font-black italic">{Math.round(stamina)}%</span>
                    </div>
                    <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                      <motion.div 
                        animate={{ width: `${stamina}%` }}
                        className={`h-full ${stamina < 30 ? 'bg-[#ce1141]' : 'bg-[#4ade80]'}`}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[8px] font-black uppercase tracking-widest text-white/40">Takeover</span>
                      <span className={`text-[10px] font-black italic ${isTakeoverActive ? 'text-yellow-500 animate-pulse' : 'text-white/60'}`}>
                        {isTakeoverActive ? 'ACTIVE' : `${Math.round(takeoverMeter)}%`}
                      </span>
                    </div>
                    <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                      <motion.div 
                        animate={{ width: `${takeoverMeter}%` }}
                        className="h-full bg-yellow-500"
                      />
                    </div>
                  </div>
                </div>

                <button 
                  onClick={movePlayer}
                  className="w-24 h-24 rounded-full bg-black/60 backdrop-blur-md border-4 border-white/20 flex flex-col items-center justify-center group active:scale-95 transition-all shadow-2xl"
                >
                  <MapPin className="text-white group-hover:text-[#ce1141] mb-1" size={24} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Move</span>
                </button>
              </div>

              {/* Right Side: Dribble & Shoot */}
              <div className="flex flex-col gap-6 items-end pointer-events-auto">
                <div className="flex gap-3">
                  <button 
                    onClick={() => {
                      const moves = ['Crossover', 'Between the Legs', 'Behind the Back', 'Step Back'];
                      const randomMove = moves[Math.floor(Math.random() * moves.length)];
                      performDribble(randomMove);
                    }}
                    className="w-20 h-20 rounded-full bg-black/60 backdrop-blur-md border-2 border-white/10 flex items-center justify-center text-[10px] font-black uppercase tracking-widest active:scale-90 transition-all hover:border-[#ce1141]"
                  >
                    Dribble
                  </button>
                </div>
                <button 
                  onPointerDown={() => { if(!isShot) { setIsCharging(true); setPower(0); } }}
                  onPointerUp={() => { if(isCharging) { setIsCharging(false); handleShoot(); } }}
                  onPointerLeave={() => { if(isCharging) { setIsCharging(false); handleShoot(); } }}
                  className={`w-36 h-36 rounded-full flex items-center justify-center font-black text-2xl italic uppercase tracking-tighter transition-all shadow-[0_0_50px_rgba(206,17,65,0.3)] ${
                    isShot ? 'bg-white/10 text-white/20 cursor-not-allowed' : 'bg-[#ce1141] text-white active:scale-90 hover:shadow-[0_0_60px_rgba(206,17,65,0.6)]'
                  }`}
                >
                  {isShot ? '...' : 'Shoot'}
                </button>
              </div>
            </div>

            {/* 3D Scene */}
            <div className="h-full w-full">
              <Canvas shadows>
                <Suspense fallback={null}>
                  <PerspectiveCamera makeDefault position={[8, 5, 12]} fov={50} />
                  <OrbitControls 
                    enablePan={false} 
                    maxPolarAngle={Math.PI / 2} 
                    minDistance={5} 
                    maxDistance={25} 
                    target={[0, 2, -2]}
                  />
                  
                  {/* Lighting */}
                  <ambientLight intensity={0.4} />
                  <spotLight 
                    position={[0, 20, 0]} 
                    angle={0.4} 
                    penumbra={0.5} 
                    intensity={3} 
                    castShadow 
                    shadow-mapSize={[2048, 2048]}
                  />
                  <pointLight position={[10, 15, 10]} intensity={1.5} castShadow />
                  <pointLight position={[0, 5, -5]} intensity={1.5} color="white" />
                  <pointLight position={[-10, 5, -10]} intensity={0.5} color="#ce1141" />
                  
                  {/* Environment */}
                  <Stars radius={100} depth={50} count={2000} factor={4} saturation={0} fade speed={1} />
                  <Environment preset="night" />
                  
                  {/* Game Objects */}
                  <Stadium />
                  <Court />
                  <Hoop />
                  <Defender position={[0, 0, -2]} />
                  <PlayerModel player={activePlayer} position={playerPos} />
                  <PlayerIndicator 
                    position={playerPos} 
                    stamina={stamina} 
                    takeoverMeter={takeoverMeter} 
                    isTakeoverActive={isTakeoverActive} 
                  />
                  <Basketball 
                    isShot={isShot} 
                    velocity={shotVelocity} 
                    onReset={handleReset} 
                    onScore={handleScore} 
                    isGreen={isGreen}
                    initialPos={[playerPos[0], playerPos[1] + 1.2, playerPos[2] - 0.5]}
                  />
                  
                  {/* Visual Feedback */}
                  <ContactShadows 
                    position={[0, 0, 0]} 
                    opacity={0.4} 
                    scale={20} 
                    blur={2} 
                    far={4.5} 
                  />
                </Suspense>
              </Canvas>
            </div>
          </motion.main>
        )}
      </AnimatePresence>

      {activeTutorial && (
        <TutorialOverlay 
          steps={activeTutorial} 
          onComplete={() => completeTutorial(view)} 
        />
      )}
    </div>
  );
}
