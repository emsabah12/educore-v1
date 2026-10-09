import {
    describe,
    expect,
    it,
} from 'vitest';

import {
    hasVisibleTenantOnlyNavigation,
} from '@/app/workspace/tenant-admin-visibility';
import type {
    BrowserAuthState,
} from '@/platform/auth';
import type {
    CapabilityState,
} from '@/platform/authorization';
import type {
    MembershipContextState,
} from '@/platform/membership';
import type {
    TenantAdminVisibilitySourceWorkspaceState,
} from '@/app/workspace/tenant-admin-visibility';

const userId =
    '018f3b6a-7c20-7000-8000-000000000401';

const personId =
    '018f3b6a-7c20-7000-8000-000000000402';

const membershipId =
    '018f3b6a-7c20-7000-8000-000000000403';

const tenantId =
    '018f3b6a-7c20-7000-8000-000000000404';

const organizationalAssignmentId =
    '018f3b6a-7c20-7000-8000-000000000405';

const organizationId =
    '018f3b6a-7c20-7000-8000-000000000406';

const authenticatedState:
    BrowserAuthState = {
        status:
            'authenticated',

        identity: {
            user: {
                id:
                    userId,

                email:
                    'guru@anginribut.test',
            },

            person: {
                id:
                    personId,

                name:
                    'Guru EduCore',
            },

            membership: {
                id:
                    membershipId,

                status:
                    'ACTIVE',
            },

            tenant: {
                id:
                    tenantId,

                name:
                    'Yayasan Angin Ribut',

                subdomain:
                    'yayasan-angin-ribut',
            },
        },
    };

const readyMembershipState:
    MembershipContextState = {
        status:
            'ready',

        memberships: [
            {
                membership_id:
                    membershipId,

                membership_status:
                    'ACTIVE',

                tenant_id:
                    tenantId,

                tenant_name:
                    'Yayasan Angin Ribut',

                tenant_subdomain:
                    'yayasan-angin-ribut',
            },
        ],

        context: {
            membership: {
                id:
                    membershipId,

                status:
                    'ACTIVE',
            },

            tenant: {
                id:
                    tenantId,

                name:
                    'Yayasan Angin Ribut',

                subdomain:
                    'yayasan-angin-ribut',
            },
        },

        failure:
            null,
    };

const tenantPlusOneOrganizationWorkspace:
    TenantAdminVisibilitySourceWorkspaceState = {
        context:
            readyMembershipState.context,

        tenant: {
            id:
                tenantId,

            name:
                'Yayasan Angin Ribut',
        },

        workspaces: [
            {
                type:
                    'TENANT',

                organizational_assignment_id:
                    null,

                organization_id:
                    null,

                organization_unit_id:
                    null,

                label:
                    'Yayasan Angin Ribut',
            },

            {
                type:
                    'ORGANIZATION',

                organizational_assignment_id:
                    organizationalAssignmentId,

                organization_id:
                    organizationId,

                organization_unit_id:
                    null,

                label:
                    'Yayasan Angin Ribut',
            },
        ],

        current: {
            type:
                'ORGANIZATION',

            organizational_assignment_id:
                organizationalAssignmentId,

            organization_id:
                organizationId,

            organization_unit_id:
                null,

            label:
                'Yayasan Angin Ribut',
        },
    };

function readyTenantCapability(
    permissions:
        string[],
    isTenantAdmin =
        false,
): CapabilityState {
    return {
        status:
            'ready',

        projection: {
            scope: {
                type:
                    'tenant',

                tenant_id:
                    tenantId,

                membership_id:
                    membershipId,
            },

            is_global_superadmin:
                false,

            is_tenant_admin:
                isTenantAdmin,

            permissions,
        },
    };
}

describe(
    'hasVisibleTenantOnlyNavigation',
    () => {
        it('returns false for a plain member (e.g. Guru) with no tenant-admin-only permission — the exact single-organization "Guru" case from the bug report', () => {
            const result =
                hasVisibleTenantOnlyNavigation({
                    authentication:
                        authenticatedState,

                    membership:
                        readyMembershipState,

                    capability:
                        readyTenantCapability(
                            [],
                        ),

                    workspace:
                        tenantPlusOneOrganizationWorkspace,
                });

            expect(
                result,
            ).toBe(
                false,
            );
        });

        it('returns true when the member is tenant-admin (Kelola Anggota becomes reachable)', () => {
            const result =
                hasVisibleTenantOnlyNavigation({
                    authentication:
                        authenticatedState,

                    membership:
                        readyMembershipState,

                    capability:
                        readyTenantCapability(
                            [],
                            true,
                        ),

                    workspace:
                        tenantPlusOneOrganizationWorkspace,
                });

            expect(
                result,
            ).toBe(
                true,
            );
        });

        it('returns true when the member merely holds organization.manage (Organisasi becomes reachable) without being a full tenant-admin', () => {
            const result =
                hasVisibleTenantOnlyNavigation({
                    authentication:
                        authenticatedState,

                    membership:
                        readyMembershipState,

                    capability:
                        readyTenantCapability(
                            [
                                'organization.manage',
                            ],
                        ),

                    workspace:
                        tenantPlusOneOrganizationWorkspace,
                });

            expect(
                result,
            ).toBe(
                true,
            );
        });

        it('returns false when no TENANT entry exists in the Workspace catalog', () => {
            const result =
                hasVisibleTenantOnlyNavigation({
                    authentication:
                        authenticatedState,

                    membership:
                        readyMembershipState,

                    capability:
                        readyTenantCapability(
                            [],
                            true,
                        ),

                    workspace: {
                        ...tenantPlusOneOrganizationWorkspace,

                        workspaces: [
                            tenantPlusOneOrganizationWorkspace
                                .workspaces[1]!,
                        ],
                    },
                });

            expect(
                result,
            ).toBe(
                false,
            );
        });

        it('never counts a Workspace-agnostic destination like Beranda (requiredPermissions === null) toward tenant-only access', () => {
            /*
             * Beranda ('root') intentionally has no
             * requiredPermissions, so it is allowed from every
             * Workspace type and must NOT, by itself, keep the
             * switcher visible. A plain member with zero
             * permissions still has Beranda — this asserts that
             * fact does not flip the result to true.
             */
            const result =
                hasVisibleTenantOnlyNavigation({
                    authentication:
                        authenticatedState,

                    membership:
                        readyMembershipState,

                    capability:
                        readyTenantCapability(
                            [],
                        ),

                    workspace:
                        tenantPlusOneOrganizationWorkspace,
                });

            expect(
                result,
            ).toBe(
                false,
            );
        });
    },
);
