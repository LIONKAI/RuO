<?php

use App\Models\User;
use Database\Seeders\RuoSeeder;

beforeEach(function () {
    $this->seed(RuoSeeder::class);
});

test('the admin logs in and lands on the admin dashboard', function () {
    $this->post('/login', ['email' => 'admin@ruo.com', 'password' => 'admin123'])
        ->assertRedirect(route('admin.dashboard'));

    $this->get(route('admin.dashboard'))->assertOk()->assertSee('Panel general');
});

test('the driver logs in and lands on the route screen', function () {
    $this->post('/login', ['email' => 'chofer1@ruo.com', 'password' => 'chofer123'])
        ->assertRedirect(route('driver.route'));

    $this->get(route('driver.route'))->assertOk()->assertSee('Juan Quispe');
});

test('wrong credentials are rejected', function () {
    $this->post('/login', ['email' => 'admin@ruo.com', 'password' => 'incorrecta'])
        ->assertSessionHasErrors('email');

    $this->assertGuest();
});

test('a driver cannot open admin screens', function () {
    $driver = User::firstWhere('email', 'chofer1@ruo.com');

    $this->actingAs($driver)->get(route('admin.dashboard'))->assertRedirect(route('driver.route'));
    $this->actingAs($driver)->getJson(route('admin.state'))->assertForbidden();
});

test('an admin cannot open driver screens', function () {
    $admin = User::firstWhere('email', 'admin@ruo.com');

    $this->actingAs($admin)->get(route('driver.route'))->assertRedirect(route('admin.dashboard'));
    $this->actingAs($admin)->getJson(route('driver.state'))->assertForbidden();
});

test('guests are sent to the login screen', function () {
    $this->get(route('admin.dashboard'))->assertRedirect(route('login'));
    $this->get(route('driver.route'))->assertRedirect(route('login'));
});

test('public registration is disabled', function () {
    $this->get('/register')->assertNotFound();
});

test('the landing page is public', function () {
    $this->get('/')->assertOk()->assertSee('Rutas óptimas.');
});
