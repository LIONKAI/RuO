<?php

namespace App\Services;

use RuntimeException;

/**
 * Raised when an external geocoding or routing service cannot fulfil a request.
 * The message is safe to show to the user.
 */
class RoutingServiceException extends RuntimeException {}
