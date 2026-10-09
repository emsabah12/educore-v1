import {
    afterEach,
    describe,
    expect,
    it,
} from 'vitest';

import type {
    BrowserApiFailure,
} from '@/platform/api';
import type {
    CanonicalMembershipContext,
    MembershipContextState,
} from '@/platform/membership';
import {
    createWorkspaceContextRuntime,
    persistBrowserWorkspaceRestorationHint,
    readBrowserWorkspaceRestorationHint,
    type WorkspaceContextOperations,
    type WorkspaceContextVerifier,
    type WorkspaceDiscoverySuccess,
    type WorkspaceSummary,
    type WorkspaceVerificationOptions,
    type WorkspaceVerificationResult,
} from '@/platform/workspace';

const membershipId =
    '018f3b6a-7c20-7abc-8def-1234567890ab';

const otherMembershipId =
    '018f3b6a-7c20-7bcd-8def-1234567890ab';

const tenantId =
    '018f3b6a-7c20-7cde-8def-1234567890ab';

const organizationAssignmentId =
    '018f3b6a-7c20-7def-9abc-1234567890ab';

const organizationId =
    '018f3b6a-7c20-7abc-9def-1234567890ab';

const context:
    CanonicalMembershipContext = {
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
                'EduCore School',
            subdomain:
                'educore-school',
        },
    };

const tenantWorkspace:
    WorkspaceSummary = {
        type:
            'TENANT',
        organizational_assignment_id:
            null,
        organization_id:
            null,
        organization_unit_id:
            null,
        label:
            'EduCore School',
    };

const organizationWorkspace:
    WorkspaceSummary = {
        type:
            'ORGANIZATION',
        organizational_assignment_id:
            organizationAssignmentId,
        organization_id:
            organizationId,
        organization_unit_id:
            null,
        label:
            'SMA EduCore',
    };

const secondOrganizationAssignmentId =
    '018f3b6a-7c20-7fab-9abc-1234567890ab';

const secondOrganizationId =
    '018f3b6a-7c20-7fbc-9abc-1234567890ab';

const secondOrganizationWorkspace:
    WorkspaceSummary = {
        type:
            'ORGANIZATION',
        organizational_assignment_id:
            secondOrganizationAssignmentId,
        organization_id:
            secondOrganizationId,
        organization_unit_id:
            null,
        label:
            'SMK EduCore',
    };

/*
 * The default fixture: TENANT plus exactly one Organization —
 * the common single Yayasan/school/pesantren case the
 * sole-Organization default targets.
 */
const discoveryResponse:
    WorkspaceDiscoverySuccess = {
        status:
            'success',

        data: {
            tenant: {
                id:
                    tenantId,
                name:
                    'EduCore School',
            },

            workspaces: [
                tenantWorkspace,
                organizationWorkspace,
            ],
        },
    };

/*
 * A genuine multi-school Yayasan: TENANT plus two
 * Organizations. There is no single correct default here, so
 * these tests use this fixture whenever they need bootstrap to
 * land on — and stay on — TENANT instead of auto-defaulting.
 */
const multiOrganizationDiscoveryResponse:
    WorkspaceDiscoverySuccess = {
        status:
            'success',

        data: {
            tenant: {
                id:
                    tenantId,
                name:
                    'EduCore School',
            },

            workspaces: [
                tenantWorkspace,
                organizationWorkspace,
                secondOrganizationWorkspace,
            ],
        },
    };

/*
 * TENANT with no Organization at all — used to exercise the
 * "already in TENANT scope" rejection, which the default
 * sole-Organization fixture can no longer exercise now that
 * bootstrap auto-defaults away from TENANT.
 */
const tenantOnlyDiscoveryResponse:
    WorkspaceDiscoverySuccess = {
        status:
            'success',

        data: {
            tenant: {
                id:
                    tenantId,
                name:
                    'EduCore School',
            },

            workspaces: [
                tenantWorkspace,
            ],
        },
    };

