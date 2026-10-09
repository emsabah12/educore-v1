<!DOCTYPE html>
<html
    lang="id"
    dir="ltr"
    x-data
    x-init="$store.theme.init()"
    class="h-full">

<head>
    <meta charset="utf-8">
    <meta
        name="viewport"
        content="width=device-width, initial-scale=1">

    <title>{{ $title ?? 'EduCore Platform' }}</title>

    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>

<body
    class="min-h-full bg-gray-50 text-gray-900 antialiased dark:bg-gray-950 dark:text-white">
    {{--
     * Layout khusus halaman tamu (belum login), seperti form login.
     * SENGAJA tidak meng-@include sidebar/header admin ('platform.partials.sidebar'
     * dan 'platform.partials.nav') karena keduanya adalah chrome area
     * terautentikasi (link navigasi ke Tenant/Role/Paket, info "Platform
     * Administrator", tombol logout) yang tidak relevan — dan membingungkan —
     * sebelum pengguna berhasil masuk.
    --}}
    <main class="min-h-screen">
        @if (session('status'))
        <div
            role="status"
            class="mx-auto mt-6 max-w-sm rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm font-medium text-success-700 dark:border-success-900/40 dark:bg-success-950/30 dark:text-success-400">
            {{ session('status') }}
        </div>
        @endif

        @yield('content')
    </main>
</body>

</html>
