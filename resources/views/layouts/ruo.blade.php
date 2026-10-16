<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <meta name="theme-color" content="#1e3a5f">
    <title>@hasSection('title')@yield('title') · @endif{{ 'RuO · Ruta Óptima' }}</title>

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@400;600;700;800&display=swap" rel="stylesheet">

    @stack('head')

    @vite(['resources/css/app.css', 'resources/js/ruo.js'])
</head>
<body data-page="@yield('page')" class="min-h-screen bg-white">
    @yield('content')
</body>
</html>
