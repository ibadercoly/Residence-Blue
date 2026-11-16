import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';

@Injectable()
export class SessionRevocationService {
  private readonly revokedUserSubject = new Subject<string>();

  notifyUserRevoked(userId: string): void {
    if (userId) {
      this.revokedUserSubject.next(userId);
    }
  }

  onUserRevoked(userId: string): Observable<void> {
    return this.revokedUserSubject.asObservable().pipe(
      filter((revokedId) => revokedId === userId),
      map(() => undefined),
    );
  }
}
