<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class HomeController extends Controller
{
    /**
     * Send the user to the home screen of their role.
     */
    public function __invoke(Request $request): RedirectResponse
    {
        return redirect()->route($request->user()->homeRouteName());
    }
}
