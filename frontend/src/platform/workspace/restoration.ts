import type {
    OrganizationalAssignmentLocator,
} from '@/platform/api';
import type {
    CanonicalMembershipContext,
} from '@/platform/membership';

import type {
    WorkspaceSummary,
} from '@/platform/workspace/contract';

const WORKSPACE_RESTORATION_HINT_VERSION =
    2 as const;

const WORKSPACE_RESTORATION_HINT_STORAGE_KEY =
    'educore.workspace-restoration.v2';

/*
 * TENANT and an organizational Workspace are both things a
 * member can EXPLICITLY choose to stay on, and both must
 * persist as a distinct, sticky preference — otherwise an
 * admin who deliberately selects TENANT would be bounced back
 * to their sole Organization on the very next reload (see
 * resolveSoleOrganizationalWorkspaceTarget).
 */
export interface TenantWorkspaceRestorationHint {
    readonly version:
        typeof WORKSPACE_RESTORATION_HINT_VERSION;

    readonly kind:
        'tenant';

    readonly membershipId:
        CanonicalMembershipContext[
            'membership'
        ]['id'];

    readonly tenantId:
        CanonicalMembershipContext[
            'tenant'
        ]['id'];
}

export interface OrganizationalWorkspaceRestorationHint {
    readonly version:
        typeof WORKSPACE_RESTORATION_HINT_VERSION;

    readonly kind:
        'organizational';

    readonly membershipId:
        CanonicalMembershipContext[
            'membership'
        ]['id'];

    readonly tenantId:
        CanonicalMembershipContext[
            'tenant'
        ]['id'];

    readonly organizationalAssignmentId:
        OrganizationalAssignmentLocator;
}

export type WorkspaceRestorationHint =
    | TenantWorkspaceRestorationHint
    | OrganizationalWorkspaceRestorationHint;

export type WorkspaceRestorationHintStorage =
    Pick<
        Storage,
        | 'getItem'
        | 'setItem'
        | 'removeItem'
    >;

export interface WorkspaceRestorationSuccess {
    readonly ok:
        true;
}

export interface WorkspaceRestorationReadSuccess {
    readonly ok:
        true;

    readonly hint:
        WorkspaceRestorationHint | null;
}

export interface WorkspaceRestorationFailure {
    readonly ok:
        false;

    readonly kind:
        'invalid'
        | 'storage';

    readonly cause:
        unknown;
}

export type WorkspaceRestorationMutationResult =
    | WorkspaceRestorationSuccess
    | WorkspaceRestorationFailure;

export type WorkspaceRestorationReadResult =
    | WorkspaceRestorationReadSuccess
    | WorkspaceRestorationFailure;

function isRecord(
    value: unknown,
): value is Record<
    string,
    unknown
> {
    return (
        typeof value
            === 'object'
        && value !== null
        && ! Array.isArray(
            value,
        )
    );
}

function isNonEmptyString(
    value: unknown,
): value is string {
    return (
        typeof value
            === 'string'
        && value.trim()
            !== ''
    );
}

function isWorkspaceRestorationHint(
    value: unknown,
): value is WorkspaceRestorationHint {
    if (
        ! isRecord(
            value,
        )
    ) {
        return false;
    }

    if (
        value.version
            !== WORKSPACE_RESTORATION_HINT_VERSION
        || ! isNonEmptyString(
            value.membershipId,
        )
        || ! isNonEmptyString(
            value.tenantId,
        )
    ) {
        return false;
    }

    if (
        value.kind
            === 'tenant'
    ) {
        return true;
    }

    if (
        value.kind
            === 'organizational'
    ) {
        return isNonEmptyString(
            value.organizationalAssignmentId,
        );
    }

    return false;
}

function resolveStorage(
    storage:
        WorkspaceRestorationHintStorage
        | undefined,
): WorkspaceRestorationHintStorage {
    if (
        storage !== undefined
    ) {
        return storage;
    }

    if (
        typeof window
            === 'undefined'
    ) {
        throw new Error(
            'EduCore Workspace restoration requires a browser runtime.',
        );
    }

    return window.sessionStorage;
}

function createStorageFailure(
    cause: unknown,
): WorkspaceRestorationFailure {
    return {
        ok:
            false,
        kind:
            'storage',
        cause,
    };
}

function discardInvalidHint(
    storage:
        WorkspaceRestorationHintStorage,
    cause: unknown,
): WorkspaceRestorationFailure {
    try {
        storage.removeItem(
            WORKSPACE_RESTORATION_HINT_STORAGE_KEY,
        );
    } catch (storageCause: unknown) {
        return createStorageFailure(
            storageCause,
        );
    }

    return {
        ok:
            false,
        kind:
            'invalid',
        cause,
    };
}

export function readBrowserWorkspaceRestorationHint(
    storage?:
        WorkspaceRestorationHintStorage,
): WorkspaceRestorationReadResult {
    let resolvedStorage:
        WorkspaceRestorationHintStorage;

    try {
        resolvedStorage =
            resolveStorage(
                storage,
            );
    } catch (cause: unknown) {
        return createStorageFailure(
            cause,
        );
    }

    let serialized:
        string | null;

    try {
        serialized =
            resolvedStorage.getItem(
                WORKSPACE_RESTORATION_HINT_STORAGE_KEY,
            );
    } catch (cause: unknown) {
        return createStorageFailure(
            cause,
        );
    }

    if (
        serialized === null
    ) {
        return {
            ok:
                true,
            hint:
                null,
        };
    }

    let parsed:
        unknown;

    try {
        parsed =
            JSON.parse(
                serialized,
            );
    } catch (cause: unknown) {
        return discardInvalidHint(
            resolvedStorage,
            cause,
        );
    }

    if (
        ! isWorkspaceRestorationHint(
            parsed,
        )
    ) {
        return discardInvalidHint(
            resolvedStorage,
            new Error(
                'Stored EduCore Workspace restoration hint is invalid.',
            ),
        );
    }

    return {
        ok:
            true,
        hint:
            parsed,
    };
}

