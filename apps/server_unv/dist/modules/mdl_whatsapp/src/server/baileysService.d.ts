import { Server } from "socket.io";
export declare class WhatsAppService {
    private static instance;
    private sock;
    private io;
    private status;
    private qrCode;
    private phone;
    private authDir;
    private mediaDir;
    private isConnecting;
    private constructor();
    static getInstance(): WhatsAppService;
    attachSocketIO(io: Server): void;
    getStatus(): {
        status: "DISCONNECTED" | "CONNECTED" | "SCAN_QR";
        qrCode: string | null;
        phoneNumber: string | null;
    };
    initIfSessionExists(): Promise<void>;
    init(): Promise<void>;
    sendMessage(targetJid: string, text: string): Promise<any>;
    private broadcastStatus;
}
export declare const globalWhatsAppService: WhatsAppService;
