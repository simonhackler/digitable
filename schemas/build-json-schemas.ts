import * as z from 'zod';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createGameSchema } from '../src/routes/games/schemas.js';

const schema = z.toJSONSchema(createGameSchema);

mkdirSync('schemas/output', { recursive: true });
writeFileSync(join('schemas/output', 'createGameSchema.json'), JSON.stringify(schema, null, 2));
