export function getOptionalEnv(name: string) {
  const value = process.env[name];

  if (!value || value.trim().length === 0) {
    return undefined;
  }

  return value;
}

export function hasRequiredEnv(names: readonly string[]) {
  return names.every((name) => Boolean(getOptionalEnv(name)));
}
