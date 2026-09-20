export function mapFirebaseError(error: unknown): string {
  const e = error as { code?: string; message?: string };
  const code = e.code ?? '';

  if (code === 'permission-denied') {
    return 'Permiso denegado en Firestore: publica las reglas abiertas en Firebase Console (pestaña Rules).';
  }
  if (code === 'unauthenticated' || code === 'auth/invalid-api-key' || code === 'auth/invalid-user-token') {
    return 'Autenticación fallida: verifica Anonymous Auth en Firebase Console y las credenciales en src/environments/firebase.ts.';
  }
  if (code === 'auth/configuration-not-found' || code === 'auth/operation-not-allowed') {
    return 'Autenticación anónima no habilitada en Firebase Console.';
  }
  if (code === 'failed-precondition') {
    return 'La base de datos Firestore no existe o no está lista: créala en Firebase Console.';
  }
  if (code === 'not-found') {
    return 'Recurso no encontrado en Firestore.';
  }
  if (code === 'resource-exhausted') {
    return 'Límite de Firebase alcanzado. Reintenta en unos segundos.';
  }

  const message = e.message ?? '';
  if (message.includes('Missing or insufficient permissions')) {
    return 'Permiso denegado en Firestore: publica las reglas abiertas en Firebase Console.';
  }

  return message || 'Ocurrió un error inesperado. Revisa la consola.';
}
