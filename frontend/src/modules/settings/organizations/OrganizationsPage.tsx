import {
    useState,
} from 'react';
import {
    Link,
} from 'react-router';

import {
    useCreateOrganizationMutation,
    useUpdateOrganizationMutation,
} from '@/modules/settings/organizations/api/use-organization-mutations';
import {
    useOrganizationsQuery,
    type OrganizationResource,
} from '@/modules/settings/organizations/api/use-organizations-query';
import type {
    BrowserApiFailure,
} from '@/platform/api';
import {
    Badge,
    Button,
    Input,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/shared/ui';

const CREATED_AT_FORMATTER =
    new Intl.DateTimeFormat(
        'id-ID',
        {
            dateStyle:
                'medium',

            timeStyle:
                'short',
        },
    );

function formatCreatedAt(
    value:
        string | undefined,
): string {
    if (
        value === undefined
    ) {
        return '—';
    }

    const parsed =
        new Date(
            value,
        );

    if (
        Number.isNaN(
            parsed.getTime(),
        )
    ) {
        return '—';
    }

    return CREATED_AT_FORMATTER.format(
        parsed,
    );
}

/*
 * Extracts the first field-level validation message from a
 * VALIDATION_FAILED (422) response, e.g. `code` uniqueness
 * conflicts on StoreOrganizationRequest. Returns null for
 * every other failure shape so callers can fall back to a
 * generic message.
 */
function extractFieldErrorMessage(
    error:
        BrowserApiFailure,
    field:
        string,
): string | null {
    if (
        error.kind !== 'response'
    ) {
        return null;
    }

    if (
        ! (
            'errors' in error.error
        )
    ) {
        return null;
    }

    const messages =
        error.error.errors[
            field
        ];

    if (
        ! Array.isArray(
            messages,
        )
        || messages.length === 0
    ) {
        return null;
    }

    return (
        messages[0]
        ?? null
    );
}

function CreateOrganizationForm() {
    const [
        name,
        setName,
    ] = useState('');

    const [
        code,
        setCode,
    ] = useState('');

    const mutation =
        useCreateOrganizationMutation();

    const codeErrorMessage =
        mutation.isError
            ? extractFieldErrorMessage(
                mutation.error,
                'code',
            )
            : null;

    function handleSubmit(
        event:
            React.FormEvent,
    ) {
        event.preventDefault();

        mutation.mutate(
            {
                name,
                code:
                    code.trim() === ''
                        ? null
                        : code.trim(),
            },
            {
                onSuccess: () => {
                    setName('');
                    setCode('');
                },
            },
        );
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-3 rounded-md border p-4"
        >
            <h2 className="text-sm font-semibold">
                Buat Organisasi Baru
            </h2>

            <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                    <label
                        htmlFor="organization-name"
                        className="text-xs font-medium text-muted-foreground"
                    >
                        Nama Organisasi
                    </label>

                    <Input
                        id="organization-name"
                        value={name}
                        placeholder="Kampus Utama"
                        required
                        onChange={
                            (
                                event,
                            ) =>
                                setName(
                                    event.target.value,
                                )
                        }
                    />
                </div>

                <div className="space-y-1">
                    <label
                        htmlFor="organization-code"
                        className="text-xs font-medium text-muted-foreground"
                    >
                        Kode (opsional)
                    </label>

                    <Input
                        id="organization-code"
                        value={code}
                        placeholder="KAMPUS-UTAMA"
                        aria-invalid={
                            codeErrorMessage !== null
                        }
                        onChange={
                            (
                                event,
                            ) =>
                                setCode(
                                    event.target.value,
                                )
                        }
                    />

                    {
                        codeErrorMessage !== null
                            ? (
                                <p
                                    role="alert"
                                    className="text-xs text-destructive"
                                >
                                    {
                                        codeErrorMessage
                                    }
                                </p>
                            )
                            : null
                    }
                </div>
            </div>

            {
                mutation.isError
                && codeErrorMessage === null
                    ? (
                        <p
                            role="alert"
                            className="text-sm text-destructive"
                        >
                            Gagal membuat Organisasi. Coba lagi.
                        </p>
                    )
                    : null
            }

            <Button
                type="submit"
                disabled={mutation.isPending}
            >
                {
                    mutation.isPending
                        ? 'Menyimpan…'
                        : 'Buat Organisasi'
                }
            </Button>
        </form>
    );
}

interface RenameOrganizationControlProps {
    organization: OrganizationResource;
}

/*
 * Inline rename control — mencegah duplikat Organization yang
 * tidak sengaja (mis. default auto-created yang tidak dipakai)
 * dengan memberi jalan resmi untuk mengganti nama Organization
 * yang sudah ada, daripada admin membuat Organization baru lagi.
 */
function RenameOrganizationControl(
    {
        organization,
    }: RenameOrganizationControlProps,
) {
    const [
        isEditing,
        setIsEditing,
    ] = useState(false);

    const [
        name,
        setName,
    ] = useState(
        organization.name,
    );

    const mutation =
        useUpdateOrganizationMutation();

    const nameErrorMessage =
        mutation.isError
            ? extractFieldErrorMessage(
                mutation.error,
                'name',
            )
            : null;

    function startEditing() {
        setName(
            organization.name,
        );

        mutation.reset();

        setIsEditing(true);
    }

    function cancelEditing() {
        mutation.reset();

        setIsEditing(false);
    }

    function handleSubmit(
        event:
            React.FormEvent,
    ) {
        event.preventDefault();

        mutation.mutate(
            {
                organizationId:
                    organization.id,

                input: {
                    name,
                },
            },
            {
                onSuccess: () => {
                    setIsEditing(false);
                },
            },
        );
    }

    if (! isEditing) {
        return (
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="ml-2"
                onClick={startEditing}
            >
                Ganti Nama
            </Button>
        );
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="ml-2 inline-flex flex-col gap-1 align-top"
        >
            <div className="inline-flex items-center gap-2">
                <label
                    htmlFor={
                        `organization-rename-${organization.id}`
                    }
                    className="sr-only"
                >
                    Nama Organisasi Baru
                </label>

                <Input
                    id={
                        `organization-rename-${organization.id}`
                    }
                    value={name}
                    required
                    aria-invalid={
                        nameErrorMessage !== null
                    }
                    onChange={
                        (
                            event,
                        ) =>
                            setName(
                                event.target.value,
                            )
                    }
                />

                <Button
                    type="submit"
                    size="sm"
                    disabled={mutation.isPending}
                >
                    {
                        mutation.isPending
                            ? 'Menyimpan…'
                            : 'Simpan'
                    }
                </Button>

                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={mutation.isPending}
                    onClick={cancelEditing}
                >
                    Batal
                </Button>
            </div>

            {
                mutation.isError
                    ? (
                        <p
                            role="alert"
                            className="text-xs text-destructive"
                        >
                            {
                                nameErrorMessage
                                ?? 'Gagal mengganti nama Organisasi. Coba lagi.'
                            }
                        </p>
                    )
                    : null
            }
        </form>
    );
}

export function OrganizationsPage() {
    const organizationsQuery =
        useOrganizationsQuery();

    return (
        <section
            aria-labelledby="organizations-heading"
            className="space-y-6"
        >
            <div>
                <h1
                    id="organizations-heading"
                    className="text-xl font-semibold"
                >
                    Organisasi
                </h1>

                <p className="text-sm text-muted-foreground">
                    Kelola Organisasi milik tenant Anda. Modul
                    organizational-scoped seperti Kepegawaian
                    memerlukan minimal satu Organisasi aktif.
                </p>
            </div>

            <CreateOrganizationForm />

            {
                organizationsQuery.status === 'pending'
                    ? (
                        <p
                            role="status"
                            className="text-sm text-muted-foreground"
                        >
                            Memuat daftar Organisasi…
                        </p>
                    )
                    : null
            }

            {
                organizationsQuery.status === 'error'
                    ? (
                        <div
                            role="alert"
                            className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive"
                        >
                            Gagal memuat daftar Organisasi. Coba muat ulang halaman ini.
                        </div>
                    )
                    : null
            }

            {
                organizationsQuery.status === 'success'
                    ? (
                        organizationsQuery.data.length === 0
                            ? (
                                <p className="text-sm text-muted-foreground">
                                    Belum ada Organisasi yang dibuat.
                                </p>
                            )
                            : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>
                                                Nama
                                            </TableHead>
                                            <TableHead>
                                                Kode
                                            </TableHead>
                                            <TableHead>
                                                Status
                                            </TableHead>
                                            <TableHead>
                                                Dibuat Pada
                                            </TableHead>
                                            <TableHead>
                                                Aksi
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>

                                    <TableBody>
                                        {
                                            organizationsQuery.data.map(
                                                (
                                                    organization,
                                                ) => (
                                                    <TableRow
                                                        key={
                                                            organization.id
                                                        }
                                                    >
                                                        <TableCell className="font-medium">
                                                            {
                                                                organization.name
                                                            }
                                                        </TableCell>

                                                        <TableCell>
                                                            {
                                                                organization.code
                                                                ?? (
                                                                    <span className="text-muted-foreground">
                                                                        —
                                                                    </span>
                                                                )
                                                            }
                                                        </TableCell>

                                                        <TableCell>
                                                            <Badge
                                                                variant={
                                                                    organization.is_active
                                                                        ? 'success'
                                                                        : 'secondary'
                                                                }
                                                            >
                                                                {
                                                                    organization.is_active
                                                                        ? 'Aktif'
                                                                        : 'Nonaktif'
                                                                }
                                                            </Badge>
                                                        </TableCell>

                                                        <TableCell>
                                                            {
                                                                formatCreatedAt(
                                                                    organization.created_at,
                                                                )
                                                            }
                                                        </TableCell>

                                                        <TableCell>
                                                            <Button
                                                                asChild
                                                                variant="outline"
                                                                size="sm"
                                                            >
                                                                <Link
                                                                    to={
                                                                        `/settings/organizations/${organization.id}/units`
                                                                    }
                                                                >
                                                                    Kelola Unit
                                                                </Link>
                                                            </Button>

                                                            <Button
                                                                asChild
                                                                variant="outline"
                                                                size="sm"
                                                                className="ml-2"
                                                            >
                                                                <Link
                                                                    to={
                                                                        `/settings/organizations/${organization.id}/members`
                                                                    }
                                                                >
                                                                    Kelola Anggota
                                                                </Link>
                                                            </Button>

                                                            <RenameOrganizationControl
                                                                organization={
                                                                    organization
                                                                }
                                                            />
                                                        </TableCell>
                                                    </TableRow>
                                                ),
                                            )
                                        }
                                    </TableBody>
                                </Table>
                            )
                    )
                    : null
            }
        </section>
    );
}
