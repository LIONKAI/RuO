<?php

namespace App\Enums;

enum DestinationStatus: string
{
    case Pending = 'pending';
    case Completed = 'completed';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Pendiente',
            self::Completed => 'Completado',
        };
    }
}
