import { ModalShellComponent } from './modal-shell.component';

describe('ModalShellComponent', () => {
  let component: ModalShellComponent;

  beforeEach(() => {
    component = new ModalShellComponent();
  });

  afterEach(() => {
    component.ngOnDestroy();
  });

  it('devrait être instancié avec les valeurs par défaut', () => {
    expect(component).toBeTruthy();
    expect(component.isOpen()).toBe(false);
    expect(component.maxWidth()).toBe('960px');
    expect(component.maxHeight()).toBe('88dvh');
    expect(component.containerMaxWidth()).toBe('min(960px, calc(100vw - 32px))');
    expect(component.containerMaxHeight()).toBe('88dvh');
  });

  it('devrait émettre closed lors de requestClose()', () => {
    let closedEmitted = false;
    component.closed.subscribe(() => {
      closedEmitted = true;
    });

    component.requestClose();
    expect(closedEmitted).toBe(true);
  });

  it('devrait émettre closed lors du clic sur le backdrop si closeOnBackdrop est true', () => {
    let closedEmitted = false;
    component.closed.subscribe(() => {
      closedEmitted = true;
    });

    const target = document.createElement('div');
    const mockEvent = {
      target,
      currentTarget: target
    } as unknown as MouseEvent;

    component.onBackdropClick(mockEvent);
    expect(closedEmitted).toBe(true);
  });

  it('ne devrait pas émettre closed lors du clic sur le contenu si target !== currentTarget', () => {
    let closedEmitted = false;
    component.closed.subscribe(() => {
      closedEmitted = true;
    });

    const currentTarget = document.createElement('div');
    const target = document.createElement('div');
    currentTarget.appendChild(target);

    const mockEvent = {
      target,
      currentTarget
    } as unknown as MouseEvent;

    component.onBackdropClick(mockEvent);
    expect(closedEmitted).toBe(false);
  });
});
