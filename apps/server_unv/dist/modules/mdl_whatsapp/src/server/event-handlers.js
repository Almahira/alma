// File: modules/mdl_whatsapp/src/server/event-handlers.ts
import { eq } from "drizzle-orm";
import * as schema from "./schema.js";
export const whatsappHandlers = {
    WA_CONTACT_LINKED: async (tx, event) => {
        const p = event.payload;
        await tx
            .insert(schema.waContacts)
            .values({
            id: event.aggregateId,
            companyId: p.companyId,
            name: p.name,
            phoneNumber: p.phoneNumber,
            contactType: p.contactType,
            vendorId: p.vendorId || null,
            employeeId: p.employeeId || null,
            outletId: p.outletId || null,
            isActive: true,
            updatedAt: new Date(),
        })
            .onConflictDoUpdate({
            target: schema.waContacts.id,
            set: {
                name: p.name,
                phoneNumber: p.phoneNumber,
                contactType: p.contactType,
                vendorId: p.vendorId || null,
                employeeId: p.employeeId || null,
                outletId: p.outletId || null,
                updatedAt: new Date(),
            },
        });
    },
    WA_CONTACT_ARCHIVED: async (tx, event) => {
        await tx
            .update(schema.waContacts)
            .set({ isActive: false, updatedAt: new Date() })
            .where(eq(schema.waContacts.id, event.aggregateId));
    },
    WA_CONTACT_RESTORED: async (tx, event) => {
        await tx
            .update(schema.waContacts)
            .set({ isActive: true, updatedAt: new Date() })
            .where(eq(schema.waContacts.id, event.aggregateId));
    },
    WA_GROUP_REGISTERED: async (tx, event) => {
        const p = event.payload;
        await tx
            .insert(schema.waGroups)
            .values({
            id: event.aggregateId,
            companyId: p.companyId,
            jid: p.jid,
            groupName: p.groupName,
            vendorId: p.vendorId || null,
            allowedOutletIds: p.allowedOutletIds || [],
            isAutoPoActive: p.isAutoPoActive !== false,
            isActive: true,
            updatedAt: new Date(),
        })
            .onConflictDoUpdate({
            target: schema.waGroups.id,
            set: {
                groupName: p.groupName,
                vendorId: p.vendorId || null,
                allowedOutletIds: p.allowedOutletIds || [],
                isAutoPoActive: p.isAutoPoActive !== false,
                updatedAt: new Date(),
            },
        });
    },
    WA_GROUP_UPDATED: async (tx, event) => {
        const p = event.payload;
        await tx
            .update(schema.waGroups)
            .set({
            groupName: p.groupName,
            vendorId: p.vendorId || null,
            allowedOutletIds: p.allowedOutletIds || [],
            isAutoPoActive: p.isAutoPoActive !== false,
            updatedAt: new Date(),
        })
            .where(eq(schema.waGroups.id, event.aggregateId));
    },
    WA_GROUP_ARCHIVED: async (tx, event) => {
        await tx
            .update(schema.waGroups)
            .set({ isActive: false, updatedAt: new Date() })
            .where(eq(schema.waGroups.id, event.aggregateId));
    },
    WA_GROUP_RESTORED: async (tx, event) => {
        await tx
            .update(schema.waGroups)
            .set({ isActive: true, updatedAt: new Date() })
            .where(eq(schema.waGroups.id, event.aggregateId));
    },
    WA_MESSAGE_RECORDED: async (tx, event) => {
        const p = event.payload;
        await tx
            .insert(schema.waMessages)
            .values({
            id: event.aggregateId,
            companyId: p.companyId,
            remoteJid: p.remoteJid,
            senderJid: p.senderJid,
            senderName: p.senderName || null,
            text: p.text,
            fromMe: Boolean(p.fromMe),
            isPoParsed: Boolean(p.isPoParsed),
            receivingId: p.receivingId || null,
            timestamp: new Date(p.timestamp || Date.now()),
        })
            .onConflictDoNothing();
    },
    WA_MESSAGE_PO_PARSED: async (tx, event) => {
        const p = event.payload;
        await tx
            .update(schema.waMessages)
            .set({ isPoParsed: true, receivingId: p.receivingId || null })
            .where(eq(schema.waMessages.id, event.aggregateId));
    },
};
