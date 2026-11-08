export function Injectable() {
  return (target: unknown) => target;
}

export function Component() {
  return (target: unknown) => target;
}

export function inject<T>(token: new () => T): T {
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
  return sig;
}

export function computed<T>(computation: () => T): () => T {
  return () => computation();
}

export function input<T>(defaultValue?: T) {
  return () => defaultValue as T;
}
input.required = <T>() => (() => undefined as unknown as T);
