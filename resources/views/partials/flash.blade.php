@if (session('status'))
    <div role="status" class="mb-5 border border-done bg-done-50 px-4 py-3 text-sm font-medium text-done">{{ session('status') }}</div>
@endif
@if (session('error'))
    <div role="alert" class="mb-5 border border-alert bg-alert-50 px-4 py-3 text-sm font-medium text-alert">{{ session('error') }}</div>
@endif
