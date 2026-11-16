export type NotificationCategory = 'RESTAURANT' | 'HOUSEKEEPING';

export type NotificationSeverity = 'INFO' | 'WARNING' | 'CRITICAL' | 'SUCCESS';

export type RestaurantNotificationType =
  | 'PLAT_CONFIRME_TEMPS'
  | 'TEMPS_AJOUTE'
  | 'PLAT_MANQUANT'
  | 'PRETE'
  | 'RETARD'
  | 'COMMANDE_ANNULEE';

export interface AppNotificationDto {
  id: string;
  category: NotificationCategory;
  type: RestaurantNotificationType | string;
  severity: NotificationSeverity;
  /** Ligne 1 : ce qui se passe (nom des plats + action/heure, jamais de prix). */
  title: string;
  /** Ligne 2 : POUR QUI (« Chambre 301, M. Diop », « Table 4 » ou « À emporter N° 12 »). */
  detail: string;
  orderId?: string | null;
  roomNumber?: string | null;
  /** Route cible lors du clic sur la carte (ex. /restaurant?highlightOrder=...). */
  link: string;
  importantAlert: boolean;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsListResponse {
  items: AppNotificationDto[];
  unreadCount: number;
  totalLast24h: number;
}

export type NotificationStreamEventType =
  | 'NOTIFICATION_CREATED'
  | 'NOTIFICATION_READ'
  | 'NOTIFICATIONS_READ_ALL'
  | 'HEARTBEAT';

export interface NotificationStreamEvent {
  eventId?: number;
  type: NotificationStreamEventType;
  notification?: AppNotificationDto;
  notificationId?: string;
  readAt?: string;
  timestamp: string;
}
