import type { Request, Response } from 'express';

type VercelHandler = (req: Request, res: Response) => void;

import app from '../src/server';

export default app as unknown as VercelHandler;
