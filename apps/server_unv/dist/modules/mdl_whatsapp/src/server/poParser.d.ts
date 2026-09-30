export interface ParsedItem {
    itemId: string;
    name: string;
    qty: number;
    price: number;
    subtotal: number;
}
export declare class WhatsAppPOParser {
    /**
     * Ekstraksi teks pesanan dari chat WhatsApp
     */
    static parseAndCreateReceiving(params: {
        messageId: string;
        text: string;
        companyId: string;
        vendorId: string;
        outletId: string;
        senderName: string;
    }): Promise<{
        success: boolean;
        receivingId?: string;
        itemCount: number;
    }>;
}
