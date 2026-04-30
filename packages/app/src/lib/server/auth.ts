import { getRequestEvent } from '$app/server';
import { sveltekitCookies } from 'better-auth/svelte-kit';

import { createAuth } from '@svg-table/auth/server';

export const auth = createAuth([sveltekitCookies(getRequestEvent)]);
