import { PrismaClient } from '@prisma/client';
export interface RealTariffsLoadReport {
    categoriesCreated: number;
    tariffsCreated: number;
    extraServicesCreated: number;
    hotelFieldsFilled: string[];
    roomsClassified: number;
    roomsMarkedUnclassified: number;
}
export declare function loadRealTariffsAndIdentity(prisma: PrismaClient): Promise<RealTariffsLoadReport>;
