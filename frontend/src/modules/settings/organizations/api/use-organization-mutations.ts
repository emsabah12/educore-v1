import {
    useMutation,
    useQueryClient,
    type UseMutationResult,
} from '@tanstack/react-query';

import {
    useApiClient,
} from '@/app/api/ApiClientProvider';
import {
    useWorkspaceContextState,
} from '@/app/workspace/WorkspaceContextProvider';
import type {
    ApiComponents,
} from '@/platform/api';
import {
    executeBrowserApiRequest,
    type BrowserApiFailure,
} from '@/platform/api';
import {
    createBrowserMembershipHeaderParams,
} from '@/platform/api/request-context';
import {
    organizationsQueryKey,
    type OrganizationResource,
} from '@/modules/settings/organizations/api/use-organizations-query';

export type StoreOrganizationInput =
    ApiComponents['schemas']['StoreOrganizationRequest'];

export type UpdateOrganizationInput =
    ApiComponents['schemas']['UpdateOrganizationRequest'];

export interface UpdateOrganizationVariables {
    organizationId: string;
    input: UpdateOrganizationInput;
}

function useMembershipId(): string | null {
    const workspaceState =
        useWorkspaceContextState();

    return workspaceState.status === 'ready'
        ? workspaceState.context.membership.id
        : null;
}

export function useCreateOrganizationMutation(): UseMutationResult<
    OrganizationResource,
    BrowserApiFailure,
    StoreOrganizationInput
> {
    const apiClient =
        useApiClient();

    const membershipId =
        useMembershipId();

    const queryClient =
        useQueryClient();

    return useMutation<
        OrganizationResource,
        BrowserApiFailure,
        StoreOrganizationInput
    >({
        mutationFn: async (
            input,
        ) => {
            if (membershipId === null) {
                throw new Error(
                    'useCreateOrganizationMutation executed without a ready Membership context.',
                );
            }

            const result =
                await executeBrowserApiRequest(
                    apiClient.POST(
                        '/api/v1/core/organizations',
                        {
                            params: {
                                header:
                                    createBrowserMembershipHeaderParams(
                                        {
                                            membershipId,
                                        },
                                    ),
                            },

                            body:
                                input,
                        },
                    ),
                );

            if (! result.ok) {
                throw result;
            }

            if (result.data === undefined) {
                throw new Error(
                    'Create organization response was empty.',
                );
            }

            return result.data.data;
        },

        onSuccess: () => {
            void queryClient.invalidateQueries(
                {
                    queryKey:
                        organizationsQueryKey,
                },
            );
        },
    });
}

export function useUpdateOrganizationMutation(): UseMutationResult<
    OrganizationResource,
    BrowserApiFailure,
    UpdateOrganizationVariables
> {
    const apiClient =
        useApiClient();

    const membershipId =
        useMembershipId();

    const queryClient =
        useQueryClient();

    return useMutation<
        OrganizationResource,
        BrowserApiFailure,
        UpdateOrganizationVariables
    >({
        mutationFn: async (
            {
                organizationId,
                input,
            },
        ) => {
            if (membershipId === null) {
                throw new Error(
                    'useUpdateOrganizationMutation executed without a ready Membership context.',
                );
            }

            const result =
                await executeBrowserApiRequest(
                    apiClient.PUT(
                        '/api/v1/core/organizations/{organization}',
                        {
                            params: {
                                header:
                                    createBrowserMembershipHeaderParams(
                                        {
                                            membershipId,
                                        },
                                    ),

                                path: {
                                    organization:
                                        organizationId,
                                },
                            },

                            body:
                                input,
                        },
                    ),
                );

            if (! result.ok) {
                throw result;
            }

            if (result.data === undefined) {
                throw new Error(
                    'Update organization response was empty.',
                );
            }

            return result.data.data;
        },

        onSuccess: () => {
            void queryClient.invalidateQueries(
                {
                    queryKey:
                        organizationsQueryKey,
                },
            );
        },
    });
}
