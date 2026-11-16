import { Injectable, inject } from '@angular/core';
import {
  Role,
  ScreenAccessMap,
  SpecialPermissionsMap,
  StarterProfileKey,
} from '@residence-blue/shared';
import { AuthService } from '../../core/services/auth.service';

export interface ManagedAccount {
  id: string;
  email: string;
  fullName: string;
  jobTitle?: string;
  role: Role;
  isActive: boolean;
  isPrimaryAdmin: boolean;
  isProtectedDirector: boolean;
  mustChangePassword: boolean;
  starterProfile: StarterProfileKey | string;
  screenAccess: ScreenAccessMap;
  specialPermissions: SpecialPermissionsMap;
  totpEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProvisionedAccountResponse {
  account: ManagedAccount;
  provisionalPassword: string;
}

export interface CreateManagedAccountPayload {
  fullName: string;
  email: string;
  starterProfile: StarterProfileKey;
  screenAccess: ScreenAccessMap;
  specialPermissions: SpecialPermissionsMap;
}

export interface UpdateManagedAccountPayload {
  fullName?: string;
  email?: string;
  starterProfile?: StarterProfileKey;
  screenAccess?: ScreenAccessMap;
  specialPermissions?: SpecialPermissionsMap;
}

@Injectable({
  providedIn: 'root',
})
export class AdministrationService {
  private readonly authService = inject(AuthService);

  private async handleResponse<T>(res: Response, fallbackMsg: string): Promise<T> {
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const message =
        typeof data?.message === 'string'
          ? data.message
          : Array.isArray(data?.message)
            ? data.message[0]
            : fallbackMsg;
      throw new Error(message || fallbackMsg);
    }
    return data as T;
  }

  async listAccounts(search?: string): Promise<ManagedAccount[]> {
    const query = search?.trim()
      ? `?search=${encodeURIComponent(search.trim())}`
      : '';
    const res = await this.authService.authenticatedFetch(
      `/api/administration/comptes${query}`,
    );
    return this.handleResponse<ManagedAccount[]>(
      res,
      'Impossible de charger la liste des comptes.',
    );
  }

  async getAccount(id: string): Promise<ManagedAccount> {
    const res = await this.authService.authenticatedFetch(
      `/api/administration/comptes/${encodeURIComponent(id)}`,
    );
    return this.handleResponse<ManagedAccount>(res, 'Compte introuvable.');
  }

  async createAccount(
    payload: CreateManagedAccountPayload,
  ): Promise<ProvisionedAccountResponse> {
    const res = await this.authService.authenticatedFetch('/api/administration/comptes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return this.handleResponse<ProvisionedAccountResponse>(
      res,
      'Impossible de créer ce compte.',
    );
  }

  async updateAccount(
    id: string,
    payload: UpdateManagedAccountPayload,
  ): Promise<ManagedAccount> {
    const res = await this.authService.authenticatedFetch(
      `/api/administration/comptes/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );
    return this.handleResponse<ManagedAccount>(
      res,
      'Impossible d’enregistrer les modifications.',
    );
  }

  async resetPassword(id: string): Promise<ProvisionedAccountResponse> {
    const res = await this.authService.authenticatedFetch(
      `/api/administration/comptes/${encodeURIComponent(id)}/reinitialiser-mot-de-passe`,
      { method: 'POST' },
    );
    return this.handleResponse<ProvisionedAccountResponse>(
      res,
      'Impossible de réinitialiser le mot de passe.',
    );
  }

  async deactivateAccount(id: string): Promise<ManagedAccount> {
    const res = await this.authService.authenticatedFetch(
      `/api/administration/comptes/${encodeURIComponent(id)}/desactiver`,
      { method: 'POST' },
    );
    return this.handleResponse<ManagedAccount>(
      res,
      'Impossible de désactiver ce compte.',
    );
  }

  async reactivateAccount(id: string): Promise<ManagedAccount> {
    const res = await this.authService.authenticatedFetch(
      `/api/administration/comptes/${encodeURIComponent(id)}/reactiver`,
      { method: 'POST' },
    );
    return this.handleResponse<ManagedAccount>(
      res,
      'Impossible de réactiver ce compte.',
    );
  }

  async deleteAccount(
    id: string,
    confirmName: string,
    directorPassword: string,
  ): Promise<{ deleted: boolean; deletedDisplayName: string }> {
    const res = await this.authService.authenticatedFetch(
      `/api/administration/comptes/${encodeURIComponent(id)}/supprimer`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmName, directorPassword }),
      },
    );
    return this.handleResponse<{ deleted: boolean; deletedDisplayName: string }>(
      res,
      'Impossible de supprimer ce compte.',
    );
  }

  async updateDirectorCredentials(payload: {
    currentPassword: string;
    totpCode?: string;
    email?: string;
    newPassword?: string;
  }): Promise<{ user: ManagedAccount; otherSessionsRevoked: number }> {
    const res = await this.authService.authenticatedFetch(
      '/api/administration/directeur/identifiants',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );
    return this.handleResponse<{ user: ManagedAccount; otherSessionsRevoked: number }>(
      res,
      'Impossible de modifier vos identifiants.',
    );
  }
}
