/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Player } from '../types';

export const NBA_ROSTER: Player[] = [
  {
    id: '1',
    name: 'LeBron James',
    team: 'Los Angeles Lakers',
    position: 'Forward',
    rating: 96,
    tier: 'Galaxy Opal',
    stats: { shooting: 85, speed: 88, defense: 82, playmaking: 95, athleticism: 94, rebounding: 85, iq: 99, consistency: 92 },
    badges: [
      { name: "Bully", level: "Hall of Fame", category: "Finishing", description: "Improves ability to finish through contact." },
      { name: "Dimer", level: "Gold", category: "Playmaking", description: "Boosts shot percentage for teammates." },
      { name: "Chase Down Artist", level: "Gold", category: "Defense", description: "Boosts speed and vertical when tracking an opponent for a block." }
    ],
    description: 'The King. Unmatched basketball IQ and physical dominance.',
    image: 'https://picsum.photos/seed/lebron/400/500'
  },
  {
    id: '2',
    name: 'Stephen Curry',
    team: 'Golden State Warriors',
    position: 'Guard',
    rating: 97,
    tier: 'Galaxy Opal',
    stats: { shooting: 99, speed: 90, defense: 75, playmaking: 92, athleticism: 82, rebounding: 65, iq: 96, consistency: 98 },
    badges: [
      { name: "Limitless Range", level: "Hall of Fame", category: "Shooting", description: "Increases the range from which a player can effectively shoot." },
      { name: "Agent 3", level: "Hall of Fame", category: "Shooting", description: "Improves ability to hit pull-up or spin shots from deep." },
      { name: "Handles for Days", level: "Gold", category: "Playmaking", description: "Reduces stamina lost when performing dribble moves." }
    ],
    description: 'Greatest shooter of all time. Gravity-shifting range.',
    image: 'https://picsum.photos/seed/curry/400/500'
  },
  {
    id: '3',
    name: 'Nikola Jokic',
    team: 'Denver Nuggets',
    position: 'Center',
    rating: 98,
    tier: 'Dark Matter',
    stats: { shooting: 92, speed: 72, defense: 80, playmaking: 98, athleticism: 75, rebounding: 98, iq: 99, consistency: 96 },
    badges: [
      { name: "Touch Passer", level: "Hall of Fame", category: "Playmaking", description: "Speeds up the passing animation for quick ball movement." },
      { name: "Post Fade Phenom", level: "Hall of Fame", category: "Shooting", description: "Improves the chances of hitting post fadeaways." },
      { name: "Break Starter", level: "Gold", category: "Playmaking", description: "Improves accuracy of outlet passes after a rebound." }
    ],
    description: 'The Joker. A triple-double machine with elite vision.',
    image: 'https://picsum.photos/seed/jokic/400/500'
  },
  {
    id: '4',
    name: 'Giannis Antetokounmpo',
    team: 'Milwaukee Bucks',
    position: 'Forward',
    rating: 97,
    tier: 'Galaxy Opal',
    stats: { shooting: 78, speed: 94, defense: 96, playmaking: 85, athleticism: 99, rebounding: 95, iq: 92, consistency: 88 },
    description: 'The Greek Freak. Unstoppable transition force.',
    image: 'https://picsum.photos/seed/giannis/400/500'
  },
  {
    id: '5',
    name: 'Luka Doncic',
    team: 'Dallas Mavericks',
    position: 'Guard',
    rating: 97,
    tier: 'Galaxy Opal',
    stats: { shooting: 90, speed: 82, defense: 78, playmaking: 97, athleticism: 80, rebounding: 75, iq: 98, consistency: 94 },
    description: 'Maverick magician. Elite shot creation.',
    image: 'https://picsum.photos/seed/luka/400/500'
  },
  {
    id: '6',
    name: 'Kevin Durant',
    team: 'Phoenix Suns',
    position: 'Forward',
    rating: 96,
    tier: 'Galaxy Opal',
    stats: { shooting: 96, speed: 85, defense: 84, playmaking: 82, athleticism: 88, rebounding: 78, iq: 94, consistency: 97 },
    description: 'The Slim Reaper. One of the most efficient scorers.',
    image: 'https://picsum.photos/seed/kd/400/500'
  },
  {
    id: '7',
    name: 'Joel Embiid',
    team: 'Philadelphia 76ers',
    position: 'Center',
    rating: 96,
    tier: 'Galaxy Opal',
    stats: { shooting: 88, speed: 75, defense: 92, playmaking: 78, athleticism: 92, rebounding: 96, iq: 90, consistency: 92 },
    description: 'Dominant force. Elite mid-range and defense.',
    image: 'https://picsum.photos/seed/embiid/400/500'
  },
  {
    id: '8',
    name: 'Jayson Tatum',
    team: 'Boston Celtics',
    position: 'Forward',
    rating: 95,
    tier: 'Pink Diamond',
    stats: { shooting: 90, speed: 88, defense: 88, playmaking: 84, athleticism: 90, rebounding: 82, iq: 92, consistency: 90 },
    description: 'Smooth operator. Two-way superstar.',
    image: 'https://picsum.photos/seed/tatum/400/500'
  },
  {
    id: '9',
    name: 'Shai Gilgeous-Alexander',
    team: 'Oklahoma City Thunder',
    position: 'Guard',
    rating: 96,
    tier: 'Galaxy Opal',
    stats: { shooting: 92, speed: 92, defense: 90, playmaking: 88, athleticism: 88, rebounding: 72, iq: 94, consistency: 94 },
    description: 'SGA. Master of pace and mid-range.',
    image: 'https://picsum.photos/seed/sga/400/500'
  },
  {
    id: '10',
    name: 'Anthony Edwards',
    team: 'Minnesota Timberwolves',
    position: 'Guard',
    rating: 94,
    tier: 'Pink Diamond',
    stats: { shooting: 88, speed: 96, defense: 88, playmaking: 82, athleticism: 98, rebounding: 75, iq: 88, consistency: 86 },
    description: 'Ant-Man. Explosive athleticism.',
    image: 'https://picsum.photos/seed/edwards/400/500'
  },
  {
    id: '11',
    name: 'Victor Wembanyama',
    team: 'San Antonio Spurs',
    position: 'Center',
    rating: 92,
    tier: 'Diamond',
    stats: { shooting: 84, speed: 86, defense: 99, playmaking: 80, athleticism: 95, rebounding: 98, iq: 90, consistency: 85 },
    description: 'The Alien. Unprecedented length and skill.',
    image: 'https://picsum.photos/seed/wemby/400/500'
  },
  {
    id: '12',
    name: 'Trae Young',
    team: 'Atlanta Hawks',
    position: 'Guard',
    rating: 89,
    tier: 'Ruby',
    stats: { shooting: 92, speed: 90, defense: 65, playmaking: 96, athleticism: 80, rebounding: 55, iq: 95, consistency: 88 },
    description: 'Ice Trae. Elite range and playmaking.',
    image: 'https://picsum.photos/seed/trae/400/500'
  },
  {
    id: '13',
    name: 'Cade Cunningham',
    team: 'Detroit Pistons',
    position: 'Guard',
    rating: 86,
    tier: 'Sapphire',
    stats: { shooting: 84, speed: 85, defense: 80, playmaking: 88, athleticism: 85, rebounding: 70, iq: 90, consistency: 85 },
    description: 'Versatile guard with elite size.',
    image: 'https://picsum.photos/seed/cade/400/500'
  },
  {
    id: '14',
    name: 'Alperen Sengun',
    team: 'Houston Rockets',
    position: 'Center',
    rating: 88,
    tier: 'Ruby',
    stats: { shooting: 80, speed: 75, defense: 82, playmaking: 88, athleticism: 78, rebounding: 92, iq: 92, consistency: 88 },
    description: 'Baby Jokic. Elite post moves and passing.',
    image: 'https://picsum.photos/seed/sengun/400/500'
  },
  {
    id: '15',
    name: 'Zion Williamson',
    team: 'New Orleans Pelicans',
    position: 'Forward',
    rating: 90,
    tier: 'Amethyst',
    stats: { shooting: 75, speed: 92, defense: 80, playmaking: 82, athleticism: 99, rebounding: 88, iq: 85, consistency: 82 },
    description: 'Force of nature. Unstoppable at the rim.',
    image: 'https://picsum.photos/seed/zion/400/500'
  },
  {
    id: '16',
    name: 'Jalen Brunson',
    team: 'New York Knicks',
    position: 'Guard',
    rating: 93,
    tier: 'Diamond',
    stats: { shooting: 92, speed: 88, defense: 80, playmaking: 90, athleticism: 84, rebounding: 60, iq: 94, consistency: 95 },
    description: 'The Engine. Elite footwork and scoring.',
    image: 'https://picsum.photos/seed/brunson/400/500'
  },
  {
    id: '17',
    name: 'Damian Lillard',
    team: 'Milwaukee Bucks',
    position: 'Guard',
    rating: 91,
    tier: 'Amethyst',
    stats: { shooting: 95, speed: 90, defense: 70, playmaking: 88, athleticism: 82, rebounding: 50, iq: 94, consistency: 92 },
    description: 'Dame Time. Unlimited range and clutch gene.',
    image: 'https://picsum.photos/seed/dame/400/500'
  },
  {
    id: '18',
    name: 'Tyrese Maxey',
    team: 'Philadelphia 76ers',
    position: 'Guard',
    rating: 89,
    tier: 'Ruby',
    stats: { shooting: 90, speed: 98, defense: 82, playmaking: 85, athleticism: 92, rebounding: 55, iq: 88, consistency: 88 },
    description: 'Mad Maxey. Blistering speed and scoring.',
    image: 'https://picsum.photos/seed/maxey/400/500'
  },
  {
    id: '19',
    name: 'Scottie Barnes',
    team: 'Toronto Raptors',
    position: 'Forward',
    rating: 88,
    tier: 'Ruby',
    stats: { shooting: 82, speed: 86, defense: 90, playmaking: 88, athleticism: 90, rebounding: 85, iq: 92, consistency: 88 },
    description: 'Point Forward. Elite versatility and defense.',
    image: 'https://picsum.photos/seed/scottie/400/500'
  },
  {
    id: '20',
    name: 'Lauri Markkanen',
    team: 'Utah Jazz',
    position: 'Forward',
    rating: 87,
    tier: 'Ruby',
    stats: { shooting: 92, speed: 80, defense: 78, playmaking: 75, athleticism: 82, rebounding: 88, iq: 88, consistency: 90 },
    description: 'The Finnisher. Elite shooting for a big man.',
    image: 'https://picsum.photos/seed/lauri/400/500'
  },
  {
    id: '21',
    name: 'Jordan Poole',
    team: 'Washington Wizards',
    position: 'Guard',
    rating: 82,
    tier: 'Emerald',
    stats: { shooting: 85, speed: 92, defense: 70, playmaking: 80, athleticism: 88, rebounding: 50, iq: 82, consistency: 78 },
    description: 'Dynamic scorer with deep range.',
    image: 'https://picsum.photos/seed/poole/400/500'
  },
  {
    id: '22',
    name: 'Anfernee Simons',
    team: 'Portland Trail Blazers',
    position: 'Guard',
    rating: 85,
    tier: 'Sapphire',
    stats: { shooting: 92, speed: 94, defense: 72, playmaking: 82, athleticism: 94, rebounding: 45, iq: 85, consistency: 88 },
    description: 'Elite shooter and explosive athlete.',
    image: 'https://picsum.photos/seed/simons/400/500'
  },
  {
    id: '23',
    name: 'Mikal Bridges',
    team: 'New York Knicks',
    position: 'Forward',
    rating: 86,
    tier: 'Sapphire',
    stats: { shooting: 88, speed: 85, defense: 94, playmaking: 78, athleticism: 85, rebounding: 65, iq: 90, consistency: 92 },
    description: 'Elite 3-and-D wing with ironman durability.',
    image: 'https://picsum.photos/seed/mikal/400/500'
  },
  {
    id: '24',
    name: 'LaMelo Ball',
    team: 'Charlotte Hornets',
    position: 'Guard',
    rating: 88,
    tier: 'Ruby',
    stats: { shooting: 86, speed: 90, defense: 75, playmaking: 95, athleticism: 88, rebounding: 70, iq: 94, consistency: 82 },
    description: 'Showtime guard with elite vision.',
    image: 'https://picsum.photos/seed/lamelo/400/500'
  },
  {
    id: '25',
    name: 'Zach LaVine',
    team: 'Chicago Bulls',
    position: 'Guard',
    rating: 85,
    tier: 'Sapphire',
    stats: { shooting: 88, speed: 96, defense: 75, playmaking: 80, athleticism: 96, rebounding: 55, iq: 82, consistency: 85 },
    description: 'Elite athlete and high-volume scorer.',
    image: 'https://picsum.photos/seed/lavine/400/500'
  },
  {
    id: '26',
    name: 'Dejounte Murray',
    team: 'New Orleans Pelicans',
    position: 'Guard',
    rating: 87,
    tier: 'Ruby',
    stats: { shooting: 85, speed: 92, defense: 90, playmaking: 88, athleticism: 88, rebounding: 75, iq: 92, consistency: 88 },
    description: 'Two-way playmaker with elite wingspan.',
    image: 'https://picsum.photos/seed/dejounte/400/500'
  },
  {
    id: '27',
    name: 'Paolo Banchero',
    team: 'Orlando Magic',
    position: 'Forward',
    rating: 90,
    tier: 'Amethyst',
    stats: { shooting: 85, speed: 86, defense: 82, playmaking: 84, athleticism: 92, rebounding: 88, iq: 90, consistency: 88 },
    description: 'Versatile scoring forward with elite size.',
    image: 'https://picsum.photos/seed/paolo/400/500'
  },
  {
    id: '28',
    name: 'De\'Aaron Fox',
    team: 'Sacramento Kings',
    position: 'Guard',
    rating: 91,
    tier: 'Amethyst',
    stats: { shooting: 86, speed: 99, defense: 84, playmaking: 88, athleticism: 94, rebounding: 60, iq: 90, consistency: 90 },
    description: 'Swipa. Fastest player in the league.',
    image: 'https://picsum.photos/seed/fox/400/500'
  },
  {
    id: '29',
    name: 'Tyrese Haliburton',
    team: 'Indiana Pacers',
    position: 'Guard',
    rating: 91,
    tier: 'Amethyst',
    stats: { shooting: 90, speed: 88, defense: 78, playmaking: 99, athleticism: 82, rebounding: 55, iq: 98, consistency: 95 },
    description: 'Point God 2.0. Elite passing vision.',
    image: 'https://picsum.photos/seed/haliburton/400/500'
  },
  {
    id: '30',
    name: 'Jimmy Butler',
    team: 'Miami Heat',
    position: 'Forward',
    rating: 91,
    tier: 'Amethyst',
    stats: { shooting: 84, speed: 85, defense: 92, playmaking: 88, athleticism: 88, rebounding: 82, iq: 95, consistency: 94 },
    description: 'Jimmy Buckets. Ultimate competitor.',
    image: 'https://picsum.photos/seed/butler/400/500'
  }
];
