import { Injectable, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { DashboardData } from '../models/dashboard.model';

@Injectable({
  providedIn: 'root'
})
export class DashboardMockService {
  // TODO(API): Remplacer les valeurs fictives par l'API météo de Thiès et l'API de gestion hôtelière
  private readonly mockData: DashboardData = {
    user: {
      name: 'Aïssatou Ba',
      role: 'Directrice Générale'
    },
    hero: {
      seasonTag: 'Haute saison • 9 chambres occupées sur 12',
      weatherTag: 'Grand Standing, Thiès • 29°C Ensoleillé',
      title: 'Bienvenue à la Résidence Blue',
      subtitle: 'Boutique Hôtel 12 Chambres • Grand Standing, Thiès • Vendredi 24 Mai • Service Conciergerie & Exploitation',
      imageUrl: 'assets/images/hero-dashboard.webp'
    },
    kpis: {
      occupancyRate: {
        value: 75,
        changeLabel: '+5% vs hier',
        targetLabel: 'Objectif mensuel: 80%',
        activeKeysLabel: '9 clés actives'
      },
      occupiedRooms: {
        occupied: 9,
        total: 12,
        availableBadge: '3 Disponibles',
        detailLabel: '2 en recouche • 1 prête'
      },
      todayRevenue: {
        amount: 485000,
        currency: 'FCFA',
        lodgingAmount: 395000,
        restaurantAmount: 90000
      },
      keyMovements: {
        checkIns: 2,
        checkOuts: 1,
        label: 'Entrées / Sorties',
        detailLabel: '1 départ réglé • 2 arrivées à suivre'
      }
    },
    weeklyRevenue: {
      weekLabel: 'Semaine 21',
      title: 'Revenus de la semaine',
      totalEstimated: 3465000,
      currency: 'FCFA',
      averageRate: 'Taux moyen semaine : 78.4%',
      days: [
        { day: 'Lun', amountLabel: '420k', heightPercent: 67 },
        { day: 'Mar', amountLabel: '380k', heightPercent: 61 },
        { day: 'Mer', amountLabel: '510k', heightPercent: 82 },
        { day: 'Jeu', amountLabel: '460k', heightPercent: 74 },
        { day: 'Ven', amountLabel: '485k', heightPercent: 78, isToday: true },
        { day: 'Sam', amountLabel: '620k*', heightPercent: 100, isConfirmed: true },
        { day: 'Dim', amountLabel: '590k*', heightPercent: 95, isConfirmed: true }
      ]
    },
    arrivals: [
      {
        id: 'guest-1',
        initials: 'MD',
        name: 'M. Mamadou Diop',
        badge: 'VIP Gold',
        badgeIcon: 'workspace_premium',
        room: 'Suite Panoramique (Ch. 301)',
        nights: '3 nuits',
        arrivalTime: 'Arrivée prévue 14h30',
        colorVariant: 'primary'
      },
      {
        id: 'guest-2',
        initials: 'CL',
        name: 'Mme Claire Lefèvre',
        badge: 'Navette aéroport confirmée',
        badgeIcon: 'directions_car',
        room: 'Deluxe Balcon (Ch. 201)',
        nights: '2 nuits',
        arrivalTime: 'Arrivée prévue 16h00',
        colorVariant: 'tertiary'
      }
    ],
    priorityAlerts: [
      {
        id: 'alert-1',
        category: 'Stock Épicerie • Alerte',
        meta: 'Il y a 30m',
        title: 'Café Touba & Vins de réserve bas',
        description: 'Seuil critique atteint au Bar Teranga. Réapprovisionnement nécessaire avant le service du dîner.',
        buttonLabel: 'Commander',
        buttonIcon: 'shopping_cart',
        variant: 'warning'
      },
      {
        id: 'alert-2',
        category: 'Technique • Urgent',
        meta: 'Ch. 302',
        title: 'Climatisation Suite Panoramique',
        description: 'Dysfonctionnement signalé ce matin. Technicien froid convoqué sur place pour 15h00.',
        buttonLabel: 'Suivre le ticket',
        buttonIcon: 'build',
        variant: 'urgent'
      },
      {
        id: 'alert-3',
        category: 'Facturation en suspens',
        meta: '145 000 FCFA',
        title: 'Folios en attente de clôture',
        description: 'Règlements extras piscine & restaurant pour Ch. 103 (M. Diallo) et Ch. 202 (Mme Ndiaye).',
        buttonLabel: 'Voir folios',
        buttonIcon: 'visibility',
        variant: 'info'
      }
    ],
    thiesWeather: {
      title: 'Climat & Espaces Extérieurs',
      locationBadge: 'Grand Standing',
      temperature: '29°C Ensoleillé',
      uvIndex: 'Modéré (6)',
      poolTemp: '28°C',
      wind: '12 km/h E',
      note: 'Transats & parasols installés autour de la piscine et du patio'
    },
    marineWeather: {
      title: 'Climat & Espaces Extérieurs',
      locationBadge: 'Grand Standing',
      tideTime: '29°C Ensoleillé',
      coefficient: 'Modéré (6)',
      waterTemp: '28°C',
      wind: '12 km/h E',
      note: 'Transats & parasols installés autour de la piscine et du patio'
    }
  };

  readonly data = signal<DashboardData>(this.mockData);

  getDashboardData(): Observable<DashboardData> {
    return of(this.mockData);
  }
}
