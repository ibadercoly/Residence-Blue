"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadRealTariffsAndIdentity = loadRealTariffsAndIdentity;
const client_1 = require("@prisma/client");
const shared_1 = require("@residence-blue/shared");
async function loadRealTariffsAndIdentity(prisma) {
    const report = {
        categoriesCreated: 0,
        tariffsCreated: 0,
        extraServicesCreated: 0,
        hotelFieldsFilled: [],
        roomsClassified: 0,
        roomsMarkedUnclassified: 0,
    };
    const categoryIdByCode = new Map();
    for (const cat of shared_1.REAL_TARIFF_CATEGORIES) {
        const existing = await prisma.tariffCategory.findUnique({ where: { code: cat.code } });
        if (existing) {
            categoryIdByCode.set(cat.code, existing.id);
        }
        else {
            const created = await prisma.tariffCategory.create({
                data: {
                    code: cat.code,
                    name: cat.name,
                    displayOrder: cat.displayOrder,
                    isActive: true,
                },
            });
            categoryIdByCode.set(cat.code, created.id);
            report.categoriesCreated += 1;
        }
    }
    for (const row of shared_1.REAL_ROOM_TARIFFS) {
        const categoryId = categoryIdByCode.get(row.categoryCode);
        if (!categoryId)
            continue;
        const existing = await prisma.roomTariff.findFirst({
            where: {
                categoryId,
                guestsCount: row.guestsCount,
                roomsUsed: row.roomsUsed,
            },
        });
        if (!existing) {
            await prisma.roomTariff.create({
                data: {
                    categoryId,
                    guestsCount: row.guestsCount,
                    roomsUsed: row.roomsUsed,
                    label: row.label,
                    pricePerNightFcfa: row.pricePerNightFcfa,
                    displayOrder: row.displayOrder,
                    isActive: true,
                },
            });
            report.tariffsCreated += 1;
        }
    }
    for (const item of shared_1.REAL_EXTRA_SERVICES) {
        const existing = await prisma.extraServiceItem.findUnique({ where: { code: item.code } });
        if (!existing) {
            await prisma.extraServiceItem.create({
                data: {
                    code: item.code,
                    name: item.name,
                    unit: item.unit,
                    unitLabel: item.unitLabel,
                    priceFcfa: item.priceFcfa,
                    category: 'AUTRES',
                    displayOrder: item.displayOrder,
                    isActive: true,
                },
            });
            report.extraServicesCreated += 1;
        }
    }
    const categoriesByName = new Map();
    const allCategories = await prisma.tariffCategory.findMany();
    for (const c of allCategories) {
        categoriesByName.set(c.name.trim().toLowerCase(), { id: c.id, name: c.name });
    }
    const roomsWithoutCategory = await prisma.room.findMany({
        where: { tariffCategoryId: null },
        select: { id: true, category: true },
    });
    for (const room of roomsWithoutCategory) {
        const matched = categoriesByName.get((room.category || '').trim().toLowerCase());
        if (matched) {
            await prisma.room.update({
                where: { id: room.id },
                data: { tariffCategoryId: matched.id, category: matched.name },
            });
            report.roomsClassified += 1;
        }
        else if ((room.category || '').trim() !== shared_1.UNCLASSIFIED_ROOM_CATEGORY) {
            await prisma.room.update({
                where: { id: room.id },
                data: { category: shared_1.UNCLASSIFIED_ROOM_CATEGORY },
            });
            report.roomsMarkedUnclassified += 1;
        }
    }
    const settings = await prisma.hotelSetting.findUnique({ where: { id: 'default' } });
    if (!settings) {
        await prisma.hotelSetting.create({
            data: {
                id: 'default',
                hotelName: shared_1.REAL_HOTEL_IDENTITY.hotelName,
                city: shared_1.REAL_HOTEL_IDENTITY.city,
                neighborhood: shared_1.REAL_HOTEL_IDENTITY.neighborhood,
                postalCode: shared_1.REAL_HOTEL_IDENTITY.postalCode,
                country: shared_1.REAL_HOTEL_IDENTITY.country,
                fullAddress: shared_1.REAL_HOTEL_IDENTITY.fullAddress,
                ninea: shared_1.REAL_HOTEL_IDENTITY.ninea,
                supportPhone: shared_1.REAL_HOTEL_IDENTITY.supportPhone,
                secondaryPhones: shared_1.REAL_HOTEL_IDENTITY.secondaryPhones,
                supportEmail: shared_1.REAL_HOTEL_IDENTITY.supportEmail,
                website: shared_1.REAL_HOTEL_IDENTITY.website,
            },
        });
        report.hotelFieldsFilled.push('hotelName', 'city', 'neighborhood', 'postalCode', 'country', 'fullAddress', 'ninea', 'supportPhone', 'secondaryPhones', 'supportEmail', 'website');
    }
    else {
        const patch = {};
        const fillIfEmpty = (field, currentValue) => {
            if (!currentValue || currentValue.trim().length === 0) {
                patch[field] = shared_1.REAL_HOTEL_IDENTITY[field];
                report.hotelFieldsFilled.push(field);
            }
        };
        fillIfEmpty('hotelName', settings.hotelName);
        fillIfEmpty('city', settings.city);
        fillIfEmpty('neighborhood', settings.neighborhood);
        fillIfEmpty('postalCode', settings.postalCode);
        fillIfEmpty('country', settings.country);
        fillIfEmpty('fullAddress', settings.fullAddress);
        fillIfEmpty('ninea', settings.ninea);
        fillIfEmpty('supportPhone', settings.supportPhone);
        fillIfEmpty('secondaryPhones', settings.secondaryPhones);
        fillIfEmpty('supportEmail', settings.supportEmail);
        fillIfEmpty('website', settings.website);
        if (Object.keys(patch).length > 0) {
            await prisma.hotelSetting.update({
                where: { id: 'default' },
                data: patch,
            });
        }
    }
    return report;
}
if (require.main === module) {
    const client = new client_1.PrismaClient();
    loadRealTariffsAndIdentity(client)
        .then((report) => {
        console.log('[TARIFS] Chargement idempotent terminé :', JSON.stringify(report));
    })
        .catch((err) => {
        console.error('[TARIFS] Erreur chargement tarifs réels :', err);
        process.exitCode = 1;
    })
        .finally(async () => {
        await client.$disconnect();
    });
}
//# sourceMappingURL=load-real-tariffs.js.map