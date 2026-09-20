export function cleanFirestoreData<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => cleanFirestoreData(item)) as unknown as T;
  }

  if (typeof value === 'object') {
    if (Object.getPrototypeOf(value as object) !== Object.prototype) {
      return value;
    }

    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      if (val === undefined) {
        continue;
      }
      result[key] = cleanFirestoreData(val);
    }
    return result as T;
  }

  return value;
}