export function clearBrowserWorkspaceRestorationHint(
    storage?:
        WorkspaceRestorationHintStorage,
): WorkspaceRestorationMutationResult {
    try {
        const resolvedStorage =
            resolveStorage(
                storage,
            );

        resolvedStorage.removeItem(
            WORKSPACE_RESTORATION_HINT_STORAGE_KEY,
        );

        return {
            ok:
                true,
        };
    } catch (cause: unknown) {
        return createStorageFailure(
            cause,
        );
    }
}

export function persistBrowserWorkspaceRestorationHint(
    context:
        CanonicalMembershipContext,
    workspace:
        WorkspaceSummary,
    storage?:
        WorkspaceRestorationHintStorage,
): WorkspaceRestorationMutationResult {
    if (
        ! isNonEmptyString(
            context.membership.id,
        )
        || ! isNonEmptyString(
            context.tenant.id,
        )
    ) {
        return {
            ok:
                false,
            kind:
                'invalid',
            cause:
                new Error(
                    'EduCore Workspace restoration requires canonical Membership and Tenant identifiers.',
                ),
        };
    }

    let hint:
        WorkspaceRestorationHint;

    /*
     * Explicitly choosing TENANT is a deliberate preference,
     * not "no preference" — it must persist just as stickily
     * as an organizational choice, so it is never silently
     * overridden by the sole-Organization default on the next
     * reload (see resolveSoleOrganizationalWorkspaceTarget).
     */
    if (
        workspace.type
            === 'TENANT'
    ) {
        hint = {
            version:
                WORKSPACE_RESTORATION_HINT_VERSION,

            kind:
                'tenant',

            membershipId:
                context.membership.id,

            tenantId:
                context.tenant.id,
        };
    } else {
        if (
            ! isNonEmptyString(
                workspace
                    .organizational_assignment_id,
            )
        ) {
            return {
                ok:
                    false,
                kind:
                    'invalid',
                cause:
                    new Error(
                        'EduCore Workspace restoration requires an organizational assignment identifier.',
                    ),
            };
        }

        hint = {
            version:
                WORKSPACE_RESTORATION_HINT_VERSION,

            kind:
                'organizational',

            membershipId:
                context.membership.id,

            tenantId:
                context.tenant.id,

            organizationalAssignmentId:
                workspace
                    .organizational_assignment_id,
        };
    }

    try {
        const resolvedStorage =
            resolveStorage(
                storage,
            );

        resolvedStorage.setItem(
            WORKSPACE_RESTORATION_HINT_STORAGE_KEY,
            JSON.stringify(
                hint,
            ),
        );

        return {
            ok:
                true,
        };
    } catch (cause: unknown) {
        return createStorageFailure(
            cause,
        );
    }
}

export function resolveWorkspaceRestorationTarget(
    context:
        CanonicalMembershipContext,
    workspaces:
        readonly WorkspaceSummary[],
    hint:
        WorkspaceRestorationHint
        | null,
): WorkspaceSummary | null {
    if (
        hint === null
    ) {
        return null;
    }

    if (
        hint.membershipId
            !== context.membership.id
        || hint.tenantId
            !== context.tenant.id
    ) {
        return null;
    }

    if (
        hint.kind
            === 'tenant'
    ) {
        return (
            workspaces.find(
                (workspace) =>
                    workspace.type
                        === 'TENANT',
            )
            ?? null
        );
    }

    const matches =
        workspaces.filter(
            (workspace) => {
                if (
                    workspace.type
                        === 'TENANT'
                ) {
                    return false;
                }

                return (
                    workspace
                        .organizational_assignment_id
                    === hint
                        .organizationalAssignmentId
                );
            },
        );

    if (
        matches.length
            !== 1
    ) {
        return null;
    }

    const match =
        matches[0];

    if (
        match === undefined
    ) {
        return null;
    }

    /*
     * Return the fresh canonical catalog object.
     *
     * Never reconstruct Workspace authority from storage.
     */
    return match;
}

/*
 * The common case this app is built around: one
 * Yayasan/school/pesantren Tenant with exactly one
 * Organization underneath it. When a member has no explicit,
 * still-valid stored preference (resolveWorkspaceRestorationTarget
 * returned null — first login, or a stale/invalid hint), this
 * is where they should land instead of being parked on TENANT,
 * which otherwise shows nothing meaningful for a plain member
 * and is confusing for an admin too (see the Langkah 1 fix in
 * WorkspaceSwitcher/hasVisibleTenantOnlyNavigation, which keeps
 * the switcher reachable so this default never traps anyone).
 *
 * Deliberately returns null — i.e. stay on TENANT — the moment
 * there is more than one non-TENANT Workspace: a genuine
 * multi-school Yayasan has no single correct default, so the
 * member must choose explicitly through the switcher.
 */
export function resolveSoleOrganizationalWorkspaceTarget(
    workspaces:
        readonly WorkspaceSummary[],
): WorkspaceSummary | null {
    const nonTenantWorkspaces =
        workspaces.filter(
            (workspace) =>
                workspace.type
                    !== 'TENANT',
        );

    if (
        nonTenantWorkspaces.length
            !== 1
    ) {
        return null;
    }

    return (
        nonTenantWorkspaces[0]
        ?? null
    );
}
