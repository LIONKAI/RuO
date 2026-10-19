@php
    $stateConfig = [
        'url' => route('driver.state'),
        'routeUrl' => route('driver.route'),
        'activeUrl' => route('driver.active'),
        'summaryUrl' => route('driver.summary'),
        'completeUrl' => route('driver.destinations.complete', ['destination' => '__ID__']),
        'failUrl' => route('driver.destinations.fail', ['destination' => '__ID__']),
        'positionUrl' => route('driver.position.store'),
        'center' => [config('services.map.center_latitude'), config('services.map.center_longitude')],
    ];
@endphp
<script type="application/json" id="initial-state">@json($initialState)</script>
<script type="application/json" id="state-config">@json($stateConfig)</script>
