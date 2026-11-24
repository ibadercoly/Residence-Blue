import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { ReservationModalService } from '../services/reservation-modal.service';

export const notFoundCanMatch: CanMatchFn = () => {
  inject(ReservationModalService).showFeedback('Page introuvable');
  return inject(Router).createUrlTree(['/tableau-de-bord']);
};
