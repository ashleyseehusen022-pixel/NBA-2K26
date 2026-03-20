/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type CardTier = 'Emerald' | 'Sapphire' | 'Ruby' | 'Amethyst' | 'Diamond' | 'Pink Diamond' | 'Galaxy Opal' | 'Dark Matter';
export type BadgeLevel = 'Bronze' | 'Silver' | 'Gold' | 'Hall of Fame';

export interface Badge {
  name: string;
  level: BadgeLevel;
  description: string;
  category: 'Finishing' | 'Shooting' | 'Playmaking' | 'Defense';
}

export interface Player {
  id: string;
  name: string;
  team: string;
  position: string;
  rating: number;
  tier: CardTier;
  stats: {
    shooting: number;
    speed: number;
    defense: number;
    playmaking: number;
    athleticism: number;
    iq: number;
    consistency: number;
  };
  badges?: Badge[];
  description: string;
  image: string;
}

export interface CareerPlayer {
  name: string;
  position: string;
  archetype: string;
  rating: number;
  attributes: {
    closeShot: number;
    threePoint: number;
    midRange: number;
    freeThrow: number;
    drivingDunk: number;
    drivingLayup: number;
    postControl: number;
    speed: number;
    acceleration: number;
    ballHandle: number;
    speedWithBall: number;
    passingAccuracy: number;
    perimeterDefense: number;
    interiorDefense: number;
    steal: number;
    block: number;
    rebounding: number;
    vertical: number;
    strength: number;
    stamina: number;
    awareness: number;
    shootingConsistency: number;
  };
  badges: Badge[];
  level: number;
  xp: number;
  season: number;
  endorsements: {
    brand: string;
    status: 'Locked' | 'Active';
    bonus: string;
  }[];
  socialFeed: {
    user: string;
    message: string;
    time: string;
  }[];
  inventory: {
    id: string;
    name: string;
    type: 'Clothing' | 'Animation' | 'Boost';
  }[];
}

export interface TutorialStep {
  title: string;
  description: string;
  target?: string; // CSS selector for highlighting
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
}
