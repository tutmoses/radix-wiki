import { defineConfig } from 'prisma/config';
import { prismaConfig } from 'wiki-formant/db';

export default defineConfig(prismaConfig(import.meta.dirname));
