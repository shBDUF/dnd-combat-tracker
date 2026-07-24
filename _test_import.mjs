import { parseCharacter } from './src/import/lss-parser.js';
import { readFileSync } from 'fs';

const raw = readFileSync('D:/RAG/knowledge/Мортиэн Серокров — Long Story Short.json', 'utf-8');
const result = parseCharacter(raw);
console.log(JSON.stringify(result, null, 2));
