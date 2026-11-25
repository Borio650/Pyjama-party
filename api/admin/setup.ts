import type { IncomingMessage, ServerResponse } from 'http';
import { handleSetup } from '../_lib/adminAuth.js';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await handleSetup(req, res);
}
