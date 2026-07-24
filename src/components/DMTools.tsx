// ============================================================================
// DMTools — Name generator, d100 tables, quick rules reference
// ============================================================================

import React, { useState, useMemo, useCallback } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Input } from './ui/input';
import { cn } from '../lib/utils';

// ═══════════════════════════════════════════════════════════════════════════
// NAME TABLES
// ═══════════════════════════════════════════════════════════════════════════

const NAME_TABLES: Record<string, { male: string[]; female: string[] }> = {
  Human: {
    male: [
      'Aric', 'Baldur', 'Cedric', 'Dorian', 'Eamon', 'Finnian', 'Garrett',
      'Hale', 'Ivor', 'Jareth', 'Kael', 'Leoric', 'Marek', 'Nolan', 'Orin',
      'Percival', 'Quinn', 'Rowan', 'Sylas', 'Theron',
    ],
    female: [
      'Aelina', 'Brienne', 'Cressida', 'Dahlia', 'Elara', 'Freya', 'Genevieve',
      'Helene', 'Iselda', 'Juniper', 'Katherine', 'Lilith', 'Maeve', 'Nerissa',
      'Ophelia', 'Penelope', 'Rowena', 'Seraphina', 'Tessa', 'Vivian',
    ],
  },
  Elf: {
    male: [
      'Aelar', 'Beiro', 'Cael', 'Daro', 'Elrohir', 'Fenrir', 'Gael', 'Himo',
      'Ithil', 'Jassin', 'Korion', 'Laeron', 'Merthin', 'Nyllar', 'Orophin',
      'Paeris', 'Rillifane', 'Soveliss', 'Theren', 'Uthvir',
    ],
    female: [
      'Aryllia', 'Birel', 'Cyeene', 'Dara', 'Elara', 'Faeryl', 'Gwellin',
      'Harla', 'Ilyana', 'Jhela', 'Kiral', 'Lalaith', 'Meriele', 'Nimesin',
      'Oriel', 'Phaera', 'Quilana', 'Sariel', 'Tathariel', 'Vaeri',
    ],
  },
  Dwarf: {
    male: [
      'Adrik', 'Baelin', 'Burin', 'Dain', 'Darrak', 'Eberk', 'Fargrim',
      'Flint', 'Gardain', 'Harbek', 'Kildrak', 'Morgran', 'Orsik', 'Oskar',
      'Rangrim', 'Rurik', 'Taklinn', 'Thoradin', 'Torin', 'Ulfgar',
    ],
    female: [
      'Amber', 'Artin', 'Audhild', 'Bardryn', 'Dagnal', 'Diesa', 'Eldeth',
      'Falkrunn', 'Gunnloda', 'Gurdis', 'Helja', 'Hlin', 'Ilde', 'Jarn',
      'Kathra', 'Liftrasa', 'Mardred', 'Riswynn', 'Torbera', 'Vistra',
    ],
  },
  Gnome: {
    male: [
      'Alston', 'Alvyn', 'Boddynock', 'Brocc', 'Eldon', 'Erky', 'Fibblestib',
      'Fonkin', 'Frug', 'Gimble', 'Glim', 'Jebeddo', 'Kellen', 'Namfoodle',
      'Orryn', 'Rimble', 'Seebo', 'Sindri', 'Warryn', 'Wrenn',
    ],
    female: [
      'Bimpnottin', 'Breena', 'Caramip', 'Carlin', 'Donella', 'Duvamil',
      'Ella', 'Ellyjobell', 'Ellywick', 'Fay', 'Lilli', 'Loopmottin',
      'Lorilla', 'Mardnab', 'Nissa', 'Nyx', 'Oda', 'Orla', 'Roywyn', 'Shamil',
    ],
  },
  Halfling: {
    male: [
      'Alton', 'Ander', 'Bernie', 'Bobbin', 'Cade', 'Callus', 'Corrin',
      'Dannad', 'Darrill', 'Erlan', 'Garret', 'Lindal', 'Lyle', 'Merric',
      'Milo', 'Osborn', 'Perrin', 'Reed', 'Roscoe', 'Wellby',
    ],
    female: [
      'Adelaide', 'Amy', 'Anastasia', 'Andry', 'Bree', 'Callie', 'Cora',
      'Euphemia', 'Genevieve', 'Hazel', 'Lavender', 'Lily', 'Marigold',
      'Myrtle', 'Nell', 'Pearl', 'Poppy', 'Rosemary', 'Violet', 'Zinnia',
    ],
  },
  Orc: {
    male: [
      'Arkh', 'Bagruk', 'Bolg', 'Dreg', 'Gorlag', 'Grish', 'Grom', 'Gurnak',
      'Hagrak', 'Karg', 'Lagakh', 'Mog', 'Olag', 'Rakh', 'Sharg', 'Thog',
      'Ulag', 'Urg', 'Vog', 'Zog',
    ],
    female: [
      'Arha', 'Bagga', 'Bolga', 'Braga', 'Dregna', 'Garha', 'Gorlaga',
      'Grisha', 'Gurna', 'Hagra', 'Karga', 'Moga', 'Olagha', 'Rakha',
      'Sharga', 'Thogha', 'Ulaga', 'Urga', 'Voga', 'Zoga',
    ],
  },
  Tiefling: {
    male: [
      'Aktaeon', 'Alastor', 'Amnon', 'Barakas', 'Calder', 'Daelius', 'Eligor',
      'Faust', 'Geder', 'Harkaan', 'Jaq', 'Kael', 'Lorcan', 'Malak', 'Morthos',
      'Nessus', 'Ravash', 'Sargen', 'Talon', 'Zarek',
    ],
    female: [
      'Aella', 'Arioch', 'Brasta', 'Cala', 'Daeva', 'Elenna', 'Faela',
      'Glasya', 'Helia', 'Ixora', 'Jessa', 'Kali', 'Lilis', 'Mara', 'Naisha',
      'Orianna', 'Reina', 'Sarelle', 'Tavira', 'Velena',
    ],
  },
  Dragonborn: {
    male: [
      'Arjh', 'Balasar', 'Bharash', 'Donaar', 'Ghesh', 'Heskan', 'Kriv',
      'Medrash', 'Mehen', 'Nadarr', 'Pandjed', 'Patrin', 'Rhogar', 'Shamash',
      'Shedinn', 'Tarhun', 'Torinn', 'Valtor', 'Vurin', 'Zarkhil',
    ],
    female: [
      'Akra', 'Avaar', 'Biri', 'Daar', 'Farideh', 'Harann', 'Havilar',
      'Jheri', 'Kava', 'Korinn', 'Misann', 'Naya', 'Perra', 'Raiann',
      'Sora', 'Surina', 'Thava', 'Uadjit', 'Varinna', 'Zara',
    ],
  },
  Goblin: {
    male: [
      'Bork', 'Drok', 'Fink', 'Glib', 'Gnik', 'Grub', 'Hob', 'Ig', 'Jib',
      'Klik', 'Mog', 'Nik', 'Pip', 'Rik', 'Skib', 'Snik', 'Tug', 'Ukg', 'Vok', 'Zik',
    ],
    female: [
      'Borka', 'Droka', 'Finka', 'Gliba', 'Gnika', 'Gruba', 'Hoba', 'Iga',
      'Jiba', 'Klikka', 'Moga', 'Nika', 'Pipa', 'Rika', 'Skiba', 'Snika',
      'Tuga', 'Ukga', 'Vokka', 'Zikka',
    ],
  },
};