const membershipSummary = {
    membership_id:
        membershipId,
    membership_status:
        'ACTIVE',
    tenant_id:
        tenantId,
    tenant_name:
        'EduCore School',
    tenant_subdomain:
        'educore-school',
};

const readyMembershipState:
    MembershipContextState = {
        status:
            'ready',
        memberships: [
            membershipSummary,
        ],
        context,
        failure:
            null,
    };

const unresolvedMembershipState:
    MembershipContextState = {
        status:
            'unresolved',
    };

const networkFailure:
    BrowserApiFailure = {
        ok:
            false,
        kind:
            'network',
        cause:
            new TypeError(
                'Network unavailable',
            ),
    };

const abortedFailure:
    BrowserApiFailure = {
        ok:
            false,
        kind:
            'aborted',
        cause:
            new DOMException(
                'Aborted',
                'AbortError',
            ),
    };

const contextDeniedFailure:
    BrowserApiFailure = {
        ok:
            false,
        kind:
            'response',
        status:
            403,
        error: {
            status:
                'error',
            code:
                'ORGANIZATIONAL_CONTEXT_DENIED',
            message:
                'Organizational context denied.',
        },
    };

type WorkspaceDiscoveryOperationResult =
    Awaited<
        ReturnType<
            WorkspaceContextOperations[
                'discover'
            ]
        >
    >;

interface Deferred<T> {
    readonly promise:
        Promise<T>;

    resolve(
        value: T,
    ): void;
}

function createDeferred<T>():
    Deferred<T> {
    let resolvePromise:
        ((value: T) => void)
        | undefined;

    const promise =
        new Promise<T>(
            (resolve) => {
                resolvePromise =
                    resolve;
            },
        );

    return {
        promise,

        resolve(
            value,
        ) {
            if (
                resolvePromise
                    === undefined
            ) {
                throw new Error(
                    'Deferred resolver is unavailable.',
                );
            }

            resolvePromise(
                value,
            );
        },
    };
}

class FakeMembershipRuntime {
    private state:
        MembershipContextState;

    private readonly listeners =
        new Set<
            () => void
        >();

    public constructor(
        initial:
            MembershipContextState,
    ) {
        this.state =
            initial;
    }

    public getState = () =>
        this.state;

    public subscribe = (
        listener:
            () => void,
    ) => {
        this.listeners.add(
            listener,
        );

        return () => {
            this.listeners.delete(
                listener,
            );
        };
    };

    public setState(
        next:
            MembershipContextState,
    ): void {
        this.state =
            next;

        for (
            const listener
            of this.listeners
        ) {
            listener();
        }
    }
}

class FakeWorkspaceVerifier
    implements WorkspaceContextVerifier {
    public readonly calls:
        WorkspaceSummary[] = [];

    public handler:
        (
            workspace:
                WorkspaceSummary,
            options?:
                WorkspaceVerificationOptions,
        ) => Promise<
            WorkspaceVerificationResult
        > =
            async () => ({
                ok:
                    true,
            });

    public async verify(
        _context:
            CanonicalMembershipContext,
        workspace:
            WorkspaceSummary,
        options?:
            WorkspaceVerificationOptions,
    ): Promise<
        WorkspaceVerificationResult
    > {
        this.calls.push(
            workspace,
        );

        return this.handler(
            workspace,
            options,
        );
    }
}

function createSuccessOperations(
    response:
        WorkspaceDiscoverySuccess =
            discoveryResponse,
): WorkspaceContextOperations {
    return {
        async discover() {
            return {
                ok:
                    true,
                status:
                    200,
                data:
                    response,
            };
        },
    };
}

function readRestorationHint() {
    const result =
        readBrowserWorkspaceRestorationHint();

    if (
        ! result.ok
    ) {
        throw new Error(
            'Expected readable Workspace restoration state.',
        );
    }

    return result.hint;
}

afterEach(() => {
    window.sessionStorage.clear();
});

