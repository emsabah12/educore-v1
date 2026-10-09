<?php

declare(strict_types=1);

namespace Modules\Core\Organization\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Rename SATU Organization yang sudah ada. Sengaja hanya `name` —
 * ini bukan PATCH umum untuk seluruh atribut Organization (lihat
 * StoreOrganizationRequest untuk `code`), melainkan aksi "Ganti
 * Nama" yang dedicated, supaya admin bisa langsung mengganti nama
 * Organization default (nama = nama Tenant, dibuat otomatis oleh
 * TenantActivationService) menjadi nama sekolah/unit yang
 * sebenarnya TANPA perlu membuat Organization baru dan meninggalkan
 * yang lama menganggur.
 */
final class UpdateOrganizationRequest extends FormRequest
{
    /**
     * Otorisasi dilakukan oleh middleware route
     * (`tenant.permission:organization.manage`), sama seperti
     * StoreOrganizationRequest.
     */
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $input = $this->all();

        if (
            array_key_exists('name', $input)
            && is_string($input['name'])
        ) {
            $this->merge([
                'name' => trim($input['name']),
            ]);
        }
    }

    /**
     * Tidak ada aturan unique pada `name` — konsisten dengan
     * StoreOrganizationRequest, yang juga tidak membatasi keunikan
     * nama Organization dalam satu tenant.
     *
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'name' => [
                'required',
                'string',
                'max:255',
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'The organization name is required.',
            'name.string' => 'The organization name must be a string.',
            'name.max' => 'The organization name may not exceed 255 characters.',
        ];
    }
}
