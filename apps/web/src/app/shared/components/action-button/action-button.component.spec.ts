import { ActionButtonComponent } from './action-button.component';

describe('ActionButtonComponent', () => {
  let component: ActionButtonComponent;

  beforeEach(() => {
    component = new ActionButtonComponent();
  });

  it('devrait émettre l’événement action au clic si non désactivé', () => {
    let emitted = false;
    component.action.subscribe(() => {
      emitted = true;
    });

    (component as any).disabled = () => false;
    component.onClick({ type: 'click' } as unknown as MouseEvent);
    expect(emitted).toBe(true);
  });

  it('ne devrait pas émettre l’événement action au clic si désactivé', () => {
    let emitted = false;
    component.action.subscribe(() => {
      emitted = true;
    });

    (component as any).disabled = () => true;
    component.onClick({ type: 'click' } as unknown as MouseEvent);
    expect(emitted).toBe(false);
  });
});
