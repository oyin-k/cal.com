import { useRouter } from "next/router";
import { useReducer, useState } from "react";
import z from "zod";

import { AppSettings } from "@calcom/app-store/_components/AppSettings";
import { InstallAppButton } from "@calcom/app-store/components";
import { EventLocationType, getEventLocationTypeFromApp } from "@calcom/app-store/locations";
import { InstalledAppVariants } from "@calcom/app-store/utils";
import { AppSetDefaultLinkDailog } from "@calcom/features/apps/components/AppSetDefaultLinkDialog";
import DisconnectIntegrationModal from "@calcom/features/apps/components/DisconnectIntegrationModal";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { RouterOutputs, trpc } from "@calcom/trpc/react";
import { App } from "@calcom/types/App";
import { AppGetServerSidePropsContext } from "@calcom/types/AppGetServerSideProps";
import {
  Alert,
  Button,
  EmptyScreen,
  List,
  AppSkeletonLoader as SkeletonLoader,
  ShellSubHeading,
  DropdownMenuTrigger,
  DropdownMenuContent,
  Dropdown,
  DropdownMenuItem,
  DropdownItem,
  showToast,
} from "@calcom/ui";
import {
  FiBarChart,
  FiCalendar,
  FiCreditCard,
  FiGrid,
  FiMoreHorizontal,
  FiPlus,
  FiShare2,
  FiTrash,
  FiVideo,
} from "@calcom/ui/components/icon";

import { QueryCell } from "@lib/QueryCell";

import AppListCard from "@components/AppListCard";
import { CalendarListContainer } from "@components/apps/CalendarListContainer";
import InstalledAppsLayout from "@components/apps/layouts/InstalledAppsLayout";

function ConnectOrDisconnectIntegrationMenuItem(props: {
  credentialIds: number[];
  type: App["type"];
  isGlobal?: boolean;
  installed?: boolean;
  invalidCredentialIds?: number[];
  handleDisconnect: (credentialId: number) => void;
}) {
  const { type, credentialIds, isGlobal, installed, handleDisconnect } = props;
  const { t } = useLocale();
  const [credentialId] = credentialIds;

  const utils = trpc.useContext();
  const handleOpenChange = () => {
    utils.viewer.integrations.invalidate();
  };

  if (credentialId || type === "stripe_payment" || isGlobal) {
    return (
      <DropdownMenuItem>
        <DropdownItem
          color="destructive"
          onClick={() => handleDisconnect(credentialId)}
          disabled={isGlobal}
          StartIcon={FiTrash}>
          {t("remove_app")}
        </DropdownItem>
      </DropdownMenuItem>
    );
  }

  if (!installed) {
    return (
      <div className="flex items-center truncate">
        <Alert severity="warning" title={t("not_installed")} />
      </div>
    );
  }

  return (
    <InstallAppButton
      type={type}
      render={(buttonProps) => (
        <Button color="secondary" {...buttonProps} data-testid="integration-connection-button">
          {t("install")}
        </Button>
      )}
      onChanged={handleOpenChange}
    />
  );
}

interface IntegrationsContainerProps {
  variant?: typeof InstalledAppVariants[number];
  exclude?: typeof InstalledAppVariants[number][];
  handleDisconnect: (credentialId: number) => void;
}

interface IntegrationsListProps {
  variant?: IntegrationsContainerProps["variant"];
  data: RouterOutputs["viewer"]["integrations"];
  handleDisconnect: (credentialId: number) => void;
}

const IntegrationsList = ({ data, handleDisconnect, variant }: IntegrationsListProps) => {
  const { data: defaultConferencingApp } = trpc.viewer.getUsersDefaultConferencingApp.useQuery();
  const utils = trpc.useContext();

  const [locationType, setLocationType] = useState<(EventLocationType & { slug: string }) | undefined>(
    undefined
  );

  const updateDefaultAppMutation = trpc.viewer.updateUserDefaultConferencingApp.useMutation({
    onSuccess: () => {
      showToast("Default app updated successfully", "success");
      utils.viewer.getUsersDefaultConferencingApp.invalidate();
    },
    onError: (error) => {
      showToast(`Error: ${error.message}`, "error");
    },
  });

  const { t } = useLocale();
  return (
    <>
      <List>
        {data.items
          .filter((item) => item.invalidCredentialIds)
          .map((item) => {
            const appSlug = item?.slug;
            const appIsDefault =
              appSlug === defaultConferencingApp?.appSlug ||
              (appSlug === "daily-video" && !defaultConferencingApp?.appSlug);
            return (
              <AppListCard
                key={item.name}
                description={item.description}
                title={item.name}
                logo={item.logo}
                isDefault={appIsDefault}
                shouldHighlight
                slug={item.slug}
                invalidCredential={item.invalidCredentialIds.length > 0}
                actions={
                  <div className="flex  justify-end">
                    <Dropdown modal={false}>
                      <DropdownMenuTrigger asChild>
                        <Button StartIcon={FiMoreHorizontal} variant="icon" color="secondary" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {!appIsDefault && variant === "conferencing" && (
                          <DropdownMenuItem>
                            <DropdownItem
                              type="button"
                              color="secondary"
                              StartIcon={FiVideo}
                              onClick={() => {
                                const locationType = getEventLocationTypeFromApp(
                                  item?.locationOption?.value ?? ""
                                );
                                if (locationType?.linkType === "static") {
                                  setLocationType({ ...locationType, slug: appSlug });
                                } else {
                                  updateDefaultAppMutation.mutate({
                                    appSlug,
                                  });
                                }
                              }}>
                              {t("change_default_conferencing_app")}
                            </DropdownItem>
                          </DropdownMenuItem>
                        )}
                        <ConnectOrDisconnectIntegrationMenuItem
                          credentialIds={item.credentialIds}
                          type={item.type}
                          isGlobal={item.isGlobal}
                          installed
                          invalidCredentialIds={item.invalidCredentialIds}
                          handleDisconnect={handleDisconnect}
                        />
                      </DropdownMenuContent>
                    </Dropdown>
                  </div>
                }>
                <AppSettings slug={item.slug} />
              </AppListCard>
            );
          })}
      </List>
      {locationType && (
        <AppSetDefaultLinkDailog
          locationType={locationType}
          setLocationType={() => setLocationType(undefined)}
        />
      )}
    </>
  );
};

