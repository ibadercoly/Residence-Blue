import { jest } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@residence-blue/shared';

describe('NotificationsService (Tests Unitaires)', () => {
  let service: NotificationsService;
  let mockPrisma: any;
  let createdRows: any[];

  beforeEach(() => {
    createdRows = [];
    mockPrisma = {
      notificationMessage: {
        create: jest.fn(async ({ data }: any) => {
          const row = {
            id: `00000000-0000-4000-8000-${String(createdRows.length + 1).padStart(12, '0')}`,
            createdAt: new Date(),
            ...data,
          };
          createdRows.push(row);
          return row;
        }),
        findMany: jest.fn(async () => createdRows),
        count: jest.fn(async () => createdRows.length),
        findUnique: jest.fn(async ({ where }: any) =>
          createdRows.find((r) => r.id === where.id) || null,
        ),
      },
      notificationRead: {
        upsert: jest.fn(async ({ create }: any) => ({ ...create })),
        createMany: jest.fn(async () => ({ count: createdRows.length })),
      },
      restaurantOrder: {
        findMany: jest.fn(async () => []),
      },
    };
    service = new NotificationsService(mockPrisma as PrismaService);
  });

  it('formate les plats avec quantités (max 2 nommés puis « et N autres plats »)', () => {
    expect(
      service.formatDishesWithQuantities([
        { name: 'Thiéboudienne royale', quantity: 1 },
      ]),
    ).toBe('1 Thiéboudienne royale');

    expect(
      service.formatDishesWithQuantities([
        { name: 'Thiéboudienne royale', quantity: 1 },
        { name: 'Yassa poulet', quantity: 2 },
        { name: 'Thiakry', quantity: 1 },
        { name: 'Bissap', quantity: 3 },
      ]),
    ).toBe('1 Thiéboudienne royale, 2 Yassa poulet et 2 autres plats');
  });

  it('génère les textes explicites sans prix ni nom pour client de passage', async () => {
    const due = new Date('2026-11-16T17:04:00.000Z');
    const later = new Date('2026-11-16T17:09:00.000Z');

    const conf = await service.notifyConfirmedWithPrepTime(
      {
        id: '11111111-1111-4111-8111-111111111111',
        ticketNumber: '#CMD-12',
        destinationType: 'ROOM',
        roomNumber: '301',
        guestName: 'M. Diop',
        items: [{ name: 'Thiéboudienne royale', quantity: 1 }],
      },
      15,
      due,
    );
    expect(conf?.title).toMatch(/^La cuisine prépare 1 Thiéboudienne royale\. Prête vers \d{2}:\d{2} \(dans 15 min\)$/);
    expect(conf?.importantAlert).toBe(false);
    expect(conf?.title).not.toMatch(/FCFA|tous les plats existent/i);

    const add = await service.notifyAddedPrepTime(
      {
        id: '11111111-1111-4111-8111-111111111111',
        ticketNumber: '#CMD-12',
        destinationType: 'TABLE',
        tableLabel: 'Table 4',
        guestName: 'Ne Jamais Afficher',
        items: [{ name: 'Thiéboudienne royale', quantity: 1 }],
      },
      due,
      later,
    );
    expect(add?.title).toMatch(/^Du temps en plus : 1 Thiéboudienne royale sera prête vers \d{2}:\d{2} au lieu de \d{2}:\d{2}$/);
    expect(add?.destinationLabel).toBe('Table 4');
    expect(add?.guestName).toBeNull();
    expect(add?.importantAlert).toBe(false);

    const missing = await service.notifyUnavailableDishes(
      {
        id: '22222222-2222-4222-8222-222222222222',
        ticketNumber: '#CMD-12',
        destinationType: 'TAKEAWAY',
        items: [{ name: 'Omelette', quantity: 1 }],
      },
      ['Omelette'],
      "plus d'œufs",
    );
    expect(missing?.title).toBe(
      "Plat manquant : Omelette n'est plus disponible. Motif : plus d'œufs. Que voulez-vous faire ?",
    );
    expect(missing?.destinationLabel).toBe('À emporter N° 12');
    expect(missing?.guestName).toBeNull();
    expect(missing?.importantAlert).toBe(true);

    const ready = await service.notifyOrderReady({
      id: '33333333-3333-4333-8333-333333333333',
      ticketNumber: '#CMD-14',
      destinationType: 'ROOM',
      roomNumber: '301',
      guestName: 'M. Diop',
      items: [{ name: 'Thiéboudiennes', quantity: 2 }],
    });
    expect(ready?.title).toBe('Prête à servir : 2 Thiéboudiennes');
    expect(ready?.importantAlert).toBe(true);

    const cancelled = await service.notifyOrderCancelled(
      {
        id: '44444444-4444-4444-8444-444444444444',
        ticketNumber: '#CMD-15',
        destinationType: 'TABLE',
        tableLabel: 'Table 2',
        items: [{ name: 'Thiakry', quantity: 1 }],
      },
      'Client parti',
    );
    expect(cancelled?.title).toBe('Commande annulée : 1 Thiakry. Motif : Client parti');
    expect(cancelled?.importantAlert).toBe(false);
  });

  it('refuse le cuisinier et les comptes sans accès Restaurant, et filtre le nom client selon les droits', async () => {
    const cook = {
      id: 'u-cook',
      role: Role.CUISINIER,
      screenAccess: { restaurant: 'AUCUN', cuisine: 'ECRITURE' },
    };
    expect(() => service.assertCanAccessNotifications(cook)).toThrow(ForbiddenException);

    const housekeeping = {
      id: 'u-hk',
      role: Role.HOUSEKEEPING,
      screenAccess: { restaurant: 'AUCUN', chambres: 'LECTURE' },
    };
    expect(() => service.assertCanAccessNotifications(housekeeping)).toThrow(ForbiddenException);

    createdRows.push({
      id: '00000000-0000-4000-8000-000000000009',
      category: 'RESTAURANT',
      type: 'PRETE',
      severity: 'SUCCESS',
      orderId: '11111111-1111-4111-8111-111111111111',
      destinationType: 'ROOM',
      roomNumber: '301',
      destinationLabel: 'Chambre 301',
      guestName: 'M. Diop',
      title: 'Prête à servir : 1 Yassa poulet',
      link: '/restaurant?highlightOrder=11111111-1111-4111-8111-111111111111',
      importantAlert: true,
      createdAt: new Date(),
      reads: [],
    });

    const restaurantWithRights = {
      id: 'u-rest',
      role: Role.RESTAURANT,
      screenAccess: { restaurant: 'ECRITURE' },
      specialPermissions: { voir_montants: true },
    };
    const resFull = await service.listForUser(restaurantWithRights);
    expect(resFull.items[0].detail).toBe('Chambre 301, M. Diop');

    const restaurantRestricted = {
      id: 'u-rest-no-guest',
      role: Role.RESTAURANT,
      screenAccess: { restaurant: 'LECTURE', clients: 'AUCUN' },
      specialPermissions: { voir_montants: false },
    };
    const resRestricted = await service.listForUser(restaurantRestricted);
    expect(resRestricted.items[0].detail).toBe('Chambre 301');
  });

  it('émet au plus une notification RETARD par commande et reste silencieuse', async () => {
    const overdueAt = new Date(Date.now() - 4 * 60_000);
    mockPrisma.restaurantOrder.findMany.mockResolvedValueOnce([
      {
        id: '55555555-5555-4555-8555-555555555555',
        ticketNumber: '#CMD-99',
        destinationType: 'TABLE',
        tableLabel: 'Table 4',
        guestName: null,
        heureFinPrevue: overdueAt,
        lines: [{ name: 'Yassa poulet', quantity: 1, isUnavailable: false }],
        room: null,
        reservation: null,
      },
    ]);
    mockPrisma.notificationMessage.findMany.mockResolvedValueOnce([]);

    const count1 = await service.checkOverdueOrders(new Date());
    expect(count1).toBe(1);
    expect(createdRows[0].title).toMatch(/^En retard de 4 min : 1 Yassa poulet devait être prêt à \d{2}:\d{2}$/);
    expect(createdRows[0].importantAlert).toBe(false);

    // Second appel : déjà notifiée -> 0 création supplémentaire
    mockPrisma.restaurantOrder.findMany.mockResolvedValueOnce([
      {
        id: '55555555-5555-4555-8555-555555555555',
        ticketNumber: '#CMD-99',
        destinationType: 'TABLE',
        tableLabel: 'Table 4',
        guestName: null,
        heureFinPrevue: overdueAt,
        lines: [{ name: 'Yassa poulet', quantity: 1, isUnavailable: false }],
        room: null,
        reservation: null,
      },
    ]);
    mockPrisma.notificationMessage.findMany.mockResolvedValueOnce([
      { orderId: '55555555-5555-4555-8555-555555555555' },
    ]);
    const count2 = await service.checkOverdueOrders(new Date());
    expect(count2).toBe(0);
  });
});