describe(
    'WorkspaceContext runtime',
    () => {
        it('remains unresolved and dispatches no discovery without canonical Membership/Tenant readiness', async () => {
            let discoveryCalls =
                0;

            const operations:
                WorkspaceContextOperations = {
                    async discover() {
                        discoveryCalls +=
                            1;

                        return {
                            ok:
                                true,
                            status:
                                200,
                            data:
                                discoveryResponse,
                        };
                    },
                };

            const membership =
                new FakeMembershipRuntime(
                    unresolvedMembershipState,
                );

            const verifier =
                new FakeWorkspaceVerifier();

            const runtime =
                createWorkspaceContextRuntime(
                    operations,
                    membership,
                    verifier,
                );

            expect(
                await runtime.bootstrap(),
            ).toEqual({
                status:
                    'unresolved',
            });

            expect(
                discoveryCalls,
            ).toBe(0);

            expect(
                verifier.calls,
            ).toHaveLength(0);

            runtime.dispose();
        });

        it('discovers and verifies TENANT before publishing the safe baseline', async () => {
            /*
             * This uses the multi-Organization fixture
             * specifically so the sole-Organization default
             * (covered below) never fires here — this test's
             * only concern is that TENANT is verified first,
             * before anything else is even considered.
             */
            const membership =
                new FakeMembershipRuntime(
                    readyMembershipState,
                );

            const verifier =
                new FakeWorkspaceVerifier();

            const runtime =
                createWorkspaceContextRuntime(
                    createSuccessOperations(
                        multiOrganizationDiscoveryResponse,
                    ),
                    membership,
                    verifier,
                );

            const state =
                await runtime.bootstrap();

            expect(state).toEqual({
                status:
                    'ready',
                context,
                tenant:
                    multiOrganizationDiscoveryResponse
                        .data
                        .tenant,
                workspaces:
                    multiOrganizationDiscoveryResponse
                        .data
                        .workspaces,
                current:
                    tenantWorkspace,
                failure:
                    null,
            });

            expect(
                verifier.calls,
            ).toEqual([
                tenantWorkspace,
            ]);

            runtime.dispose();
        });

        it('defaults to the sole Organization when no explicit Workspace preference is stored', async () => {
            const membership =
                new FakeMembershipRuntime(
                    readyMembershipState,
                );

            const verifier =
                new FakeWorkspaceVerifier();

            const runtime =
                createWorkspaceContextRuntime(
                    createSuccessOperations(),
                    membership,
                    verifier,
                );

            const state =
                await runtime.bootstrap();

            expect(
                state.status,
            ).toBe(
                'ready',
            );

            if (
                state.status
                    !== 'ready'
            ) {
                throw new Error(
                    'Expected sole-Organization default READY state.',
                );
            }

            expect(
                state.current,
            ).toEqual(
                organizationWorkspace,
            );

            /*
             * TENANT is still verified first as the safe
             * baseline, then the sole Organization is
             * verified before it becomes current.
             */
            expect(
                verifier.calls,
            ).toEqual([
                tenantWorkspace,
                organizationWorkspace,
            ]);

            /*
             * An auto-default is not an explicit choice — it
             * must not be persisted as one.
             */
            expect(
                readRestorationHint(),
            ).toBeNull();

            runtime.dispose();
        });

        it('stays on TENANT when more than one Organization exists and no explicit preference is stored', async () => {
            const membership =
                new FakeMembershipRuntime(
                    readyMembershipState,
                );

            const verifier =
                new FakeWorkspaceVerifier();

            const runtime =
                createWorkspaceContextRuntime(
                    createSuccessOperations(
                        multiOrganizationDiscoveryResponse,
                    ),
                    membership,
                    verifier,
                );

            const state =
                await runtime.bootstrap();

            expect(
                state.status,
            ).toBe(
                'ready',
            );

            if (
                state.status
                    !== 'ready'
            ) {
                throw new Error(
                    'Expected verified TENANT READY state.',
                );
            }

            expect(
                state.current,
            ).toEqual(
                tenantWorkspace,
            );

            expect(
                verifier.calls,
            ).toEqual([
                tenantWorkspace,
            ]);

            runtime.dispose();
        });

        it('fails closed on a transport-success payload that does not satisfy the canonical Workspace DTO', async () => {
            const membership =
                new FakeMembershipRuntime(
                    readyMembershipState,
                );

            const verifier =
                new FakeWorkspaceVerifier();

            const operations:
                WorkspaceContextOperations = {
                    async discover() {
                        return {
                            ok:
                                true,
                            status:
                                200,
                            data: {
                                status:
                                    'success',
                                data: {
                                    tenant: {
                                        id:
                                            tenantId,
                                        name:
                                            'EduCore School',
                                    },
                                    workspaces: [
                                        {
                                            type:
                                                'TENANT',
                                            label:
                                                'EduCore School',
                                        },
                                    ],
                                },
                            },
                        };
                    },
                };

            const runtime =
                createWorkspaceContextRuntime(
                    operations,
                    membership,
                    verifier,
                );

            expect(
                await runtime.bootstrap(),
            ).toEqual({
                status:
                    'unavailable',
                context,
                failure: {
                    ok:
                        false,
                    kind:
                        'protocol',
                    status:
                        200,
                    message:
                        'EduCore API returned an unexpected error response.',
                },
            });

            expect(
                verifier.calls,
            ).toHaveLength(0);

            runtime.dispose();
        });

        it('restores only a fresh canonical catalog target after TENANT and target verification', async () => {
            const membership =
                new FakeMembershipRuntime(
                    readyMembershipState,
                );

            const verifier =
                new FakeWorkspaceVerifier();

            persistBrowserWorkspaceRestorationHint(
                context,
                organizationWorkspace,
            );

            const renamedWorkspace:
                WorkspaceSummary = {
                    ...organizationWorkspace,
                    label:
                        'SMA EduCore Renamed',
                };

            const response:
                WorkspaceDiscoverySuccess = {
                    ...discoveryResponse,
                    data: {
                        ...discoveryResponse.data,
                        workspaces: [
                            tenantWorkspace,
                            renamedWorkspace,
                        ],
                    },
                };

            const runtime =
                createWorkspaceContextRuntime(
                    createSuccessOperations(
                        response,
                    ),
                    membership,
                    verifier,
                );

            const state =
                await runtime.bootstrap();

            expect(
                state.status,
            ).toBe(
                'ready',
            );

            if (
                state.status
                    !== 'ready'
            ) {
                throw new Error(
                    'Expected restored Workspace READY state.',
                );
            }

            expect(
                state.current,
            ).toBe(
                renamedWorkspace,
            );

            expect(
                verifier.calls,
            ).toEqual([
                tenantWorkspace,
                renamedWorkspace,
            ]);

            runtime.dispose();
        });

        it('discards a stale restoration assignment and remains on verified TENANT when more than one Organization exists', async () => {
            const membership =
                new FakeMembershipRuntime(
                    readyMembershipState,
                );

            const verifier =
                new FakeWorkspaceVerifier();

            const staleWorkspace:
                WorkspaceSummary = {
                    type:
                        'ORGANIZATION',
                    organizational_assignment_id:
                        '018f3b6a-7c20-7def-8def-1234567890ab',
                    organization_id:
                        organizationId,
                    organization_unit_id:
                        null,
                    label:
                        'Stale Workspace',
                };

            persistBrowserWorkspaceRestorationHint(
                context,
                staleWorkspace,
            );

            const runtime =
                createWorkspaceContextRuntime(
                    createSuccessOperations(
                        multiOrganizationDiscoveryResponse,
                    ),
                    membership,
                    verifier,
                );

            const state =
                await runtime.bootstrap();

            expect(
                state.status,
            ).toBe(
                'ready',
            );

            if (
                state.status
                    !== 'ready'
            ) {
                throw new Error(
                    'Expected TENANT Workspace READY state.',
                );
            }

            expect(
                state.current,
            ).toEqual(
                tenantWorkspace,
            );

            expect(
                readRestorationHint(),
            ).toBeNull();

            expect(
                verifier.calls,
            ).toEqual([
                tenantWorkspace,
            ]);

            runtime.dispose();
        });

        it('discards a stale restoration assignment and falls through to the sole-Organization default', async () => {
            const membership =
                new FakeMembershipRuntime(
                    readyMembershipState,
                );

            const verifier =
                new FakeWorkspaceVerifier();

            const staleWorkspace:
                WorkspaceSummary = {
                    type:
                        'ORGANIZATION',
                    organizational_assignment_id:
                        '018f3b6a-7c20-7def-8def-1234567890ab',
                    organization_id:
                        organizationId,
                    organization_unit_id:
                        null,
                    label:
                        'Stale Workspace',
                };

            persistBrowserWorkspaceRestorationHint(
                context,
                staleWorkspace,
            );

            const runtime =
                createWorkspaceContextRuntime(
                    createSuccessOperations(),
                    membership,
                    verifier,
                );

            const state =
                await runtime.bootstrap();

            expect(
                state.status,
            ).toBe(
                'ready',
            );

            if (
                state.status
                    !== 'ready'
            ) {
                throw new Error(
                    'Expected sole-Organization default READY state.',
                );
            }

            /*
             * The stale, no-longer-existing assignment is
             * discarded — but the fresh catalog's own sole
             * Organization is still the right default, not
             * TENANT.
             */
            expect(
                state.current,
            ).toEqual(
                organizationWorkspace,
            );

            expect(
                readRestorationHint(),
            ).toBeNull();

            expect(
                verifier.calls,
            ).toEqual([
                tenantWorkspace,
                organizationWorkspace,
            ]);

            runtime.dispose();
        });

        it('commits an explicit Workspace switch only after verifier success and persists its hint', async () => {
            /*
             * The multi-Organization fixture keeps bootstrap
             * itself on TENANT, isolating this test to the
             * explicit switchWorkspace call it actually means
             * to exercise.
             */
            const membership =
                new FakeMembershipRuntime(
                    readyMembershipState,
                );

            const verifier =
                new FakeWorkspaceVerifier();

            const runtime =
                createWorkspaceContextRuntime(
                    createSuccessOperations(
                        multiOrganizationDiscoveryResponse,
                    ),
                    membership,
                    verifier,
                );

            await runtime.bootstrap();

            const state =
                await runtime.switchWorkspace(
                    organizationWorkspace,
                );

            expect(
                state.status,
            ).toBe(
                'ready',
            );

            if (
                state.status
                    !== 'ready'
            ) {
                throw new Error(
                    'Expected switched Workspace READY state.',
                );
            }

            expect(
                state.current,
            ).toEqual(
                organizationWorkspace,
            );

            expect(
                readRestorationHint(),
            ).toEqual({
                version:
                    2,
                kind:
                    'organizational',
                membershipId,
                tenantId,
                organizationalAssignmentId:
                    organizationAssignmentId,
            });

            expect(
                verifier.calls,
            ).toEqual([
                tenantWorkspace,
                organizationWorkspace,
            ]);

            runtime.dispose();
        });

        it('keeps the previous Workspace when target verification fails', async () => {
            const membership =
                new FakeMembershipRuntime(
                    readyMembershipState,
                );

            const verifier =
                new FakeWorkspaceVerifier();

            const runtime =
                createWorkspaceContextRuntime(
                    createSuccessOperations(
                        multiOrganizationDiscoveryResponse,
                    ),
                    membership,
                    verifier,
                );

            await runtime.bootstrap();

            verifier.handler =
                async () =>
                    networkFailure;

            const state =
                await runtime.switchWorkspace(
                    organizationWorkspace,
                );

            expect(state).toEqual({
                status:
                    'ready',
                context,
                tenant:
                    multiOrganizationDiscoveryResponse
                        .data
                        .tenant,
                workspaces:
                    multiOrganizationDiscoveryResponse
                        .data
                        .workspaces,
                current:
                    tenantWorkspace,
                failure:
                    networkFailure,
            });

            expect(
                readRestorationHint(),
            ).toBeNull();

            runtime.dispose();
        });

        it('treats target verification cancellation as lifecycle-neutral and restores the stable Workspace', async () => {
            const membership =
                new FakeMembershipRuntime(
                    readyMembershipState,
                );

            const verifier =
                new FakeWorkspaceVerifier();

            const runtime =
                createWorkspaceContextRuntime(
                    createSuccessOperations(
                        multiOrganizationDiscoveryResponse,
                    ),
                    membership,
                    verifier,
                );

            await runtime.bootstrap();

            verifier.handler =
                async () =>
                    abortedFailure;

            const state =
                await runtime.switchWorkspace(
                    organizationWorkspace,
                );

            expect(
                state.status,
            ).toBe(
                'ready',
            );

            if (
                state.status
                    !== 'ready'
            ) {
                throw new Error(
                    'Expected stable Workspace after cancellation.',
                );
            }

            expect(
                state.current,
            ).toEqual(
                tenantWorkspace,
            );

            expect(
                state.failure,
            ).toBeNull();

            runtime.dispose();
        });

        it('invalidates Workspace truth and restoration when Membership context changes', async () => {
            const membership =
                new FakeMembershipRuntime(
                    readyMembershipState,
                );

            const verifier =
                new FakeWorkspaceVerifier();

            const runtime =
                createWorkspaceContextRuntime(
                    createSuccessOperations(),
                    membership,
                    verifier,
                );

            await runtime.bootstrap();

            await runtime.switchWorkspace(
                organizationWorkspace,
            );

            expect(
                readRestorationHint(),
            ).not.toBeNull();

            membership.setState({
                status:
                    'selection-required',
                memberships: [
                    {
                        ...membershipSummary,
                        membership_id:
                            otherMembershipId,
                    },
                ],
                failure:
                    null,
            });

            expect(
                runtime.getState(),
            ).toEqual({
                status:
                    'unresolved',
            });

            expect(
                readRestorationHint(),
            ).toBeNull();

            runtime.dispose();
        });

        it('ignores stale discovery completion after Membership invalidation', async () => {
            const deferred =
                createDeferred<
                    WorkspaceDiscoveryOperationResult
                >();

            const operations:
                WorkspaceContextOperations = {
                    discover() {
                        return deferred.promise;
                    },
                };

            const membership =
                new FakeMembershipRuntime(
                    readyMembershipState,
                );

            const verifier =
                new FakeWorkspaceVerifier();

            const runtime =
                createWorkspaceContextRuntime(
                    operations,
                    membership,
                    verifier,
                );

            const bootstrapPromise =
                runtime.bootstrap();

            expect(
                runtime.getState()
                    .status,
            ).toBe(
                'discovering',
            );

            membership.setState(
                unresolvedMembershipState,
            );

            expect(
                runtime.getState(),
            ).toEqual({
                status:
                    'unresolved',
            });

            deferred.resolve({
                ok:
                    true,
                status:
                    200,
                data:
                    discoveryResponse,
            });

            expect(
                await bootstrapPromise,
            ).toEqual({
                status:
                    'unresolved',
            });

            expect(
                verifier.calls,
            ).toHaveLength(0);

            runtime.dispose();
        });

        it('recovers stale organizational context by discarding restoration and returning to verified TENANT without re-restoring', async () => {
            const membership =
                new FakeMembershipRuntime(
                    readyMembershipState,
                );

            const verifier =
                new FakeWorkspaceVerifier();

            const runtime =
                createWorkspaceContextRuntime(
                    createSuccessOperations(),
                    membership,
                    verifier,
                );

            await runtime.bootstrap();

            await runtime.switchWorkspace(
                organizationWorkspace,
            );

            expect(
                readRestorationHint(),
            ).not.toBeNull();

            const state =
                await runtime
                    .recoverStaleWorkspace(
                        contextDeniedFailure,
                    );

            expect(
                state.status,
            ).toBe(
                'ready',
            );

            if (
                state.status
                    !== 'ready'
            ) {
                throw new Error(
                    'Expected recovered TENANT Workspace.',
                );
            }

            expect(
                state.current,
            ).toEqual(
                tenantWorkspace,
            );

            expect(
                readRestorationHint(),
            ).toBeNull();

            expect(
                verifier.calls,
            ).toEqual([
                tenantWorkspace,
                organizationWorkspace,
                tenantWorkspace,
            ]);

            runtime.dispose();
        });

        it('rejects stale recovery for failures other than ORGANIZATIONAL_CONTEXT_DENIED', async () => {
            const membership =
                new FakeMembershipRuntime(
                    readyMembershipState,
                );

            const verifier =
                new FakeWorkspaceVerifier();

            const runtime =
                createWorkspaceContextRuntime(
                    createSuccessOperations(),
                    membership,
                    verifier,
                );

            await runtime.bootstrap();

            await expect(
                runtime
                    .recoverStaleWorkspace(
                        networkFailure,
                    ),
            ).rejects.toThrow(
                'EduCore WorkspaceContext recovery requires ORGANIZATIONAL_CONTEXT_DENIED.',
            );

            expect(
                runtime.getState()
                    .status,
            ).toBe(
                'ready',
            );

            runtime.dispose();
        });

        it('rejects stale organizational recovery while already in TENANT scope', async () => {
            /*
             * Uses the TENANT-only fixture: with any
             * Organization present, bootstrap would now
             * auto-default away from TENANT (see the
             * sole-Organization default tests above), which
             * would defeat this test's "already in TENANT
             * scope" premise.
             */
            const membership =
                new FakeMembershipRuntime(
                    readyMembershipState,
                );

            const verifier =
                new FakeWorkspaceVerifier();

            const runtime =
                createWorkspaceContextRuntime(
                    createSuccessOperations(
                        tenantOnlyDiscoveryResponse,
                    ),
                    membership,
                    verifier,
                );

            await runtime.bootstrap();

            await expect(
                runtime
                    .recoverStaleWorkspace(
                        contextDeniedFailure,
                    ),
            ).rejects.toThrow(
                'EduCore WorkspaceContext stale recovery requires an active organizational Workspace.',
            );

            runtime.dispose();
        });

        it('discards a stored hint and still auto-defaults to the sole Organization when bootstrap disables restoration', async () => {
            const verifiedWorkspaceTypes:
                string[] = [];

            const membership = {
                getState() {
                    return readyMembershipState;
                },

                subscribe(
                    _listener:
                        () => void,
                ) {
                    return () => {
                        // Static Membership fixture has no updates.
                    };
                },
            };

            const verifier:
                WorkspaceContextVerifier = {
                    async verify(
                        _context,
                        workspace,
                    ) {
                        verifiedWorkspaceTypes.push(
                            workspace.type,
                        );

                        return {
                            ok:
                                true,
                        };
                    },
                };

            const persisted =
                persistBrowserWorkspaceRestorationHint(
                    context,
                    organizationWorkspace,
                );

            expect(
                persisted,
            ).toEqual({
                ok:
                    true,
            });

            expect(
                readRestorationHint(),
            ).not.toBeNull();

            const runtime =
                createWorkspaceContextRuntime(
                    createSuccessOperations(),
                    membership,
                    verifier,
                );

            const state =
                await runtime.bootstrap({
                    restoreHint:
                        false,
                });

            expect(
                state.status,
            ).toBe(
                'ready',
            );

            if (
                state.status
                    !== 'ready'
            ) {
                throw new Error(
                    'Expected fresh Workspace bootstrap to publish verified TENANT or the sole-Organization default.',
                );
            }

            /*
             * A fresh login (restoreHint: false) must discard
             * any stored hint from a previous session — but
             * the sole-Organization default is not a stored
             * preference, it is a property of the fresh
             * catalog itself, so it still applies here. This
             * is precisely the "default awal hanya 1
             * organisasi" case the feature targets: a brand
             * new login lands straight on the Tenant's one
             * Organization.
             */
            expect(
                state.current,
            ).toEqual(
                organizationWorkspace,
            );

            expect(
                verifiedWorkspaceTypes,
            ).toEqual([
                'TENANT',
                'ORGANIZATION',
            ]);

            /*
             * An auto-default is not an explicit choice and
             * must not be persisted as one — nor must the
             * discarded stored hint survive.
             */
            expect(
                readRestorationHint(),
            ).toBeNull();

            runtime.dispose();
        });

        it('discards a stored hint and remains on verified TENANT when bootstrap disables restoration and more than one Organization exists', async () => {
            const verifiedWorkspaceTypes:
                string[] = [];

            const membership = {
                getState() {
                    return readyMembershipState;
                },

                subscribe(
                    _listener:
                        () => void,
                ) {
                    return () => {
                        // Static Membership fixture has no updates.
                    };
                },
            };

            const verifier:
                WorkspaceContextVerifier = {
                    async verify(
                        _context,
                        workspace,
                    ) {
                        verifiedWorkspaceTypes.push(
                            workspace.type,
                        );

                        return {
                            ok:
                                true,
                        };
                    },
                };

            persistBrowserWorkspaceRestorationHint(
                context,
                organizationWorkspace,
            );

            expect(
                readRestorationHint(),
            ).not.toBeNull();

            const runtime =
                createWorkspaceContextRuntime(
                    createSuccessOperations(
                        multiOrganizationDiscoveryResponse,
                    ),
                    membership,
                    verifier,
                );

            const state =
                await runtime.bootstrap({
                    restoreHint:
                        false,
                });

            expect(
                state.status,
            ).toBe(
                'ready',
            );

            if (
                state.status
                    !== 'ready'
            ) {
                throw new Error(
                    'Expected fresh Workspace bootstrap to publish verified TENANT.',
                );
            }

            expect(
                state.current,
            ).toEqual(
                tenantWorkspace,
            );

            /*
             * Fresh bootstrap verifies only the safe TENANT
             * baseline. With more than one Organization there
             * is no sole-Organization default either, so the
             * stored organizational target must never
             * participate in this discovery cycle.
             */
            expect(
                verifiedWorkspaceTypes,
            ).toEqual([
                'TENANT',
            ]);

            expect(
                readRestorationHint(),
            ).toBeNull();

            runtime.dispose();
        });

        it('never re-selects the just-denied Organization when stale recovery runs against a sole-Organization catalog', async () => {
            /*
             * recoverStaleWorkspace also runs its discovery
             * cycle with restoreHint:false, but — unlike
             * bootstrap — it must NEVER apply the
             * sole-Organization default: that would
             * immediately re-select the very Organization
             * whose access backend just denied, defeating the
             * whole point of recovery.
             */
            const membership =
                new FakeMembershipRuntime(
                    readyMembershipState,
                );

            const verifier =
                new FakeWorkspaceVerifier();

            const runtime =
                createWorkspaceContextRuntime(
                    createSuccessOperations(),
                    membership,
                    verifier,
                );

            await runtime.bootstrap();

            const state =
                await runtime.recoverStaleWorkspace(
                    contextDeniedFailure,
                );

            expect(
                state.status,
            ).toBe(
                'ready',
            );

            if (
                state.status
                    !== 'ready'
            ) {
                throw new Error(
                    'Expected recovered TENANT Workspace.',
                );
            }

            expect(
                state.current,
            ).toEqual(
                tenantWorkspace,
            );

            runtime.dispose();
        });
    },


);