type Race = keyof typeof NAME_TABLES;
type Gender = 'male' | 'female' | 'any';

const RACES = Object.keys(NAME_TABLES);

// ═══════════════════════════════════════════════════════════════════════════
// d100 TABLES
// ═══════════════════════════════════════════════════════════════════════════

interface D100Table {
  name: string;
  entries: string[];
}

const D100_TABLES: Record<string, D100Table> = {
  trinkets: {
    name: 'Trinkets',
    entries: [
      'A lock of hair from a forgotten hero',
      'A small glass vial filled with glowing liquid',
      'A coin that always lands on its edge',
      'A miniature chest with a tiny key',
      'A finger bone wrapped in worn leather',
      'A stone that faintly hums at night',
      'A tooth from a creature that never existed',
      'A rusted medal of honor from a lost kingdom',
      'A child\u2019s drawing of a castle',
      'A perfect cube of obsidian',
      'A preserved firefly in amber',
      'A page torn from a wizard\u2019s spellbook',
      'A ring that changes color with the weather',
      'A piece of charcoal that never burns away',
      'A feather from a celestial bird',
      'A broken compass needle',
      'A tiny jade frog',
      'A silver spoon engraved with a star map',
      'A scrap of silk embroidered with an arcane sigil',
      'A dried flower that never wilts',
      'A button from a royal guard\u2019s uniform',
      'A candle that burns with blue flame',
      'A piece of eight from a sunken galleon',
      'A locket with a portrait of an unknown person',
      'A key carved from bone',
      'A vial of sand from a desert oasis',
      'A whistle that only animals can hear',
      'A glove that fits any hand',
      'A shard of a broken crystal ball',
      'A mask worn during a forgotten festival',
      'A chain made of interlocking bronze rings',
      'A book written in an unknown language',
      'A petrified egg',
      'A scarab beetle carved from lapis lazuli',
      'A horn that emits no sound',
      'A piece of rotten wood that smells of roses',
      'A string of beads from a shaman\u2019s necklace',
      'A tiny cage with no door',
      'A die that always rolls 7',
      'A map to a location that doesn\u2019t exist',
      'A piece of chalk that writes in gold',
      'A mirror that shows a reflection from the past',
      'A stone with a naturally formed hole',
      'A bell that rings without being touched',
      'A piece of fabric woven from spider silk',
      'A jar filled with firefly light',
      'A finger puppet of a famous hero',
      'A seal bearing a noble house crest',
      'A piece of coal that glows faintly',
      'A tin whistle that plays itself',
      'A feather quill that never runs out of ink',
      'A small hourglass that measures 13 seconds',
      'A piece of parchment that cannot be torn',
      'A crystal that is warm to the touch',
      'A bootlace tied in an impossible knot',
      'A scale from a dragon',
      'A petal from a moonflower',
      'A piece of chalk that never wears down',
      'A small iron bell with no clapper',
      'A jar of ink that changes color',
      'A tooth from a vampire',
      'A hairpin that opens any lock',
      'A tiny anchor from a ship in a bottle',
      'A piece of music written in blood',
      'A scarf that smells of the sea',
      'A pebble with a star-shaped marking',
      'A miniature painting of a landscape',
      'A compass that points to the nearest danger',
      'A cork from a bottle of ancient wine',
      'A piece of twine that ties itself',
      'A glass eye that moves on its own',
      'A charm made of braided grass',
      'A fragment of a meteorite',
      'A petrified leaf',
      'A button from a court jester\u2019s outfit',
      'A thimble made of silver',
      'A key that fits no lock',
      'A coin from a country long destroyed',
      'A small stone idol of a forgotten god',
      'A piece of amber with a trapped moth',
      'A broken arrow from a legendary battle',
      'A glove lined with fur',
      'A scarf that changes color with mood',
      'A cup that keeps liquids warm forever',
      'A spoon that stirs itself',
      'A knucklebone from a giant',
      'A whistle that sounds like a bird',
      'A ribbon that unties itself',
      'A piece of chalk that draws in three dimensions',
      'A stone that weeps water',
      'A feather that glows in moonlight',
      'A ring that is always cold',
      'A mask that changes expression',
      'A bell jar containing a miniature storm',
      'A coin with two heads',
      'A bookmark made of pressed flowers',
      'A vial of water from the River Styx',
      'A piece of a shattered sword',
      'A crown made of woven vines',
      'A necklace of dried berries',
      'A starfish that moves when wet',
      'A piece of driftwood carved into a face',
      'A bundle of herbs that never decay',
    ],
  },
  wildMagic: {
    name: 'Wild Magic Surge',
    entries: [
      'Roll on this table at the start of each of your turns for the next minute.',
      'A spectral shield appears and grants +2 AC until the effect ends.',
      'You cast Fireball as a 3rd-level spell centered on yourself.',
      'You cast Magic Missile as a 5th-level spell.',
      'Your skin turns bright blue. A Remove Curse spell can end this.',
      'You grow a beard of feathers that remains until you sneeze.',
      'You cast Grease centered on yourself.',
      'You regain 5 HP at the start of each of your turns.',
      'You are affected as if by the Confusion spell for 1 minute.',
      'You teleport up to 60 feet to an unoccupied space.',
      'You are frightened by the nearest creature until the end of your next turn.',
      'You become invisible for 1 minute.',
      'You cast Levitate on yourself.',
      'A unicorn appears and is friendly to you for 1 minute.',
      'All your hair falls out but grows back within 24 hours.',
      'You cast Darkness centered on yourself.',
      'You gain the ability to speak with animals for 1 hour.',
      'You cast Mirror Image.',
      'You are surrounded by illusory butterflies for 1 minute.',
      'You can take one additional action immediately.',
      'All your metal possessions turn to silver.',
      'You cast Polymorph on yourself, becoming a sheep for 1 minute.',
      'Your voice booms three times louder than normal for 1 minute.',
      'A modron appears and takes detailed notes for 1 minute before leaving.',
      'You cast Web centered on yourself.',
      'You are immune to being intoxicated for 1 week.',
      'A spectral shield hovers near you granting resistance to one damage type.',
      'Your eyes glow with dim light for 1 minute.',
      'You cast Enlarge/Reduce on yourself.',
      'You restore all expended sorcery points.',
    ],
  },
  npcQuirks: {
    name: 'NPC Quirks',
    entries: [
      'Constantly taps their fingers on surfaces',
      'Speaks in rhymes',
      'Refuses to say anyone\u2019s name directly',
      'Collects unusual buttons',
      'Always knows the time of day',
      'Never blinks during conversation',
      'Humming an unrecognizable tune constantly',
      'Excessively polite, even when threatened',
      'Afraid of open spaces',
      'Hoards candles',
      'Carries a pet mouse in their pocket',
      'Refers to themselves in the third person',
      'Laughs nervously at everything',
      'Always eating or drinking something',
      'Finishes other people\u2019s sentences',
      'Afraid of magic, even cantrips',
      'Can only whisper',
      'Constantly checks for traps',
      'Has an imaginary friend they consult',
      'Never says "yes" or "no" directly',
      'Always corrects others on unimportant details',
      'Uses overly complicated words',
      'Wears mismatched shoes',
      'Afraid of dogs',
      'Talks to plants',
      'Insists on shaking hands with everyone they meet',
      'Has a photographic memory for faces',
      'Refuses to touch metal',
      'Collects teeth',
      'Always seems to know a guy who knows a guy',
      'Sneezes loudly at dramatic moments',
      'Writes everything down obsessively',
      'Hums the same four notes over and over',
      'Always carries a spare key "just in case"',
      'Stares into the distance mid-conversation',
      'Can only count in multiples of three',
      'Names every object they interact with',
      'Refuses to sit with their back to a door',
      'Keeps a detailed diary of every conversation',
      'Can perfectly mimic animal sounds',
    ],
  },
  randomEncounters: {
    name: 'Random Encounters',
    entries: [
      '1d4 goblins dragging a cart of stolen goods',
      'A traveling merchant with a broken wheel',
      'A wounded deer being hunted by wolves',
      'A group of bandits setting up an ambush',
      'A mysterious fog that obscures vision',
      'A lone knight challenging travelers to a duel',
      'A ruined shrine to a forgotten god',
      'A bridge that is partially collapsed',
      'A herd of wild horses stampeding',
      'A hag offering "helpful" advice',
      'A patrol of guards searching for a fugitive',
      'A traveling circus with strange performers',
      'A meteorite crash site',
      'A pack of dire wolves hunting for food',
      'An abandoned campsite with a journal',
      'A group of cultists performing a ritual',
      'A traveling bard with a tale to tell',
      'A giant blocking the road demanding toll',
      'An old hermit living in a cave',
      'A wounded griffon caught in a trap',
      'A caravan of refugees fleeing disaster',
      'A magical anomaly causing wild magic effects',
      'A group of orc scouts scouting the area',
      'A spectral procession of ghostly figures',
      'A giant spider web blocking the path',
      'A wizard testing a new spell nearby',
      'A funeral procession for a fallen hero',
      'A group of druids tending a sacred grove',
      'A wyvern circling overhead',
      'An earthquake that reshapes the terrain',
      'A sinkhole revealing an underground cavern',
      'A group of assassins hunting a specific target',
      'A forest fire spreading rapidly',
      'A group of centaurs crossing the plains',
      'A magical fountain with strange properties',
      'A group of kobolds setting traps',
      'A lone traveler who has lost their way',
      'A ghost haunting an old battlefield',
      'A group of smugglers moving contraband',
      'A dragon flying in the distance',
    ],
  },
};

