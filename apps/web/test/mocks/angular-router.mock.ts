export class NavigationEnd {
  constructor(public id = 1, public url = '', public urlAfterRedirects = '') {}
}

export class RouterLink {}
export class RouterLinkActive {}
export class RouterOutlet {}

export class Router {
  url = '/connexion';
  events = {
    subscribe: (fn?: (event: unknown) => void) => ({ unsubscribe: () => {} }),
    pipe: () => ({ subscribe: (fn?: (event: unknown) => void) => ({ unsubscribe: () => {} }) })
  };
  navigate = (commands: string[]) => Promise.resolve(true);
}

export type Routes = Array<Record<string, unknown>>;
