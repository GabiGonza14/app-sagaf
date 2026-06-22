import { cache } from 'react';
import { auth } from '@/auth';

// Deduplica la llamada a auth() dentro del mismo request (layout + page comparten el resultado)
export const getSession = cache(auth);
