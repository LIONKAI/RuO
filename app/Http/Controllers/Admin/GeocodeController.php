<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\Geocoder;
use App\Services\RoutingServiceException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GeocodeController extends Controller
{
    /**
     * Locate an address so the admin can confirm the point on the map.
     */
    public function __invoke(Request $request, Geocoder $geocoder): JsonResponse
    {
        $validated = $request->validate(['address' => ['required', 'string', 'max:255']]);

        try {
            $location = $geocoder->geocode($validated['address']);
        } catch (RoutingServiceException $exception) {
            return response()->json(['message' => $exception->getMessage()], 503);
        }

        if ($location === null) {
            return response()->json(['message' => 'No encontramos esa dirección. Marca el punto haciendo clic en el mapa.'], 404);
        }

        return response()->json($location);
    }
}
