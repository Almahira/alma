export declare const serverRateLimiter: (limit: number, windowMs: number) => (req: any, res: any, next: any) => any;
export declare const serverBackpressureGuard: (req: any, res: any, next: any) => any;
