/**
 * This is a utility type that allows for the creation of a Partial types that span
 * more than just the first level of object fields. If a field is an object, it will
 * recursively create a Partial of that object.
 */
export type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;
