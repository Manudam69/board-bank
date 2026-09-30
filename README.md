# BoardBank

BoardBank es una banca digital compartida para llevar las cuentas de una partida de Monopoly desde el móvil. Los jugadores siguen usando el tablero y los dados físicos; la aplicación registra las operaciones que introducen y sincroniza los saldos, las propiedades y el historial en tiempo real.

## Qué puedes hacer

- Crear una sala, elegir una edición y compartir el código de cinco caracteres, el enlace o el código QR. Se admiten hasta 8 jugadores.
- Unirse a una sala sin crear una cuenta, con un nombre de jugador y autenticación anónima de Firebase.
- Registrar transferencias entre jugadores o con el Banco, pagos y cobros del Banco, sueldo al pasar por la salida, impuestos y fianza de la cárcel.
- Consultar las propiedades disponibles y registrar compras, alquileres, hipotecas, deshipotecas, construcción o venta de casas y hoteles.
- Proponer intercambios de dinero y propiedades; los demás jugadores pueden aceptarlos o rechazarlos.
- Consultar los saldos, las propiedades de cada jugador y el registro de movimientos sincronizado. Algunas operaciones recientes pueden deshacerse por quien las realizó, mientras sigan siendo reversibles.
- Declarar bancarrota, liquidar activos y, como anfitrión, finalizar la partida. Al terminar, se muestra una clasificación final y el historial.
- Elegir entre ediciones predefinidas (Monopoly Clásico de España, Clásico de USA, Millonario y Banco Electrónico) o crear y editar ediciones propias con moneda, importes y propiedades personalizados.

BoardBank no tira los dados, mueve fichas ni detecta automáticamente el paso por casillas o la bancarrota: los jugadores registran esas operaciones manualmente. La app sirve como banca y libro de cuentas, no como sustituto del tablero.

## Configuración

Necesitas Node.js y npm. Para usar la aplicación con Firebase:

1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com/).
2. Habilita Firestore Database y Authentication con el proveedor de inicio de sesión anónimo.
3. Sustituye los valores de ejemplo de `src/environments/firebase.ts` por la configuración de tu proyecto.
4. Publica en Firestore las reglas del archivo `firestore.rules`.

La aplicación necesita autenticación anónima y permisos de lectura y escritura en Firestore. Si aparece «Missing or insufficient permissions», comprueba que has publicado las reglas y habilitado la autenticación anónima.

## Desarrollo

Instala las dependencias e inicia el servidor local:

```bash
npm install
npm start
```

Abre `http://localhost:4200/`. Para compilar y ejecutar las pruebas unitarias:

```bash
npm run build
npm test -- --watch=false
```

El proyecto utiliza Angular 22 y Vitest.
