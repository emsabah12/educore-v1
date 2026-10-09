import {
    applicationNavigationCatalog,
} from '@/platform/navigation';
import {
    evaluateProtectedRouteAccess,
} from '@/platform/routing';
import type {
    ProtectedRouteAccessInput,
} from '@/platform/routing';
import type {
    ReadyWorkspaceContextState,
    SwitchingWorkspaceContextState,
    WorkspaceSummary,
} from '@/platform/workspace';

import {
    resolveApplicationRouteAccessPolicy,
} from '@/app/routing/application-route-access';

/*
 * The subset of a 'ready'/'switching' Workspace snapshot this
 * module actually needs.
 *
 * Both source states carry the same context/tenant/workspaces
 * shape — only their `status` tag and a couple of
 * status-specific fields differ — so either may be adapted into
 * a synthetic 'ready' snapshot below.
 */
export type TenantAdminVisibilitySourceWorkspaceState =
    Pick<
        ReadyWorkspaceContextState | SwitchingWorkspaceContextState,
        | 'context'
        | 'tenant'
        | 'workspaces'
        | 'current'
    >;

export interface TenantOnlyNavigationAccessInput {
    readonly authentication:
        ProtectedRouteAccessInput['authentication'];

    readonly membership:
        ProtectedRouteAccessInput['membership'];

    readonly capability:
        ProtectedRouteAccessInput['capability'];

    readonly workspace:
        TenantAdminVisibilitySourceWorkspaceState;
}

function findTenantWorkspace(
    workspaces:
        readonly WorkspaceSummary[],
): WorkspaceSummary | null {
    return (
        workspaces.find(
            (workspace) =>
                workspace.type
                    === 'TENANT',
        )
        ?? null
    );
}

/*
 * Whether this Membership has at least one navigation
 * destination that ONLY exists at the TENANT Workspace AND is
 * actually gated by a permission (Kelola Anggota, Organisasi,
 * and any future tenant-admin-only destination) — as opposed to
 * a Workspace-agnostic destination like Beranda, whose
 * `requiredPermissions` is null and is therefore allowed from
 * every Workspace type (see evaluateProtectedRouteAccess).
 *
 * This answers "would this Membership lose something real by
 * never being able to reach the TENANT Workspace" — the
 * question WorkspaceSwitcher needs before it may safely hide
 * itself for a single-Organization tenant.
 *
 * Deliberately re-evaluates against the SAME pure
 * evaluateProtectedRouteAccess used by routing/navigation,
 * rather than hardcoding specific routeIds, so a future
 * tenant-admin-only destination is covered automatically.
 */
export function hasVisibleTenantOnlyNavigation(
    input:
        TenantOnlyNavigationAccessInput,
): boolean {
    const tenantWorkspace =
        findTenantWorkspace(
            input.workspace.workspaces,
        );

    if (
        tenantWorkspace === null
    ) {
        return false;
    }

    const syntheticTenantWorkspaceState:
        ProtectedRouteAccessInput['workspace'] = {
            status:
                'ready',

            context:
                input.workspace.context,

            tenant:
                input.workspace.tenant,

            workspaces:
                input.workspace.workspaces,

            current:
                tenantWorkspace,

            failure:
                null,
        };

    return applicationNavigationCatalog.some(
        (navigation) => {
            const policy =
                resolveApplicationRouteAccessPolicy(
                    navigation.routeId,
                );

            if (
                policy === null
            ) {
                return false;
            }

            /*
             * A Workspace-agnostic destination (requiredPermissions
             * === null, e.g. Beranda) never requires the TENANT
             * Workspace specifically — it must not keep the
             * switcher visible by itself.
             */
            if (
                policy.authorizationScope
                    !== 'tenant'
                || policy.requiredPermissions
                    === null
            ) {
                return false;
            }

            const decision =
                evaluateProtectedRouteAccess({
                    policy,

                    authentication:
                        input.authentication,

                    membership:
                        input.membership,

                    workspace:
                        syntheticTenantWorkspaceState,

                    capability:
                        input.capability,
                });

            return decision.status
                === 'allowed';
        },
    );
}