const TABLE_KEYS = Object.keys(D100_TABLES);

// ═══════════════════════════════════════════════════════════════════════════
// RULES REFERENCE DATA
// ═══════════════════════════════════════════════════════════════════════════

interface RuleCategory {
  name: string;
  rules: { title: string; text: string }[];
}

const RULES_DATA: RuleCategory[] = [
  {
    name: 'Conditions',
    rules: [
      { title: 'Blinded', text: 'A blinded creature cannot see and automatically fails any ability check that requires sight. Attack rolls against the creature have advantage, and the creature attack rolls have disadvantage.' },
      { title: 'Charmed', text: 'A charmed creature cannot attack the charmer or target them with harmful abilities. The charmer has advantage on social interaction checks with the creature.' },
      { title: 'Deafened', text: 'A deafened creature cannot hear and automatically fails any ability check that requires hearing.' },
      { title: 'Frightened', text: 'A frightened creature has disadvantage on ability checks and attack rolls while the source of its fear is within line of sight. The creature cannot willingly move closer to the source of its fear.' },
      { title: 'Grappled', text: 'A grappled creature speed becomes 0 and it cannot benefit from speed bonuses. The condition ends if the grappler is incapacitated. The grappled creature can use its action to escape with a Strength (Athletics) or Dexterity (Acrobatics) check against the grappler DC.' },
      { title: 'Incapacitated', text: 'An incapacitated creature cannot take actions, bonus actions, or reactions.' },
      { title: 'Invisible', text: 'An invisible creature is impossible to see without magical aid. It can be detected by sound or tracks. Attack rolls against the creature have disadvantage, and the creature attack rolls have advantage.' },
      { title: 'Paralyzed', text: 'A paralyzed creature is incapacitated and cannot move or speak. It automatically fails Strength and Dexterity saving throws. Attack rolls against the creature have advantage. Any hit within 5 ft. is a critical hit.' },
      { title: 'Petrified', text: 'A petrified creature is transformed into stone, incapacitated, and does not age. It automatically fails Strength and Dexterity saving throws. It has resistance to all damage, and is immune to poison and disease.' },
      { title: 'Poisoned', text: 'A poisoned creature has disadvantage on attack rolls and ability checks.' },
      { title: 'Prone', text: 'A prone creature can only crawl (costs 1 extra foot per foot moved) unless it stands up (costs half its movement). Attack rolls have advantage within 5 ft., disadvantage beyond 5 ft.' },
      { title: 'Restrained', text: 'A restrained creature speed becomes 0. Attack rolls against the creature have advantage, and the creature attack rolls have disadvantage. The creature has disadvantage on Dexterity saving throws.' },
      { title: 'Stunned', text: 'A stunned creature is incapacitated, cannot move, and speaks falteringly. It automatically fails Strength and Dexterity saving throws. Attack rolls against the creature have advantage.' },
      { title: 'Unconscious', text: 'An unconscious creature is incapacitated, cannot move or speak, and drops what it is holding. It automatically fails Strength and Dexterity saving throws. Attack rolls have advantage. Any hit within 5 ft. is a critical hit.' },
      { title: 'Exhaustion', text: 'Exhaustion has 6 levels. Level 1: disadvantage on ability checks. Level 2: speed halved. Level 3: disadvantage on attack rolls and saving throws. Level 4: hit point maximum halved. Level 5: speed reduced to 0. Level 6: death. A long rest reduces exhaustion by 1 level.' },
    ],
  },
  {
    name: 'Actions in Combat',
    rules: [
      { title: 'Attack', text: 'Make a melee or ranged weapon attack, or an attack with a spell. You can make one attack per Attack action, unless you have Extra Attack.' },
      { title: 'Cast a Spell', text: 'Cast a spell with a casting time of 1 action. You can only cast one leveled spell per turn (cantrips are fine as the second spell).' },
      { title: 'Dash', text: 'Double your speed for the current turn.' },
      { title: 'Disengage', text: 'Your movement does not provoke opportunity attacks for the rest of the turn.' },
      { title: 'Dodge', text: 'Until the start of your next turn, attack rolls against you have disadvantage. You also make Dexterity saving throws with advantage.' },
      { title: 'Help', text: 'You aid a friendly creature. The target gains advantage on the next ability check it makes for the task. Or, you can help attack a creature within 5 ft. of you, giving an ally advantage on the next attack.' },
      { title: 'Hide', text: 'Make a Dexterity (Stealth) check to conceal yourself. You cannot hide from a creature that can see you.' },
      { title: 'Ready', text: 'Prepare an action to react to a trigger. You take the Readied action when the trigger occurs, using your reaction.' },
      { title: 'Search', text: 'Make a Wisdom (Perception) or Intelligence (Investigation) check to find something.' },
      { title: 'Use an Object', text: 'Interact with an object, such as opening a door, pulling a lever, or drinking a potion.' },
      { title: 'Opportunity Attack', text: 'When a hostile creature leaves your reach, you can use your reaction to make one melee attack against it. Not provoked by Disengage, teleportation, or forced movement.' },
    ],
  },
  {
    name: 'Damage Types',
    rules: [
      { title: 'Acid', text: 'Corrosive substances. Green dragon breath, black dragon breath, and spells like Acid Splash.' },
      { title: 'Bludgeoning', text: 'Blunt force trauma. Maces, hammers, falling, and spells like Magic Stone.' },
      { title: 'Cold', text: 'Freezing temperatures and ice. White dragon breath, cone of cold.' },
      { title: 'Fire', text: 'Heat and flames. Red dragon breath, fireball, burning hands.' },
      { title: 'Force', text: 'Raw magical energy. Magic missile, eldritch blast.' },
      { title: 'Lightning', text: 'Electrical discharge. Blue dragon breath, lightning bolt.' },
      { title: 'Necrotic', text: 'Death energy. Chill touch, inflict wounds.' },
      { title: 'Piercing', text: 'Sharp pointy things. Arrows, spears, stabs.' },
      { title: 'Poison', text: 'Toxins and venoms. Many monster bites, poison spray.' },
      { title: 'Psychic', text: 'Mental damage. Mind flayer attacks, dissonant whispers.' },
      { title: 'Radiant', text: 'Holy/divine light. Sacred flame, guiding bolt.' },
      { title: 'Slashing', text: 'Cutting edges. Swords, axes, claws.' },
      { title: 'Thunder', text: 'Sonic waves. Thunderwave, shatter.' },
    ],
  },
  {
    name: 'Resting',
    rules: [
      { title: 'Short Rest', text: 'A period of downtime at least 1 hour long. During a short rest, you can spend Hit Dice to heal (roll the die, add CON modifier). You regain some class features (e.g., Warlock spell slots, Fighter Action Surge).' },
      { title: 'Long Rest', text: 'A period of extended downtime at least 8 hours long. You regain all HP, all Hit Dice (up to half your max), all class features, and spell slots. You cannot benefit from more than one long rest per 24-hour period.' },
    ],
  },
  {
    name: 'Death & Dying',
    rules: [
      { title: 'Death Saving Throws', text: 'When reduced to 0 HP, you fall unconscious and must make death saving throws. Roll a d20 (no modifiers). 10+ is a success, 9- is a failure. 3 successes = stable. 3 failures = death. A natural 20 = regain 1 HP. A natural 1 = 2 failures.' },
      { title: 'Stabilizing a Creature', text: 'You can use your action to administer first aid to an unconscious creature. Make a DC 10 Wisdom (Medicine) check. On success, the creature becomes stable. Spare the Dying also stabilizes.' },
      { title: 'Damage at 0 HP', text: 'If you take damage while at 0 HP, you suffer one death save failure. If the damage is from a critical hit, you suffer two failures. If the damage equals or exceeds your max HP, you die instantly.' },
      { title: 'Instant Death', text: 'Massive damage can kill instantly. If damage reduces you to 0 HP and the remaining damage equals or exceeds your max HP, you die without making death saves.' },
    ],
  },
  {
    name: 'Movement & Positioning',
    rules: [
      { title: 'Movement in Combat', text: 'On your turn, you can move up to your speed. You can break up your movement with actions. Difficult terrain costs double movement.' },
      { title: 'Squeezing', text: 'A creature can squeeze through a space large enough for a creature one size smaller. While squeezing, attack rolls have disadvantage and Dexterity saving throws have disadvantage.' },
      { title: 'Cover', text: 'Half cover: +2 AC and Dexterity saves. Three-quarters cover: +5 AC and Dexterity saves. Total cover: cannot be targeted directly.' },
      { title: 'Climbing, Swimming, Crawling', text: 'Each foot of movement costs 1 extra foot (2 total) unless you have a climbing or swimming speed. Crawling costs 1 extra foot.' },
      { title: 'Jumping', text: 'Long jump: (STR score) feet with a 10 ft. running start, or half without. High jump: (3 + STR mod) feet with running start, or half without.' },
    ],
  },
  {
    name: 'Spellcasting',
    rules: [
      { title: 'Spell Slots', text: 'You expend a spell slot of the spell level or higher to cast it. Casting at a higher level (upcasting) can increase the spell effects.' },
      { title: 'Cantrips', text: 'Cantrips are 0-level spells that do not consume spell slots. They scale with character level (not class level).' },
      { title: 'Components', text: 'Verbal (V): you must speak. Somatic (S): you must gesture. Material (M): you must have the required materials or a spellcasting focus.' },
      { title: 'Concentration', text: 'Some spells require concentration. You can only concentrate on one spell at a time. Taking damage forces a Constitution save (DC 10 or half the damage, whichever is higher) to maintain concentration.' },
      { title: 'Range & Area of Effect', text: 'Spell range is the maximum distance you can target. Area effects include: cone (originates from you), cube, cylinder, line, sphere, and hemisphere.' },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

// ─── Name Generator ────────────────────────────────────────────────────────

function NameGenerator() {
  const [race, setRace] = useState<Race>('Human');
  const [gender, setGender] = useState<Gender>('any');
  const [names, setNames] = useState<string[]>([]);

  const generateNames = useCallback(() => {
    const table = NAME_TABLES[race];
    const pool: string[] = [];
    if (gender === 'male' || gender === 'any') pool.push(...table.male);
    if (gender === 'female' || gender === 'any') pool.push(...table.female);

    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    setNames(shuffled.slice(0, 10));
  }, [race, gender]);

  const [mounted, setMounted] = useState(false);
  if (!mounted) {
    generateNames();
    setMounted(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Race</label>
          <select
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
            value={race}
            onChange={(e) => setRace(e.target.value as Race)}
          >
            {RACES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Gender</label>
          <select
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
            value={gender}
            onChange={(e) => setGender(e.target.value as Gender)}
          >
            <option value="any">Any</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
        <Button onClick={generateNames}>Generate</Button>
      </div>

      {names.length > 0 && (
        <div className="grid grid-cols-2 gap-1">
          {names.map((name, i) => (
            <div key={i} className="text-sm px-2 py-1 rounded hover:bg-muted/50">
              {name}
            </div>
          ))}
        </div>
      )}
      <Button variant="outline" size="sm" onClick={generateNames}>
        Regenerate
      </Button>
    </div>
  );
}

// ─── d100 Table Roller ─────────────────────────────────────────────────────

function D100TableRoller() {
  const [selectedTable, setSelectedTable] = useState(TABLE_KEYS[0]);
  const [result, setResult] = useState<string | null>(null);
  const [rolling, setRolling] = useState(false);

  const table = D100_TABLES[selectedTable];

  const handleRoll = useCallback(() => {
    setRolling(true);
    let count = 0;
    const interval = setInterval(() => {
      const rand = Math.floor(Math.random() * table.entries.length);
      setResult(table.entries[rand]);
      count++;
      if (count >= 5) {
        clearInterval(interval);
        setRolling(false);
        const final = Math.floor(Math.random() * table.entries.length);
        setResult(table.entries[final]);
      }
    }, 80);
  }, [table]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Table
          </label>
          <select
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
            value={selectedTable}
            onChange={(e) => {
              setSelectedTable(e.target.value);
              setResult(null);
            }}
          >
            {TABLE_KEYS.map((key) => (
              <option key={key} value={key}>{D100_TABLES[key].name}</option>
            ))}
          </select>
        </div>
        <Button onClick={handleRoll} disabled={rolling}>
          {rolling ? 'Rolling...' : 'Roll d100'}
        </Button>
      </div>

      {result && (
        <Card className={cn(
          'transition-all',
          rolling ? 'opacity-70' : 'opacity-100'
        )}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🎲</span>
              <div>
                <p className="text-sm font-medium">{table.name}</p>
                <p className="text-base">{result}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Quick Rules Reference ─────────────────────────────────────────────────

function RulesReference() {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const filteredRules = useMemo(() => {
    if (!search) return RULES_DATA;
    const q = search.toLowerCase();
    return RULES_DATA
      .map((cat) => ({
        ...cat,
        rules: cat.rules.filter(
          (r) =>
            r.title.toLowerCase().includes(q) ||
            r.text.toLowerCase().includes(q)
        ),
      }))
      .filter((cat) => cat.rules.length > 0);
  }, [search]);

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search rules..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {filteredRules.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No rules match your search.
        </p>
      ) : (
        <div className="space-y-3">
          {filteredRules.map((cat) => (
            <Card key={cat.name}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{cat.name}</CardTitle>
                <CardDescription className="text-xs">
                  {cat.rules.length} rule{cat.rules.length !== 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="space-y-1">
                  {cat.rules.map((rule) => (
                    <div key={rule.title}>
                      <button
                        className="flex items-center justify-between w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted/50 transition-colors"
                        onClick={() =>
                          setExpanded(
                            expanded === rule.title ? null : rule.title
                          )
                        }
                      >
                        <span className="font-medium">{rule.title}</span>
                        <span className="text-muted-foreground text-xs">
                          {expanded === rule.title ? '\u25B2' : '\u25BC'}
                        </span>
                      </button>
                      {expanded === rule.title && (
                        <div className="px-2 pb-2 text-sm text-muted-foreground">
                          {rule.text}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main DMTools Component ───────────────────────────────────────────────

type DMTab = 'names' | 'tables' | 'rules';

export function DMTools() {
  const [tab, setTab] = useState<DMTab>('names');

  const tabs: { id: DMTab; label: string; icon: string }[] = [
    { id: 'names', label: 'Name Generator', icon: '\uD83D\uDCDB' },
    { id: 'tables', label: 'd100 Tables', icon: '\uD83C\uDFB2' },
    { id: 'rules', label: 'Rules Reference', icon: '\uD83D\uDCD6' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold">DM Tools</h2>
        <p className="text-sm text-muted-foreground">
          Utilities for Dungeon Masters
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 border-b pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-md transition-colors',
              tab === t.id
                ? 'bg-card border border-b-white rounded-b-none text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <Card>
        <CardContent className="p-4">
          {tab === 'names' && <NameGenerator />}
          {tab === 'tables' && <D100TableRoller />}
          {tab === 'rules' && <RulesReference />}
        </CardContent>
      </Card>
    </div>
  );
}