const IntegrationsContainer = ({
  variant,
  exclude,
  handleDisconnect,
}: IntegrationsContainerProps): JSX.Element => {
  const { t } = useLocale();
  const query = trpc.viewer.integrations.useQuery({ variant, exclude, onlyInstalled: true });
  const emptyIcon = {
    calendar: FiCalendar,
    conferencing: FiVideo,
    automation: FiShare2,
    analytics: FiBarChart,
    payment: FiCreditCard,
    web3: FiBarChart,
    other: FiGrid,
  };

  return (
    <QueryCell
      query={query}
      customLoader={<SkeletonLoader />}
      success={({ data }) => {
        if (!data.items.length) {
          return (
            <EmptyScreen
              Icon={emptyIcon[variant || "other"]}
              headline={t("no_category_apps", {
                category: (variant && t(variant).toLowerCase()) || t("other").toLowerCase(),
              })}
              description={t(`no_category_apps_description_${variant || "other"}`)}
              buttonRaw={
                <Button
                  color="secondary"
                  data-testid={`connect-${variant || "other"}-apps`}
                  href={variant ? `/apps/categories/${variant}` : "/apps/categories/other"}>
                  {t(`connect_${variant || "other"}_apps`)}
                </Button>
              }
            />
          );
        }
        return (
          <>
            <ShellSubHeading
              title={t(variant || "other")}
              subtitle={t(`installed_app_${variant || "other"}_description`)}
              className="mb-6"
              actions={
                <Button
                  href={
                    variant ? `/apps/categories/${variant === "conferencing" ? "video" : variant}` : "/apps"
                  }
                  color="secondary"
                  StartIcon={FiPlus}>
                  {t("add")}
                </Button>
              }
            />
            <IntegrationsList handleDisconnect={handleDisconnect} data={data} variant={variant} />
          </>
        );
      }}
    />
  );
};

const querySchema = z.object({
  category: z.enum(InstalledAppVariants),
});

type querySchemaType = z.infer<typeof querySchema>;

type ModalState = {
  isOpen: boolean;
  credentialId: null | number;
};

export default function InstalledApps() {
  const { t } = useLocale();
  const router = useRouter();
  const category = router.query.category as querySchemaType["category"];
  const categoryList: querySchemaType["category"][] = [
    "payment",
    "conferencing",
    "automation",
    "analytics",
    "web3",
  ];

  const [data, updateData] = useReducer(
    (data: ModalState, partialData: Partial<ModalState>) => ({ ...data, ...partialData }),
    {
      isOpen: false,
      credentialId: null,
    }
  );

  const handleModelClose = () => {
    updateData({ isOpen: false, credentialId: null });
  };

  const handleDisconnect = (credentialId: number) => {
    updateData({ isOpen: true, credentialId });
  };

  return (
    <>
      <InstalledAppsLayout heading={t("installed_apps")} subtitle={t("manage_your_connected_apps")}>
        <div className="rounded-md border border-gray-200 p-7">
          {categoryList.includes(category) && (
            <IntegrationsContainer handleDisconnect={handleDisconnect} variant={category} />
          )}
          {category === "calendar" && <CalendarListContainer />}
          {category === "other" && (
            <IntegrationsContainer
              handleDisconnect={handleDisconnect}
              variant={category}
              exclude={[...categoryList, "calendar"]}
            />
          )}
        </div>
      </InstalledAppsLayout>
      <DisconnectIntegrationModal
        handleModelClose={handleModelClose}
        isOpen={data.isOpen}
        credentialId={data.credentialId}
      />
    </>
  );
}

// Server side rendering
export async function getServerSideProps(ctx: AppGetServerSidePropsContext) {
  // get return-to cookie and redirect if needed
  const { cookies } = ctx.req;
  if (cookies && cookies["return-to"]) {
    const returnTo = cookies["return-to"];
    if (returnTo) {
      ctx.res.setHeader("Set-Cookie", "return-to=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT");
      return {
        redirect: {
          destination: `${returnTo}`,
          permanent: false,
        },
      };
    }
  }
  const params = querySchema.safeParse(ctx.params);

  if (!params.success) return { notFound: true };

  return {
    props: {
      category: params.data.category,
    },
  };
}
