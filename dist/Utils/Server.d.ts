import { Application } from 'express';
import https from 'https';
import http from 'http';
import { SslConfig } from '../types/shared';
declare class Server {
    app: Application;
    server: http.Server | https.Server | false;
    ssl: SslConfig | false;
    constructor(useHttps: boolean | undefined, ssl: SslConfig | false, ENCRYPTIONKEY: string, corsOpt: boolean | undefined, serverAddon?: (app: Application) => void);
    listen(port: number): Promise<boolean>;
    setStaticPath(path: string): void;
    close(): void;
}
export = Server;
//# sourceMappingURL=Server.d.ts.map