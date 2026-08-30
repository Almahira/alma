import { NatsConnection, JetStreamManager, JetStreamClient } from "nats";
export declare let nc: NatsConnection;
export declare let jsm: JetStreamManager;
export declare let js: JetStreamClient;
export declare const sc: import("nats").Codec<string>;
export declare function initNATS(): Promise<void>;
export declare function publishEvent(subject: string, payload: any): Promise<void>;
