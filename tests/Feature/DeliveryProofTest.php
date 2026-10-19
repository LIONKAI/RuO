<?php

use App\Enums\DestinationStatus;
use App\Enums\WorkdayStatus;
use App\Models\Destination;
use App\Models\User;
use App\Models\Vehicle;
use Database\Seeders\RuoSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake('public');

    $this->seed(RuoSeeder::class);
    $this->admin = User::firstWhere('email', 'admin@ruo.com');
    $this->driver = User::firstWhere('email', 'chofer1@ruo.com');
    $this->vehicle = Vehicle::firstWhere('plate', 'ABC-123');
    $this->workday = workdayWithTestDestinations($this->vehicle);

    fakeOsrmTrip();
    $this->actingAs($this->admin)->post(route('admin.route.store', $this->vehicle));
    $this->workday->refresh();
});

test('the driver completes a destination with photo, signature and recipient', function () {
    $destination = $this->workday->destinations->first();
    $signature = 'data:image/png;base64,'.base64_encode('fake-png-bytes');

    $this->actingAs($this->driver)->post(route('driver.destinations.complete', $destination), [
        'recipient_name' => 'María Flores',
        'note' => 'Entregado en recepción',
        'photo' => UploadedFile::fake()->image('entrega.jpg'),
        'signature' => $signature,
        'latitude' => -17.779,
        'longitude' => -63.189,
    ]);

    $destination->refresh();

    expect($destination->status)->toBe(DestinationStatus::Completed)
        ->and($destination->recipient_name)->toBe('María Flores')
        ->and($destination->pod_note)->toBe('Entregado en recepción')
        ->and($destination->delivered_latitude)->toBe(-17.779)
        ->and($destination->pod_photo_path)->not->toBeNull()
        ->and($destination->pod_signature_path)->toBe("pod/{$destination->id}/firma.png");

    Storage::disk('public')->assertExists($destination->pod_photo_path);
    Storage::disk('public')->assertExists($destination->pod_signature_path);
});

test('the driver reports a failed delivery with a reason', function () {
    $destination = $this->workday->destinations->first();

    $this->actingAs($this->driver)
        ->postJson(route('driver.destinations.fail', $destination), ['reason' => 'ausente'])
        ->assertOk()
        ->assertJson(['finished' => false]);

    $destination->refresh();

    expect($destination->status)->toBe(DestinationStatus::Failed)
        ->and($destination->failure_reason)->toBe('Cliente ausente');
});

test('a failed delivery counts as finished for the workday', function () {
    $destinations = $this->workday->destinations;

    foreach ($destinations->take(3) as $destination) {
        $this->actingAs($this->driver)->postJson(route('driver.destinations.complete', $destination));
    }

    $this->actingAs($this->driver)
        ->postJson(route('driver.destinations.fail', $destinations->last()), ['reason' => 'rechazado'])
        ->assertJson(['finished' => true]);

    $workday = $this->workday->fresh();

    expect($workday->status)->toBe(WorkdayStatus::Completed)
        ->and($workday->failedCount())->toBe(1)
        ->and($workday->total_km)->not->toBeNull();
});

test('the driver cannot mark failed a destination that is not the active one', function () {
    $this->actingAs($this->driver)
        ->postJson(route('driver.destinations.fail', $this->workday->destinations->get(2)), ['reason' => 'ausente'])
        ->assertForbidden();
});

test('the admin sends a failed destination back to the pool for another day', function () {
    $destination = $this->workday->destinations->first();

    $this->actingAs($this->driver)->postJson(route('driver.destinations.fail', $destination), ['reason' => 'ausente']);

    $tomorrow = today()->addDay()->toDateString();

    $this->actingAs($this->admin)
        ->post(route('admin.destinations.requeue', $destination), ['fecha' => $tomorrow])
        ->assertRedirect(route('admin.destinations.index', $this->vehicle))
        ->assertSessionHas('status');

    $destination->refresh();

    expect($destination->workday_id)->toBeNull()
        ->and($destination->service_date->toDateString())->toBe($tomorrow)
        ->and($destination->status)->toBe(DestinationStatus::Pending)
        ->and($destination->position)->toBeNull()
        ->and($destination->failure_reason)->toBeNull()
        ->and(Destination::query()->inPool($tomorrow)->count())->toBe(1);
});
