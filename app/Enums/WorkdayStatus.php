<?php

namespace App\Enums;

enum WorkdayStatus: string
{
    case Draft = 'draft';
    case InProgress = 'in_progress';
    case Completed = 'completed';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Sin iniciar',
            self::InProgress => 'En ruta',
            self::Completed => 'Completado',
        };
    }
}
