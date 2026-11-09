export function Injectable() {
  return (target: unknown) => target;
}

export function Component() {
  return (target: unknown) => target;
}

export function inject<T>(token: new (...args: unknown[]) => T): T {
  return new token();
}

export function effect(fn: () => void) {
  fn();
  return { destroy: () => {} };
}

export interface WritableSignal<T> {
  (): T;
  set(value: T): void;
  update(updateFn: (value: T) => T): void;
  asReadonly(): () => T;
}

export function signal<T>(initialValue: T): WritableSignal<T> {
  let current = initialValue;
  const sig = (() => current) as WritableSignal<T>;
  sig.set = (val: T) => {
    current = val;
  };
  sig.update = (fn: (val: T) => T) => {
    current = fn(current);
  };
  sig.asReadonly = () => (() => current);
  return sig;
}

export function computed<T>(computation: () => T): () => T {
  return () => computation();
}

export function input<T>(defaultValue?: T) {
  return () => defaultValue as T;
}
input.required = <T>() => (() => undefined as unknown as T);

export function Input(options?: unknown) {
  return (target: unknown, propertyKey?: string) => {};
}

export function Output(bindingPropertyName?: string) {
  return (target: unknown, propertyKey?: string) => {};
}

export class EventEmitter<T = unknown> {
  emit(value?: T) {}
  subscribe(next?: (value: T) => void) {
    return { unsubscribe: () => {} };
  }
}

export function isDevMode(): boolean {
  return true;
}
