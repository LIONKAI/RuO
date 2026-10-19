<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreVehicleRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()?->isAdmin() ?? false;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $vehicle = $this->route('vehicle');

        return [
            'name' => ['required', 'string', 'max:80'],
            'plate' => ['required', 'string', 'max:20', Rule::unique('vehicles', 'plate')->ignore($vehicle)],
            'fuel_liters_per_km' => ['required', 'numeric', 'between:0.01,1'],
            'driver_id' => [
                'nullable',
                'exists:users,id',
                Rule::unique('vehicles', 'driver_id')->ignore($vehicle),
            ],
            'depot_address' => ['nullable', 'string', 'max:255'],
            'depot_latitude' => ['nullable', 'required_with:depot_address', 'numeric', 'between:-90,90'],
            'depot_longitude' => ['nullable', 'required_with:depot_address', 'numeric', 'between:-180,180'],
        ];
    }

    /**
     * Get custom attributes for validator errors.
     *
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'name' => 'nombre',
            'plate' => 'placa',
            'fuel_liters_per_km' => 'consumo',
            'driver_id' => 'chofer',
            'depot_address' => 'dirección del depósito',
            'depot_latitude' => 'punto del depósito',
            'depot_longitude' => 'punto del depósito',
        ];
    }

    /**
     * Get the error messages for the defined validation rules.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'required' => 'El/La :attribute es obligatorio/a.',
            'unique' => 'Ese :attribute ya está registrado/a.',
            'exists' => 'El :attribute elegido no existe.',
            'required_with' => 'Marca el depósito en el mapa o deja la dirección vacía.',
            'between' => 'El/La :attribute no es válido/a.',
            'numeric' => 'El/La :attribute no es válido/a.',
            'max' => 'El/La :attribute no puede tener más de :max caracteres.',
        ];
    }
}
