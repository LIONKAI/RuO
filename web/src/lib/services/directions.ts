// Convierte pasos de OSRM en instrucciones cortas de manejo en español.
// Port de App\Services\DirectionsTranslator.

interface OsrmStep {
    maneuver?: { type?: string; modifier?: string; exit?: number };
    name?: string;
    distance?: number;
}

const turn = (modifier: string): string =>
    ({
        uturn: 'Da la vuelta en U',
        'sharp right': 'Gira bruscamente a la derecha',
        right: 'Gira a la derecha',
        'slight right': 'Mantente a la derecha',
        'sharp left': 'Gira bruscamente a la izquierda',
        left: 'Gira a la izquierda',
        'slight left': 'Mantente a la izquierda',
    })[modifier] ?? 'Sigue derecho';

const ordinal = (exit: number): string =>
    ({ 1: 'primera', 2: 'segunda', 3: 'tercera', 4: 'cuarta', 5: 'quinta' })[exit] ?? `${exit}.ª`;

export function instruction(step: OsrmStep): string {
    const type = step.maneuver?.type ?? 'continue';
    const modifier = step.maneuver?.modifier ?? 'straight';
    const street = (step.name ?? '').trim();
    const onStreet = street !== '' ? ` por ${street}` : '';
    const intoStreet = street !== '' ? ` en ${street}` : '';

    switch (type) {
        case 'depart':
            return 'Sal' + (street !== '' ? ` por ${street}` : ' hacia el destino');
        case 'arrive':
            return 'Llegaste al destino';
        case 'roundabout':
        case 'rotary':
            return `En la rotonda, toma la ${ordinal(step.maneuver?.exit ?? 1)} salida${street !== '' ? ` hacia ${street}` : ''}`;
        case 'continue':
        case 'new name':
        case 'notification':
            return modifier === 'straight' || modifier === ''
                ? `Continúa${onStreet}`
                : turn(modifier) + intoStreet;
        default:
            return turn(modifier) + intoStreet;
    }
}
