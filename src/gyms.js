// Gyms: each one specialises in a type and has an apprentice trainer and a Gym Leader.
// Gyms are listed in the intended order; later ones are further from the start and tougher.

export const GYMS = [
  {
    id: 'rock', type: 'rock', name: 'Boulder Gym', badge: 'Boulder Badge',
    leader: { name: 'Leader Rocco', colors: { shirt: 0x8a6d45, pants: 0x4a3b28, hair: 0x2b2118, skin: 0xd9a066 } },
    trainer: { name: 'Hiker Dale', colors: { shirt: 0x6b8e3a, pants: 0x5a4a35, hair: 0x6b4a2b, skin: 0xe8b98a } },
    trainerTeam: [['pebblor', 6], ['magmole', 6]],
    leaderTeam: [['geodrake', 7], ['pebblor', 8], ['cragtusk', 9]],
    intro: ['Welcome to the Boulder Gym!', 'My rock creatures are tough as mountains. Show me your strength!'],
    lose: 'You crushed my defence! Take the Boulder Badge.',
  },
  {
    id: 'bug', type: 'bug', name: 'Hive Gym', badge: 'Hive Badge',
    leader: { name: 'Leader Mantis', colors: { shirt: 0x8ca61e, pants: 0x3e4a12, hair: 0x1a1a1a, skin: 0xf0c9a0 } },
    trainer: { name: 'Bug Fan Tomo', colors: { shirt: 0xd9c23a, pants: 0x3a5a8a, hair: 0x5a3a1a, skin: 0xf2c79a } },
    trainerTeam: [['beetlet', 9], ['flutterby', 9]],
    leaderTeam: [['glowbug', 10], ['flutterby', 11], ['hornbeetle', 12]],
    intro: ['Bzzz! Welcome to the Hive Gym.', 'Bugs are small, but they never give up!'],
    lose: 'What a swarm of skill! The Hive Badge is yours.',
  },
  {
    id: 'water', type: 'water', name: 'Tide Gym', badge: 'Tide Badge',
    leader: { name: 'Leader Marina', colors: { shirt: 0x2f6fc0, pants: 0x16345e, hair: 0x2ab0c0, skin: 0xe8b98a } },
    trainer: { name: 'Swimmer Kai', colors: { shirt: 0x7ac0f0, pants: 0x205080, hair: 0xe0c060, skin: 0xc68a5a } },
    trainerTeam: [['bubbuck', 12], ['shellby', 12]],
    leaderTeam: [['ripplet', 13], ['gullop', 14], ['torrentide', 15]],
    intro: ['The Tide Gym welcomes you.', 'Can you swim against my current?'],
    lose: 'You rode the wave perfectly. Here is the Tide Badge!',
  },
  {
    id: 'grass', type: 'grass', name: 'Grove Gym', badge: 'Grove Badge',
    leader: { name: 'Leader Fern', colors: { shirt: 0x4a9e66, pants: 0x2f5a3a, hair: 0x7a4a2a, skin: 0xf0c9a0 } },
    trainer: { name: 'Gardener Ivy', colors: { shirt: 0xd970a0, pants: 0x4a6a3a, hair: 0x3a2a1a, skin: 0xe8b98a } },
    trainerTeam: [['budling', 15], ['sproutle', 15]],
    leaderTeam: [['mossloth', 16], ['thornox', 17], ['bloomora', 18]],
    intro: ['Breathe in... welcome to the Grove Gym.', 'My garden creatures will put down roots and never budge!'],
    lose: 'Your team blossomed! You earned the Grove Badge.',
  },
  {
    id: 'electric', type: 'electric', name: 'Volt Gym', badge: 'Volt Badge',
    leader: { name: 'Leader Sparky', colors: { shirt: 0xf5d63d, pants: 0x2a2a2a, hair: 0xf0f0f0, skin: 0xd9a066 } },
    trainer: { name: 'Engineer Max', colors: { shirt: 0xe07a20, pants: 0x3a3a50, hair: 0x2a1a10, skin: 0xf2c79a } },
    trainerTeam: [['zapple', 18], ['ampup', 18]],
    leaderTeam: [['voltwing', 19], ['joltail', 20], ['thunderwolf', 21]],
    intro: ['Zap! The Volt Gym is fully charged.', "Let's see if you can handle the voltage!"],
    lose: 'Shocking! You win the Volt Badge.',
  },
  {
    id: 'fire', type: 'fire', name: 'Blaze Gym', badge: 'Blaze Badge',
    leader: { name: 'Leader Cinder', colors: { shirt: 0xb83a1c, pants: 0x2a1a10, hair: 0xff8a20, skin: 0xe8b98a } },
    trainer: { name: 'Firebreather Rex', colors: { shirt: 0xff7a1a, pants: 0x4a1608, hair: 0x1a1a1a, skin: 0xc68a5a } },
    trainerTeam: [['sparkitten', 21], ['magmole', 22]],
    leaderTeam: [['flarehawk', 23], ['pyrolynx', 24], ['blazehound', 25]],
    intro: ['Feel the heat of the Blaze Gym!', 'My flames burn hotter than the sun!'],
    lose: 'You extinguished my fire! The Blaze Badge is yours.',
  },
  {
    id: 'ice', type: 'ice', name: 'Frost Gym', badge: 'Frost Badge',
    leader: { name: 'Leader Yuki', colors: { shirt: 0xa8e0f0, pants: 0x3a5a7a, hair: 0xf0f8ff, skin: 0xf2d0b0 } },
    trainer: { name: 'Skier Nell', colors: { shirt: 0xe04040, pants: 0x2a2a50, hair: 0xe0c060, skin: 0xf2c79a } },
    trainerTeam: [['frostling', 24], ['waddlice', 25]],
    leaderTeam: [['snowpaw', 26], ['geodrake', 26], ['glacieron', 28]],
    intro: ['Brrr... welcome to the Frost Gym.', 'Only the coolest trainers make it past me!'],
    lose: 'You thawed my icy heart. Take the Frost Badge!',
  },
  {
    id: 'ghost', type: 'ghost', name: 'Phantom Gym', badge: 'Phantom Badge',
    leader: { name: 'Leader Raven', colors: { shirt: 0x4a2a6a, pants: 0x1a1020, hair: 0x101010, skin: 0xe0d0e0 } },
    trainer: { name: 'Medium Luna', colors: { shirt: 0x7a5aa0, pants: 0x2a1a3a, hair: 0xc0c0d0, skin: 0xf0d8c0 } },
    trainerTeam: [['wispurr', 27], ['glowbug', 28]],
    leaderTeam: [['wispurr', 29], ['snoozle', 29], ['phantomaw', 31]],
    intro: ['Hee hee... the Phantom Gym has been expecting you.', 'This is the final gym. Are you brave enough?'],
    lose: 'Incredible... you have every badge! You are a true PokeCraft Champion!',
  },
];

export const gymById = id => GYMS.find(g => g.id === id);
