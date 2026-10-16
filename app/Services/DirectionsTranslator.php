<?php

namespace App\Services;

/**
 * Converts OSRM route steps into short Spanish driving instructions.
 */
class DirectionsTranslator
{
    /**
     * @param  array<string, mixed>  $step
     */
    public static function instruction(array $step): string
    {
        $type = $step['maneuver']['type'] ?? 'continue';
        $modifier = $step['maneuver']['modifier'] ?? 'straight';
        $street = trim((string) ($step['name'] ?? ''));
        $onStreet = $street !== '' ? " por {$street}" : '';
        $intoStreet = $street !== '' ? " en {$street}" : '';

        return match ($type) {
            'depart' => 'Sal'.($street !== '' ? " por {$street}" : ' hacia el destino'),
            'arrive' => 'Llegaste al destino',
            'roundabout', 'rotary' => 'En la rotonda, toma la '.self::ordinal((int) ($step['maneuver']['exit'] ?? 1)).' salida'.($street !== '' ? " hacia {$street}" : ''),
            'continue', 'new name', 'notification' => $modifier === 'straight' || $modifier === ''
                ? 'Continúa'.$onStreet
                : self::turn($modifier).$intoStreet,
            default => self::turn($modifier).$intoStreet,
        };
    }

    protected static function turn(string $modifier): string
    {
        return match ($modifier) {
            'uturn' => 'Da la vuelta en U',
            'sharp right' => 'Gira bruscamente a la derecha',
            'right' => 'Gira a la derecha',
            'slight right' => 'Mantente a la derecha',
            'sharp left' => 'Gira bruscamente a la izquierda',
            'left' => 'Gira a la izquierda',
            'slight left' => 'Mantente a la izquierda',
            default => 'Sigue derecho',
        };
    }

    protected static function ordinal(int $exit): string
    {
        return match ($exit) {
            1 => 'primera',
            2 => 'segunda',
            3 => 'tercera',
            4 => 'cuarta',
            5 => 'quinta',
            default => "{$exit}.ª",
        };
    }
}
