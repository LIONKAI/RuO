<?php

use App\Services\DirectionsTranslator;

test('route steps are translated into spanish instructions', function (array $step, string $expected) {
    expect(DirectionsTranslator::instruction($step))->toBe($expected);
})->with([
    'depart' => [['name' => 'Av. Cañoto', 'maneuver' => ['type' => 'depart']], 'Sal por Av. Cañoto'],
    'right turn' => [['name' => 'Calle Murillo', 'maneuver' => ['type' => 'turn', 'modifier' => 'right']], 'Gira a la derecha en Calle Murillo'],
    'continue' => [['name' => 'Av. Busch', 'maneuver' => ['type' => 'new name', 'modifier' => 'straight']], 'Continúa por Av. Busch'],
    'roundabout' => [['name' => 'Av. Irala', 'maneuver' => ['type' => 'roundabout', 'exit' => 2]], 'En la rotonda, toma la segunda salida hacia Av. Irala'],
    'arrive' => [['name' => '', 'maneuver' => ['type' => 'arrive']], 'Llegaste al destino'],
]);
